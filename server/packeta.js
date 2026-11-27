// DT Logistics: stav zásilek Zásilkovny přes jejich REST/XML API (metoda packetStatus).
// Potřebuje tajný klíč PACKETA_API_PASSWORD (API heslo z klientské sekce) – nikdy nejde do prohlížeče.
import { HttpError } from './http.js';

const API = 'https://www.zasilkovna.cz/api/rest';

// Kódy stavů Zásilkovny → český text pro administraci
export const STATUS = {
  1: 'Zásilkovna přijala data', 2: 'Zásilka podána', 3: 'Připravena k odeslání', 4: 'Na cestě',
  5: 'Připravena k vyzvednutí', 6: 'Předána dopravci', 7: 'Doručeno – vyzvednuto', 9: 'Vrací se odesílateli',
  10: 'Vráceno odesílateli', 11: 'Zrušena', 12: 'Vyzvednuta odesílatelem', 14: 'Celní řízení', 999: 'Neznámý stav',
};
export const DELIVERED = 7;
export const PROBLEM = new Set([9, 10, 11, 12]);

// „Z 123 4567 890“, „Z1234567890“ i „1234567890“ → 1234567890
export function packetId(tracking) {
  const m = String(tracking || '').toUpperCase().replace(/\s+/g, '').match(/^Z?(\d{10})$/);
  return m ? m[1] : null;
}

const tag = (xml, name) => {
  const m = String(xml).match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim() : null;
};
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function packetStatus(env, tracking, { fetcher = fetch } = {}) {
  const password = String(env.PACKETA_API_PASSWORD || '').trim();
  if (!password) throw new HttpError('Chybí API heslo Zásilkovny (PACKETA_API_PASSWORD)', 503);
  const id = packetId(tracking);
  if (!id) throw new HttpError('Číslo zásilky není ve tvaru Zásilkovny (Z + 10 číslic)');
  const res = await fetcher(API, {
    method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body: `<packetStatus><apiPassword>${xmlEsc(password)}</apiPassword><packetId>${id}</packetId></packetStatus>`,
  });
  const xml = await res.text();
  if (!res.ok || tag(xml, 'status') !== 'ok') {
    const fault = tag(xml, 'fault'); const msg = tag(xml, 'string');
    throw new HttpError(`Zásilkovna: ${fault === 'IncorrectApiPasswordFault' ? 'neplatné API heslo' : fault === 'PacketIdFault' ? 'zásilka nenalezena' : msg || fault || `chyba ${res.status}`}`, 502);
  }
  const code = Number(tag(xml, 'statusCode'));
  const raw = tag(xml, 'dateTime');
  const at = raw && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) ? raw.replace(' ', 'T') : null; // Safari neumí datum s mezerou
  return { code, text: STATUS[code] || tag(xml, 'statusText') || tag(xml, 'codeText') || `Stav ${code}`, at };
}

// Zjistí stav jedné objednávky a uloží ho
export async function refreshOrder(env, order, deps) {
  const s = await packetStatus(env, order.tracking_number, deps);
  await env.DB.prepare('UPDATE orders SET tracking_code = ?, tracking_status = ?, tracking_at = ?, tracking_checked_at = ? WHERE id = ?')
    .bind(s.code, s.text, s.at, new Date().toISOString(), order.id).run();
  return s;
}

// Denní běh DT Logistics: odeslané zásilky Zásilkovny, které ještě nejsou doručené ani vrácené
export async function refreshAll(env, deps) {
  if (!env.PACKETA_API_PASSWORD) return null;
  const { results } = await env.DB.prepare("SELECT id, number, tracking_number, tracking_code FROM orders WHERE status = 'shipped' AND shipping_method = 'zasilkovna' AND tracking_number IS NOT NULL AND tracking_number != '' AND (tracking_code IS NULL OR tracking_code NOT IN (7, 10, 11, 12)) ORDER BY shipped_at LIMIT 40").all();
  const out = { checked: 0, delivered: [], problems: [], errors: 0 };
  for (const o of results) {
    try {
      const s = await refreshOrder(env, o, deps); out.checked++;
      if (s.code === DELIVERED) out.delivered.push(o.number);
      if (PROBLEM.has(s.code)) out.problems.push(`${o.number}: ${s.text}`);
    } catch { out.errors++; }
  }
  return out;
}
