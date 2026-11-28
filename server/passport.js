// Dante Time OS – etapa E3: digitální pas hodinek s QR a certifikát pravosti.
// Veřejná stránka pasu ukazuje jen hodinky a jejich historii, nikdy zákazníka ani cenu.
import { HttpError } from './http.js';
import { randomId, now, audit } from './db.js';
import { str, oneOf } from './validate.js';
import { qrSvg } from './qr.js';
import { SITE, OPERATOR } from '../src/site.mjs';
import { AUTH_PARTS } from '../src/shop/describe.mjs';
import { dtName } from '../src/shop/naming.mjs';
import { caliberInfo, PARTS_PRESETS } from '../src/shop/calibers.mjs';
import { esc } from '../src/layout.mjs';

export const EVENT_KINDS = { renovace: 'Renovace', servis: 'Servis', prohlidka: 'Garanční prohlídka', predani: 'Předání majiteli', overeni: 'Ověření pravosti', jine: 'Jiné' };
const EVENT_EN = { renovace: 'Restoration', servis: 'Service', prohlidka: 'Warranty inspection', predani: 'Handover to owner', overeni: 'Authenticity check', jine: 'Other' };
const FIELDS = { title: 200, brand: 80, model: 120, reference: 80, year: 20, movement: 120, case_material: 120, hallmark: 200, serial_ref: 120, original_parts: 1000, replaced_parts: 1000 };
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : now().slice(0, 10));

/** Kód do QR: 12 znaků bez zaměnitelných znaků (0/O, 1/I/L), ~60 bitů náhody. */
export function newCode() {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const a = crypto.getRandomValues(new Uint8Array(12));
  return [...a].map((b) => abc[b % abc.length]).join('');
}
export const passportUrl = (code, lang = 'cs') => `${SITE.origin}${lang === 'en' ? '/en/passport/' : '/pas/'}${code}`;
/** Výrobní číslo zkráceně (jen poslední 4 znaky) – stačí k ověření, ale nedá se okopírovat. */
export const maskSerial = (s) => { const t = String(s || '').replace(/\s+/g, ''); return t ? (t.length <= 4 ? '••••' : `••••${t.slice(-4)}`) : ''; };

function input(b, { customerWatch = false } = {}) {
  const d = {};
  for (const [k, max] of Object.entries(FIELDS)) if (k in b) d[k] = str(b[k], { max, required: k === 'title', name: k === 'title' ? 'název hodinek' : k }) || null;
  if ('authenticity_parts' in b) {
    const parts = (Array.isArray(b.authenticity_parts) ? b.authenticity_parts : String(b.authenticity_parts || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
    for (const x of parts) oneOf(x, Object.keys(AUTH_PARTS), 'součást garance');
    d.authenticity_parts = parts.length ? [...new Set(parts)].join(',') : null;
  }
  if ('issued_on' in b) d.issued_on = ymd(b.issued_on);
  // jednotný název DT – ZNAČKA … (R26) – jen u hodinek Dante Time; hodinky zákazníka na servisu si nechávají své jméno
  if (d.title && !customerWatch) d.title = dtName({ brand: d.brand ?? b.brand, title: d.title });
  if ('status' in b) d.status = oneOf(b.status, ['platny', 'zruseny'], 'stav');
  return d;
}

/** Založí pas k hodinkám z katalogu (údaje převezme z karty hodinek). Opakované volání vrátí existující pas. */
export async function createFromProduct(env, productId, actor) {
  const ex = await env.DB.prepare('SELECT id FROM watch_passports WHERE product_id = ?').bind(productId).first();
  if (ex) return ex.id;
  const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
  if (!p) throw new HttpError('Hodinky nenalezeny', 404);
  const id = randomId();
  await env.DB.prepare(`INSERT OR IGNORE INTO watch_passports (id, code, product_id, title, brand, model, reference, year, movement, case_material, hallmark, serial_ref, authenticity_parts, original_parts, replaced_parts, issued_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, newCode(), p.id, dtName(p) || p.title, p.brand, p.model, p.reference, p.year, p.movement, p.case_material, p.hallmark ?? null, p.serial_ref ?? null, p.authenticity_parts ?? null, p.original_parts, p.replaced_parts, now().slice(0, 10)).run();
  const row = await env.DB.prepare('SELECT id FROM watch_passports WHERE product_id = ?').bind(productId).first();
  if (row.id === id) {
    if (p.service_done) await addEvent(env, id, { kind: 'renovace', event_date: (p.published_at || now()).slice(0, 10), text_cs: String(p.service_done).slice(0, 1000), ref: `product:${p.id}:renovace` });
    await audit(env, actor, 'pas_zalozen', 'passport', id, { product: p.id });
  }
  return row.id;
}

// --- Pas pro hodinky ze zakázky -------------------------------------------------------------
/** Servis a renovace = hodinky zákazníka (vlastní jméno); přestavba a zakázková výroba = hodinky Dante Time (DT – …). */
const CUSTOMER_TYPES = ['servis', 'renovace'];
/** Stavy, ve kterých má zakázka mít pas (po přijetí). */
export const COMMISSION_PASSPORT_STATUSES = ['prijato', 'v_praci', 'ceka_na_dily', 'hotovo', 'predano'];
const WORK = {
  servis: ['servis', 'Servis hodinek v ateliéru Dante Time', 'Watch service at Atelier Dante Time'],
  renovace: ['renovace', 'Renovace hodinek v ateliéru Dante Time', 'Watch restoration at Atelier Dante Time'],
  prestavba: ['renovace', 'Přestavba hodinek v ateliéru Dante Time z originálních historických komponentů', 'Rebuilt at Atelier Dante Time from original historic components'],
  zakazkova_vyroba: ['renovace', 'Zakázková sestava hodinek v ateliéru Dante Time', 'Custom-built at Atelier Dante Time'],
};

/**
 * Založí (nebo vrátí existující) pas k hodinkám ze zakázky. Převezme jen popis hodinek a kalibr –
 * nikdy jméno, kontakt ani cenu. Opakované volání nic nezdvojí.
 */
export async function createFromCommission(env, commissionId, actor) {
  const ex = await env.DB.prepare('SELECT id FROM watch_passports WHERE commission_id = ?').bind(commissionId).first();
  if (ex) return ex.id;
  const k = await env.DB.prepare('SELECT id, number, type, watch, caliber FROM commissions WHERE id = ?').bind(commissionId).first();
  if (!k) throw new HttpError('Zakázka nenalezena', 404);
  const raw = String(k.watch || '').split(/\r?\n/)[0].trim().slice(0, 200) || `Hodinky – zakázka ${k.number}`;
  const title = CUSTOMER_TYPES.includes(k.type) ? raw : dtName({ title: raw });
  const id = randomId();
  await env.DB.prepare('INSERT OR IGNORE INTO watch_passports (id, code, commission_id, title, movement, issued_on) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, newCode(), k.id, title, k.caliber ? String(k.caliber).slice(0, 120) : null, now().slice(0, 10)).run();
  const row = await env.DB.prepare('SELECT id FROM watch_passports WHERE commission_id = ?').bind(commissionId).first();
  if (row.id === id) await audit(env, actor, 'pas_zalozen', 'passport', id, { commission: k.number });
  await syncFromCommission(env, commissionId, actor);
  return row.id;
}

/**
 * Zakázka změnila stav: po přijetí založí pas, po dokončení zapíše provedenou práci do historie
 * a po vrácení zákazníkovi záznam o předání. Texty jsou obecné – bez jména, kontaktu a ceny.
 */
export async function onCommissionStatus(env, commissionId, actor) {
  const k = await env.DB.prepare('SELECT id, number, type, status, returned_at FROM commissions WHERE id = ?').bind(commissionId).first();
  if (!k || !COMMISSION_PASSPORT_STATUSES.includes(k.status)) return null;
  const pid = await createFromCommission(env, k.id, actor);
  const today = now().slice(0, 10);
  if (['hotovo', 'predano'].includes(k.status)) {
    const [kind, cs, en] = WORK[k.type] || WORK.servis;
    await addEvent(env, pid, { kind, event_date: today, text_cs: cs, text_en: en, ref: `commission:${k.id}:prace` });
  }
  if (k.status === 'predano') {
    await addEvent(env, pid, { kind: 'predani', event_date: /^\d{4}-\d{2}-\d{2}/.test(k.returned_at || '') ? k.returned_at.slice(0, 10) : today, text_cs: 'Hodinky předány majiteli', text_en: 'Watch handed over to the owner', ref: `commission:${k.id}:predani` });
  }
  return pid;
}

/**
 * Přepíše do pasu údaje hodinek ze zakázky (zakázka je zdroj pravdy): název z 1. řádku „Hodinky“, kalibr,
 * originální díly s garancí, popis originálních a vyměněných dílů. Nic o zákazníkovi ani ceně.
 * Díly se přepisují jen tehdy, když je zakázka už má vyplněné (NULL = zatím nevyplněno, nechá pas být).
 */
export async function syncFromCommission(env, commissionId, actor) {
  const k = await env.DB.prepare('SELECT id, number, type, watch, caliber, parts_preset, authenticity_parts, original_parts, replaced_parts FROM commissions WHERE id = ?').bind(commissionId).first();
  const w = k && await env.DB.prepare('SELECT id FROM watch_passports WHERE commission_id = ?').bind(commissionId).first();
  if (!w) return null;
  const raw = String(k.watch || '').split(/\r?\n/)[0].trim().slice(0, 200);
  const cal = caliberInfo(k.caliber);
  const d = { movement: cal.movement };
  if (cal.year) d.year = cal.year;
  if (raw) d.title = CUSTOMER_TYPES.includes(k.type) ? raw : dtName({ title: raw });
  const preset = PARTS_PRESETS[commissionPreset(k)];
  if (preset?.auth) Object.assign(d, { authenticity_parts: preset.auth, original_parts: preset.original, replaced_parts: preset.replaced });
  else {
    if (k.authenticity_parts !== null) d.authenticity_parts = String(k.authenticity_parts).split(',').filter((x) => AUTH_PARTS[x]).join(',') || null;
    if (k.original_parts !== null || k.replaced_parts !== null) { d.original_parts = k.original_parts || null; d.replaced_parts = k.replaced_parts || null; }
  }
  const keys = Object.keys(d);
  await env.DB.prepare(`UPDATE watch_passports SET ${keys.map((x) => `${x} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((x) => d[x]), now(), w.id).run();
  return w.id;
}

/** Originalita zakázky: zvolená, jinak výchozí podle druhu (přestavba/výroba = nové pouzdro a řemínek, servis/renovace = vše originální). */
export function commissionPreset(k) {
  if (PARTS_PRESETS[k?.parts_preset]) return k.parts_preset;
  return CUSTOMER_TYPES.includes(k?.type) ? 'original' : 'prestavba';
}

/** Doplní pasy k zakázkám, které je ještě nemají (zakázky přijaté před zavedením nebo mimo administraci). */
export async function ensureCommissionPassports(env) {
  const { results } = await env.DB.prepare(`SELECT k.id FROM commissions k WHERE k.status IN (${COMMISSION_PASSPORT_STATUSES.map(() => '?').join(',')})
    AND NOT EXISTS (SELECT 1 FROM watch_passports w WHERE w.commission_id = k.id) LIMIT 50`).bind(...COMMISSION_PASSPORT_STATUSES).all();
  for (const r of results) await onCommissionStatus(env, r.id, 'system');
  // údaje ze zakázek se do pasů přepisují i bez uložení zakázky (např. kalibr doplněný jinde, výchozí originalita)
  const all = await env.DB.prepare('SELECT commission_id FROM watch_passports WHERE commission_id IS NOT NULL LIMIT 300').all();
  for (const r of all.results) await syncFromCommission(env, r.commission_id, 'system');
  return results.length;
}

/** Ručně založený pas (hodinky mimo katalog, např. zakázka nebo starší prodej). */
export async function createManual(env, b, actor) {
  const d = input(b);
  if (!d.title) throw new HttpError('Vyplňte název hodinek');
  const id = randomId(); d.issued_on = d.issued_on || now().slice(0, 10);
  const k = Object.keys(d).filter((x) => x !== 'status');
  await env.DB.prepare(`INSERT INTO watch_passports (id, code, ${k.join(', ')}) VALUES (?, ?, ${k.map(() => '?').join(', ')})`).bind(id, newCode(), ...k.map((x) => d[x])).run();
  await audit(env, actor, 'pas_zalozen', 'passport', id, { manual: true });
  return id;
}

export async function update(env, id, b, actor) {
  const k0 = await env.DB.prepare('SELECT k.type FROM watch_passports w JOIN commissions k ON k.id = w.commission_id WHERE w.id = ?').bind(id).first();
  const d = input(b, { customerWatch: CUSTOMER_TYPES.includes(k0?.type) }); const k = Object.keys(d);
  if (!k.length) return;
  await env.DB.prepare(`UPDATE watch_passports SET ${k.map((x) => `${x} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...k.map((x) => d[x]), now(), id).run();
  await audit(env, actor, d.status === 'zruseny' ? 'pas_zrusen' : 'pas_upraven', 'passport', id, { fields: k });
}

export async function addEvent(env, passportId, e, actor) {
  const kind = oneOf(e.kind, Object.keys(EVENT_KINDS), 'druh záznamu');
  const text = str(e.text_cs, { max: 1000, required: true, name: 'popis' });
  const r = await env.DB.prepare('INSERT OR IGNORE INTO passport_events (id, passport_id, event_date, kind, text_cs, text_en, public, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(randomId(), passportId, ymd(e.event_date), kind, text, str(e.text_en, { max: 1000 }) || null, e.public === false || e.public === '0' ? 0 : 1, e.ref || null).run();
  if (actor) await audit(env, actor, 'pas_zaznam', 'passport', passportId, { kind });
  return r.meta?.changes || 0;
}

export async function get(env, id) {
  const p = await env.DB.prepare('SELECT * FROM watch_passports WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError('Pas nenalezen', 404);
  const { results: events } = await env.DB.prepare('SELECT * FROM passport_events WHERE passport_id = ? ORDER BY event_date, created_at').bind(id).all();
  return { passport: p, events, url: passportUrl(p.code), url_en: passportUrl(p.code, 'en'), qr: qrSvg(passportUrl(p.code), { label: 'QR kód digitálního pasu' }) };
}

export async function list(env) {
  const { results } = await env.DB.prepare('SELECT w.id, w.code, w.title, w.status, w.issued_on, w.product_id, w.commission_id, (SELECT number FROM commissions k WHERE k.id = w.commission_id) AS commission_number, (SELECT COUNT(*) FROM passport_events e WHERE e.passport_id = w.id) AS events FROM watch_passports w ORDER BY w.created_at DESC LIMIT 500').all();
  return results;
}

/** Po předání hodinek zákazníkovi: pas (je-li třeba, založí) + záznam o předání. Bez jména zákazníka. */
export async function onDelivered(env, orderId, day, actor) {
  const { results: items } = await env.DB.prepare('SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL').bind(orderId).all();
  for (const it of items) {
    const pid = await createFromProduct(env, it.product_id, actor);
    await env.DB.prepare('UPDATE passport_events SET event_date = ? WHERE ref = ?').bind(day, `order:${orderId}:${it.product_id}`).run();
    await addEvent(env, pid, { kind: 'predani', event_date: day, text_cs: 'Předáno majiteli z ateliéru Dante Time.', text_en: 'Handed over to its owner by Atelier Dante Time.', ref: `order:${orderId}:${it.product_id}` });
  }
}

/** Po garanční prohlídce: záznam do pasu (jen výsledek, bez měření a bez zákazníka). */
export async function onInspection(env, inspection, doneOn, result) {
  if (!inspection.product_id) return;
  const p = await env.DB.prepare('SELECT id FROM watch_passports WHERE product_id = ?').bind(inspection.product_id).first();
  if (!p) return;
  const ok = result !== 'zavada';
  await addEvent(env, p.id, { kind: 'prohlidka', event_date: doneOn, text_cs: ok ? 'Garanční prohlídka – hodinky v pořádku.' : 'Garanční prohlídka – provedena oprava v rámci záruky.', text_en: ok ? 'Warranty inspection – watch in order.' : 'Warranty inspection – repaired under warranty.', ref: `warranty:${inspection.id}` });
}

// --- Veřejná stránka pasu -------------------------------------------------------------
const fmt = (s, lang) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague' }) : '');

export async function publicData(env, code) {
  if (!/^[2-9A-HJKMNP-Z]{12}$/.test(String(code || ''))) return null;
  const p = await env.DB.prepare('SELECT * FROM watch_passports WHERE code = ?').bind(code).first();
  if (!p) return null;
  const { results: events } = await env.DB.prepare('SELECT event_date, kind, text_cs, text_en FROM passport_events WHERE passport_id = ? AND public = 1 ORDER BY event_date, created_at').bind(p.id).all();
  return { p, events };
}

export function publicBody({ p, events }, lang) {
  const L = (cs, en) => (lang === 'en' ? en : cs);
  const valid = p.status === 'platny';
  const parts = String(p.authenticity_parts || '').split(',').filter((x) => AUTH_PARTS[x]).map((x) => AUTH_PARTS[x][lang === 'en' ? 'en' : 'cs']);
  const row = (l, v) => (v ? `<tr><th scope="row">${esc(l)}</th><td>${esc(v)}</td></tr>` : '');
  const name = [p.brand, p.model].filter(Boolean).join(' ') || p.title;
  return `<section class="section"><div class="wrap passport">
  <p class="eyebrow">${L('Digitální pas hodinek', 'Digital watch passport')}</p>
  <h1>${esc(name)}</h1>
  <p class="passport-status ${valid ? 'ok' : 'void'}" role="status">${valid
    ? L(`Pas je platný. Vystavil ${esc(OPERATOR.tradeName)} dne ${fmt(p.issued_on, lang)}.`, `This passport is valid. Issued by ${esc(OPERATOR.tradeName)} on ${fmt(p.issued_on, lang)}.`)
    : L('Tento pas byl zrušen a neplatí.', 'This passport has been cancelled and is not valid.')}</p>
  <div class="card"><table class="specs">
    ${row(L('Hodinky', 'Watch'), p.title)}${row(L('Reference', 'Reference'), p.reference)}${row(L('Rok', 'Year'), p.year)}
    ${row(L('Strojek', 'Movement'), p.movement)}${row(L('Pouzdro', 'Case'), p.case_material)}${row(L('Punc a ryzost', 'Hallmark'), p.hallmark)}
    ${row(L('Výrobní číslo (zkráceně)', 'Serial number (shortened)'), maskSerial(p.serial_ref))}
  </table></div>
  ${valid && parts.length ? `<div class="card"><h2>${L('Certifikát pravosti', 'Certificate of authenticity')}</h2>
    <p>${L(`Originální součásti s doživotní garancí pravosti: <strong>${esc(parts.join(', '))}</strong>.`, `Original components covered by the lifetime authenticity guarantee: <strong>${esc(parts.join(', '))}</strong>.`)}</p>
    ${p.original_parts ? `<p class="passport-note">${esc(p.original_parts)}</p>` : ''}
    <p class="passport-note">${L('Garance platí i pro každého dalšího majitele.', 'The guarantee also applies to every subsequent owner.')} <a href="${L('/warranty', '/en/warranty')}">${L('Podmínky garance', 'Guarantee terms')}</a></p></div>` : ''}
  ${p.replaced_parts ? `<div class="card"><h2>${L('Vyměněné součásti', 'Replaced components')}</h2><p>${esc(p.replaced_parts)}</p></div>` : ''}
  ${events.length ? `<div class="card"><h2>${L('Historie hodinek', 'Watch history')}</h2><ol class="timeline">${events.map((e) => `<li><time datetime="${esc(e.event_date)}">${fmt(e.event_date, lang)}</time> <strong>${esc(L(EVENT_KINDS[e.kind], EVENT_EN[e.kind]))}</strong><br>${esc(lang === 'en' && e.text_en ? e.text_en : e.text_cs)}</li>`).join('')}</ol></div>` : ''}
  <p class="passport-note">${L(`Kód pasu: ${esc(p.code)}. Pravost pasu ověříte jen na adrese ${esc(SITE.origin.replace('https://', ''))}. Pas neobsahuje žádné osobní údaje majitele.`, `Passport code: ${esc(p.code)}. Verify this passport only at ${esc(SITE.origin.replace('https://', ''))}. It contains no personal data of the owner.`)}</p>
</div></section>`;
}

// --- Tisknutelný certifikát pravosti (administrace) ------------------------------------
export function certificateHtml({ passport: p, events, qr, url, sign = null }) {
  const parts = String(p.authenticity_parts || '').split(',').filter((x) => AUTH_PARTS[x]).map((x) => AUTH_PARTS[x].cs);
  const row = (l, v) => (v ? `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>` : '');
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Certifikát pravosti – ${esc(p.title)}</title>
<style>
@page{size:A4;margin:16mm}body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;margin:0}
.sheet{max-width:178mm;margin:0 auto;padding:10mm 4mm;border:1px solid #c8a24a;border-radius:6px}
h1{font-weight:400;letter-spacing:.18em;text-transform:uppercase;font-size:20px;text-align:center;margin:0 0 4px}
.sub{text-align:center;color:#6b5a2a;letter-spacing:.12em;font-size:12px;text-transform:uppercase;margin:0 0 18px}
table{border-collapse:collapse;width:100%;font-family:-apple-system,system-ui,sans-serif;font-size:13px}th{text-align:left;color:#555;font-weight:400;padding:5px 12px 5px 0;width:38%;vertical-align:top}td{padding:5px 0}
.row{display:flex;gap:18px;align-items:flex-start;margin-top:16px}.row>div{flex:1}.qr svg{max-width:120px!important}
p{font-family:-apple-system,system-ui,sans-serif;font-size:12.5px;line-height:1.5}.muted{color:#666}.signimg{display:flex;align-items:flex-end;gap:8px}.signimg img{max-height:130px;max-width:240px;object-fit:contain}.sign{margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;font-size:12px;font-family:-apple-system,system-ui,sans-serif}
.noprint{text-align:center;margin:12px}@media print{.noprint{display:none}.sheet{border-color:#c8a24a}}
</style></head><body>
<div class="noprint"><button type="button" id="print">Vytisknout / uložit jako PDF</button><script src="/admin/print.js"></script></div>
<div class="sheet">
<h1>Certifikát pravosti</h1><p class="sub">${esc(OPERATOR.tradeName)} · digitální pas ${esc(p.code)}</p>
<table>${row('Hodinky', p.title)}${row('Značka a model', [p.brand, p.model].filter(Boolean).join(' '))}${row('Reference', p.reference)}${row('Rok', p.year)}${row('Strojek', p.movement)}${row('Pouzdro', p.case_material)}${row('Punc a ryzost', p.hallmark)}${row('Identifikace (číslo pouzdra / strojku)', p.serial_ref)}${row('Datum vystavení', p.issued_on)}</table>
<div class="row"><div>
${parts.length ? `<p><strong>Originální součásti s doživotní garancí pravosti:</strong> ${esc(parts.join(', '))}.</p>` : '<p class="muted">U těchto hodinek nejsou deklarovány součásti s garancí pravosti.</p>'}
${p.original_parts ? `<p class="muted">${esc(p.original_parts)}</p>` : ''}${p.replaced_parts ? `<p><strong>Vyměněné součásti:</strong> ${esc(p.replaced_parts)}</p>` : ''}
${events.filter((e) => e.public).length ? `<p><strong>Historie:</strong> ${events.filter((e) => e.public).map((e) => `${esc(e.event_date)} ${esc(EVENT_KINDS[e.kind])}`).join(' · ')}</p>` : ''}
<p class="muted">Garance pravosti platí i pro každého dalšího majitele hodinek za podmínek uvedených na ${esc(SITE.origin.replace('https://', ''))}/warranty. Garance neomezuje zákonná práva kupujícího. Aktuální stav a historii hodinek ověříte naskenováním QR kódu.</p>
</div><div class="qr" style="flex:0 0 130px;text-align:center">${qr}<p class="muted" style="font-size:10px;word-break:break-all">${esc(url)}</p></div></div>
<div class="sign"><span>${esc(OPERATOR.tradeName)}</span>${sign ? `<span class="signimg"><span>Podpis a razítko:</span><img src="${sign}" alt="Podpis a razítko"></span>` : '<span>Podpis a razítko: ____________________</span>'}</div>
</div></body></html>`;
}
