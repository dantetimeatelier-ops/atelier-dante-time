// API administrace. Všechny cesty kromě přihlášení vyžadují platnou relaci.
import { json, handle, readJson, HttpError, assertSameOrigin } from '../../../server/http.js';
import { requireAdmin, hashPassword, timingSafeEqual, verifyTotp, newTotpSecret, otpauthUrl, createSession, destroySession, checkLoginRate, recordLogin } from '../../../server/auth.js';
import { randomId, now, audit, releaseExpired, getSettings, nextCounter, productsWithImages, mode } from '../../../server/db.js';
import { str, email as vEmail, oneOf, int, num } from '../../../server/validate.js';
import { qrSvg } from '../../../server/qr.js';
import { media } from '../../../server/media.js';
import { markPaid, markShipped, cancelOrder, shopConfig } from '../../../server/orders.js';
import { describe, productName } from '../../../src/shop/describe.mjs';
import { slugify } from '../../../src/shop/format.mjs';
import { OPERATOR } from '../../../src/site.mjs';

const STATUSES = ['draft', 'available', 'reserved', 'sold', 'in_progress', 'archived'];
const PRODUCT_TEXT = { title: 200, brand: 80, model: 120, reference: 80, year: 20, movement: 120, case_material: 120, crystal: 80, water_resistance: 80, dial: 200, strap: 200, condition: 1000, service_done: 1000, original_parts: 1000, replaced_parts: 1000, accessories: 500, manufacturer_info: 500, safety_info: 500, description_cs: 5000, description_en: 5000, seo_title: 80, seo_description: 200 };

const routes = [];
const route = (method, pattern, fn, { auth = true } = {}) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[A-Za-z0-9_-]+)')}$`), fn, auth });

// --- Nastavení prvního účtu a přihlášení -------------------------------------
async function setupAllowed(env, token) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
  if (n > 0) throw new HttpError('Administrace už je nastavena', 403);
  if (!env.ADMIN_SETUP_TOKEN || env.ADMIN_SETUP_TOKEN.length < 24 || !timingSafeEqual(env.ADMIN_SETUP_TOKEN, token || '')) throw new HttpError('Neplatný instalační kód', 403);
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

// --- Přehled -------------------------------------------------------------------
route('GET', 'dashboard', async ({ env }) => {
  await releaseExpired(env);
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const counts = {};
  const { results } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM products GROUP BY status').all();
  for (const r of results) counts[r.status] = r.n;
  const cfg = await shopConfig(env);
  const warnings = [];
  for (const [k, label] of [['name', 'jméno / firma'], ['ico', 'IČO'], ['address', 'adresa'], ['vatPayer', 'plátce DPH'], ['iban', 'IBAN pro QR platbu']]) {
    if (OPERATOR[k] == null && !(k === 'iban' && env.SHOP_IBAN)) warnings.push(`Chybí údaj provozovatele: ${label}`);
  }
  if (!cfg.shipping.length) warnings.push('Nejsou nastaveny ceny dopravy (Nastavení)');
  if (!cfg.payment.length) warnings.push('Není dostupný žádný způsob platby');
  if (env.EMAIL_PROVIDER !== 'resend') warnings.push('E-maily se zatím neodesílají, jen ukládají (chybí poskytovatel e-mailů)');
  return json({
    mode: mode(env), products: counts, warnings,
    inquiriesNew: (await q("SELECT COUNT(*) AS n FROM inquiries WHERE status='nova'")).n,
    ordersAwaiting: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='awaiting_payment'")).n,
    ordersToShip: (await q("SELECT COUNT(*) AS n FROM orders WHERE status='paid'")).n,
    commissionsActive: (await q("SELECT COUNT(*) AS n FROM commissions WHERE status IN ('prijato','v_praci','ceka_na_dily','hotovo')")).n,
    withdrawals: (await q('SELECT COUNT(*) AS n FROM withdrawals WHERE created_at > ?', new Date(Date.now() - 30 * 86400000).toISOString())).n,
  });
});

// --- Hodinky -------------------------------------------------------------------
function productInput(body, existing = {}) {
  const d = {};
  for (const [k, max] of Object.entries(PRODUCT_TEXT)) if (k in body) d[k] = str(body[k], { max, name: k });
  if ('status' in body) d.status = oneOf(body.status, STATUSES, 'stav');
  if ('movement_type' in body) d.movement_type = body.movement_type ? oneOf(body.movement_type, ['manual', 'automatic'], 'nátah') : null;
  if ('case_diameter_mm' in body) d.case_diameter_mm = num(body.case_diameter_mm, { max: 80, name: 'průměr' });
  if ('lug_width_mm' in body) d.lug_width_mm = num(body.lug_width_mm, { max: 40, name: 'šířka uchycení' });
  if ('price_czk' in body) d.price_czk = int(body.price_czk, { max: 50000000, name: 'cena' });
  if ('featured' in body) d.featured = body.featured ? 1 : 0;
  if ('sort_order' in body) d.sort_order = int(body.sort_order, { min: -10000, max: 10000, nullable: false, name: 'pořadí' });
  const merged = { ...existing, ...d };
  // Název se skládá automaticky ze značky a modelu, pokud majitel nezadal vlastní
  const autoOld = productName({ ...existing, title: null });
  if (!merged.title || merged.title === 'Hodinky' || merged.title === autoOld) merged.title = productName({ ...merged, title: null });
  d.title = merged.title;
  if (d.status === 'available' && merged.price_czk == null) throw new HttpError('Pro zveřejnění „Skladem“ vyplňte cenu');
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
  const d = productInput(body);
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
  const d = productInput(body, old);
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
  return json({ order, items, withdrawals });
});
route('POST', 'orders/:id/paid', async ({ env, params, user, request }) => json({ order: await markPaid(env, params.id, user.email, new URL(request.url).origin) }));
route('POST', 'orders/:id/shipped', async ({ env, params, body, user }) => { await markShipped(env, params.id, str(body.tracking, { max: 60 }), user.email); return json({ ok: true }); });
route('POST', 'orders/:id/cancel', async ({ env, params, user }) => { await cancelOrder(env, params.id, user.email); return json({ ok: true }); });
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

// --- Nastavení, e-maily, historie ------------------------------------------------------
const SETTINGS = { shipping_zasilkovna_czk: 'int', shipping_balikovna_czk: 'int', shipping_osobni_enabled: 'bool', reservation_hours_bank: 'int', reservation_minutes_card: 'int' };
route('GET', 'settings', async ({ env }) => {
  const s = await getSettings(env);
  return json({
    settings: s,
    integrations: {
      mode: mode(env), email: env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY), card: Boolean(env.COMGATE_MERCHANT && env.COMGATE_SECRET),
      cardLive: env.PAYMENTS_LIVE === 'true', packeta: Boolean(env.PACKETA_API_KEY), iban: Boolean(env.SHOP_IBAN || OPERATOR.iban),
    },
  });
});
route('PUT', 'settings', async ({ env, body, user }) => {
  const stmts = [];
  for (const [k, type] of Object.entries(SETTINGS)) {
    if (!(k in body)) continue;
    const v = type === 'bool' ? (body[k] ? '1' : '0') : (body[k] === '' || body[k] == null ? null : String(int(body[k], { max: 100000, name: k })));
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
