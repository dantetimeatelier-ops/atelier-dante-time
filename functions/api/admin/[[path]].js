// API administrace. Všechny cesty kromě přihlášení vyžadují platnou relaci.
import { json, handle, readJson, HttpError, assertSameOrigin } from '../../../server/http.js';
import { requireAdmin, hashPassword, timingSafeEqual, verifyTotp, newTotpSecret, otpauthUrl, createSession, destroySession, checkLoginRate, recordLogin } from '../../../server/auth.js';
import { randomId, now, audit, releaseExpired, getSettings, nextCounter, productsWithImages, mode, sha256Hex } from '../../../server/db.js';
import { str, email as vEmail, oneOf, int, num } from '../../../server/validate.js';
import { qrSvg } from '../../../server/qr.js';
import { media } from '../../../server/media.js';
import { markPaid, markShipped, markDelivered, cancelOrder, shopConfig, createInvoice } from '../../../server/orders.js';
import { describe, productName } from '../../../src/shop/describe.mjs';
import { puncCheck } from '../../../src/shop/punc.mjs';
import { slugify, REBUILD_NOTE, hasRebuildNote } from '../../../src/shop/format.mjs';
import { OPERATOR } from '../../../src/site.mjs';
import * as W from '../../../server/warranty.js';
import * as OS from '../../../server/os.js';
import * as FIN from '../../../server/finance.js';
import * as PAS from '../../../server/passport.js';
import * as CARD from '../../../server/passport-card.js';
import * as DOC from '../../../server/documents.js';
import * as INV from '../../../server/invoicing.js';
import { INVOICE_KINDS, SALE_CHANNELS, INVOICE_PAY } from '../../../src/shop/invoice.mjs';
import * as INB from '../../../server/inbox.js';
import * as PAY from '../../../server/invoice-payments.js';
import * as CPH from '../../../server/commission-photos.js';
import { draftReply } from '../../../server/sales.js';
import { refreshOrder, createPacket, labelPdf } from '../../../server/packeta.js';
import { aiStatus } from '../../../server/ai.js';
import { gateway as payGateway, isLive as payLive, cardDiagnostics } from '../../../server/payments.js';
import * as SHIP from '../../../server/shipping.js';
import { setShippingCost } from '../../../server/orders.js';
import { html } from '../../../server/http.js';
import { renderInvoicePage } from '../../../server/invoice-page.js';

const STATUSES = ['draft', 'available', 'reserved', 'sold', 'in_progress', 'archived'];
const PRODUCT_TEXT = { title: 200, brand: 80, model: 120, reference: 80, year: 20, movement: 120, case_material: 120, crystal: 80, water_resistance: 80, dial: 200, strap: 200, condition: 1000, service_done: 1000, original_parts: 1000, replaced_parts: 1000, accessories: 500, manufacturer_info: 500, safety_info: 500, hallmark: 200, plating: 200, authenticity_note: 1000, serial_ref: 120, description_cs: 5000, description_en: 5000, seo_title: 80, seo_description: 200 };

const routes = [];
const route = (method, pattern, fn, { auth = true } = {}) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[A-Za-z0-9_-]+)')}$`), fn, auth });

// --- Nastavení prvního účtu a přihlášení -------------------------------------
async function setupAllowed(env, token) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
  if (n > 0) throw new HttpError('Administrace už je nastavena', 403);
  // Instalační kód: buď tajná proměnná Cloudflare, nebo jeho otisk (SHA-256) uložený automatikou v databázi
  const t = String(token || '');
  const { results: rows = [] } = await env.DB.prepare("SELECT value FROM settings WHERE key IN ('admin_setup_hash', 'admin_setup_hash_alt') AND value IS NOT NULL").all().catch(() => ({ results: [] }));
  const byEnv = env.ADMIN_SETUP_TOKEN && env.ADMIN_SETUP_TOKEN.length >= 24 && timingSafeEqual(env.ADMIN_SETUP_TOKEN, t);
  const th = t.length >= 24 ? await sha256Hex(t) : null;
  const byHash = th != null && rows.some((r) => timingSafeEqual(r.value, th));
  if (!byEnv && !byHash) throw new HttpError('Neplatný instalační kód', 403);
}
route('GET', 'setup', async ({ env }) => {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
  return json({ needed: n === 0 });
}, { auth: false });
route('POST', 'setup/start', async ({ env, body }) => {
  await setupAllowed(env, body.token);
  const email = vEmail(body.email);
  const secret = newTotpSecret();
  return json({ secret, qr: qrSvg(otpauthUrl(secret, email), { label: 'Kód pro aplikaci ověřování' }) });
}, { auth: false });
route('POST', 'setup/finish', async ({ env, body, request }) => {
  await setupAllowed(env, body.token);
  const email = vEmail(body.email);
  const password = String(body.password || '');
  if (password.length < 12) throw new HttpError('Heslo musí mít alespoň 12 znaků');
  if (!/^[A-Z2-7]{32}$/.test(String(body.secret || ''))) throw new HttpError('Neplatný klíč ověřování');
  const step = await verifyTotp(body.secret, body.code);
  if (step == null) throw new HttpError('Ověřovací kód nesouhlasí. Zkontrolujte čas v telefonu a zkuste nový kód.');
  const h = await hashPassword(password);
  const id = randomId();
  await env.DB.prepare('INSERT INTO admin_users (id, email, password_hash, password_salt, password_iterations, totp_secret, last_totp_step) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, email, h.hash, h.salt, h.iterations, body.secret, step).run();
  await audit(env, email, 'admin_nastaven');
  return json({ ok: true }, 201, { 'Set-Cookie': await createSession(env, id, request) });
}, { auth: false });

route('POST', 'login', async ({ env, body, request }) => {
  const ip = await checkLoginRate(env, request);
  const email = String(body.email || '').trim().toLowerCase();
  const user = await env.DB.prepare('SELECT * FROM admin_users WHERE email = ?').bind(email).first();
  // Heslo ověřujeme i pro neexistující účet, aby odpověď netrvala jinak dlouho
  const h = await hashPassword(String(body.password || ''), user?.password_salt, user?.password_iterations);
  const step = user ? await verifyTotp(user.totp_secret, String(body.code || '')) : null;
  const ok = user && timingSafeEqual(h.hash, user.password_hash) && step != null && step > user.last_totp_step;
  await recordLogin(env, ip, ok);
  if (!ok) throw new HttpError('Nesprávný e-mail, heslo nebo ověřovací kód', 401);
  await env.DB.prepare('UPDATE admin_users SET last_totp_step = ? WHERE id = ?').bind(step, user.id).run();
  await audit(env, user.email, 'prihlaseni');
  return json({ ok: true }, 200, { 'Set-Cookie': await createSession(env, user.id, request) });
}, { auth: false });

route('POST', 'logout', async ({ env, request }) => json({ ok: true }, 200, { 'Set-Cookie': await destroySession(env, request) }), { auth: false });
route('GET', 'me', async ({ user }) => json({ email: user.email }));
// Výměna klíče dvoufázového ověření (např. když byl klíč nebo QR kód někde vidět)
route('POST', 'security/totp/start', async ({ user }) => {
  const secret = newTotpSecret();
  return json({ secret, qr: qrSvg(otpauthUrl(secret, user.email), { label: 'Nový kód pro aplikaci ověřování' }) });
});
route('POST', 'security/totp/finish', async ({ env, body, user, request }) => {
  const ip = await checkLoginRate(env, request);
  const u = await env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(user.id).first();
  const h = await hashPassword(String(body.password || ''), u.password_salt, u.password_iterations);
  const okPass = timingSafeEqual(h.hash, u.password_hash);
  await recordLogin(env, ip, okPass);
  if (!okPass) throw new HttpError('Nesprávné heslo', 401);
  if (!/^[A-Z2-7]{32}$/.test(String(body.secret || ''))) throw new HttpError('Neplatný klíč ověřování');
  const step = await verifyTotp(body.secret, body.code);
  if (step == null) throw new HttpError('Ověřovací kód nesouhlasí. Použijte kód z NOVÉHO záznamu v aplikaci Hesla.');
  await env.DB.prepare('UPDATE admin_users SET totp_secret = ?, last_totp_step = ? WHERE id = ?').bind(body.secret, step, user.id).run();
  await audit(env, user.email, 'klic_2fa_vymenen');
  return json({ ok: true });
});
route('POST', 'logout-all', async ({ env, user }) => {
  await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(user.id).run();
  await audit(env, user.email, 'odhlaseni_vsude');
  return json({ ok: true }, 200, { 'Set-Cookie': '__Host-dt_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
});

// --- Přehled -------------------------------------------------------------------
route('GET', 'dashboard', async ({ env }) => {
  await releaseExpired(env);
  // Záložní spuštění OS, pokud časovač (Worker) neběží: nejvýš jednou za hodinu, chyba nesmí rozbít přehled
  try { await OS.tick(env); } catch (e) { console.error('OS tick:', e?.message); }
  // Doby uložení podle zásad ochrany osobních údajů
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM inquiries WHERE created_at < ? AND id NOT IN (SELECT inquiry_id FROM commissions WHERE inquiry_id IS NOT NULL)").bind(yearAgo),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(new Date().toISOString()),
  ]);
  try { await CPH.purgeOrphans(env, yearAgo); } catch (e) { console.error('Fotky poptávek:', e?.message); }
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const counts = {};
  const { results } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM products GROUP BY status').all();
  for (const r of results) counts[r.status] = r.n;
  const cfg = await shopConfig(env);
  const warnings = [];
  for (const [k, label] of [['name', 'jméno / firma'], ['ico', 'IČO'], ['address', 'adresa'], ['vatPayer', 'plátce DPH'], ['iban', 'IBAN pro QR platbu']]) {
    if (OPERATOR[k] == null) warnings.push(`Chybí údaj provozovatele: ${label}`);
  }
  if (!cfg.shipping.length) warnings.push('Nejsou nastaveny ceny dopravy (Nastavení)');
  if (!cfg.payment.length) warnings.push('Není dostupný žádný způsob platby');
  if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY) warnings.push('E-maily se zatím neodesílají, jen ukládají (chybí poskytovatel e-mailů)');
  // Hlídání limitů DPH u neplátce: obrat za kalendářní rok (vystavené faktury) a prodej spotřebitelům do jiných zemí EU
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const live = mode(env) === 'live' ? "mode = 'live'" : '1=1';
  const vt = await FIN.vatTurnover(env, yearStart.slice(0, 4), { liveOnly: mode(env) === 'live' });
  const turnover = vt.total;
  const euSales = (await q(`SELECT COALESCE(SUM(i.total),0) AS s FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.cancelled_at IS NULL AND i.kind <> 'zalohova' AND i.issued_at >= ? AND o.billing_country <> 'CZ' AND (o.company_ico IS NULL OR o.company_ico = '') AND ${live.replace('mode', 'i.mode')}`, yearStart)).s;
  const eurRate = Number(cfg.eurRate) || 25;
  const vatLimit = 2000000;
  const euLimitCzk = Math.round(10000 * eurRate);
  if (!OPERATOR.vatPayer && turnover >= vatLimit * 0.8) warnings.push(`Obrat letos ${turnover.toLocaleString('cs-CZ')} Kč se blíží limitu pro registraci k DPH (2 000 000 Kč). Poraďte se s účetní.`);
  if (euSales >= euLimitCzk * 0.8) warnings.push(`Prodej spotřebitelům do jiných zemí EU letos ${euSales.toLocaleString('cs-CZ')} Kč se blíží limitu 10 000 € (DPH v zemi zákazníka / OSS). Poraďte se s účetní.`);
  return json({
    turnover, turnoverInvoices: vt.invoices, turnoverImported: vt.imported, euSales, vatLimit, euLimitCzk,
    mode: mode(env), products: counts, warnings,
    inquiriesNew: (await q("SELECT COUNT(*) AS n FROM inquiries WHERE status='nova'")).n,
    ordersAwaiting: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='awaiting_payment'")).n,
    ordersToShip: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='paid'")).n,
    commissionsActive: (await q("SELECT COUNT(*) AS n FROM commissions WHERE status IN ('prijato','v_praci','ceka_na_dily','hotovo')")).n,
    invoicesOverdue: (await q(`SELECT COUNT(*) AS n FROM invoices WHERE cancelled_at IS NULL AND paid_at IS NULL AND kind <> 'dobropis' AND due_date IS NOT NULL AND due_date < ? AND ${live}`, now())).n,
    invoicesToApprove: (await q("SELECT COUNT(*) AS n FROM approvals WHERE kind = 'faktura_odeslani' AND status = 'ceka'")).n,
    withdrawals: (await q('SELECT COUNT(*) AS n FROM withdrawals WHERE created_at > ?', new Date(Date.now() - 30 * 86400000).toISOString())).n,
    warranty: await (async () => { try { const l = await W.list(env); return { remind: l.filter((x) => x.phase === 'pripomenout').length, window: l.filter((x) => x.phase === 'v_okne').length }; } catch { return { remind: 0, window: 0 }; } })(),
  });
});

// --- Hodinky -------------------------------------------------------------------
function productInput(body, existing = {}, settings = {}) {
  const d = {};
  for (const [k, max] of Object.entries(PRODUCT_TEXT)) if (k in body) d[k] = str(body[k], { max, name: k });
  if ('status' in body) d.status = oneOf(body.status, STATUSES, 'stav');
  if ('kind' in body) d.kind = oneOf(body.kind || 'original', ['original', 'prestavba', 'sestava'], 'druh');
  if ('case_metal' in body) d.case_metal = body.case_metal ? oneOf(body.case_metal, ['ocel', 'mosaz', 'chrom', 'pozlaceno', 'zlato', 'stribro', 'platina', 'titan', 'jine'], 'materiál pouzdra') : null;
  if ('movement_type' in body) d.movement_type = body.movement_type ? oneOf(body.movement_type, ['manual', 'automatic'], 'nátah') : null;
  if ('case_diameter_mm' in body) d.case_diameter_mm = num(body.case_diameter_mm, { max: 80, name: 'průměr' });
  if ('lug_width_mm' in body) d.lug_width_mm = num(body.lug_width_mm, { max: 40, name: 'šířka uchycení' });
  if ('precious_weight_g' in body) d.precious_weight_g = num(body.precious_weight_g, { max: 2000, name: 'hmotnost drahého kovu' });
  if ('authenticity_parts' in body) {
    const parts = (Array.isArray(body.authenticity_parts) ? body.authenticity_parts : String(body.authenticity_parts || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
    for (const x of parts) oneOf(x, ['strojek', 'cifernik', 'rucicky'], 'součást garance');
    d.authenticity_parts = parts.length ? [...new Set(parts)].join(',') : null;
  }
  if ('price_czk' in body) d.price_czk = int(body.price_czk, { max: 50000000, name: 'cena' });
  if ('featured' in body) d.featured = body.featured ? 1 : 0;
  if ('sort_order' in body) d.sort_order = int(body.sort_order, { min: -10000, max: 10000, nullable: false, name: 'pořadí' });
  const merged = { ...existing, ...d };
  // Název se skládá automaticky ze značky a modelu, pokud majitel nezadal vlastní
  const autoOld = productName({ ...existing, title: null });
  if (!merged.title || ['Hodinky', 'DT – Hodinky', autoOld].includes(merged.title)) merged.title = productName({ ...merged, title: null });
  // Jednotný název „DT – ZNAČKA model označení“ (R26) – doplní se vždy automaticky, i když majitel napíše jen „Prim Classic …“
  merged.title = productName(merged);
  d.title = merged.title;
  // Přestavba: popis vždy s upozorněním, že nejde o oficiální nový model původního výrobce (R26)
  if (merged.kind === 'prestavba') {
    if ('description_cs' in d && d.description_cs && !hasRebuildNote(d.description_cs)) d.description_cs = `${d.description_cs}\n\n${REBUILD_NOTE.cs}`;
    if ('description_en' in d && d.description_en && !hasRebuildNote(d.description_en)) d.description_en = `${d.description_en}\n\n${REBUILD_NOTE.en}`;
  }
  if (d.status === 'available' && merged.price_czk == null) throw new HttpError('Pro zveřejnění „Skladem“ vyplňte cenu');
  // Puncovní zákon: drahé kovy jen s puncem, hmotností a po oznámení; obecné kovy bez klamavých výrazů
  const puncErr = puncCheck(merged, settings);
  if (puncErr) throw new HttpError(puncErr);
  return d;
}

async function uniqueSlug(env, base, id) {
  let slug = slugify(base); let n = 1;
  while (await env.DB.prepare('SELECT 1 FROM products WHERE slug = ? AND id <> ?').bind(slug, id).first()) slug = `${slugify(base)}-${++n}`;
  return slug;
}

route('GET', 'products', async ({ env }) => {
  await releaseExpired(env);
  return json({ products: await productsWithImages(env, '1=1', [], "CASE status WHEN 'draft' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'available' THEN 2 WHEN 'reserved' THEN 3 ELSE 4 END, updated_at DESC", 500) });
});
route('POST', 'products', async ({ env, body, user }) => {
  const d = productInput(body, {}, await getSettings(env));
  const id = randomId(8);
  d.slug = await uniqueSlug(env, [d.brand, d.model, d.year].filter(Boolean).join(' ') || d.title, id);
  d.status = d.status || 'draft';
  if (d.status !== 'draft') d.published_at = now();
  const keys = Object.keys(d);
  await env.DB.prepare(`INSERT INTO products (id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`).bind(id, ...keys.map((k) => d[k])).run();
  await audit(env, user.email, 'hodinky_vytvoreny', 'product', id, { title: d.title });
  return json({ id }, 201);
});
route('GET', 'products/:id', async ({ env, params }) => {
  const [p] = await productsWithImages(env, 'id = ?', [params.id]);
  if (!p) throw new HttpError('Hodinky nenalezeny', 404);
  return json({ product: p });
});
route('PUT', 'products/:id', async ({ env, params, body, user }) => {
  const old = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(params.id).first();
  if (!old) throw new HttpError('Hodinky nenalezeny', 404);
  const d = productInput(body, old, await getSettings(env));
  if (d.status && d.status !== old.status) {
    if (old.status === 'reserved' && d.status !== 'reserved') {
      const o = await env.DB.prepare("SELECT number FROM orders WHERE id=? AND status='awaiting_payment'").bind(old.reserved_order_id).first();
      if (o) throw new HttpError(`Hodinky jsou rezervované objednávkou ${o.number}. Nejdřív ji vyřiďte nebo zrušte.`, 409);
    }
    // Osobní rezervace (prodej mimo e-shop se domlouvá): kus zmizí z nabídky, e-shop ho nepředá jinému zákazníkovi
    if (d.status === 'reserved') { d.reserved_order_id = null; d.reserved_until = null; }
    if (old.status === 'draft' && !old.published_at) d.published_at = now();
    if (d.status === 'sold') d.sold_at = now();
    if (d.status !== 'reserved') { d.reserved_order_id = null; d.reserved_until = null; }
  }
  // Změna stavu jen pokud se stav mezitím nezměnil (např. objednávka z e-shopu ve stejnou chvíli) – ochrana proti dvojímu prodeji
  const guard = d.status && d.status !== old.status;
  if (old.status === 'draft' && (body.brand || body.model || body.year) && !old.published_at) d.slug = await uniqueSlug(env, [d.brand ?? old.brand, d.model ?? old.model, d.year ?? old.year].filter(Boolean).join(' ') || d.title, params.id);
  d.updated_at = now();
  const keys = Object.keys(d);
  const upd = await env.DB.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?${guard ? ' AND status = ?' : ''}`).bind(...keys.map((k) => d[k]), params.id, ...(guard ? [old.status] : [])).run();
  if (guard && !upd?.meta?.changes) throw new HttpError('Stav hodinek se mezitím změnil (např. objednávka z e-shopu). Obnovte stránku.', 409);
  const changed = keys.filter((k) => k !== 'updated_at' && String(old[k] ?? '') !== String(d[k] ?? ''));
  await audit(env, user.email, 'hodinky_upraveny', 'product', params.id, { changed, ...(changed.includes('price_czk') ? { price: [old.price_czk, d.price_czk] } : {}) });
  return json({ ok: true });
});
route('DELETE', 'products/:id', async ({ env, params, user }) => {
  const p = await env.DB.prepare('SELECT status FROM products WHERE id = ?').bind(params.id).first();
  if (!p) throw new HttpError('Hodinky nenalezeny', 404);
  const used = await env.DB.prepare('SELECT 1 FROM order_items WHERE product_id = ?').bind(params.id).first();
  if (used || p.status !== 'draft') throw new HttpError('Smazat lze jen koncept bez objednávek. Jinak použijte stav „Archiv“.', 409);
  const { results: imgs } = await env.DB.prepare('SELECT key_large, key_small FROM product_images WHERE product_id = ?').bind(params.id).all();
  for (const i of imgs) await media(env).delete([i.key_large, i.key_small]);
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(params.id).run();
  await audit(env, user.email, 'hodinky_smazany', 'product', params.id);
  return json({ ok: true });
});
route('POST', 'products/:id/describe', async ({ env, params }) => {
  const p = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(params.id).first();
  if (!p) throw new HttpError('Hodinky nenalezeny', 404);
  return json(describe(p));
});

// Fotografie: telefon je předem zmenší a odstraní z nich metadata (GPS)
const isWebp = (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45;
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
route('POST', 'products/:id/images', async ({ env, params, request, user }) => {
  const p = await env.DB.prepare('SELECT title FROM products WHERE id = ?').bind(params.id).first();
  if (!p) throw new HttpError('Hodinky nenalezeny', 404);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').bind(params.id).first();
  if (n >= 20) throw new HttpError('Maximálně 20 fotografií na hodinky');
  const form = await request.formData();
  const imgId = randomId(8);
  const keys = {};
  for (const [field, max] of [['large', 4e6], ['small', 1e6]]) {
    const f = form.get(field);
    if (!f || typeof f === 'string' || f.size > max) throw new HttpError('Neplatná nebo příliš velká fotografie');
    const buf = new Uint8Array(await f.arrayBuffer());
    const type = isWebp(buf) ? 'webp' : isJpeg(buf) ? 'jpg' : null;
    if (!type) throw new HttpError('Podporované formáty jsou JPEG a WebP');
    keys[field] = `products/${params.id}/${imgId}-${field[0]}.${type}`;
    await media(env).put(keys[field], buf, type === 'webp' ? 'image/webp' : 'image/jpeg');
  }
  const width = int(form.get('width'), { max: 10000 }); const height = int(form.get('height'), { max: 10000 });
  await env.DB.prepare('INSERT INTO product_images (id, product_id, key_large, key_small, width, height, alt, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(imgId, params.id, keys.large, keys.small, width, height, str(form.get('alt'), { max: 200 }) || p.title, n).run();
  await env.DB.prepare('UPDATE products SET updated_at = ? WHERE id = ?').bind(now(), params.id).run();
  await audit(env, user.email, 'foto_nahrano', 'product', params.id);
  return json({ id: imgId }, 201);
});
route('DELETE', 'images/:id', async ({ env, params, user }) => {
  const i = await env.DB.prepare('SELECT * FROM product_images WHERE id = ?').bind(params.id).first();
  if (!i) throw new HttpError('Fotografie nenalezena', 404);
  await media(env).delete([i.key_large, i.key_small]);
  await env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(params.id).run();
  await audit(env, user.email, 'foto_smazano', 'product', i.product_id);
  return json({ ok: true });
});
route('PUT', 'products/:id/images/order', async ({ env, params, body }) => {
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 50) : [];
  await env.DB.batch(ids.map((id, n) => env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?').bind(n, id, params.id)));
  return json({ ok: true });
});

// --- Objednávky -----------------------------------------------------------------
route('GET', 'orders', async ({ env }) => {
  await releaseExpired(env);
  const { results } = await env.DB.prepare('SELECT id, number, status, mode, name, email, total, payment_method, shipping_method, created_at, reserved_until FROM orders ORDER BY created_at DESC LIMIT 300').all();
  return json({ orders: results });
});
route('GET', 'orders/:id', async ({ env, params }) => {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!order) throw new HttpError('Objednávka nenalezena', 404);
  const { results: items } = await env.DB.prepare('SELECT i.*, p.slug, p.status AS product_status FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE order_id = ?').bind(params.id).all();
  const { results: withdrawals } = await env.DB.prepare('SELECT * FROM withdrawals WHERE order_id = ? OR order_number = ?').bind(params.id, order.number).all();
  const { results: invoices } = await env.DB.prepare('SELECT id, number, public_token, total, paid_at, cancelled_at FROM invoices WHERE order_id = ?').bind(params.id).all();
  return json({ order, items, withdrawals, invoices });
});
route('POST', 'orders/:id/paid', async ({ env, params, user, request }) => json({ order: await markPaid(env, params.id, user.email, new URL(request.url).origin) }));
// DT Logistics – expedice: založení zásilky v Zásilkovně a štítek k tisku (jen na pokyn majitele)
route('POST', 'orders/:id/packeta', async ({ env, params, body, user }) => {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
  if (!o) throw new HttpError('Objednávka nenalezena', 404);
  if (!['paid', 'awaiting_payment', 'shipped'].includes(o.status) || (o.status === 'awaiting_payment' && o.payment_method !== 'cod')) throw new HttpError('Zásilku lze založit jen u zaplacené objednávky nebo dobírky');
  const settings = await getSettings(env);
  const r = await createPacket(env, o, { weightKg: body.weight, settings });
  await audit(env, user.email, 'zasilka_zalozena', 'order', o.id, { tracking: r.tracking });
  // Štítek ≠ odeslání: objednávka se označí „odesláno“ (a zákazník dostane e-mail) až když dopravce zásilku převezme
  // (hodinová kontrola DT Logistics) nebo když majitel klepne na „Předáno dopravci“.
  return json(r, 201);
});
route('GET', 'orders/:id/packeta-label', async ({ env, params }) => {
  const o = await env.DB.prepare('SELECT number, tracking_number FROM orders WHERE id = ?').bind(params.id).first();
  if (!o?.tracking_number) throw new HttpError('Objednávka nemá číslo zásilky', 404);
  const pdf = await labelPdf(env, o.tracking_number);
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="stitek-${o.number}.pdf"`, 'Cache-Control': 'private, no-store' } });
});
// DT Logistics: aktuální stav zásilky Zásilkovny
route('POST', 'orders/:id/tracking', async ({ env, params }) => {
  const o = await env.DB.prepare('SELECT id, tracking_number FROM orders WHERE id = ?').bind(params.id).first();
  if (!o) throw new HttpError('Objednávka nenalezena', 404);
  return json(await refreshOrder(env, o));
});
route('POST', 'orders/:id/shipped', async ({ env, params, body, user }) => { await markShipped(env, params.id, str(body.tracking, { max: 60 }), user.email); return json({ ok: true }); });
route('POST', 'orders/:id/cancel', async ({ env, params, user }) => { await cancelOrder(env, params.id, user.email); return json({ ok: true }); });
route('POST', 'orders/:id/delivered', async ({ env, params, body, user }) => { await markDelivered(env, params.id, body.delivered_on, user.email); return json({ ok: true }); });
route('POST', 'orders/:id/status', async ({ env, params, body, user }) => {
  const status = oneOf(body.status, ['completed', 'withdrawn'], 'stav');
  await env.DB.prepare(`UPDATE orders SET status = ?, ${status === 'completed' ? 'completed_at' : 'cancelled_at'} = ?, updated_at = ? WHERE id = ?`).bind(status, now(), now(), params.id).run();
  if (status === 'withdrawn') await env.DB.prepare("UPDATE products SET status='available', sold_at=NULL, reserved_order_id=NULL, reserved_until=NULL, updated_at=? WHERE id IN (SELECT product_id FROM order_items WHERE order_id=?) AND status IN ('sold','reserved')").bind(now(), params.id).run();
  await audit(env, user.email, `objednavka_${status}`, 'order', params.id);
  return json({ ok: true });
});
route('PUT', 'orders/:id/note', async ({ env, params, body }) => {
  await env.DB.prepare('UPDATE orders SET internal_note = ?, updated_at = ? WHERE id = ?').bind(str(body.note, { max: 2000 }), now(), params.id).run();
  return json({ ok: true });
});

// --- Zákazníci --------------------------------------------------------------------
route('GET', 'customers', async ({ env, request }) => {
  const q = `%${(new URL(request.url).searchParams.get('q') || '').slice(0, 60)}%`;
  const { results } = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders, (SELECT COUNT(*) FROM commissions k WHERE k.customer_id = c.id) AS commissions
    FROM customers c WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? ORDER BY c.updated_at DESC LIMIT 200`).bind(q, q, q).all();
  return json({ customers: results });
});
route('GET', 'customers/:id', async ({ env, params }) => {
  const customer = await env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(params.id).first();
  if (!customer) throw new HttpError('Zákazník nenalezen', 404);
  const { results: orders } = await env.DB.prepare('SELECT id, number, status, total, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC').bind(params.id).all();
  const { results: commissions } = await env.DB.prepare('SELECT id, number, type, status, created_at FROM commissions WHERE customer_id = ? ORDER BY created_at DESC').bind(params.id).all();
  const { results: inquiries } = await env.DB.prepare('SELECT id, type, status, created_at, message FROM inquiries WHERE email = ? COLLATE NOCASE ORDER BY created_at DESC').bind(customer.email).all();
  const { results: invoices } = await env.DB.prepare('SELECT id, number, kind, total, issued_at, paid_at, cancelled_at FROM invoices WHERE buyer_email = ? COLLATE NOCASE ORDER BY issued_at DESC LIMIT 50').bind(customer.email).all();
  return json({ customer, orders, commissions, inquiries, invoices });
});
route('PUT', 'customers/:id', async ({ env, params, body, user }) => {
  await env.DB.prepare('UPDATE customers SET name = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.name, { max: 120 }), str(body.phone, { max: 40 }), str(body.note, { max: 2000 }), now(), params.id).run();
  await audit(env, user.email, 'zakaznik_upraven', 'customer', params.id);
  return json({ ok: true });
});
// Smazání zákazníka (např. žádost o výmaz podle GDPR) jen bez objednávek, zakázek a dokladů – ty se musí uchovat
route('DELETE', 'customers/:id', async ({ env, params, user }) => {
  const c = await env.DB.prepare('SELECT id, email FROM customers WHERE id = ?').bind(params.id).first();
  if (!c) throw new HttpError('Zákazník nenalezen', 404);
  const linked = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM orders WHERE customer_id = ?) + (SELECT COUNT(*) FROM commissions WHERE customer_id = ?) + (SELECT COUNT(*) FROM invoices WHERE buyer_email = ? COLLATE NOCASE) AS n').bind(c.id, c.id, c.email).first();
  if (linked.n) throw new HttpError('Zákazník má objednávky, zakázky nebo doklady – ty je nutné uchovat (účetní a záruční lhůty), proto ho smazat nelze.', 409);
  await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(c.id).run();
  await audit(env, user.email, 'zakaznik_smazan', 'customer', c.id);
  return json({ ok: true });
});

// --- Zakázky ------------------------------------------------------------------------
async function upsertCustomer(env, body) {
  const email = vEmail(body.email);
  const name = str(body.name, { max: 120, required: true, name: 'jméno zákazníka' });
  await env.DB.prepare('INSERT INTO customers (id, email, name, phone) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = COALESCE(excluded.phone, customers.phone), updated_at = ?')
    .bind(randomId(), email, name, str(body.phone, { max: 40 }), now()).run();
  return (await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first()).id;
}
// Bez e-mailu se telefon uloží ke kontaktu zakázky (jinak k zákazníkovi)
function contactWithoutEmail(body, d) {
  const phone = str(body.phone, { max: 40 });
  if (!String(body.email || '').trim() && phone) d.contact_info = [phone, d.contact_info ?? str(body.contact_info, { max: 200 })].filter(Boolean).join(', ');
}
function commissionInput(body) {
  const d = {};
  if ('type' in body) d.type = oneOf(body.type, ['servis', 'renovace', 'zakazkova_vyroba', 'prestavba'], 'druh zakázky');
  if ('status' in body) d.status = oneOf(body.status, ['poptavka', 'nabidka', 'prijato', 'v_praci', 'ceka_na_dily', 'hotovo', 'predano', 'zruseno'], 'stav');
  for (const [k, max] of [['contact_info', 200], ['contact_street', 120], ['contact_city', 80], ['contact_zip', 12], ['watch', 500], ['caliber', 100], ['description', 4000], ['internal_note', 4000], ['due_date', 20], ['received_at', 20], ['returned_at', 20], ['deposit_received_on', 20]]) if (k in body) d[k] = str(body[k], { max });
  for (const k of ['estimate_czk', 'deposit_czk', 'final_price_czk']) if (k in body) d[k] = int(body[k], { max: 50000000, name: 'částka' });
  // údaje pro digitální pas (originální díly s garancí pravosti, vyměněné díly)
  if ('parts_preset' in body) d.parts_preset = oneOf(body.parts_preset, ['prestavba', 'original', 'vlastni'], 'originalita hodinek');
  for (const k of ['original_parts', 'replaced_parts']) if (k in body) d[k] = str(body[k], { max: 1000 }) || null;
  if ('authenticity_parts' in body) {
    const parts = (Array.isArray(body.authenticity_parts) ? body.authenticity_parts : String(body.authenticity_parts || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
    for (const x of parts) oneOf(x, ['strojek', 'cifernik', 'rucicky'], 'součást garance');
    d.authenticity_parts = [...new Set(parts)].join(',');
  }
  return d;
}
route('GET', 'commissions', async ({ env }) => {
  // Hlavní fotka: zvolená, jinak první fotka „po“, jinak první nahraná (i od zákazníka z poptávky)
  const { results } = await env.DB.prepare(`SELECT k.*, COALESCE(c.name, k.contact_name) AS customer_name, c.email AS customer_email, COALESCE(c.phone, k.contact_info) AS customer_phone,
      COALESCE((SELECT p.id FROM commission_photos p WHERE p.id = k.main_photo_id),
        (SELECT p.id FROM commission_photos p WHERE p.commission_id = k.id OR (k.inquiry_id IS NOT NULL AND p.inquiry_id = k.inquiry_id) ORDER BY CASE p.phase WHEN 'po' THEN 0 ELSE 1 END, p.created_at LIMIT 1)) AS cover_photo_id,
      (SELECT d.id FROM invoice_drafts d WHERE d.commission_id = k.id ORDER BY d.updated_at DESC LIMIT 1) AS invoice_draft_id
    FROM commissions k LEFT JOIN customers c ON c.id = k.customer_id ORDER BY CASE k.status WHEN \'predano\' THEN 1 WHEN \'zruseno\' THEN 2 ELSE 0 END, k.updated_at DESC LIMIT 300`).all();
  return json({ commissions: results });
});
route('POST', 'commissions', async ({ env, body, user }) => {
  const d = commissionInput(body);
  if (!d.type) throw new HttpError('Zvolte druh zakázky');
  d.contact_name = str(body.name, { max: 120, required: true, name: 'jméno zákazníka' });
  // E-mail je nepovinný (zákazníci z Instagramu) – do evidence zákazníků jen s e-mailem
  if (String(body.email || '').trim()) d.customer_id = await upsertCustomer(env, body);
  contactWithoutEmail(body, d);
  d.number = `Z-${new Date().getFullYear()}-${String(await nextCounter(env, 'commission')).padStart(3, '0')}`;
  if (body.inquiry_id) { d.inquiry_id = str(body.inquiry_id, { max: 40 }); await env.DB.prepare("UPDATE inquiries SET status='vyrizuje_se' WHERE id = ?").bind(d.inquiry_id).run(); }
  const id = randomId(); const keys = Object.keys(d);
  await env.DB.prepare(`INSERT INTO commissions (id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`).bind(id, ...keys.map((k) => d[k])).run();
  await audit(env, user.email, 'zakazka_vytvorena', 'commission', id, { number: d.number });
  await CPH.linkInquiry(env, d.inquiry_id, id);
  await PAS.onCommissionStatus(env, id, user.email); // digitální pas po přijetí zakázky
  return json({ id, number: d.number }, 201);
});
route('PUT', 'commissions/:id', async ({ env, params, body, user }) => {
  const d = commissionInput(body);
  if ('name' in body) d.contact_name = str(body.name, { max: 120, required: true, name: 'jméno zákazníka' });
  if (String(body.email || '').trim()) d.customer_id = await upsertCustomer(env, body);
  contactWithoutEmail(body, d);
  d.updated_at = now();
  const keys = Object.keys(d);
  await env.DB.prepare(`UPDATE commissions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => d[k]), params.id).run();
  await audit(env, user.email, 'zakazka_upravena', 'commission', params.id, { status: d.status });
  if ('status' in d) await PAS.onCommissionStatus(env, params.id, user.email); // pas: založení po přijetí, zápis práce a předání
  await PAS.syncFromCommission(env, params.id, user.email); // údaje hodinek ze zakázky se přepíšou do pasu
  return json({ ok: true });
});
// Fotografie zakázky (z atelieru i od zákazníka) – soukromé, jen po přihlášení
// Smazání zakázky jen bez navázaných dokladů a nákladů (jinak archiv = stav „Zrušeno“)
route('DELETE', 'commissions/:id', async ({ env, params, user }) => {
  const k = await env.DB.prepare('SELECT id, number FROM commissions WHERE id = ?').bind(params.id).first();
  if (!k) throw new HttpError('Zakázka nenalezena', 404);
  const inv = await env.DB.prepare('SELECT number FROM invoices WHERE commission_id = ? LIMIT 1').bind(k.id).first();
  if (inv) throw new HttpError(`Zakázka má doklad ${inv.number} – smazat ji nelze (účetní evidence). Nastavte stav „Zrušeno“, zakázka se přesune do archivu.`, 409);
  const cost = await env.DB.prepare('SELECT 1 FROM costs WHERE commission_id = ? LIMIT 1').bind(k.id).first();
  const part = await env.DB.prepare('SELECT 1 FROM parts WHERE commission_id = ? LIMIT 1').bind(k.id).first();
  if (cost || part) throw new HttpError('Zakázka má zapsané náklady nebo použité díly – nejdřív je odeberte, nebo nastavte stav „Zrušeno“ (archiv).', 409);
  const { results: photos } = await env.DB.prepare('SELECT id FROM commission_photos WHERE commission_id = ?').bind(k.id).all();
  for (const f of photos) await CPH.remove(env, f.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM invoice_drafts WHERE commission_id = ?').bind(k.id),
    env.DB.prepare('DELETE FROM commissions WHERE id = ?').bind(k.id),
  ]);
  await audit(env, user.email, 'zakazka_smazana', 'commission', k.id, { number: k.number });
  return json({ ok: true });
});
// Historie změn záznamu (deník audit_log)
route('GET', 'history/:entity/:id', async ({ env, params }) => {
  const { results } = await env.DB.prepare('SELECT at, actor, action, details FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT 60').bind(params.entity, params.id).all();
  return json({ history: results });
});
route('GET', 'commissions/:id/photos', async ({ env, params }) => json({ photos: await CPH.forCommission(env, params.id) }));
route('POST', 'commissions/:id/photos', async ({ env, params, request, user }) => {
  const photos = await CPH.forCommission(env, params.id);
  if (photos.length >= CPH.MAX_PER_COMMISSION) throw new HttpError(`Maximálně ${CPH.MAX_PER_COMMISSION} fotografií na zakázku`);
  const form = await request.formData();
  const id = await CPH.save(env, { commissionId: params.id, source: 'atelier', large: form.get('large'), small: form.get('small'), width: form.get('width'), height: form.get('height'), phase: form.get('phase') });
  await env.DB.prepare('UPDATE commissions SET updated_at = ? WHERE id = ?').bind(now(), params.id).run();
  await audit(env, user.email, 'zakazka_foto', 'commission', params.id);
  return json({ id }, 201);
});
route('PUT', 'commission-photos/:id', async ({ env, params, body, user }) => {
  await CPH.setPhase(env, params.id, body.phase);
  await audit(env, user.email, 'zakazka_foto_faze', 'commission_photo', params.id, { phase: body.phase || null });
  return json({ ok: true });
});
route('PUT', 'commissions/:id/main-photo', async ({ env, params, body, user }) => {
  await CPH.setMain(env, params.id, body.photo_id ? str(body.photo_id, { max: 40 }) : null);
  await audit(env, user.email, 'zakazka_hlavni_foto', 'commission', params.id, { photo: body.photo_id || null });
  return json({ ok: true });
});
route('POST', 'commissions/:id/parts', async ({ env, params, body, user }) => json({ id: await FIN.usePartInCommission(env, params.id, str(body.part_id, { max: 40, required: true, name: 'díl' }), body.qty, user.email) }, 201));
route('DELETE', 'commissions/:id/parts/:pid', async ({ env, params, user }) => { await FIN.returnPartFromCommission(env, params.id, params.pid, user.email); return json({ ok: true }); });
route('GET', 'commissions/:id/economics', async ({ env, params }) => json(await FIN.commissionEconomics(env, params.id)));
route('GET', 'commission-photos/:id/:size', async ({ env, params }) => CPH.file(env, params.id, params.size));
route('DELETE', 'commission-photos/:id', async ({ env, params, user }) => {
  const p = await CPH.remove(env, params.id);
  await audit(env, user.email, 'zakazka_foto_smazano', p.commission_id ? 'commission' : 'inquiry', p.commission_id || p.inquiry_id);
  return json({ ok: true });
});

// --- Garanční prohlídky (Dante Time OS E1) -------------------------------------------
route('GET', 'warranty', async ({ env }) => json({ inspections: await W.list(env) }));
route('POST', 'warranty', async ({ env, body, user }) => {
  const id = await W.createManual(env, {
    watch_title: str(body.watch_title, { max: 200, required: true, name: 'hodinky' }), customer_name: str(body.customer_name, { max: 120, required: true, name: 'jméno' }),
    customer_email: vEmail(body.customer_email), lang: body.lang, handover_date: body.handover_date,
  }, user.email);
  return json({ id }, 201);
});
route('PUT', 'warranty/:id', async ({ env, params, body, user }) => {
  if (body.handover_date) await W.setHandover(env, params.id, String(body.handover_date).slice(0, 10), user.email);
  const set = []; const vals = [];
  if ('status' in body) { set.push('status = ?'); vals.push(oneOf(body.status, ['planovana', 'objednana', 'zrusena'], 'stav')); }
  if ('booked_for' in body) { set.push('booked_for = ?'); vals.push(body.booked_for ? String(body.booked_for).slice(0, 10) : null); }
  if ('note' in body) { set.push('note = ?'); vals.push(str(body.note, { max: 2000, required: false })); }
  if (set.length) {
    await env.DB.prepare(`UPDATE warranty_inspections SET ${set.join(', ')}, updated_at = ? WHERE id = ? AND status <> 'hotova'`).bind(...vals, now(), params.id).run();
    await audit(env, user.email, 'prohlidka_upravena', 'warranty_inspection', params.id, { status: body.status });
  }
  return json({ ok: true });
});
route('POST', 'warranty/:id/remind', async ({ env, params, user }) => { await W.sendReminder(env, params.id, user.email); return json({ ok: true }); });
route('POST', 'warranty/remind-due', async ({ env, user }) => json({ sent: await W.sendDueReminders(env, user.email) }));
route('POST', 'warranty/:id/protocol', async ({ env, params, body, user }) => json(await W.recordProtocol(env, params.id, {
  done_on: body.done_on, result: oneOf(body.result || 'ok', ['ok', 'zavada'], 'výsledek'),
  rate_s_day: num(body.rate_s_day, { min: -999, max: 999, name: 'odchylka chodu' }), amplitude_deg: int(body.amplitude_deg, { min: 0, max: 360, name: 'amplituda' }),
  beat_error_ms: num(body.beat_error_ms, { min: 0, max: 99, name: 'odchylka kroku' }), findings: str(body.findings, { max: 2000, required: false }), paid: !!body.paid,
}, user.email)));

// --- Digitální pas hodinek a certifikát pravosti (E3) -----------------------------------
route('GET', 'passports', async ({ env }) => json({ passports: await PAS.list(env), kinds: PAS.EVENT_KINDS }));
route('POST', 'passports', async ({ env, body, user }) => {
  const id = body.product_id ? await PAS.createFromProduct(env, str(body.product_id, { max: 40, required: true }), user.email) : await PAS.createManual(env, body, user.email);
  return json({ id });
});
route('GET', 'passports/:id', async ({ env, params }) => { const d = await PAS.get(env, params.id); const commission = d.passport.commission_id ? await env.DB.prepare('SELECT id, number FROM commissions WHERE id = ?').bind(d.passport.commission_id).first() : null; return json({ ...d, commission, kinds: PAS.EVENT_KINDS }); });
route('PUT', 'passports/:id', async ({ env, params, body, user }) => { await PAS.get(env, params.id); await PAS.update(env, params.id, body, user.email); return json({ ok: true }); });
route('POST', 'passports/:id/events', async ({ env, params, body, user }) => { await PAS.get(env, params.id); await PAS.addEvent(env, params.id, { ...body, ref: null }, user.email); return json({ ok: true }); });
route('DELETE', 'passports/:id/events/:eid', async ({ env, params, user }) => {
  await env.DB.prepare('DELETE FROM passport_events WHERE id = ? AND passport_id = ?').bind(params.eid, params.id).run();
  await audit(env, user.email, 'pas_zaznam_smazan', 'passport', params.id, { event: params.eid });
  return json({ ok: true });
});
// Karta k gravírování (85,6 × 54 mm): SVG s texty v křivkách, PDF ve skutečné velikosti, kontrola QR.
// Údaje vždy ze stávajícího pasu (kód a adresa pasu) – nic se nepřepisuje ani negeneruje nově.
const cardOf = (p) => ({ code: p.code, url: PAS.passportUrl(p.code), status: p.status, title: p.title });
const fileCode = (c) => String(c).replace(/[^A-Z0-9]/gi, '');
const bin = (data, type, name, download) => new Response(data, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"` } });
route('GET', 'passports/:id/card/:fmt', async ({ env, params, request }) => {
  const { passport: p } = await PAS.get(env, params.id);
  const u = new URL(request.url).searchParams; const invert = u.get('invert') === '1'; const dl = u.get('download') === '1';
  const c = cardOf(p); const suffix = invert ? '-inverze' : '';
  if (params.fmt === 'svg') return bin(CARD.cardSvg({ ...c, invert, preview: u.get('preview') === '1' }), 'image/svg+xml; charset=utf-8', `karta-pasu-${fileCode(p.code)}${suffix}.svg`, dl);
  if (params.fmt === 'pdf') return bin(CARD.cardsPdf([c], { invert }), 'application/pdf', `karta-pasu-${fileCode(p.code)}${suffix}.pdf`, dl);
  if (params.fmt === 'check') return json(CARD.qrCheck({ ...c, expectedUrl: PAS.passportUrl(p.code) }));
  throw new HttpError('Neznámý formát', 404);
});
route('GET', 'passport-cards', async ({ env, request }) => {
  const u = new URL(request.url).searchParams; const invert = u.get('invert') === '1';
  const ids = [...new Set(String(u.get('ids') || '').split(',').filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)))].slice(0, 100);
  if (!ids.length) throw new HttpError('Vyberte alespoň jeden pas', 400);
  const cards = [];
  for (const id of ids) { const { passport: p } = await PAS.get(env, id); cards.push(cardOf(p)); }
  const suffix = invert ? '-inverze' : '';
  const files = cards.flatMap((c) => [
    { name: `svg/karta-pasu-${fileCode(c.code)}${suffix}.svg`, data: CARD.cardSvg({ ...c, invert }) },
    { name: `pdf/karta-pasu-${fileCode(c.code)}${suffix}.pdf`, data: CARD.cardsPdf([c], { invert }) },
  ]);
  files.push({ name: `karty-pasu-vsechny${suffix}.pdf`, data: CARD.cardsPdf(cards, { invert }) });
  files.push({ name: 'PRECTI-ME.txt', data: `Karty digitálních pasů Dante Time (${cards.length})\r\n\r\nRozměr 85,6 × 54 mm. SVG: texty převedené na křivky – v xTool importujte a nastavte velikost 85,6 × 54 mm (měřítko 100 %).\r\nČerná = gravírovat. Inverze: pro tmavé kartičky (QR zůstane po vypálení čitelný).\r\n\r\n${cards.map((c) => `${c.code}  ${c.title}  ${c.url}`).join('\r\n')}\r\n` });
  return bin(CARD.zip(files), 'application/zip', `karty-pasu-${cards.length}${suffix}.zip`, true);
});
route('GET', 'commissions/:id/passport', async ({ env, params }) => json({ passport: await env.DB.prepare('SELECT id, code, status FROM watch_passports WHERE commission_id = ?').bind(params.id).first() }));
route('POST', 'commissions/:id/passport', async ({ env, params, user }) => json({ id: await PAS.createFromCommission(env, params.id, user.email) }, 201));
// Podpis a razítko na certifikát: obrázek v MEDIA_KV, vidí ho jen přihlášený správce a vytištěný certifikát
const SIGN_KEY = 'settings:podpis-razitko';
async function signDataUrl(env) {
  const m = await env.MEDIA_KV.getWithMetadata(SIGN_KEY, 'arrayBuffer');
  if (!m?.value) return null;
  let bin = ''; const u = new Uint8Array(m.value); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return `data:${m.metadata?.type || 'image/png'};base64,${btoa(bin)}`;
}
route('GET', 'signature', async ({ env }) => json({ image: await signDataUrl(env) }));
route('PUT', 'signature', async ({ env, body, user }) => {
  const mt = /^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
  if (!mt) throw new HttpError('Nahrajte obrázek PNG, WebP nebo JPEG');
  const bytes = Uint8Array.from(atob(mt[2]), (c) => c.charCodeAt(0));
  if (bytes.length > 400000) throw new HttpError('Obrázek je příliš velký (max. 400 kB)');
  await env.MEDIA_KV.put(SIGN_KEY, bytes, { metadata: { type: mt[1] } });
  await audit(env, user.email, 'podpis_nahran', 'settings', 'podpis', { bytes: bytes.length });
  return json({ ok: true });
});
route('DELETE', 'signature', async ({ env, user }) => { await env.MEDIA_KV.delete(SIGN_KEY); await audit(env, user.email, 'podpis_smazan', 'settings', 'podpis', {}); return json({ ok: true }); });
route('GET', 'passports/:id/certificate', async ({ env, params }) => html(PAS.certificateHtml({ ...(await PAS.get(env, params.id)), sign: await signDataUrl(env) }), 200, { 'Cache-Control': 'no-store' }));

// --- Poptávky a odstoupení -----------------------------------------------------------
route('GET', 'inquiries', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT i.*, p.title AS product_title, p.slug AS product_slug, (SELECT group_concat(f.id) FROM commission_photos f WHERE f.inquiry_id = i.id) AS photo_ids, (SELECT number FROM commissions k WHERE k.inquiry_id = i.id) AS commission_number FROM inquiries i LEFT JOIN products p ON p.id = i.product_id ORDER BY CASE i.status WHEN \'nova\' THEN 0 ELSE 1 END, i.created_at DESC LIMIT 300').all();
  return json({ inquiries: results });
});
route('PUT', 'inquiries/:id', async ({ env, params, body }) => {
  await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(oneOf(body.status, ['nova', 'vyrizuje_se', 'vyrizena', 'spam'], 'stav'), params.id).run();
  return json({ ok: true });
});
// Smazání poptávky (např. spam nebo na žádost zákazníka – GDPR). Poptávku, ze které vznikla zakázka, smazat nelze.
route('DELETE', 'inquiries/:id', async ({ env, params, user }) => {
  const i = await env.DB.prepare('SELECT id, status FROM inquiries WHERE id = ?').bind(params.id).first();
  if (!i) throw new HttpError('Poptávka nenalezena', 404);
  const k = await env.DB.prepare('SELECT number FROM commissions WHERE inquiry_id = ?').bind(params.id).first();
  if (k) throw new HttpError(`Z poptávky vznikla zakázka ${k.number} – smazat ji nelze`, 409);
  const photos = await CPH.removeForInquiry(env, params.id);
  await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(params.id).run();
  await audit(env, user.email, 'poptavka_smazana', 'inquiry', params.id, { status: i.status, photos });
  return json({ ok: true });
});
// DT Sales: návrh odpovědi (odesílá majitel sám ze svého e-mailu)
route('GET', 'inquiries/ai', async ({ env }) => { const st = await aiStatus(env, 'sales'); return json({ ready: st.ready, reason: st.reason }); });
route('POST', 'inquiries/:id/draft', async ({ env, params, body, user }) => {
  const d = await draftReply(env, params.id, { note: str(body.note, { max: 500 }) || '' });
  await audit(env, user.email, 'navrh_odpovedi', 'inquiry', params.id);
  return json(d);
});
route('GET', 'withdrawals', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 200').all();
  return json({ withdrawals: results });
});

// --- Faktury ----------------------------------------------------------------------------
route('GET', 'invoices', async ({ env, request }) => {
  const u = new URL(request.url).searchParams;
  return json(await INV.listInvoices(env, { q: u.get('q'), year: u.get('year'), channel: u.get('channel'), kind: u.get('kind'), status: u.get('status'), commission_id: u.get('commission_id') }));
});
route('GET', 'invoices/form', async ({ env, request }) => {
  const kid = new URL(request.url).searchParams.get('commission_id');
  const commission = kid ? await FIN.commissionEconomics(env, kid).then((e) => ({ id: kid, number: e.commission.number, depositCashLeft: e.depositCashLeft, advancesPaid: e.advancesPaid, price: e.price, received: e.received })).catch(() => null) : null;
  // Aktuální údaje zakázky (odběratel, hodinky, cena) – faktura se předvyplní vždy z uloženého stavu, ne ze starého odkazu
  if (commission) {
    const k = await env.DB.prepare(`SELECT k.type, k.watch, k.caliber, k.final_price_czk, k.estimate_czk, k.contact_street, k.contact_city, k.contact_zip,
        COALESCE(c.name, k.contact_name) AS name, c.email AS email FROM commissions k LEFT JOIN customers c ON c.id = k.customer_id WHERE k.id = ?`).bind(kid).first();
    if (k) Object.assign(commission, { type: k.type, watch: k.watch, caliber: k.caliber, final_price_czk: k.final_price_czk, estimate_czk: k.estimate_czk,
      buyer: { buyer_name: k.name || '', buyer_email: k.email || '', buyer_street: k.contact_street || '', buyer_city: k.contact_city || '', buyer_zip: k.contact_zip || '' } });
  }
  const autosend = (await getSettings(env)).invoice_autosend === '1';
  const { results: products } = await env.DB.prepare("SELECT id, title, price_czk, serial_ref, status FROM products WHERE status IN ('available','in_progress','draft') OR (status = 'reserved' AND reserved_order_id IS NULL) ORDER BY title").all();
  const { results: advances } = await env.DB.prepare("SELECT a.id, a.number, a.buyer_name, a.total, a.commission_id FROM invoices a WHERE a.kind = 'zalohova' AND a.cancelled_at IS NULL AND a.paid_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices f WHERE f.related_invoice_id = a.id AND f.kind = 'faktura' AND f.cancelled_at IS NULL) ORDER BY a.issued_at DESC").all();
  return json({ products, advances, kinds: INVOICE_KINDS, channels: SALE_CHANNELS, pay: INVOICE_PAY, commission, autosend });
});
// Koncepty faktur (bez čísla; číslo se přidělí až při vystavení)
route('GET', 'invoice-drafts', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT d.id, d.commission_id, d.buyer_name, d.total_czk, d.updated_at, k.number AS commission_number FROM invoice_drafts d LEFT JOIN commissions k ON k.id = d.commission_id ORDER BY d.updated_at DESC LIMIT 50').all();
  return json({ drafts: results });
});
route('GET', 'invoice-drafts/:id', async ({ env, params }) => {
  const d = await env.DB.prepare('SELECT * FROM invoice_drafts WHERE id = ?').bind(params.id).first();
  if (!d) throw new HttpError('Koncept nenalezen', 404);
  return json({ id: d.id, commission_id: d.commission_id, data: JSON.parse(d.data) });
});
route('POST', 'invoice-drafts', async ({ env, body, user }) => {
  const data = JSON.stringify(body.data || {});
  if (data.length > 50000) throw new HttpError('Koncept je příliš velký');
  const buyer = str(body.data?.fields?.buyer_name, { max: 120 }) || null;
  const total = int(body.total_czk, { max: 50000000, name: 'částka' }) ?? null;
  const kid = body.commission_id ? str(body.commission_id, { max: 40 }) : null;
  let id = body.id ? str(body.id, { max: 40 }) : null;
  if (id && await env.DB.prepare('SELECT id FROM invoice_drafts WHERE id = ?').bind(id).first()) {
    await env.DB.prepare('UPDATE invoice_drafts SET data = ?, buyer_name = ?, total_czk = ?, commission_id = ?, updated_at = ? WHERE id = ?').bind(data, buyer, total, kid, now(), id).run();
  } else {
    id = randomId();
    await env.DB.prepare('INSERT INTO invoice_drafts (id, commission_id, buyer_name, total_czk, data) VALUES (?, ?, ?, ?, ?)').bind(id, kid, buyer, total, data).run();
    await audit(env, user.email, 'koncept_faktury', 'invoice_draft', id);
  }
  return json({ id });
});
route('DELETE', 'invoice-drafts/:id', async ({ env, params }) => {
  await env.DB.prepare('DELETE FROM invoice_drafts WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
});
// Náhled dokladu z rozpracovaného formuláře – nic se neuloží, číslo se nepřidělí
route('POST', 'invoices/preview', async ({ env, body, user }) => {
  let commission = null;
  if (body.commission_id) commission = await env.DB.prepare('SELECT number FROM commissions WHERE id = ?').bind(body.commission_id).first();
  const { inv, related } = await INV.issueManual(env, { ...body, channel: body.channel || (commission ? 'zakazka' : 'osobne'), note: body.note || (commission ? `Zakázka ${commission.number}` : null) }, user.email, undefined, { preview: true });
  return json({ html: renderInvoicePage(inv, { related, preview: true }) });
});
route('POST', 'invoices', async ({ env, body, user, request }) => {
  let commission = null;
  if (body.commission_id) commission = await env.DB.prepare('SELECT number FROM commissions WHERE id = ?').bind(body.commission_id).first();
  const inv = await INV.issueManual(env, { ...body, channel: body.channel || (commission ? 'zakazka' : 'osobne'), note: body.note || (commission ? `Zakázka ${commission.number}` : null) }, user.email, new URL(request.url).origin);
  if (body.draft_id) await env.DB.prepare('DELETE FROM invoice_drafts WHERE id = ?').bind(String(body.draft_id)).run(); // koncept je vystaven
  return json({ id: inv.id, number: inv.number, token: inv.public_token, done: inv.done, sendMode: inv.sendMode }, 201);
});
// „Uhrazeno“ jedním klepnutím = platba zbývající částky dnešním datem
route('POST', 'invoices/:id/paid', async ({ env, params, body, user }) => {
  const d = await INV.invoiceDetail(env, params.id);
  if (d.invoice.cancelled_at) throw new HttpError('Doklad je stornovaný');
  if (d.remaining === 0) return json({ ok: true, already: true });
  return json(await PAY.addPayment(env, params.id, { amount: d.remaining, paid_on: body.paid_on, method: body.method, note: 'Doplatek' }, user.email));
});
route('GET', 'invoices/:id', async ({ env, params }) => json(await INV.invoiceDetail(env, params.id)));
route('POST', 'invoices/:id/payments', async ({ env, params, body, user }) => json(await PAY.addPayment(env, params.id, body, user.email), 201));
route('POST', 'invoice-payments/:id/cancel', async ({ env, params, body, user }) => { await PAY.cancelPayment(env, params.id, body.reason, user.email); return json({ ok: true }); });
route('POST', 'invoices/:id/copy', async ({ env, params, user }) => json(await INV.copyToDraft(env, params.id, user.email), 201));
route('PUT', 'invoices/:id/buyer', async ({ env, params, body, user }) => json({ ok: true, ...(await INV.updateBuyer(env, params.id, body, user.email)) }));
route('POST', 'invoices/:id/cancel', async ({ env, params, body, user }) => { await INV.cancelInvoice(env, params.id, user.email, body.reason); return json({ ok: true }); });
route('POST', 'invoices/:id/credit', async ({ env, params, body, user }) => { const inv = await INV.creditNote(env, params.id, body, user.email); return json({ id: inv.id, number: inv.number, token: inv.public_token }, 201); });
route('POST', 'invoices/:id/send', async ({ env, params, user, request }) => { await INV.sendInvoice(env, params.id, user.email, new URL(request.url).origin); return json({ ok: true }); });

// --- Dopravci (ceny, příplatky, dobírka, země, limity, výluky, automatizace) -----------------
route('GET', 'shipping-methods', async ({ env }) => json({ methods: await SHIP.loadMethods(env), providers: SHIP.PROVIDERS, metals: SHIP.METALS_EXCLUDABLE, packetaKey: Boolean(env.PACKETA_API_KEY), packetaApi: Boolean(env.PACKETA_API_PASSWORD) }));
route('POST', 'shipping-methods', async ({ env, body, user }) => json({ method: await SHIP.saveMethod(env, str(body.id, { max: 32, required: true, name: 'kód' }), body, user.email, { create: true }) }, 201));
route('PUT', 'shipping-methods/:id', async ({ env, params, body, user }) => {
  if (body.status === 'aktivni') {
    const cur = await SHIP.methodById(env, params.id);
    const prices = body.prices ?? cur?.prices ?? {};
    if (!Object.values(typeof prices === 'string' ? JSON.parse(prices || '{}') : prices).some((v) => v !== '' && v != null)) throw new HttpError('Před zapnutím vyplňte cenu alespoň pro jednu zemi');
  }
  return json({ method: await SHIP.saveMethod(env, params.id, body, user.email) });
});
// Náhled pokladny: co uvidí zákazník pro zemi, hodnotu a materiál pouzdra
route('GET', 'shipping-preview', async ({ env, request }) => {
  const u = new URL(request.url);
  const metal = u.searchParams.get('metal');
  return json({ rows: await SHIP.preview(env, { country: (u.searchParams.get('country') || 'CZ').toUpperCase(), value: Number(u.searchParams.get('value')) || 0, metals: metal ? [metal] : [] }) });
});
route('PUT', 'orders/:id/shipping-cost', async ({ env, params, body, user }) => json({ cost: await setShippingCost(env, params.id, body.amount, user.email) }));

// --- Nastavení, e-maily, historie ------------------------------------------------------
const SETTINGS = { shipping_zasilkovna_czk: 'int', shipping_balikovna_czk: 'int', shipping_osobni_enabled: 'bool', reservation_hours_bank: 'int', reservation_minutes_card: 'int', cod_enabled: 'bool', cod_fee_czk: 'int',
  eur_rate: 'num', punc_notified: 'bool', shipping_eu_insured_json: 'json', insured_threshold_czk: 'int', insured_price_czk: 'int', insured_eu_price_czk: 'int', shipping_eu_json: 'json', invoice_autosend: 'bool',
  shipping_packeta_pickup_json: 'json', shipping_packeta_home_json: 'json', packeta_home_carriers_json: 'json', ship_autonotify: 'bool',
  auto_label: 'bool', label_weight_kg: 'num', cover_packeta_czk: 'int', cover_packeta_eu_eur: 'int', cover_balikovna_czk: 'int', cover_insured_czk: 'int', cover_insured_eu_czk: 'int' };
// U těchto nastavení smí být i ČR (doručení na adresu v ČR)
const JSON_WITH_CZ = new Set(['shipping_packeta_home_json', 'packeta_home_carriers_json']);
route('GET', 'settings', async ({ env }) => {
  const s = await getSettings(env);
  return json({
    settings: s,
    integrations: {
      mode: mode(env), email: env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY), card: Boolean(payGateway(env)), cardGateway: payGateway(env), cardLive: payLive(env), cardDiag: payGateway(env) === 'stripe' ? cardDiagnostics(env) : null,
      cardLive: payLive(env), packeta: Boolean(env.PACKETA_API_KEY), packetaTracking: Boolean(env.PACKETA_API_PASSWORD), iban: Boolean(OPERATOR.iban),
    },
  });
});
route('PUT', 'settings', async ({ env, body, user }) => {
  const stmts = [];
  for (const [k, type] of Object.entries(SETTINGS)) {
    if (!(k in body)) continue;
    let v;
    if (type === 'bool') v = body[k] ? '1' : '0';
    else if (type === 'json') {
      const obj = typeof body[k] === 'object' && body[k] ? body[k] : {};
      const clean = {};
      for (const [cc, price] of Object.entries(obj)) {
        if (!/^[A-Z]{2}$/.test(cc) || (cc === 'CZ' && !JSON_WITH_CZ.has(k))) continue;
        if (price === '' || price == null) continue;
        clean[cc] = int(price, { max: 100000, nullable: false, name: k === 'packeta_home_carriers_json' ? `dopravce ${cc}` : `cena dopravy ${cc}` });
      }
      v = JSON.stringify(clean);
    } else if (body[k] === '' || body[k] == null) v = null;
    else v = String(type === 'num' ? (k === 'label_weight_kg' ? num(body[k], { min: 0.05, max: 30, name: 'hmotnost' }) : num(body[k], { min: 1, max: 1000, name: 'kurz EUR' })) : int(body[k], { max: 10000000, name: k }));
    stmts.push(env.DB.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').bind(v, now(), k));
  }
  if (stmts.length) await env.DB.batch(stmts);
  await audit(env, user.email, 'nastaveni_zmeneno', 'settings', null, Object.fromEntries(Object.keys(SETTINGS).filter((k) => k in body).map((k) => [k, body[k]])));
  return json({ ok: true });
});
route('GET', 'emails', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT id, to_addr, subject, status, error, created_at, sent_at FROM emails ORDER BY created_at DESC LIMIT 100').all();
  return json({ emails: results });
});
route('GET', 'emails/:id', async ({ env, params }) => {
  const e = await env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(params.id).first();
  if (!e) throw new HttpError('E-mail nenalezen', 404);
  return json({ email: e });
});
route('GET', 'audit', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 150').all();
  return json({ log: results });
});

// --- Ekonomika (E2): náklady, díly, marže, přehledy, export pro účetní ------------------
route('GET', 'finance/overview', async ({ env, request }) => json(await FIN.overview(env, new URL(request.url).searchParams.get('year'))));
route('GET', 'finance/products/:id', async ({ env, params }) => json(await FIN.productEconomics(env, params.id)));
route('GET', 'costs', async ({ env, request }) => {
  const u = new URL(request.url).searchParams;
  // volne = nepřiřazené skutečně zaplacené výdaje (lze je přiřadit k zakázce, bez nového zadání)
  const where = [u.get('volne') ? "c.product_id IS NULL AND c.commission_id IS NULL AND c.estimate = 0 AND c.status = 'potvrzeno' AND c.amount_czk > 0" : u.get('overhead') ? 'c.product_id IS NULL AND c.commission_id IS NULL' : '1=1'];
  const binds = [];
  // Hledání a filtry (jako v účetních programech): text, druh, rok/měsíc, přiřazení, bez dokladu
  const q = (u.get('q') || '').trim().slice(0, 100);
  if (q) { where.push("(c.description LIKE ? OR COALESCE(c.supplier,'') LIKE ? OR COALESCE(c.document_ref,'') LIKE ? OR COALESCE(c.note,'') LIKE ? OR COALESCE(c.order_ref,'') LIKE ?)"); binds.push(...Array(5).fill(`%${q}%`)); }
  if (u.get('category') && FIN.COST_CATS[u.get('category')]) { where.push('c.category = ?'); binds.push(u.get('category')); }
  if (/^\d{4}(-\d{2})?$/.test(u.get('obdobi') || '')) { where.push('substr(c.cost_date, 1, ?) = ?'); binds.push(u.get('obdobi').length, u.get('obdobi')); }
  const pr = u.get('prirazeni');
  if (pr === 'provoz') where.push('c.product_id IS NULL AND c.commission_id IS NULL');
  if (pr === 'hodinky') where.push('c.product_id IS NOT NULL');
  if (pr === 'zakazka') where.push('c.commission_id IS NOT NULL');
  if (u.get('bez_dokladu')) where.push('NOT EXISTS (SELECT 1 FROM documents d WHERE d.cost_id = c.id)');
  const { results } = await env.DB.prepare(`SELECT c.*, p.title AS product_title, (SELECT number FROM commissions k WHERE k.id = c.commission_id) AS commission_number, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS docs FROM costs c LEFT JOIN products p ON p.id = c.product_id WHERE ${where.join(' AND ')} ORDER BY c.cost_date DESC, c.created_at DESC LIMIT 500`).bind(...binds).all();
  return json({ costs: results, categories: FIN.COST_CATS });
});
route('POST', 'costs', async ({ env, body, user }) => json({ id: await FIN.addCost(env, body, user.email) }, 201));
route('GET', 'costs/:id', async ({ env, params }) => json(await FIN.getCost(env, params.id)));
route('PUT', 'costs/:id', async ({ env, params, body, user }) => json({ ok: true, ...(await FIN.updateCost(env, params.id, body, user.email)) }));
route('DELETE', 'costs/:id', async ({ env, params, user, request }) => {
  // Výchozí: přílohy se nemažou, jen odpojí (zůstanou mezi doklady bez nákladu). ?doklady=1 smaže i přílohy.
  const withDocs = new URL(request.url).searchParams.get('doklady') === '1';
  return json({ ok: true, ...(await FIN.deleteCost(env, params.id, user.email, { withDocs, removeDoc: DOC.remove })) });
});
// --- Doklady k nákladům (E3b, bez AI) ---------------------------------------------------
route('GET', 'documents', async ({ env, request }) => json({ documents: await DOC.list(env, { unassigned: !!new URL(request.url).searchParams.get('volne') }), kinds: DOC.DOC_KINDS }));
route('POST', 'documents', async ({ env, request, user }) => json({ id: await DOC.upload(env, await request.formData(), user.email) }, 201));
route('PUT', 'documents/:id', async ({ env, params, body, user }) => {
  if ('cost_id' in body) await DOC.assign(env, params.id, body.cost_id ? str(body.cost_id, { max: 40 }) : null, user.email);
  if ('kind' in body || 'note' in body) await DOC.update(env, params.id, body, user.email);
  return json({ ok: true });
});
route('GET', 'documents/:id/file', async ({ env, params, user, request }) => {
  const u = new URL(request.url).searchParams;
  return DOC.file(env, params.id, user.email, { download: u.get('download') === '1', preview: u.get('preview') === '1' });
});
route('DELETE', 'documents/:id', async ({ env, params, user }) => { await DOC.remove(env, params.id, user.email); return json({ ok: true }); });
// --- Nákupy a prodeje (E3b v2): nahrání, AI vytěžení, kontrola, ruční zadání ------------------
route('GET', 'inbox', async ({ env }) => json(await INB.overview(env)));
route('POST', 'inbox/upload', async ({ env, request, user }) => json(await INB.upload(env, await request.formData(), user.email), 201));
route('POST', 'inbox/reset-sales', async ({ env, body, user }) => {
  if (body.confirm !== 'SMAZAT') throw new HttpError('Pro potvrzení napište SMAZAT');
  return json(await INB.resetSalesImport(env, user.email));
});
route('POST', 'inbox/cleanup', async ({ env, user }) => json({ removed: await INB.cleanupDrafts(env, user.email) }));
route('POST', 'inbox/:id/extract', async ({ env, params, user }) => json(await INB.extract(env, params.id, user.email)));
route('POST', 'purchases', async ({ env, body, user }) => json({ id: await INB.savePurchase(env, null, body, user.email) }, 201));
route('PUT', 'purchases/:id', async ({ env, params, body, user }) => json({ id: await INB.savePurchase(env, params.id, body, user.email, { confirm: body.confirm !== false }) }));
route('GET', 'sales/:id', async ({ env, params }) => {
  const sale = await env.DB.prepare('SELECT s.*, p.title AS product_title FROM sales s LEFT JOIN products p ON p.id = s.product_id WHERE s.id = ?').bind(params.id).first();
  if (!sale) throw new HttpError('Prodej nenalezen', 404);
  const { results: docs } = await env.DB.prepare('SELECT id, kind, filename, mime, size, created_at FROM documents WHERE sale_id = ? ORDER BY created_at').bind(params.id).all();
  const { results: history } = await env.DB.prepare("SELECT at, actor, action, details FROM audit_log WHERE entity = 'sale' AND entity_id = ? ORDER BY id DESC LIMIT 30").bind(params.id).all();
  return json({ sale, docs, history, pay: INB.PAY });
});
route('POST', 'sales', async ({ env, body, user }) => json({ id: await INB.saveSale(env, null, body, user.email) }, 201));
route('PUT', 'sales/:id', async ({ env, params, body, user }) => json({ id: await INB.saveSale(env, params.id, body, user.email, { confirm: body.confirm !== false }) }));
route('DELETE', 'sales/:id', async ({ env, params, user }) => {
  await env.DB.prepare('DELETE FROM sales WHERE id = ?').bind(params.id).run();
  await env.DB.prepare('UPDATE documents SET sale_id = NULL WHERE sale_id = ?').bind(params.id).run();
  await audit(env, user.email, 'prodej_smazan', 'sale', params.id); return json({ ok: true });
});
route('PUT', 'finance/ai-model', async ({ env, body, user }) => {
  const { MODELS } = await import('../../../server/ai.js');
  const m = oneOf(body.ai_model, Object.keys(MODELS), 'model');
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('ai_model', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(m).run();
  await audit(env, user.email, 'ai_model', 'settings', 'ai_model', { model: m }); return json({ ok: true });
});
route('GET', 'finance/export', async ({ env, request, user }) => {
  const u = new URL(request.url).searchParams;
  const kind = u.get('kind') === 'faktury' ? 'faktury' : 'naklady';
  const csv = await FIN.exportCsv(env, kind, u.get('from'), u.get('to'));
  await audit(env, user.email, 'export_ucetni', 'finance', kind, { from: u.get('from'), to: u.get('to') });
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dante-time-${kind}-${u.get('from')}-${u.get('to')}.csv"`, 'Cache-Control': 'no-store' } });
});
route('GET', 'parts', async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT x.*, p.title AS product_title, k.number AS commission_number FROM parts x LEFT JOIN products p ON p.id = x.product_id LEFT JOIN commissions k ON k.id = x.commission_id ORDER BY CASE x.status WHEN 'skladem' THEN 0 ELSE 1 END, x.kind, x.title LIMIT 500").all();
  return json({ parts: results, kinds: FIN.PART_KINDS });
});
route('POST', 'parts', async ({ env, body, user }) => {
  const d = FIN.partInput(body); const id = randomId(); const k = Object.keys(d);
  await env.DB.prepare(`INSERT INTO parts (id, ${k.join(', ')}) VALUES (?, ${k.map(() => '?').join(', ')})`).bind(id, ...k.map((x) => d[x])).run();
  await audit(env, user.email, 'dil_pridan', 'part', id, { title: d.title }); return json({ id }, 201);
});
route('DELETE', 'parts/:id', async ({ env, params, user }) => {
  const x = await env.DB.prepare('SELECT * FROM parts WHERE id = ?').bind(params.id).first();
  if (!x) throw new HttpError('Díl nenalezen', 404);
  if (x.product_id || x.commission_id || x.status === 'pouzito' || x.status === 'prodano') throw new HttpError('Díl je použitý v hodinkách nebo zakázce – smazat ho nelze (počítá se do nákladů). Pokud je chybně zapsaný, nastavte stav „Vyřazeno“.', 409);
  await env.DB.prepare('DELETE FROM parts WHERE id = ?').bind(x.id).run();
  await audit(env, user.email, 'dil_smazan', 'part', x.id, { title: x.title });
  return json({ ok: true });
});
route('PUT', 'parts/:id', async ({ env, params, body, user }) => {
  const d = FIN.partInput(body);
  // Díl patří k hodinkám, nebo k zakázce; vrácený na sklad nepatří nikam
  if (d.product_id || d.status === 'skladem') d.commission_id = null;
  const k = Object.keys(d);
  await env.DB.prepare(`UPDATE parts SET ${k.map((x) => `${x} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...k.map((x) => d[x]), now(), params.id).run();
  await audit(env, user.email, 'dil_upraven', 'part', params.id, { status: d.status, product: d.product_id }); return json({ ok: true });
});
route('PUT', 'finance/settings', async ({ env, body, user }) => {
  const rate = int(body.labor_rate_czk, { min: 0, max: 100000, name: 'hodinová sazba' });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('labor_rate_czk', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(rate == null ? null : String(rate)).run();
  await audit(env, user.email, 'sazba_prace', 'settings', 'labor_rate_czk', { rate }); return json({ ok: true });
});

// --- Dante Time OS: přehled rolí, nálezy, schválení, náklady, zálohy -------------------
route('GET', 'system', async ({ env }) => {
  const runs = (await env.DB.prepare('SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 60').all()).results;
  const approvals = (await env.DB.prepare("SELECT * FROM approvals ORDER BY CASE status WHEN 'ceka' THEN 0 ELSE 1 END, created_at DESC LIMIT 50").all()).results;
  const backups = (await env.DB.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 10').all()).results;
  const s = await getSettings(env);
  return json({ roles: await OS.roles(env), runs, findings: await OS.openFindings(env), approvals, backups, budget: await OS.aiBudget(env), lastTick: s.os_last_tick, cron: !!env.OS_TICK_SECRET });
});
route('POST', 'system/roles/:id/pause', async ({ env, params, body, user }) => { await OS.pauseRole(env, params.id, 'majitel', str(body.reason, { max: 200 }) || `pozastavil ${user.email}`); return json({ ok: true }); });
route('POST', 'system/roles/:id/resume', async ({ env, params, user }) => { await OS.resumeRole(env, params.id, user.email); return json({ ok: true }); });
route('POST', 'system/run', async ({ env, user }) => { await audit(env, user.email, 'os_spusteno_rucne', 'os', null); return json(await OS.tick(env, { force: true })); });
route('POST', 'system/director', async ({ env, user }) => { await audit(env, user.email, 'os_souhrn_rucne', 'os', null); return json(await OS.runRole(env, 'director', 'souhrn na vyžádání', () => OS.directorSummary(env))); });
route('POST', 'system/findings/:id/resolve', async ({ env, params, user }) => {
  await env.DB.prepare('UPDATE os_findings SET resolved_at = ? WHERE id = ?').bind(now(), params.id).run();
  await audit(env, user.email, 'nalez_uzavren', 'os_finding', params.id); return json({ ok: true });
});
route('POST', 'system/approvals/:id', async ({ env, params, body, user, request }) => {
  const st = oneOf(body.decision, ['schvaleno', 'zamitnuto'], 'rozhodnutí');
  const a = await env.DB.prepare('SELECT kind, payload, status FROM approvals WHERE id = ?').bind(params.id).first();
  // Schválené odeslání faktury se rovnou provede (při chybě odeslání zůstane žádost čekat)
  if (a?.kind === 'faktura_odeslani' && a.status === 'ceka' && st === 'schvaleno') await INV.sendInvoice(env, a.payload, user.email, new URL(request.url).origin);
  await env.DB.prepare("UPDATE approvals SET status=?, decided_at=?, decided_by=? WHERE id=? AND status='ceka'").bind(st, now(), user.email, params.id).run();
  await audit(env, user.email, `schvaleni_${st}`, 'approval', params.id); return json({ ok: true });
});
route('PUT', 'system/ai-limit', async ({ env }) => { throw new HttpError('Limit AI mění majitel po schválení (R20). Napište agentovi.', 403); });
route('GET', 'system/backups/:id', async ({ env, params, user }) => {
  const b = await env.DB.prepare('SELECT * FROM backups WHERE id = ?').bind(params.id).first();
  if (!b) throw new HttpError('Záloha nenalezena', 404);
  const data = await env.MEDIA_KV.get(b.storage_key, 'arrayBuffer');
  if (!data) throw new HttpError('Záloha už vypršela', 404);
  await audit(env, user.email, 'zaloha_stazena', 'backup', params.id);
  // Šifrovaný soubor; rozšifruje ho jen držitel klíče BACKUP_KEY (scripts/backup-decrypt.mjs)
  return new Response(data, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="dante-time-${b.created_at.slice(0, 10)}.enc"`, 'Cache-Control': 'no-store' } });
});

// --- Směrovač ---------------------------------------------------------------------------
export const onRequest = handle(async (ctx) => {
  const { request, env, params } = ctx;
  assertSameOrigin(request);
  const path = (Array.isArray(params.path) ? params.path : [params.path || '']).join('/');
  for (const r of routes) {
    const m = r.method === request.method && path.match(r.re);
    if (!m) continue;
    const user = r.auth ? await requireAdmin(env, request) : null;
    const isForm = (request.headers.get('Content-Type') || '').includes('multipart/form-data');
    const body = ['POST', 'PUT'].includes(request.method) && !isForm ? await readJson(request, path === 'signature' ? 600000 : 200000).catch((e) => { if (e.status === 415 && r.method === 'POST') return {}; throw e; }) : {};
    return r.fn({ env, request, params: m.groups || {}, body, user });
  }
  throw new HttpError('Neznámá operace', 404);
});
