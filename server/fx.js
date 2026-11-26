// Kurzy ČNB (veřejný denní kurzovní lístek, zdarma). Kč za 1 jednotku měny.
const CNB = 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';

/** Rozparsuje kurzovní lístek ČNB („země|měna|množství|kód|kurz“, desetinná čárka). */
export function parseCnb(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/).slice(2)) {
    const p = line.split('|');
    if (p.length !== 5) continue;
    const qty = Number(p[2]); const rate = Number(p[4].replace(',', '.'));
    if (/^[A-Z]{3}$/.test(p[3]) && qty > 0 && rate > 0) out[p[3]] = rate / qty;
  }
  return out;
}

/** Kurz pro den (u víkendu/svátku ČNB vrací poslední platný). Při výpadku vrátí null – částku pak doplní majitel. */
export async function cnbRate(env, code, day) {
  const c = String(code || '').toUpperCase();
  if (!c || c === 'CZK') return 1;
  if (!/^[A-Z]{3}$/.test(c)) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day || '') ? day : new Date().toISOString().slice(0, 10);
  const hit = await env.DB.prepare('SELECT rate FROM fx_rates WHERE day = ? AND code = ?').bind(d, c).first().catch(() => null);
  if (hit) return hit.rate;
  try {
    const [y, m, dd] = d.split('-');
    const res = await fetch(`${CNB}?date=${dd}.${m}.${y}`, { headers: { Accept: 'text/plain' } });
    if (!res.ok) return null;
    const rates = parseCnb(await res.text());
    const stmts = Object.entries(rates).map(([k, v]) => env.DB.prepare('INSERT OR REPLACE INTO fx_rates (day, code, rate) VALUES (?, ?, ?)').bind(d, k, v));
    if (stmts.length) await env.DB.batch(stmts);
    return rates[c] ?? null;
  } catch { return null; }
}

/** Přepočet na celé Kč. */
export const toCzk = (amount, rate) => (amount == null || rate == null ? null : Math.round(Number(amount) * Number(rate)));
