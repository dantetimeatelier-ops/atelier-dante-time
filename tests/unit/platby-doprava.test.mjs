// Platby (karta, Apple Pay, Google Pay, převod, dobírka) a doprava po EU – zadání majitele 27. 11. 2026.
// Žádná skutečná platba ani zásilka: platební brána i Zásilkovna jsou nahrazené testovací odpovědí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function makeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../../migrations/', import.meta.url)).sort()) {
    try { db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8')); } catch { /* část schématu mimo SQLite */ }
  }
  const stmt = (sql) => { let a = []; const o = { bind: (...b) => { a = b; return o; }, run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }) }; return o; };
  const env = { DB: { prepare: stmt, batch: async (l) => { for (const s of l) await s.run(); } }, SHOP_MODE: 'live', OWNER_EMAIL: 'majitel@example.cz', ...extra };
  return { db, env };
}
const ORIGIN = 'https://atelier-dante-time.cz';
const set = (db, k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
const STRIPE_TEST = { PAYMENT_GATEWAY: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
const customer = { name: 'Jana Testovací', email: 'jana@example.cz', phone: '+420777000111', street: 'Dlouhá 12/3a', city: 'Praha', zip: '11000', terms: true };

test('migrace 0024 jen přidává nastavení (žádná data se nemažou)', () => {
  const { db } = makeEnv();
  const keys = db.prepare("SELECT key, value FROM settings WHERE key IN ('shipping_packeta_pickup_json','shipping_packeta_home_json','packeta_home_carriers_json','ship_autonotify')").all();
  assert.equal(keys.length, 4);
  const sql = readFileSync(new URL('../../migrations/0024_doprava_eu_platby.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE/i);
});

test('doprava: nabídka podle země a pojištění na plnou hodnotu – jen funkční a plně krytý dopravce', async () => {
  const { shopConfig } = await import('../../server/orders.js');
  const { db, env } = makeEnv();
  set(db, 'shipping_packeta_home_json', '{"CZ":139,"SK":169,"DE":249}');
  set(db, 'shipping_packeta_pickup_json', '{"SK":129,"DE":189}');
  set(db, 'eur_rate', '25');
  // Levný kus (4 000 Kč): kryjí ho všichni
  const cheap = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 4000 });
  assert.deepEqual(cheap.shipping.map((s) => s.id), ['zasilkovna', 'balikovna', 'zasilkovna_adresa', 'osobni']);
  // 9 000 Kč: Balíkovna (cennosti nad 5 000 Kč jen s Cenným obsahem) se nenabídne, Zásilkovna do 20 000 Kč ano, dobírka zůstává
  const cz = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 9000 });
  assert.deepEqual(cz.shipping.map((s) => s.id), ['zasilkovna', 'zasilkovna_adresa', 'osobni']);
  assert.equal(cz.insuredOnly, false);
  assert.equal(cz.shipping.find((s) => s.id === 'zasilkovna_adresa').price, 139);
  assert.deepEqual(cz.payment.map((p) => p.id), ['bank_transfer', 'cod']); // převod je první (výchozí); karta jen po vložení klíčů brány
  assert.deepEqual(cz.payment.find((p) => p.id === 'cod').onlyWith, ['zasilkovna', 'balikovna', 'zasilkovna_adresa']); // R23: dobírka i na adresu v ČR

  // Slovensko bez mapy Zásilkovny: výdejní místo se nenabízí (nešlo by vybrat), adresa ano, dobírka ne; limit 700 € × 25 = 17 500 Kč
  const sk = await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 9000 });
  assert.deepEqual(sk.shipping.map((s) => s.id), ['zasilkovna_adresa', 'osobni']);
  assert.ok(!sk.payment.some((p) => p.id === 'cod'));
  const skMap = await shopConfig({ ...env, PACKETA_API_KEY: 'k' }, 'en', { country: 'SK', itemsTotal: 9000 });
  assert.deepEqual(skMap.shipping.map((s) => s.id), ['zasilkovna', 'zasilkovna_adresa', 'osobni']);
  assert.match(skMap.shipping[0].label, /^Packeta/);
  const skHigh = await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 18000 });
  assert.deepEqual(skHigh.shipping.map((s) => s.id), ['osobni']); // Packeta nekryje, pojištěná do EU není nastavena → nenabízí se nic nepojištěného
  // Země bez ceny → nic kromě osobního předání
  const fr = await shopConfig(env, 'cs', { country: 'FR', itemsTotal: 9000 });
  assert.deepEqual(fr.shipping.map((s) => s.id), ['osobni']);

  // Drahé hodinky (Rolex, Omega) nad 20 000 Kč: jen pojištěná cenná zásilka nebo osobní předání, bez dobírky
  set(db, 'insured_price_czk', '450');
  const lux = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 180000 });
  assert.deepEqual(lux.shipping.map((s) => s.id), ['pojistena', 'osobni']);
  assert.equal(lux.insuredOnly, true);
  assert.ok(!lux.payment.some((p) => p.id === 'cod'));
  // Nad limit i pojištěné přepravy (1 000 000 Kč) → jen osobní předání
  const over = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 1200000 });
  assert.deepEqual(over.shipping.map((s) => s.id), ['osobni']);
  // Majitel ověří u České pošty, že hodinky nejsou „cennost“, a zvýší limit Balíkovny → nabídne se
  set(db, 'cover_balikovna_czk', '50000');
  assert.ok((await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 9000 })).shipping.some((s) => s.id === 'balikovna'));
});

test('platba kartou: zobrazí se jen se skutečně nastavenou bránou, ostrý klíč nikdy v testovacím režimu', async () => {
  const P = await import('../../server/payments.js');
  assert.equal(P.cardPaymentsAvailable({}), false);
  assert.equal(P.cardPaymentsAvailable({ STRIPE_SECRET_KEY: 'sk_test_x' }), false); // bez klíče pro oznámení nefunguje potvrzení platby
  assert.equal(P.cardPaymentsAvailable({ ...STRIPE_TEST, SHOP_MODE: 'live' }), true);
  assert.equal(P.cardPaymentsAvailable({ ...STRIPE_TEST, STRIPE_SECRET_KEY: 'sk_live_x', SHOP_MODE: 'live' }), false); // ostrý klíč bez souhlasu majitele
  assert.equal(P.cardPaymentsAvailable({ ...STRIPE_TEST, STRIPE_SECRET_KEY: 'sk_live_x', SHOP_MODE: 'live', PAYMENTS_LIVE: 'true' }), true);
  assert.equal(P.cardPaymentsAvailable({ ...STRIPE_TEST, SHOP_MODE: 'live', PAYMENTS_LIVE: 'true' }), false); // v ostrém provozu jen ostrý klíč
  assert.equal(P.gateway({ COMGATE_MERCHANT: 'm', COMGATE_SECRET: 's' }), 'comgate');
  assert.equal(P.gateway({ ...STRIPE_TEST, PAYMENT_GATEWAY: 'comgate' }), null);
  assert.deepEqual(P.orderAmount({ total: 12990 }), { currency: 'CZK', cents: 1299000 });
  assert.deepEqual(P.orderAmount({ total: 12990, pay_currency: 'EUR', pay_amount_cents: 52000 }), { currency: 'EUR', cents: 52000 });
});

test('Stripe: podpis oznámení (HMAC-SHA256) a parametry platby', async () => {
  const P = await import('../../server/payments.js');
  const { createHmac } = await import('node:crypto');
  const payload = '{"type":"checkout.session.completed"}';
  const t = 1_800_000_000;
  const sig = createHmac('sha256', 'whsec_test').update(`${t}.${payload}`).digest('hex');
  assert.equal(await P.verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_test', t + 10), true);
  assert.equal(await P.verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_test', t + 1000), false); // staré oznámení
  assert.equal(await P.verifyStripeSignature(payload + ' ', `t=${t},v1=${sig}`, 'whsec_test', t), false);
  assert.equal(await P.verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'jiny', t), false);
  assert.equal(String(P.stripeForm({ a: { b: [{ c: 1 }] }, d: null })), 'a%5Bb%5D%5B0%5D%5Bc%5D=1');

  let sent;
  const fetcher = async (url, init) => { sent = { url, init, body: new URLSearchParams(init.body) }; return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' })); };
  const until = new Date(Date.now() + 40 * 60e3).toISOString();
  const r = await P.createCardPayment({ ...STRIPE_TEST, SHOP_MODE: 'live' }, { id: 'o1', number: '2026-0007', public_token: 'tok', email: 'a@b.cz', lang: 'en', total: 13000, pay_currency: 'EUR', pay_amount_cents: 52000, reserved_until: until }, ORIGIN, { fetcher });
  assert.equal(r.transId, 'cs_test_1');
  assert.equal(sent.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(sent.init.headers.Authorization, 'Bearer sk_test_x');
  assert.equal(sent.body.get('line_items[0][price_data][currency]'), 'eur');
  assert.equal(sent.body.get('line_items[0][price_data][unit_amount]'), '52000');
  assert.equal(sent.body.get('locale'), 'en');
  assert.equal(sent.body.get('success_url'), `${ORIGIN}/objednavka/tok?platba=ok`);
  // Platbu nelze dokončit po konci rezervace kusu
  assert.equal(Number(sent.body.get('expires_at')), Math.floor(new Date(until).getTime() / 1000));
  assert.equal(sent.body.get('payment_method_types[0]'), 'card'); // jen karty (Apple Pay a Google Pay jsou karetní peněženky), žádný PayPal ani Link
  assert.equal(sent.body.get('payment_method_types[1]'), null);
  for (const paid of ['automatic_tax[enabled]', 'invoice_creation[enabled]', 'subscription_data[description]']) assert.equal(sent.body.get(paid), null); // žádné placené doplňky
});

test('celý nákup kartou: zákazník z EU zvolí eura, strhne se v Kč → zaplaceno, prodáno, faktura, e-mail, poplatek v nákladech hodinek', async () => {
  const { createOrder } = await import('../../server/orders.js');
  const { applyPaymentStatus, recordCardFee } = await import('../../server/payment-events.js');
  const { db, env } = makeEnv({ ...STRIPE_TEST });
  set(db, 'eur_rate', '25'); set(db, 'shipping_packeta_home_json', '{"DE":250}');
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p1', 'prim-a', 'Prim Classic A', 'available', 12750)");
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'cs_test_A', url: 'https://checkout.stripe.com/c/pay/cs_test_A' }));
  try {
    const out = await createOrder(env, { ...customer, country: 'DE', currency: 'EUR', shipping: 'zasilkovna_adresa', payment: 'card', items: ['p1'], lang: 'en' }, ORIGIN);
    assert.equal(out.redirect, 'https://checkout.stripe.com/c/pay/cs_test_A');
  } finally { globalThis.fetch = orig; }
  const o = db.prepare("SELECT * FROM orders WHERE payment_ref = 'cs_test_A'").get();
  assert.equal(o.pay_currency, 'CZK'); // karta vždy v Kč – bez 2% poplatku Stripe za převod měny
  assert.equal(o.total, 13000);
  assert.equal(db.prepare("SELECT status FROM products WHERE id='p1'").get().status, 'reserved');
  assert.ok(new Date(o.reserved_until) - Date.now() >= 34 * 60e3); // rezervace na kartu nejméně 35 minut

  // Nesouhlasící částka nebo měna → nic se neoznačí
  assert.equal(await applyPaymentStatus(env, o, { status: 'PAID', cents: 1300000, currency: 'EUR' }, ORIGIN, 'stripe'), 'mismatch');
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(o.id).status, 'awaiting_payment');
  // Správná platba → automaticky zaplaceno, kus prodán, faktura a e-mail o přijetí platby
  const fee = (body) => async () => new Response(JSON.stringify(body));
  globalThis.fetch = fee({ payment_intent: { latest_charge: { balance_transaction: { fee: 20200, currency: 'czk' } } } });
  try {
    assert.equal(await applyPaymentStatus(env, o, { status: 'PAID', cents: 1300000, currency: 'CZK' }, ORIGIN, 'stripe'), 'paid');
  } finally { globalThis.fetch = orig; }
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(o.id).status, 'paid');
  assert.equal(db.prepare("SELECT status FROM products WHERE id='p1'").get().status, 'sold');
  assert.ok(db.prepare('SELECT number FROM invoices WHERE order_id = ?').get(o.id));
  assert.ok(db.prepare("SELECT 1 FROM emails WHERE subject LIKE 'Payment received%'").get());
  // Poplatek brány (202 Kč) je náklad „Poplatky“ u prodaných hodinek – právě jednou
  const cost = db.prepare("SELECT * FROM costs WHERE product_id = 'p1' AND category = 'poplatky'").all();
  assert.equal(cost.length, 1);
  assert.equal(cost[0].amount_czk, 202);
  assert.equal(cost[0].supplier, 'Stripe');
  assert.equal(db.prepare('SELECT card_fee_czk AS f FROM orders WHERE id = ?').get(o.id).f, 202);
  assert.equal(await recordCardFee(env, o.id, { fetcher: fee({}) }), 202);
  // Opakované oznámení nic nezdvojí
  assert.equal(await applyPaymentStatus(env, o, { status: 'PAID', cents: 1300000, currency: 'CZK' }, ORIGIN, 'stripe'), 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE order_id = ?').get(o.id).n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM costs WHERE category = 'poplatky'").get().n, 1);
});

test('poplatek brány: více kusů v objednávce → rozdělení podle ceny; když ho brána ještě neuvádí, doplní se později', async () => {
  const { recordCardFee, recordMissingCardFees } = await import('../../server/payment-events.js');
  const { db, env } = makeEnv({ ...STRIPE_TEST });
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('a', 'a', 'A', 'sold', 30000), ('b', 'b', 'B', 'sold', 10000)");
  db.exec(`INSERT INTO orders (id, number, public_token, status, mode, email, name, shipping_method, payment_method, items_total, shipping_price, total, variable_symbol, terms_version, terms_accepted_at, payment_ref, paid_at)
    VALUES ('m1', '2026-0200', 'tok-m1-xxxxxxxxxxxxxxxxxxxx', 'paid', 'live', 'a@b.cz', 'A', 'osobni', 'card', 40000, 0, 40000, '260200', '1.2', 'now', 'cs_test_M', '2026-11-27T10:00:00Z')`);
  db.exec("INSERT INTO order_items (id, order_id, product_id, title, price_czk) VALUES ('i1', 'm1', 'a', 'A', 30000), ('i2', 'm1', 'b', 'B', 10000)");
  assert.equal(await recordCardFee(env, 'm1', { fetcher: async () => new Response(JSON.stringify({ payment_intent: { latest_charge: { balance_transaction: 'txn_1' } } })) }), null); // zatím neznámý
  assert.equal(db.prepare('SELECT card_fee_czk AS f FROM orders').get().f, null);
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ payment_intent: { latest_charge: { balance_transaction: { fee: 60650, currency: 'czk' } } } }));
  try { assert.equal(await recordMissingCardFees(env), 1); } finally { globalThis.fetch = orig; }
  const rows = db.prepare("SELECT product_id, amount_czk FROM costs WHERE category = 'poplatky' ORDER BY product_id").all();
  assert.deepEqual(rows.map((r) => [r.product_id, r.amount_czk]), [['a', 455], ['b', 152]]); // 607 Kč v poměru 3 : 1
});

test('ochrana unikátního kusu: druhá objednávka neprojde a pozdní platba po prodeji jinému se neoznačí', async () => {
  const { createOrder } = await import('../../server/orders.js');
  const { applyPaymentStatus } = await import('../../server/payment-events.js');
  const { db, env } = makeEnv({ ...STRIPE_TEST });
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('u1', 'rolex-x', 'Rolex X', 'available', 15000)");
  const orig = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: `cs_test_${++n}`, url: 'https://checkout.stripe.com/x' }));
  try {
    await createOrder(env, { ...customer, country: 'CZ', shipping: 'osobni', payment: 'card', items: ['u1'] }, ORIGIN);
    await assert.rejects(() => createOrder(env, { ...customer, email: 'druhy@example.cz', country: 'CZ', shipping: 'osobni', payment: 'bank_transfer', items: ['u1'] }, ORIGIN), (e) => e.status === 409);
    // Rezervace první objednávky vyprší, kus si koupí někdo jiný převodem
    db.exec("UPDATE orders SET reserved_until = '2000-01-01T00:00:00Z' WHERE payment_ref = 'cs_test_1'");
    db.exec("UPDATE products SET reserved_until = '2000-01-01T00:00:00Z' WHERE id = 'u1'");
    await createOrder(env, { ...customer, email: 'druhy@example.cz', country: 'CZ', shipping: 'osobni', payment: 'bank_transfer', items: ['u1'] }, ORIGIN);
  } finally { globalThis.fetch = orig; }
  const first = db.prepare("SELECT * FROM orders WHERE payment_ref = 'cs_test_1'").get();
  assert.equal(first.status, 'expired');
  const r = await applyPaymentStatus(env, first, { status: 'PAID', cents: 1500000, currency: 'CZK' }, ORIGIN, 'stripe');
  assert.equal(r, 'conflict');
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(first.id).status, 'expired');
  const second = db.prepare("SELECT id FROM orders WHERE email = 'druhy@example.cz'").get();
  assert.equal(db.prepare("SELECT reserved_order_id AS r FROM products WHERE id='u1'").get().r, second.id); // kus patří jen druhé objednávce
  assert.ok(db.prepare("SELECT 1 FROM emails WHERE to_addr = 'majitel@example.cz' AND subject LIKE 'Vrátit platbu%'").get());
});

test('pokladna odmítne nedostupnou kombinaci (dobírka do zahraničí nebo s osobním předáním, karta bez brány, EUR u dobírky); dobírka na adresu v ČR projde', async () => {
  const { createOrder } = await import('../../server/orders.js');
  const { db, env } = makeEnv();
  set(db, 'eur_rate', '25'); set(db, 'shipping_packeta_home_json', '{"CZ":139,"SK":169}');
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p2', 'prim-b', 'Prim B', 'available', 9000)");
  await assert.rejects(() => createOrder(env, { ...customer, country: 'SK', shipping: 'zasilkovna_adresa', payment: 'cod', items: ['p2'] }, ORIGIN), /platby není dostupný/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', shipping: 'zasilkovna_adresa', payment: 'card', items: ['p2'] }, ORIGIN), /platby není dostupný/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', currency: 'EUR', shipping: 'zasilkovna', pickupPointId: '123', pickupPointName: 'Z-BOX Praha', payment: 'cod', items: ['p2'] }, ORIGIN), /v eurech/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', shipping: 'osobni', payment: 'cod', items: ['p2'] }, ORIGIN), /Zásilkovnou nebo Balíkovnou/);
  const ok = await createOrder(env, { ...customer, country: 'CZ', shipping: 'zasilkovna_adresa', payment: 'cod', items: ['p2'] }, ORIGIN);
  assert.match(ok.redirect, /^\/objednavka\//);
});

test('Zásilkovna: doručení na adresu (ČR, SR, EU), výdejní místo partnera v zahraničí, odkaz pro sledování', async () => {
  const P = await import('../../server/packeta.js');
  assert.deepEqual(P.splitStreet('Dlouhá 12/3a'), { street: 'Dlouhá', houseNumber: '12/3a' });
  assert.deepEqual(P.splitStreet('Hlavná 5'), { street: 'Hlavná', houseNumber: '5' });
  assert.deepEqual(P.splitStreet('Na Výsluní'), { street: 'Na Výsluní', houseNumber: '' });
  const env = { PACKETA_API_PASSWORD: 'h', DB: { prepare: () => { const o = { bind: () => o, run: async () => ({}) }; return o; } } };
  const ok = '<response><status>ok</status><result><id>4930000999</id><barcodeText>Z 493 0000 999</barcodeText></result></response>';
  let body;
  const fetcher = async (u, q) => { body = q?.body; return new Response(ok); };
  const base = { id: 'o', number: '2026-0009', name: 'Ján Novák', email: 'jan@example.sk', phone: '+421900000000', payment_method: 'card', total: 13000, tracking_number: null };
  await P.createPacket(env, { ...base, shipping_method: 'zasilkovna_adresa', billing_country: 'SK', billing_street: 'Hlavná 5', billing_city: 'Bratislava', billing_zip: '81101', pay_currency: 'EUR', pay_amount_cents: 52000 }, { fetcher });
  for (const s of ['<addressId>131</addressId>', '<street>Hlavná</street>', '<houseNumber>5</houseNumber>', '<city>Bratislava</city>', '<zip>81101</zip>', '<value>520</value>', '<currency>EUR</currency>']) assert.ok(body.includes(s), `chybí ${s}`);
  await P.createPacket(env, { ...base, shipping_method: 'zasilkovna_adresa', billing_country: 'DE', billing_street: 'Hauptstr. 1', billing_city: 'Berlin', billing_zip: '10115' }, { fetcher, settings: { packeta_home_carriers_json: '{"DE":111}' } });
  assert.ok(body.includes('<addressId>111</addressId>'));
  await assert.rejects(() => P.createPacket(env, { ...base, shipping_method: 'zasilkovna_adresa', billing_country: 'FR' }, { fetcher }), /není nastaven dopravce/);
  await P.createPacket(env, { ...base, shipping_method: 'zasilkovna', pickup_point_id: 'c4307:FR12345' }, { fetcher });
  assert.ok(body.includes('<addressId>4307</addressId>') && body.includes('<carrierPickupPoint>FR12345</carrierPickupPoint>'));
  // Dopravce pro adresu ze seznamu Zásilkovny, když je API klíč
  const feed = async () => new Response(JSON.stringify({ carriers: [{ id: 5, country: 'AT', pickupPoints: 'true', name: 'AT box' }, { id: 80, country: 'AT', pickupPoints: 'false', apiAllowed: 'true', name: 'AT Austrian Post' }] }));
  assert.equal(await P.homeCarrierId({ PACKETA_API_KEY: 'k' }, 'AT', { fetcher: feed }), 80);
  assert.equal(P.trackingUrl('zasilkovna_adresa', 'Z 493 0000 999', 'cs'), 'https://tracking.packeta.com/cs/?id=Z4930000999');
  assert.equal(P.trackingUrl('osobni', 'X'), null);
});

test('odeslání: zákazník dostane číslo zásilky s odkazem pro sledování', async () => {
  const { markShipped } = await import('../../server/orders.js');
  const { db, env } = makeEnv();
  db.exec(`INSERT INTO orders (id, number, public_token, status, mode, email, name, shipping_method, payment_method, items_total, shipping_price, total, variable_symbol, terms_version, terms_accepted_at)
    VALUES ('s1', '2026-0100', 'tok-s1-xxxxxxxxxxxxxxxxxx', 'paid', 'live', 'jana@example.cz', 'Jana', 'zasilkovna', 'card', 9000, 99, 9099, '260100', '1.1', 'now')`);
  await markShipped(env, 's1', 'Z 493 0000 999', 'test');
  const m = db.prepare("SELECT html FROM emails WHERE subject LIKE '%na cestě%'").get();
  assert.match(m.html, /Z 493 0000 999/);
  assert.match(m.html, /https:\/\/tracking\.packeta\.com\/cs\/\?id=Z4930000999/);
});

test('ruční prodej mimo e-shop: kus rezervovaný e-shopem nejde prodat, záloha kus osobně zarezervuje, e-shop ho pak neprodá', async () => {
  const INV = await import('../../server/invoicing.js');
  const { createOrder } = await import('../../server/orders.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('r1', 'r1', 'Omega R1', 'available', 15000), ('r2', 'r2', 'Prim R2', 'available', 9000)");
  // 1) E-shop rezervuje r1 → ruční faktura na r1 je odmítnuta, kus zůstane objednávce
  await createOrder(env, { ...customer, country: 'CZ', shipping: 'osobni', payment: 'bank_transfer', items: ['r1'] }, ORIGIN);
  await assert.rejects(() => INV.issueManual(env, { product_id: 'r1', buyer_name: 'Pan Ruční', paid: true }, 'test'), (e) => e.status === 409 || /rezervované objednávkou/.test(e.message));
  assert.equal(db.prepare("SELECT status FROM products WHERE id='r1'").get().status, 'reserved');
  // 2) Záloha na r2 při osobním prodeji → kus „rezervováno osobně“, e-shop ho už nikomu neprodá
  const adv = await INV.issueManual(env, { kind: 'zalohova', product_id: 'r2', product_price: 3000, buyer_name: 'Pan Osobní' }, 'test');
  const r2 = db.prepare("SELECT status, reserved_order_id AS o FROM products WHERE id='r2'").get();
  assert.deepEqual([r2.status, r2.o], ['reserved', null]);
  await assert.rejects(() => createOrder(env, { ...customer, email: 'jiny@example.cz', country: 'CZ', shipping: 'osobni', payment: 'bank_transfer', items: ['r2'] }, ORIGIN), (e) => e.status === 409);
  // 3) Storno zálohy uvolní osobní rezervaci
  await INV.cancelInvoice(env, adv.id, 'test');
  assert.equal(db.prepare("SELECT status FROM products WHERE id='r2'").get().status, 'available');
  // 4) Ruční faktura na volný kus → prodáno; druhá faktura na týž kus neprojde
  await INV.issueManual(env, { product_id: 'r2', buyer_name: 'Pan Osobní', paid: true }, 'test');
  assert.equal(db.prepare("SELECT status FROM products WHERE id='r2'").get().status, 'sold');
  await assert.rejects(() => INV.issueManual(env, { product_id: 'r2', buyer_name: 'Někdo jiný', paid: true }, 'test'), /prodané/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE product_id = 'r2' AND kind = 'faktura' AND cancelled_at IS NULL").get().n, 1);
});

test('ruční zápis prodeje (Nákupy a prodeje): potvrzení neprodá kus rezervovaný objednávkou z e-shopu', () => {
  const src = readFileSync(new URL('../../server/inbox.js', import.meta.url), 'utf8');
  assert.match(src, /status = 'reserved' AND reserved_order_id IS NULL/);
  assert.match(src, /rezervované objednávkou z e-shopu – prodej nejde potvrdit/);
  assert.doesNotMatch(src, /WHERE id = \? AND status IN \('available','reserved','in_progress','draft'\)/);
});

test('odeslání až při předání dopravci: štítek nestačí, převzetí Zásilkovnou → odesláno + e-mail se sledovacím číslem', async () => {
  const { handoverCheck, handedOver } = await import('../../server/os.js');
  const { db, env } = makeEnv({ PACKETA_API_PASSWORD: 'h' });
  db.exec(`INSERT INTO orders (id, number, public_token, status, mode, email, name, shipping_method, payment_method, items_total, shipping_price, total, variable_symbol, terms_version, terms_accepted_at, tracking_number)
    VALUES ('h1', '2026-0300', 'tok-h1-xxxxxxxxxxxxxxxxxxxx', 'paid', 'live', 'jana@example.cz', 'Jana', 'zasilkovna', 'card', 9000, 99, 9099, '260300', '1.2', 'now', 'Z 493 0000 999')`);
  const packeta = (code) => ({ fetcher: async () => new Response(`<response><status>ok</status><result><statusCode>${code}</statusCode><codeText>x</codeText><statusText>${code === 1 ? 'Zásilkovna přijala data' : 'Zásilka podána'}</statusText><dateTime>2026-11-27 10:00:00</dateTime></result></response>`) });
  let r = await handoverCheck(env, packeta(1)); // jen data ze štítku
  assert.deepEqual(r.shipped, []);
  assert.equal(db.prepare("SELECT status FROM orders WHERE id='h1'").get().status, 'paid');
  assert.ok(!db.prepare("SELECT 1 FROM emails WHERE subject LIKE '%na cestě%'").get());
  r = await handoverCheck(env, packeta(2)); // zásilka podána na výdejním místě
  assert.deepEqual(r.shipped, ['2026-0300']);
  assert.equal(db.prepare("SELECT status FROM orders WHERE id='h1'").get().status, 'shipped');
  assert.match(db.prepare("SELECT html FROM emails WHERE subject LIKE '%na cestě%'").get().html, /tracking\.packeta\.com/);
  assert.equal(handedOver({ code: 2, text: 'Obdržena elektronická data k zásilce' }), false); // Česká pošta: jen data
  assert.equal(handedOver({ code: 11, text: 'Zrušena' }), false);
});

test('právní texty 1.2: dobírka i na adresu, platba kartou přes Stripe, Stripe v zásadách ochrany údajů, pojištění na plnou hodnotu', async () => {
  const { LEGAL_VERSION } = await import('../../src/legal/docs.mjs');
  assert.equal(LEGAL_VERSION, '1.2');
  const cs = readFileSync(new URL('../../src/legal/cs.mjs', import.meta.url), 'utf8');
  const en = readFileSync(new URL('../../src/legal/en.mjs', import.meta.url), 'utf8');
  for (const t of [cs, en]) {
    assert.match(t, /Stripe Payments Europe, Limited/);
    assert.doesNotMatch(t, /po (její )?aktivaci|once (the payment gateway is )?activated/);
  }
  assert.match(cs, /při doručení Zásilkovnou na adresu/);
  assert.match(cs, /Všechny hodinky posíláme pojištěné na plnou hodnotu/);
  assert.match(en, /Every watch is shipped insured for its full value/);
});
