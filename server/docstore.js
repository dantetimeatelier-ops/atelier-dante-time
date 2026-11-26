// Uložení souborů dokladů v D1 (EU). Nové doklady jako text base64 po částech (enc = 'b64'):
// převod dělá prostředí Cloudflare nativně, bez zátěže procesoru. Starší doklady jsou BLOB (enc = NULL).
export const DOC_MAX = 10_000_000;      // 10 MB na doklad
const CHUNK = 1_500_000;                 // znaků na část (limit řádku D1 je 2 MB)
const EMPTY = new Uint8Array(0);

const loopB64 = (bytes) => {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
};
/** Bajty → base64 (nativně, je-li k dispozici). */
export const toB64 = (bytes) => (typeof bytes.toBase64 === 'function' ? bytes.toBase64() : loopB64(bytes));
/** base64 → bajty (nativně, je-li k dispozici). */
export const fromB64 = (s) => (typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(s) : Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
/** Délka uloženého textu pro soubor dané velikosti. */
export const b64Len = (size) => 4 * Math.ceil(size / 3);

/** Hodnoty pro documents.data / enc a příkazy pro uložení částí (spustit po vložení dokladu). */
export function splitDoc(env, id, buf) {
  const text = toB64(buf);
  const stmts = [];
  for (let i = 0, n = 0; i < text.length; i += CHUNK, n++) stmts.push(env.DB.prepare('INSERT OR REPLACE INTO document_chunks (document_id, idx, data) VALUES (?, ?, ?)').bind(id, n, text.slice(i, i + CHUNK)));
  return { data: EMPTY, enc: 'b64', stmts };
}

/** Uložený doklad jako base64 (nové bez převodu, starší BLOB se převede). d = { id, enc } */
export async function docB64(env, d) {
  if (d.enc === 'b64') {
    const { results } = await env.DB.prepare('SELECT data FROM document_chunks WHERE document_id = ? ORDER BY idx').bind(d.id).all();
    return results.map((r) => r.data).join('');
  }
  return toB64(await legacyBytes(env, d));
}

/** Bajty dokladu. d = { id, enc } */
export async function docBytes(env, d) {
  if (d.enc === 'b64') return fromB64(await docB64(env, d));
  return legacyBytes(env, d);
}

async function legacyBytes(env, d) {
  const row = d.data !== undefined ? d : await env.DB.prepare('SELECT data FROM documents WHERE id = ?').bind(d.id).first();
  const own = row?.data ? new Uint8Array(row.data) : EMPTY;
  if (own.length) return own;
  const { results } = await env.DB.prepare('SELECT data FROM document_chunks WHERE document_id = ? ORDER BY idx').bind(d.id).all();
  const parts = results.map((r) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Je soubor uložen celý? (bez načítání obsahu) */
export async function docComplete(env, id) {
  const r = await env.DB.prepare('SELECT size, enc, COALESCE(length(data), 0) AS own, (SELECT COALESCE(SUM(length(data)), 0) FROM document_chunks WHERE document_id = documents.id) AS parts FROM documents WHERE id = ?').bind(id).first();
  if (!r) return false;
  return r.enc === 'b64' ? r.parts === b64Len(r.size) : r.own + r.parts === r.size;
}

export const removeChunks = (env, id) => env.DB.prepare('DELETE FROM document_chunks WHERE document_id = ?').bind(id).run();

/** Druh souboru podle prvních bajtů (nevěří příponě ani údaji prohlížeče). */
export const sniff = (b) => {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  return null;
};
