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
import { slugify } from '../../../src/shop/format.mjs';
import { OPERATOR } from '../../../src/site.mjs';
import * as W from '../../../server/warranty.js';
import * as OS from '../../../server/os.js';
import * as FIN from '../../../server/finance.js';
import * as PAS from '../../../server/passport.js';
import * as DOC from '../../../server/documents.js';
import * as INB from '../../../server/inbox.js';
import { html } from '../../../server/http.js';

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
  const turnover = (await q(`SELECT COALESCE(SUM(total),0) AS s FROM invoices WHERE cancelled_at IS NULL AND issued_at >= ? AND ${live}`, yearStart)).s;
  const euSales = (await q(`SELECT COALESCE(SUM(i.total),0) AS s FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.cancelled_at IS NULL AND i.issued_at >= ? AND o.billing_country <> 'CZ' AND (o.company_ico IS NULL OR o.company_ico = '') AND ${live.replace('mode', 'i.mode')}`, yearStart)).s;
  const eurRate = Number(cfg.eurRate) || 25;
  const vatLimit = 2000000;
  const euLimitCzk = Math.round(10000 * eurRate);
  if (!OPERATOR.vatPayer && turnover >= vatLimit * 0.8) warnings.push(`Obrat letos ${turnover.toLocaleString('cs-CZ')} Kč se blíží limitu pro registraci k DPH (2 000 000 Kč). Poraďte se s účetní.`);
  if (euSales >= euLimitCzk * 0.8) warnings.push(`Prodej spotřebitelům do jiných zemí EU letos ${euSales.toLocaleString('cs-CZ')} Kč se blíží limitu 10 000 € (DPH v zemi zákazníka / OSS). Poraďte se s účetní.`);
  return json({
    turnover, euSales, vatLimit, euLimitCzk,
    mode: mode(env), products: counts, warnings,
    inquiriesNew: (await q("SELECT COUNT(*) AS n FROM inquiries WHERE status='nova'")).n,
    ordersAwaiting: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='awaiting_payment'")).n,
    ordersToShip: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='paid'")).n,
    commissionsActive: (await q("SELECT COUNT(*) AS n FROM commissions WHERE status IN ('prijato','v_praci','ceka_na_dily','hotovo')")).n,
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
  if (!merged.title || merged.title === 'Hodinky' || merged.title === autoOld) merged.title = productName({ ...merged, title: null });
  d.title = merged.title;
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
    if (d.status === 'reserved') throw new HttpError('Rezervaci vytváří jen objednávka', 400);
    if (old.status === 'draft' && !old.published_at) d.published_at = now();
    if (d.status === 'sold') d.sold_at = now();
    if (d.status !== 'reserved') { d.reserved_order_id = null; d.reserved_until = null; }
  }
  if (old.status === 'draft' && (body.brand || body.model || body.year) && !old.published_at) d.slug = await uniqueSlug(env, [d.brand ?? old.brand, d.model ?? old.model, d.year ?? old.year].filter(Boolean).join(' ') || d.title, params.id);
  d.updated_at = now();
  const keys = Object.keys(d);
  await env.DB.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => d[k]), params.id).run();
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
  return json({ customer, orders, commissions, inquiries });
});
route('PUT', 'customers/:id', async ({ env, params, body }) => {
  await env.DB.prepare('UPDATE customers SET name = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.name, { max: 120 }), str(body.phone, { max: 40 }), str(body.note, { max: 2000 }), now(), params.id).run();
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
function commissionInput(body) {
  const d = {};
  if ('type' in body) d.type = oneOf(body.type, ['servis', 'renovace', 'zakazkova_vyroba', 'prestavba'], 'druh zakázky');
  if ('status' in body) d.status = oneOf(body.status, ['poptavka', 'nabidka', 'prijato', 'v_praci', 'ceka_na_dily', 'hotovo', 'predano', 'zruseno'], 'stav');
  for (const [k, max] of [['watch', 500], ['description', 4000], ['internal_note', 4000], ['due_date', 20], ['received_at', 20], ['returned_at', 20]]) if (k in body) d[k] = str(body[k], { max });
  for (const k of ['estimate_czk', 'deposit_czk', 'final_price_czk']) if (k in body) d[k] = int(body[k], { max: 50000000, name: 'částka' });
  return d;
}
route('GET', 'commissions', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT k.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM commissions k LEFT JOIN customers c ON c.id = k.customer_id ORDER BY CASE k.status WHEN \'predano\' THEN 1 WHEN \'zruseno\' THEN 2 ELSE 0 END, k.updated_at DESC LIMIT 300').all();
  return json({ commissions: results });
});
route('POST', 'commissions', async ({ env, body, user }) => {
  const d = commissionInput(body);
  if (!d.type) throw new HttpError('Zvolte druh zakázky');
  d.customer_id = await upsertCustomer(env, body);
  d.number = `Z-${new Date().getFullYear()}-${String(await nextCounter(env, 'commission')).padStart(3, '0')}`;
  if (body.inquiry_id) { d.inquiry_id = str(body.inquiry_id, { max: 40 }); await env.DB.prepare("UPDATE inquiries SET status='vyrizuje_se' WHERE id = ?").bind(d.inquiry_id).run(); }
  const id = randomId(); const keys = Object.keys(d);
  await env.DB.prepare(`INSERT INTO commissions (id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`).bind(id, ...keys.map((k) => d[k])).run();
  await audit(env, user.email, 'zakazka_vytvorena', 'commission', id, { number: d.number });
  return json({ id, number: d.number }, 201);
});
route('PUT', 'commissions/:id', async ({ env, params, body, user }) => {
  const d = commissionInput(body);
  if (body.email) d.customer_id = await upsertCustomer(env, body);
  d.updated_at = now();
  const keys = Object.keys(d);
  await env.DB.prepare(`UPDATE commissions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => d[k]), params.id).run();
  await audit(env, user.email, 'zakazka_upravena', 'commission', params.id, { status: d.status });
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
route('GET', 'passports/:id', async ({ env, params }) => { const d = await PAS.get(env, params.id); return json({ ...d, kinds: PAS.EVENT_KINDS }); });
route('PUT', 'passports/:id', async ({ env, params, body, user }) => { await PAS.get(env, params.id); await PAS.update(env, params.id, body, user.email); return json({ ok: true }); });
route('POST', 'passports/:id/events', async ({ env, params, body, user }) => { await PAS.get(env, params.id); await PAS.addEvent(env, params.id, { ...body, ref: null }, user.email); return json({ ok: true }); });
route('DELETE', 'passports/:id/events/:eid', async ({ env, params, user }) => {
  await env.DB.prepare('DELETE FROM passport_events WHERE id = ? AND passport_id = ?').bind(params.eid, params.id).run();
  await audit(env, user.email, 'pas_zaznam_smazan', 'passport', params.id, { event: params.eid });
  return json({ ok: true });
});
route('GET', 'passports/:id/certificate', async ({ env, params }) => html(PAS.certificateHtml(await PAS.get(env, params.id)), 200, { 'Cache-Control': 'no-store' }));

// --- Poptávky a odstoupení -----------------------------------------------------------
route('GET', 'inquiries', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT i.*, p.title AS product_title, p.slug AS product_slug FROM inquiries i LEFT JOIN products p ON p.id = i.product_id ORDER BY CASE i.status WHEN \'nova\' THEN 0 ELSE 1 END, i.created_at DESC LIMIT 300').all();
  return json({ inquiries: results });
});
route('PUT', 'inquiries/:id', async ({ env, params, body }) => {
  await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(oneOf(body.status, ['nova', 'vyrizuje_se', 'vyrizena', 'spam'], 'stav'), params.id).run();
  return json({ ok: true });
});
route('GET', 'withdrawals', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 200').all();
  return json({ withdrawals: results });
});

// --- Faktury ----------------------------------------------------------------------------
route('GET', 'invoices', async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT id, number, public_token, source, buyer_name, buyer_company, total, issued_at, paid_at, cancelled_at, mode, order_id, commission_id FROM invoices ORDER BY issued_at DESC LIMIT 300').all();
  return json({ invoices: results });
});
route('POST', 'invoices', async ({ env, body, user }) => {
  const items = Array.isArray(body.items) ? body.items.slice(0, 30).map((i) => ({ text: str(i.text, { max: 300, required: true, name: 'položku' }), price: int(i.price, { max: 50000000, nullable: false, name: 'cenu položky' }) })) : [];
  let commission = null;
  if (body.commission_id) commission = await env.DB.prepare('SELECT k.*, c.name, c.email FROM commissions k LEFT JOIN customers c ON c.id = k.customer_id WHERE k.id = ?').bind(body.commission_id).first();
  const paid = Boolean(body.paid);
  const dueDays = int(body.due_days, { max: 90 }) ?? 14;
  const inv = await createInvoice(env, {
    source: commission ? 'commission' : 'manual', commission_id: commission?.id || null,
    buyer_name: str(body.buyer_name, { max: 200, required: true, name: 'odběratele' }), buyer_company: str(body.buyer_company, { max: 200 }),
    buyer_ico: str(body.buyer_ico, { max: 20 }), buyer_dic: str(body.buyer_dic, { max: 20 }), buyer_street: str(body.buyer_street, { max: 200 }),
    buyer_city: str(body.buyer_city, { max: 120 }), buyer_zip: str(body.buyer_zip, { max: 12 }), buyer_email: body.buyer_email ? vEmail(body.buyer_email) : null,
    items, payment_method: oneOf(body.payment_method || 'bank_transfer', ['bank_transfer', 'card', 'cod', 'cash'], 'způsob úhrady'),
    taxable_date: str(body.taxable_date, { max: 30 }) || now(), paid_at: paid ? now() : null,
    due_date: paid ? null : new Date(Date.now() + dueDays * 86400000).toISOString(), note: str(body.note, { max: 500 }) || (commission ? `Zakázka ${commission.number}` : null),
  });
  await audit(env, user.email, 'faktura_vystavena', 'invoice', inv.id, { number: inv.number, total: inv.total });
  return json({ id: inv.id, number: inv.number, token: inv.public_token }, 201);
});
route('POST', 'invoices/:id/paid', async ({ env, params, user }) => {
  await env.DB.prepare('UPDATE invoices SET paid_at = ? WHERE id = ? AND paid_at IS NULL').bind(now(), params.id).run();
  await audit(env, user.email, 'faktura_uhrazena', 'invoice', params.id);
  return json({ ok: true });
});
route('POST', 'invoices/:id/cancel', async ({ env, params, user }) => {
  await env.DB.prepare('UPDATE invoices SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL').bind(now(), params.id).run();
  await audit(env, user.email, 'faktura_stornovana', 'invoice', params.id);
  return json({ ok: true });
});

// --- Nastavení, e-maily, historie ------------------------------------------------------
const SETTINGS = { shipping_zasilkovna_czk: 'int', shipping_balikovna_czk: 'int', shipping_osobni_enabled: 'bool', reservation_hours_bank: 'int', reservation_minutes_card: 'int', cod_enabled: 'bool', cod_fee_czk: 'int',
  eur_rate: 'num', punc_notified: 'bool', shipping_eu_insured_json: 'json', insured_threshold_czk: 'int', insured_price_czk: 'int', insured_eu_price_czk: 'int', shipping_eu_json: 'json' };
route('GET', 'settings', async ({ env }) => {
  const s = await getSettings(env);
  return json({
    settings: s,
    integrations: {
      mode: mode(env), email: env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY), card: Boolean(env.COMGATE_MERCHANT && env.COMGATE_SECRET),
      cardLive: env.PAYMENTS_LIVE === 'true', packeta: Boolean(env.PACKETA_API_KEY), iban: Boolean(OPERATOR.iban),
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
        if (!/^[A-Z]{2}$/.test(cc) || cc === 'CZ') continue;
        if (price === '' || price == null) continue;
        clean[cc] = int(price, { max: 100000, nullable: false, name: `cena dopravy ${cc}` });
      }
      v = JSON.stringify(clean);
    } else if (body[k] === '' || body[k] == null) v = null;
    else v = String(type === 'num' ? num(body[k], { min: 1, max: 1000, name: 'kurz EUR' }) : int(body[k], { max: 10000000, name: k }));
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
  const where = u.get('overhead') ? 'c.product_id IS NULL AND c.commission_id IS NULL' : '1=1';
  const { results } = await env.DB.prepare(`SELECT c.*, p.title AS product_title, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS docs FROM costs c LEFT JOIN products p ON p.id = c.product_id WHERE ${where} ORDER BY c.cost_date DESC, c.created_at DESC LIMIT 300`).all();
  return json({ costs: results, categories: FIN.COST_CATS });
});
route('POST', 'costs', async ({ env, body, user }) => json({ id: await FIN.addCost(env, body, user.email) }, 201));
route('DELETE', 'costs/:id', async ({ env, params, user }) => {
  await env.DB.prepare('DELETE FROM costs WHERE id = ?').bind(params.id).run();
  await env.DB.prepare('UPDATE documents SET cost_id = NULL WHERE cost_id = ?').bind(params.id).run(); // doklad se nemaže, jen se odpojí
  await audit(env, user.email, 'naklad_smazan', 'cost', params.id); return json({ ok: true });
});
// --- Doklady k nákladům (E3b, bez AI) ---------------------------------------------------
route('GET', 'documents', async ({ env, request }) => json({ documents: await DOC.list(env, { unassigned: !!new URL(request.url).searchParams.get('volne') }), kinds: DOC.DOC_KINDS }));
route('POST', 'documents', async ({ env, request, user }) => json({ id: await DOC.upload(env, await request.formData(), user.email) }, 201));
route('PUT', 'documents/:id', async ({ env, params, body, user }) => { await DOC.assign(env, params.id, body.cost_id ? str(body.cost_id, { max: 40 }) : null, user.email); return json({ ok: true }); });
route('GET', 'documents/:id/file', async ({ env, params, user }) => DOC.file(env, params.id, user.email));
route('DELETE', 'documents/:id', async ({ env, params, user }) => { await DOC.remove(env, params.id, user.email); return json({ ok: true }); });
// --- Nákupy a prodeje (E3b v2): nahrání, AI vytěžení, kontrola, ruční zadání ------------------
route('GET', 'inbox', async ({ env }) => json(await INB.overview(env)));
route('POST', 'inbox/upload', async ({ env, request, user }) => json(await INB.upload(env, await request.formData(), user.email), 201));
route('POST', 'inbox/:id/extract', async ({ env, params, user }) => json(await INB.extract(env, params.id, user.email)));
route('POST', 'purchases', async ({ env, body, user }) => json({ id: await INB.savePurchase(env, null, body, user.email) }, 201));
route('PUT', 'purchases/:id', async ({ env, params, body, user }) => json({ id: await INB.savePurchase(env, params.id, body, user.email, { confirm: body.confirm !== false }) }));
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
  const { results } = await env.DB.prepare("SELECT x.*, p.title AS product_title FROM parts x LEFT JOIN products p ON p.id = x.product_id ORDER BY CASE x.status WHEN 'skladem' THEN 0 ELSE 1 END, x.kind, x.title LIMIT 500").all();
  return json({ parts: results, kinds: FIN.PART_KINDS });
});
route('POST', 'parts', async ({ env, body, user }) => {
  const d = FIN.partInput(body); const id = randomId(); const k = Object.keys(d);
  await env.DB.prepare(`INSERT INTO parts (id, ${k.join(', ')}) VALUES (?, ${k.map(() => '?').join(', ')})`).bind(id, ...k.map((x) => d[x])).run();
  await audit(env, user.email, 'dil_pridan', 'part', id, { title: d.title }); return json({ id }, 201);
});
route('PUT', 'parts/:id', async ({ env, params, body, user }) => {
  const d = FIN.partInput(body); const k = Object.keys(d);
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
route('POST', 'system/approvals/:id', async ({ env, params, body, user }) => {
  const st = oneOf(body.decision, ['schvaleno', 'zamitnuto'], 'rozhodnutí');
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
    const body = ['POST', 'PUT'].includes(request.method) && !isForm ? await readJson(request, 200000).catch((e) => { if (e.status === 415 && r.method === 'POST') return {}; throw e; }) : {};
    return r.fn({ env, request, params: m.groups || {}, body, user });
  }
  throw new HttpError('Neznámá operace', 404);
});
