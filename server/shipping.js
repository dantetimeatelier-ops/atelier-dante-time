// Dopravci: nastavení z administrace (tabulka shipping_methods) a výpočet nabídky pro pokladnu.
// Zákazník vidí jen způsoby se stavem „aktivni“, které doručují do zvolené země, pokryjí celou hodnotu
// objednávky a nevylučují materiál pouzdra hodinek (např. zlato). Vše ostatní se řeší tady, na pozadí.
import { HttpError } from './http.js';
import { str, int, oneOf } from './validate.js';
import { now, audit } from './db.js';
import { EU_COUNTRIES } from '../src/shop/eu.mjs';

export const STATUSES = ['aktivni', 'pripraveno', 'vypnuto'];
export const KINDS = ['vydejni_misto', 'adresa', 'osobni'];
export const PROVIDERS = { packeta: 'Zásilkovna / Packeta', balikovna: 'Balíkovna', ceska_posta: 'Česká pošta', ppl: 'PPL', osobni: 'Osobní předání', jiny: 'Jiný dopravce' };
export const METALS_EXCLUDABLE = ['zlato', 'stribro', 'platina'];
export const LABEL_APIS = ['packeta']; // štítek přes API zdarma
export const TRACKING = ['packeta', 'cpost', 'ppl'];

const parse = (v) => { try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } };
const n = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

export function rowToMethod(r) {
  return {
    ...r,
    prices: parse(r.prices_json),
    costs: parse(r.cost_json),
    excluded: String(r.excluded_metals || '').split(',').map((x) => x.trim()).filter(Boolean),
    cod_enabled: Number(r.cod_enabled) === 1,
  };
}

export async function loadMethods(env) {
  const { results } = await env.DB.prepare('SELECT * FROM shipping_methods ORDER BY sort_order, id').all().catch(() => ({ results: [] }));
  return results.map(rowToMethod);
}

/** Cena za zemi: konkrétní země, jinak „*“ (všude). null = do země nedoručuje. */
const countryValue = (map, cc) => n(map[cc] ?? map['*']);

/** Počet započatých kroků hodnoty nad částkou v ceně (např. každých 10 000 Kč nad 30 000 Kč). */
export function valueSteps(m, value) {
  const step = Number(m.value_step_czk) || 0;
  const over = Math.max(0, Number(value || 0) - (Number(m.value_free_czk) || 0));
  return step > 0 ? Math.ceil(over / step) : 0;
}

/**
 * Posouzení jednoho způsobu dopravy pro konkrétní objednávku.
 * @returns {{ok:boolean, reason?:string, price?:number, cost?:number}}
 */
export function quote(m, { country, value = 0, metals = [], hasPacketaKey = false } = {}) {
  const base = countryValue(m.prices, country);
  if (base == null) return { ok: false, reason: 'do země nedoručuje' };
  if (m.kind === 'vydejni_misto' && m.provider === 'packeta' && country !== 'CZ' && !hasPacketaKey) return { ok: false, reason: 'chybí mapa výdejních míst (API klíč Zásilkovny)' };
  if (m.kind === 'vydejni_misto' && m.provider === 'balikovna' && country !== 'CZ') return { ok: false, reason: 'Balíkovna jen v ČR' };
  const max = n(country === 'CZ' ? m.max_value_czk : (m.max_value_abroad_czk ?? m.max_value_czk));
  if (max != null && value > max) return { ok: false, reason: `hodnota nad ${max} Kč není krytá` };
  const bad = metals.filter((x) => m.excluded.includes(x));
  if (bad.length) return { ok: false, reason: `dopravce nepřepravuje pouzdra: ${bad.join(', ')}` };
  const steps = valueSteps(m, value);
  const price = base + steps * (Number(m.value_step_price_czk) || 0);
  const costBase = countryValue(m.costs, country);
  const cost = costBase == null ? null : costBase + steps * (Number(m.cost_step_price_czk) || 0);
  return { ok: true, price, cost };
}

/** Nabídka dopravy pro pokladnu (jen aktivní) + informace, zda se něco skrylo kvůli hodnotě. */
export async function offer(env, { country, value, metals = [], lang = 'cs', methods } = {}) {
  const list = methods || await loadMethods(env);
  const hasPacketaKey = Boolean(env.PACKETA_API_KEY);
  const out = []; let hiddenByValue = false;
  for (const m of list) {
    if (m.status !== 'aktivni') continue;
    const q = quote(m, { country, value, metals, hasPacketaKey });
    if (!q.ok) { if (/hodnota|pouzdra/.test(q.reason) && countryValue(m.prices, country) != null) hiddenByValue = true; continue; }
    out.push({
      id: m.id, label: lang === 'en' ? m.name_en : m.name_cs, price: q.price, cost: q.cost,
      note: (lang === 'en' ? m.note_en : m.note_cs) || undefined,
      pickup: m.kind === 'vydejni_misto' || undefined, address: m.kind === 'adresa' || undefined,
      carrier: m.provider, insured: (n(m.max_value_czk) ?? 0) >= 100000, cod: m.cod_enabled ? { fee: Number(m.cod_fee_czk) || 0, max: n(m.cod_max_czk), cost: Number(m.cost_cod_czk) || 0 } : null,
    });
  }
  return { shipping: out, hiddenByValue };
}

/** Náhled pro administraci: proč se způsob v dané situaci (ne)nabídne. */
export async function preview(env, { country, value, metals = [] }) {
  const hasPacketaKey = Boolean(env.PACKETA_API_KEY);
  return (await loadMethods(env)).map((m) => {
    const q = quote(m, { country, value, metals, hasPacketaKey });
    return { id: m.id, name: m.name_cs, status: m.status, ok: q.ok && m.status === 'aktivni', reason: m.status !== 'aktivni' ? (m.status === 'pripraveno' ? 'připraveno – zákazníkům skryto' : 'vypnuto') : q.reason, price: q.price ?? null, cost: q.cost ?? null };
  });
}

/** Údaje dopravce pro automatizaci (štítek, sledování). */
export async function methodById(env, id) {
  const r = await env.DB.prepare('SELECT * FROM shipping_methods WHERE id = ?').bind(id).first().catch(() => null);
  return r ? rowToMethod(r) : null;
}

// --- Úpravy z administrace ---------------------------------------------------------
function cleanMap(obj, name, { max = 1000000 } = {}) {
  const src = typeof obj === 'string' ? parse(obj) : (obj && typeof obj === 'object' ? obj : {});
  const out = {};
  for (const [cc, v] of Object.entries(src)) {
    if (!(cc === '*' || EU_COUNTRIES[cc])) continue;
    if (v === '' || v == null) continue;
    out[cc] = int(v, { min: 0, max, nullable: false, name: `${name} ${cc}` });
  }
  return JSON.stringify(out);
}

export function methodInput(b, old = {}) {
  const d = {};
  if ('name_cs' in b) d.name_cs = str(b.name_cs, { max: 120, required: true, name: 'název' });
  if ('name_en' in b) d.name_en = str(b.name_en, { max: 120, required: true, name: 'anglický název' });
  if ('note_cs' in b) d.note_cs = str(b.note_cs, { max: 300 }) || null;
  if ('note_en' in b) d.note_en = str(b.note_en, { max: 300 }) || null;
  if ('provider' in b) d.provider = oneOf(b.provider, Object.keys(PROVIDERS), 'dopravce');
  if ('kind' in b) d.kind = oneOf(b.kind, KINDS, 'druh doručení');
  if ('status' in b) d.status = oneOf(b.status, STATUSES, 'stav');
  if ('sort_order' in b) d.sort_order = int(b.sort_order, { min: 0, max: 1000, name: 'pořadí' }) ?? 100;
  if ('prices' in b) d.prices_json = cleanMap(b.prices, 'cena');
  if ('costs' in b) d.cost_json = cleanMap(b.costs, 'náklad');
  for (const k of ['value_free_czk', 'value_step_price_czk', 'cod_fee_czk', 'cost_step_price_czk', 'cost_cod_czk']) if (k in b) d[k] = int(b[k], { min: 0, max: 10000000, name: k }) ?? 0;
  if ('value_step_czk' in b) d.value_step_czk = int(b.value_step_czk, { min: 1, max: 10000000, name: 'krok hodnoty' }) ?? 10000;
  for (const k of ['max_value_czk', 'max_value_abroad_czk', 'cod_max_czk']) if (k in b) d[k] = int(b[k], { min: 0, max: 100000000, name: k });
  if ('excluded' in b) {
    const list = Array.isArray(b.excluded) ? b.excluded : String(b.excluded || '').split(',');
    d.excluded_metals = list.map((x) => String(x).trim()).filter((x) => METALS_EXCLUDABLE.includes(x)).join(',');
  }
  if ('cod_enabled' in b) d.cod_enabled = b.cod_enabled === true || b.cod_enabled === 'on' || b.cod_enabled === '1' || b.cod_enabled === 1 ? 1 : 0;
  if ('label_api' in b) d.label_api = b.label_api ? oneOf(b.label_api, LABEL_APIS, 'štítek') : null;
  if ('tracking' in b) d.tracking = b.tracking ? oneOf(b.tracking, TRACKING, 'sledování') : null;
  if ('verification' in b) d.verification = str(b.verification, { max: 1000 }) || null;
  // Dobírka jen tam, kde ji dopravce umí; dobírka do zahraničí se nenabízí (obchodní podmínky)
  const kind = d.kind ?? old.kind;
  if (kind === 'osobni') d.cod_enabled = 0;
  return d;
}

export async function saveMethod(env, id, body, actor, { create = false } = {}) {
  const old = await env.DB.prepare('SELECT * FROM shipping_methods WHERE id = ?').bind(id).first();
  if (create && old) throw new HttpError('Dopravce s tímto kódem už existuje');
  if (!create && !old) throw new HttpError('Dopravce nenalezen', 404);
  const d = methodInput(body, old || {});
  d.updated_at = now();
  if (create) {
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(id)) throw new HttpError('Kód dopravce: malá písmena, číslice a podtržítko');
    if (!d.name_cs || !d.name_en || !d.provider) throw new HttpError('Vyplňte název (CZ, EN) a dopravce');
    d.status = d.status || 'pripraveno';
    const k = Object.keys(d);
    await env.DB.prepare(`INSERT INTO shipping_methods (id, ${k.join(', ')}) VALUES (?, ${k.map(() => '?').join(', ')})`).bind(id, ...k.map((x) => d[x])).run();
  } else {
    const k = Object.keys(d);
    await env.DB.prepare(`UPDATE shipping_methods SET ${k.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`).bind(...k.map((x) => d[x]), id).run();
  }
  await audit(env, actor, create ? 'dopravce_pridan' : 'dopravce_upraven', 'shipping_method', id, d);
  return methodById(env, id);
}
