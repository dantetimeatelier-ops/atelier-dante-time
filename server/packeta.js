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

// Společné volání API; vrací XML odpovědi nebo vyhodí srozumitelnou chybu
async function call(env, method, inner, fetcher = fetch) {
  const password = String(env.PACKETA_API_PASSWORD || '').trim();
  if (!password) throw new HttpError('Chybí API heslo Zásilkovny (PACKETA_API_PASSWORD)', 503);
  const res = await fetcher(API, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: `<${method}><apiPassword>${xmlEsc(password)}</apiPassword>${inner}</${method}>` });
  const xml = await res.text();
  if (!res.ok || tag(xml, 'status') !== 'ok') {
    const fault = tag(xml, 'fault');
    const detail = [...String(xml).matchAll(/<attributeFault>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<fault>([\s\S]*?)<\/fault>[\s\S]*?<\/attributeFault>/g)].map((m) => `${m[1]}: ${m[2]}`).join('; ');
    const known = { IncorrectApiPasswordFault: 'neplatné API heslo', PacketIdFault: 'zásilka nenalezena', PacketAttributesFault: 'neplatné údaje zásilky' };
    throw new HttpError(`Zásilkovna: ${known[fault] || tag(xml, 'string') || fault || `chyba ${res.status}`}${detail ? ` (${detail})` : ''}`, 502);
  }
  return xml;
}

// Expedice: založí zásilku na výdejní místo zákazníka (majitel klepne na tlačítko, nic automaticky)
export async function createPacket(env, order, { weightKg = 0.5, fetcher } = {}) {
  if (order.shipping_method !== 'zasilkovna') throw new HttpError('Objednávka nemá dopravu Zásilkovnou');
  if (order.tracking_number) throw new HttpError('Zásilka už je založená (číslo zásilky je vyplněné)');
  const point = String(order.pickup_point_id || '').replace(/\D/g, '');
  if (!point) throw new HttpError('Objednávka nemá vybrané výdejní místo Zásilkovny');
  const w = Math.min(30, Math.max(0.05, Number(String(weightKg).replace(',', '.')) || 0.5));
  const [first, ...rest] = String(order.name || '').trim().split(/\s+/);
  const attrs = {
    number: order.number, name: first || order.name, surname: rest.join(' ') || first || order.name,
    email: order.email, phone: order.phone || '', addressId: point,
    cod: order.payment_method === 'cod' ? Math.round(order.total) : null,
    value: Math.round(order.total), currency: 'CZK', weight: w.toFixed(2),
    eshop: env.PACKETA_SENDER || null, // označení odesílatele z klientské sekce (jen když je nastavené)
  };
  const inner = `<packetAttributes>${Object.entries(attrs).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `<${k}>${xmlEsc(v)}</${k}>`).join('')}</packetAttributes>`;
  const xml = await call(env, 'createPacket', inner, fetcher);
  const id = tag(xml, 'id');
  const text = tag(xml, 'barcodeText') || (id ? `Z ${id.slice(0, 3)} ${id.slice(3, 7)} ${id.slice(7)}` : null);
  if (!id) throw new HttpError('Zásilkovna nevrátila číslo zásilky', 502);
  await env.DB.prepare('UPDATE orders SET tracking_number = ?, tracking_code = 1, tracking_status = ?, tracking_checked_at = ? WHERE id = ?')
    .bind(text, STATUS[1], new Date().toISOString(), order.id).run();
  return { id, tracking: text };
}

// Štítek k vytištění (PDF, formát A6 – pro tiskárnu štítků i běžný papír)
export async function labelPdf(env, tracking, { format = 'A6 on A4', fetcher } = {}) {
  const id = packetId(tracking);
  if (!id) throw new HttpError('Číslo zásilky není ve tvaru Zásilkovny');
  const xml = await call(env, 'packetLabelPdf', `<packetId>${id}</packetId><format>${xmlEsc(format)}</format><offset>0</offset>`, fetcher);
  const b64 = (tag(xml, 'result') || '').replace(/\s+/g, '');
  if (!b64) throw new HttpError('Zásilkovna nevrátila štítek', 502);
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function packetStatus(env, tracking, { fetcher = fetch } = {}) {
  const id = packetId(tracking);
  if (!String(env.PACKETA_API_PASSWORD || '').trim()) throw new HttpError('Chybí API heslo Zásilkovny (PACKETA_API_PASSWORD)', 503);
  if (!id) throw new HttpError('Číslo zásilky není ve tvaru Zásilkovny (Z + 10 číslic)');
  const xml = await call(env, 'packetStatus', `<packetId>${id}</packetId>`, fetcher);
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
