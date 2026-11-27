// Dante Time OS – etapa E3b: doklady k nákladům (bez AI). Soubory jen pro přihlášenou administraci.
import { HttpError, SECURITY_HEADERS } from './http.js';
import { randomId, audit } from './db.js';
import { str, oneOf } from './validate.js';
import { DOC_MAX, splitDoc, docBytes, removeChunks } from './docstore.js';

export const DOC_KINDS = { uctenka: 'Účtenka', faktura: 'Faktura od dodavatele', smlouva: 'Kupní smlouva', jiny: 'Jiný doklad' };
const MAX = DOC_MAX;
const sniff = (b) => {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  return null;
};
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function upload(env, form, actor) {
  const f = form.get('file');
  if (!f || typeof f === 'string') throw new HttpError('Vyberte soubor dokladu');
  if (f.size > MAX) throw new HttpError('Soubor je větší než 10 MB – vyfoťte doklad znovu nebo zmenšete PDF');
  const buf = new Uint8Array(await f.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new HttpError('Podporované jsou fotky (JPEG, WebP, PNG) a PDF');
  const hash = hex(await crypto.subtle.digest('SHA-256', buf));
  const dup = await env.DB.prepare('SELECT id, cost_id FROM documents WHERE sha256 = ?').bind(hash).first();
  if (dup) throw new HttpError('Tento doklad už je nahraný', 409, { id: dup.id, cost_id: dup.cost_id });
  const costId = form.get('cost_id') ? str(form.get('cost_id'), { max: 40 }) : null;
  if (costId && !(await env.DB.prepare('SELECT id FROM costs WHERE id = ?').bind(costId).first())) throw new HttpError('Náklad nenalezen', 404);
  const id = randomId();
  const store = splitDoc(env, id, buf);
  await env.DB.prepare('INSERT INTO documents (id, cost_id, kind, filename, mime, size, sha256, data, enc, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, costId, oneOf(form.get('kind') || 'uctenka', Object.keys(DOC_KINDS), 'druh dokladu'), str(f.name, { max: 200 }), mime, buf.length, hash, store.data, store.enc, str(form.get('note'), { max: 500 }), actor).run();
  for (const st of store.stmts) await st.run();
  await audit(env, actor, 'doklad_nahran', 'document', id, { cost: costId, size: buf.length });
  if (costId) await audit(env, actor, 'priloha_pridana', 'cost', costId, { soubor: f.name || null, document: id });
  return id;
}

export async function list(env, { unassigned = false } = {}) {
  // Bez nákladu = doklad nákupu, který zatím nepatří k žádnému výdaji ani prodeji
  const { results } = await env.DB.prepare(`SELECT d.id, d.cost_id, d.kind, d.filename, d.mime, d.size, d.note, d.created_at, c.description AS cost_description, c.amount_czk, c.cost_date
    FROM documents d LEFT JOIN costs c ON c.id = d.cost_id ${unassigned ? "WHERE d.cost_id IS NULL AND d.sale_id IS NULL AND COALESCE(d.purpose, 'nakup') = 'nakup'" : ''} ORDER BY d.created_at DESC LIMIT 300`).all();
  return results;
}

export async function assign(env, id, costId, actor) {
  const d = await env.DB.prepare('SELECT id, cost_id, filename FROM documents WHERE id = ?').bind(id).first();
  if (!d) throw new HttpError('Doklad nenalezen', 404);
  if (costId && !(await env.DB.prepare('SELECT id FROM costs WHERE id = ?').bind(costId).first())) throw new HttpError('Náklad nenalezen', 404);
  await env.DB.prepare('UPDATE documents SET cost_id = ? WHERE id = ?').bind(costId || null, id).run();
  await audit(env, actor, 'doklad_prirazen', 'document', id, { cost: costId });
  if (d.cost_id && d.cost_id !== costId) await audit(env, actor, 'priloha_odebrana', 'cost', d.cost_id, { soubor: d.filename, document: id });
  if (costId && d.cost_id !== costId) await audit(env, actor, 'priloha_pridana', 'cost', costId, { soubor: d.filename, document: id });
}

/** Úprava popisu přílohy (druh dokladu, poznámka). */
export async function update(env, id, b, actor) {
  const d = {};
  if ('kind' in b) d.kind = oneOf(b.kind, Object.keys(DOC_KINDS), 'druh dokladu');
  if ('note' in b) d.note = str(b.note, { max: 500 }) || null;
  const k = Object.keys(d);
  if (!k.length) return;
  const r = await env.DB.prepare(`UPDATE documents SET ${k.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`).bind(...k.map((x) => d[x]), id).run();
  if (r?.meta && !r.meta.changes) throw new HttpError('Doklad nenalezen', 404);
  await audit(env, actor, 'doklad_upraven', 'document', id, d);
}

/** Soubor dokladu: inline (zobrazit) nebo jako stažení původního souboru. Náhled (miniatura) se do historie nezapisuje. */
export async function file(env, id, actor, { download = false, preview = false } = {}) {
  const d = await env.DB.prepare('SELECT id, mime, filename, enc FROM documents WHERE id = ?').bind(id).first();
  if (!d) throw new HttpError('Doklad nenalezen', 404);
  if (!preview) await audit(env, actor, download ? 'doklad_stazen' : 'doklad_zobrazen', 'document', id);
  const ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[d.mime] || '';
  let name = (d.filename || `doklad-${id}`).replace(/[^\w.-]+/g, '_');
  if (ext && !name.toLowerCase().endsWith(ext) && !(ext === '.jpg' && /\.jpe?g$/i.test(name))) name += ext;
  return new Response(await docBytes(env, d), { headers: { ...SECURITY_HEADERS, 'Content-Type': d.mime, 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
}

export async function remove(env, id, actor) {
  const d = await env.DB.prepare('SELECT cost_id, filename FROM documents WHERE id = ?').bind(id).first();
  if (!d) throw new HttpError('Doklad nenalezen', 404);
  await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id).run();
  await removeChunks(env, id);
  await audit(env, actor, 'doklad_smazan', 'document', id);
  if (d.cost_id) await audit(env, actor, 'priloha_smazana', 'cost', d.cost_id, { soubor: d.filename, document: id });
}
