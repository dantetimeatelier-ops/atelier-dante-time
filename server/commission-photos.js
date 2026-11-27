// Fotografie k zakázkám a poptávkám (soukromé – vydává je jen administrace po přihlášení).
// Telefon (administrace i formulář na webu) fotky předem zmenší a odstraní metadata (GPS).
import { media } from './media.js';
import { randomId } from './db.js';
import { HttpError } from './http.js';

export const MAX_PER_COMMISSION = 40;
export const MAX_PER_INQUIRY = 5;
/** Fáze práce, ke které fotka patří (průběžná dokumentace renovace). */
export const PHASES = { pred: 'Před', behem: 'Během', po: 'Po' };
const phaseOf = (v) => (v && PHASES[v] ? v : null);

const isWebp = (b) => b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

async function readImage(file, max) {
  if (!file || typeof file === 'string' || file.size > max) throw new HttpError('Neplatná nebo příliš velká fotografie');
  const buf = new Uint8Array(await file.arrayBuffer());
  const ext = isWebp(buf) ? 'webp' : isJpeg(buf) ? 'jpg' : null;
  if (!ext) throw new HttpError('Podporované formáty fotografií jsou JPEG a WebP');
  return { buf, ext };
}

// Uloží jednu fotografii. `large` je povinná, `small` (náhled) volitelná – bez ní se jako náhled použije velká.
export async function save(env, { commissionId = null, inquiryId = null, source, large, small, width, height, phase = null }) {
  const id = randomId(10);
  const L = await readImage(large, 4e6);
  const S = small ? await readImage(small, 1e6) : null;
  const dir = commissionId ? `private/commissions/${commissionId}` : `private/inquiries/${inquiryId}`;
  const keyLarge = `${dir}/${id}-l.${L.ext}`;
  const keySmall = S ? `${dir}/${id}-s.${S.ext}` : keyLarge;
  await media(env).put(keyLarge, L.buf, L.ext === 'webp' ? 'image/webp' : 'image/jpeg');
  if (S) await media(env).put(keySmall, S.buf, S.ext === 'webp' ? 'image/webp' : 'image/jpeg');
  const w = Number.isFinite(+width) ? Math.min(10000, Math.max(0, Math.round(+width))) : null;
  const h = Number.isFinite(+height) ? Math.min(10000, Math.max(0, Math.round(+height))) : null;
  await env.DB.prepare('INSERT INTO commission_photos (id, commission_id, inquiry_id, source, key_large, key_small, width, height, phase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, commissionId, inquiryId, source, keyLarge, keySmall, w, h, phaseOf(phase)).run();
  return id;
}

// Fotky zakázky: vlastní + ty, které zákazník přiložil k poptávce, ze které zakázka vznikla
export async function forCommission(env, commissionId) {
  const k = await env.DB.prepare('SELECT inquiry_id, main_photo_id FROM commissions WHERE id = ?').bind(commissionId).first();
  if (!k) throw new HttpError('Zakázka nenalezena', 404);
  const { results } = await env.DB.prepare('SELECT id, source, width, height, phase, created_at FROM commission_photos WHERE commission_id = ? OR (? IS NOT NULL AND inquiry_id = ?) ORDER BY created_at')
    .bind(commissionId, k.inquiry_id, k.inquiry_id).all();
  for (const p of results) p.main = p.id === k.main_photo_id ? 1 : 0;
  return results;
}

export async function setPhase(env, id, phase) {
  const r = await env.DB.prepare('UPDATE commission_photos SET phase = ? WHERE id = ?').bind(phaseOf(phase), id).run();
  if (r?.meta && !r.meta.changes) throw new HttpError('Fotografie nenalezena', 404);
}

/** Hlavní fotka zakázky (miniatura v přehledu). Musí patřit k zakázce nebo k její poptávce. */
export async function setMain(env, commissionId, photoId) {
  if (photoId) {
    const ok = (await forCommission(env, commissionId)).some((p) => p.id === photoId);
    if (!ok) throw new HttpError('Fotografie k této zakázce nepatří', 404);
  }
  await env.DB.prepare('UPDATE commissions SET main_photo_id = ? WHERE id = ?').bind(photoId || null, commissionId).run();
}

// Po vytvoření zakázky z poptávky k ní připoj fotky zákazníka
export const linkInquiry = (env, inquiryId, commissionId) => inquiryId
  ? env.DB.prepare('UPDATE commission_photos SET commission_id = ? WHERE inquiry_id = ? AND commission_id IS NULL').bind(commissionId, inquiryId).run()
  : null;

export async function file(env, id, size) {
  const p = await env.DB.prepare('SELECT key_large, key_small FROM commission_photos WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError('Fotografie nenalezena', 404);
  const key = size === 's' ? p.key_small : p.key_large;
  const obj = await media(env).get(key);
  if (!obj) throw new HttpError('Fotografie nenalezena', 404);
  return new Response(obj.body, { headers: {
    'Content-Type': obj.type || (key.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
    'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff',
  } });
}

async function removeRows(env, rows) {
  for (const p of rows) await media(env).delete([...new Set([p.key_large, p.key_small])]);
  if (rows.length) await env.DB.batch(rows.map((p) => env.DB.prepare('DELETE FROM commission_photos WHERE id = ?').bind(p.id)));
}

export async function remove(env, id) {
  const p = await env.DB.prepare('SELECT id, commission_id, inquiry_id, key_large, key_small FROM commission_photos WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError('Fotografie nenalezena', 404);
  await removeRows(env, [p]);
  await env.DB.prepare('UPDATE commissions SET main_photo_id = NULL WHERE main_photo_id = ?').bind(id).run();
  return p;
}

// Doba uložení: fotky poptávek, ze kterých nevznikla zakázka, mizí spolu s poptávkou (po roce)
export async function purgeOrphans(env, olderThan) {
  const { results } = await env.DB.prepare('SELECT id, key_large, key_small FROM commission_photos WHERE commission_id IS NULL AND created_at < ? AND (inquiry_id IS NULL OR inquiry_id NOT IN (SELECT id FROM inquiries)) LIMIT 50')
    .bind(olderThan).all();
  await removeRows(env, results);
}
