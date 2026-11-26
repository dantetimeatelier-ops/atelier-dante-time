// Uložení souborů dokladů v D1 (EU). Velké soubory po částech – limit řádku D1 je 2 MB.
export const DOC_MAX = 10_000_000;      // 10 MB na doklad
const CHUNK = 1_500_000;
const EMPTY = new Uint8Array(0);

/** Hodnota pro sloupec documents.data a příkazy pro uložení částí (spustit po vložení dokladu). */
export function splitDoc(env, id, buf) {
  if (buf.length <= CHUNK) return { data: buf, stmts: [] };
  const stmts = [];
  for (let i = 0, n = 0; i < buf.length; i += CHUNK, n++) stmts.push(env.DB.prepare('INSERT OR REPLACE INTO document_chunks (document_id, idx, data) VALUES (?, ?, ?)').bind(id, n, buf.subarray(i, i + CHUNK)));
  return { data: EMPTY, stmts };
}

/** Bajty dokladu (složí části, je-li soubor uložen po částech). */
export async function docBytes(env, d) {
  const own = d.data ? new Uint8Array(d.data) : EMPTY;
  if (own.length) return own;
  const { results } = await env.DB.prepare('SELECT data FROM document_chunks WHERE document_id = ? ORDER BY idx').bind(d.id).all();
  const parts = results.map((r) => new Uint8Array(r.data));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const removeChunks = (env, id) => env.DB.prepare('DELETE FROM document_chunks WHERE document_id = ?').bind(id).run();
