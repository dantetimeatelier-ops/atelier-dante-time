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
// Úprava dopravce v tabulce shipping_methods (jako by to majitel nastavil v administraci → Dopravci)
const ship = (db, id, f) => { const k = Object.keys(f); db.prepare(`UPDATE shipping_methods SET ${k.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`).run(...k.map((x) => (typeof f[x] === 'object' && f[x] !== null ? JSON.stringify(f[x]) : f[x])), id); };
const STRIPE_TEST = { PAYMENT_GATEWAY: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
const customer = { name: 'Jana Testovací', email: 'jana@example.cz', phone: '+420777000111', street: 'Dlouhá 12/3a', city: 'Praha', zip: '11000', terms: true };

test('migrace 0024 jen přidává nastavení (žádná data se nemažou)', () => {
  const { db } = makeEnv();
  const keys = db.prepare("SELECT key, value FROM settings WHERE key IN ('shipping_packeta_pickup_json','shipping_packeta_home_json','packeta_home_carriers_json','ship_autonotify')").all();
  assert.equal(keys.length, 4);
  const sql = readFileSync(new URL('../../migrations/0024_doprava_eu_platby.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE/i);
});

test('migrace 0026: dopravci převzali dosavadní nastavení, nové (neověřené) jsou jen připravené', () => {
  const { db } = makeEnv();
  const rows = Object.fromEntries(db.prepare('SELECT id, status, prices_json, max_value_czk, excluded_metals, cod_enabled FROM shipping_methods').all().map((r) => [r.id, r]));
  assert.deepEqual(JSON.parse(rows.zasilkovna.prices_json), { CZ: 99 }); // cena z dosavadního nastavení
  assert.equal(rows.zasilkovna.status, 'aktivni');
  assert.equal(rows.zasilkovna.max_value_czk, 20000);
  assert.equal(rows.balikovna.status, 'aktivni');
  assert.equal(rows.balikovna.max_value_czk, 5000);
  assert.equal(rows.osobni.status, 'aktivni');
  for (const id of ['balikovna_adresa', 'pojistena', 'ppl_adresa', 'ppl_eu', 'zasilkovna_adresa']) assert.equal(rows[id].status, 'pripraveno', id); // zákazníkům skryto
  assert.equal(rows.ppl_eu.excluded_metals, 'zlato,stribro,platina');
  const sql = readFileSync(new URL('../../migrations/0026_dopravci.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /DROP|DELETE|UPDATE /i);
});

test('doprava: filtr podle země, celkové hodnoty, materiálu pouzdra a stavu dopravce; cena podle hodnoty', async () => {
  const { shopConfig } = await import('../../server/orders.js');
  const { db, env } = makeEnv();
  // Jen připravené (neověřené) způsoby zákazník nevidí
  let cz = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 9000 });
  assert.deepEqual(cz.shipping.map((s) => s.id), ['zasilkovna', 'osobni']); // Balíkovna jen do 5 000 Kč
  assert.deepEqual(cz.payment.map((p) => p.id), ['bank_transfer', 'cod']); // převod první (výchozí)
  assert.deepEqual(cz.payment.find((p) => p.id === 'cod').onlyWith, ['zasilkovna']);
  assert.ok(!('cost' in cz.shipping[0])); // náklad dopravce se zákazníkovi neposílá
  const cheap = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 4000 });
  assert.deepEqual(cheap.shipping.map((s) => s.id), ['zasilkovna', 'balikovna', 'osobni']);
  assert.equal(cheap.insuredOnly, false);

  // Majitel zapne Zásilkovnu na adresu, Cennou zásilku a PPL do EU
  ship(db, 'zasilkovna_adresa', { status: 'aktivni', prices_json: { CZ: 139, SK: 169, DE: 249 } });
  ship(db, 'pojistena', { status: 'aktivni', cod_enabled: 1, cod_fee_czk: 50 });
  ship(db, 'ppl_eu', { status: 'aktivni' });
  cz = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 9000 });
  assert.deepEqual(cz.shipping.map((s) => s.id), ['zasilkovna', 'zasilkovna_adresa', 'pojistena', 'osobni']);
  // Cenná zásilka: 190 Kč do 30 000 Kč, pak 14 Kč za každých započatých 10 000 Kč
  assert.equal(cz.shipping.find((s) => s.id === 'pojistena').price, 190);
  const omega = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 100000 });
  assert.deepEqual(omega.shipping.map((s) => s.id), ['pojistena', 'osobni']); // Zásilkovna nad 20 000 Kč ne
  assert.equal(omega.shipping[0].price, 190 + 7 * 14);
  assert.equal(omega.insuredOnly, true);
  assert.ok(!omega.payment.some((p) => p.id === 'cod')); // 100 000 Kč + doprava přesahuje max. dobírku 100 000 Kč
  const omega90 = await shopConfig(env, 'cs', { country: 'CZ', itemsTotal: 90000 });
  const cod = omega90.payment.find((p) => p.id === 'cod');
  assert.deepEqual([cod.onlyWith, cod.fees], [['pojistena'], { pojistena: 50 }]); // dobírka jen tam, kde ji dopravce umí, s jeho příplatkem
  // Slovensko: Packeta do 700 € (17 000 Kč), dražší kus PPL s krytím do 250 000 Kč
  const sk = await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 9000 });
  assert.deepEqual(sk.shipping.map((s) => s.id), ['zasilkovna_adresa', 'ppl_eu', 'osobni']);
  assert.ok(!sk.payment.some((p) => p.id === 'cod')); // dobírka do zahraničí ne
  const skRolex = await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 180000 });
  assert.deepEqual(skRolex.shipping.map((s) => s.id), ['ppl_eu', 'osobni']);
  assert.equal(skRolex.shipping[0].price, 420 + 740); // nad 100 000 Kč příplatek za zvýšenou odpovědnost
  // Zlaté pouzdro: PPL drahé kovy nepřepraví → jen osobní předání (nic nepojištěného se nenabídne)
  const skGold = await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 180000, metals: ['zlato'] });
  assert.deepEqual(skGold.shipping.map((s) => s.id), ['osobni']);
  assert.equal(skGold.noCarrier, true);
  // Země bez ceny → jen osobní předání
  assert.deepEqual((await shopConfig(env, 'cs', { country: 'FR', itemsTotal: 9000 })).shipping.map((s) => s.id), ['osobni']);
  // Výdejní místa Packety v zahraničí jen s mapou (API klíč)
  ship(db, 'zasilkovna', { prices_json: { CZ: 99, SK: 129 } });
  assert.ok(!(await shopConfig(env, 'cs', { country: 'SK', itemsTotal: 9000 })).shipping.some((s) => s.id === 'zasilkovna'));
  assert.ok((await shopConfig({ ...env, PACKETA_API_KEY: 'k' }, 'cs', { country: 'SK', itemsTotal: 9000 })).shipping.some((s) => s.id === 'zasilkovna'));
});

test('administrace: úprava dopravce se ověří (země, ceny, výluky, dobírka u osobního předání nejde)', async () => {
  const SHIP = await import('../../server/shipping.js');
  const { db, env } = makeEnv();
  await SHIP.saveMethod(env, 'ppl_adresa', { prices: { CZ: '310', XX: 5, SK: '' }, excluded: ['zlato', 'nesmysl'], max_value_czk: '300000', status: 'pripraveno' }, 'test');
  const r = db.prepare("SELECT prices_json, excluded_metals, max_value_czk FROM shipping_methods WHERE id = 'ppl_adresa'").get();
  assert.deepEqual([JSON.parse(r.prices_json), r.excluded_metals, r.max_value_czk], [{ CZ: 310 }, 'zlato', 300000]);
  await SHIP.saveMethod(env, 'osobni', { cod_enabled: true }, 'test');
  assert.equal(db.prepare("SELECT cod_enabled FROM shipping_methods WHERE id = 'osobni'").get().cod_enabled, 0);
  const m = await SHIP.saveMethod(env, 'dpd_test', { name_cs: 'Test', name_en: 'Test', provider: 'jiny', kind: 'adresa' }, 'test', { create: true });
  assert.equal(m.status, 'pripraveno'); // nový dopravce je vždy nejdřív skrytý
  await assert.rejects(() => SHIP.saveMethod(env, 'dpd_test', { name_cs: 'X', name_en: 'X', provider: 'jiny' }, 'test', { create: true }), /už existuje/);
  await assert.rejects(() => SHIP.saveMethod(env, 'neni', { status: 'aktivni' }, 'test'), /nenalezen/);
  const pv = await SHIP.preview(env, { country: 'CZ', value: 50000, metals: [] });
  assert.equal(pv.find((x) => x.id === 'zasilkovna').reason, 'hodnota nad 20000 Kč není krytá');
  assert.match(pv.find((x) => x.id === 'pojistena').reason, /připraveno/);
});

test('náklad dopravy: odhad u objednávky, při odeslání do nákladů hodinek, oprava podle faktury dopravce; zisk počítá i zaplacenou dopravu', async () => {
  const { createOrder, markShipped, setShippingCost } = await import('../../server/orders.js');
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('d1', 'd1', 'Prim D', 'available', 9000)");
  await createOrder(env, { ...customer, country: 'CZ', shipping: 'zasilkovna', pickupPointId: '123', pickupPointName: 'Z-BOX Praha', payment: 'cod', items: ['d1'] }, ORIGIN);
  const o = db.prepare("SELECT * FROM orders WHERE email = 'jana@example.cz'").get();
  assert.equal(o.shipping_cost_czk, 91 + 25); // Zásilkovna + dobírka (náklad dopravce)
  await markShipped(env, o.id, 'Z 123 4567 890', 'test');
  let c = db.prepare("SELECT amount_czk, category FROM costs WHERE product_id = 'd1' AND category = 'doprava'").all();
  assert.deepEqual(c.map((x) => x.amount_czk), [116]);
  await setShippingCost(env, o.id, 102, 'test'); // skutečnost podle faktury Zásilkovny
  c = db.prepare("SELECT amount_czk FROM costs WHERE product_id = 'd1' AND category = 'doprava'").all();
  assert.deepEqual(c.map((x) => x.amount_czk), [102]); // přepsáno, ne zdvojeno
  db.exec(`UPDATE orders SET status = 'completed' WHERE id = '${o.id}'`);
  const e = await FIN.productEconomics(env, 'd1');
  assert.equal(e.revenue, 9000 + o.shipping_price + o.cod_fee); // tržba včetně dopravy a dobírky, kterou zaplatil zákazník
  assert.equal(e.byCat.doprava, 102);
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
  set(db, 'eur_rate', '25'); ship(db, 'zasilkovna_adresa', { status: 'aktivni', prices_json: { DE: 250 } });
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
  set(db, 'eur_rate', '25'); ship(db, 'zasilkovna_adresa', { status: 'aktivni', prices_json: { CZ: 139, SK: 169 } });
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p2', 'prim-b', 'Prim B', 'available', 9000)");
  await assert.rejects(() => createOrder(env, { ...customer, country: 'SK', shipping: 'zasilkovna_adresa', payment: 'cod', items: ['p2'] }, ORIGIN), /platby není dostupný/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', shipping: 'zasilkovna_adresa', payment: 'card', items: ['p2'] }, ORIGIN), /platby není dostupný/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', currency: 'EUR', shipping: 'zasilkovna', pickupPointId: '123', pickupPointName: 'Z-BOX Praha', payment: 'cod', items: ['p2'] }, ORIGIN), /v eurech/);
  await assert.rejects(() => createOrder(env, { ...customer, country: 'CZ', shipping: 'osobni', payment: 'cod', items: ['p2'] }, ORIGIN), /Dobírku lze zvolit jen/);
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
  assert.match(cs, /u nichž je v košíku nabízena/);
  assert.match(cs, /Všechny hodinky posíláme pojištěné na plnou hodnotu/);
  assert.match(en, /Every watch is shipped insured for its full value/);
});

test('automatický štítek Zásilkovny po zaplacení: vznikne číslo zásilky, ale objednávka zůstane „zaplaceno“ až do převzetí dopravcem', async () => {
  const { createOrder, markPaid } = await import('../../server/orders.js');
  const { db, env } = makeEnv({ PACKETA_API_PASSWORD: 'h' });
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('a1', 'a1', 'Prim A1', 'available', 9000)");
  await createOrder(env, { ...customer, country: 'CZ', shipping: 'zasilkovna', pickupPointId: '123', pickupPointName: 'Z-BOX Praha', payment: 'bank_transfer', items: ['a1'] }, ORIGIN);
  const o = db.prepare('SELECT id FROM orders').get();
  const orig = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('<response><status>ok</status><result><id>4930000111</id><barcodeText>Z 493 0000 111</barcodeText></result></response>'); };
  try {
    await markPaid(env, o.id, 'test', ORIGIN); // vypnuto (výchozí) → žádný štítek
    assert.equal(calls, 0);
    db.exec(`UPDATE orders SET status = 'awaiting_payment' WHERE id = '${o.id}'`); db.exec("UPDATE products SET status = 'reserved' WHERE id = 'a1'");
    set(db, 'auto_label', '1');
    await markPaid(env, o.id, 'test', ORIGIN);
  } finally { globalThis.fetch = orig; }
  assert.equal(calls, 1);
  const r = db.prepare('SELECT status, tracking_number FROM orders WHERE id = ?').get(o.id);
  assert.deepEqual([r.status, r.tracking_number], ['paid', 'Z 493 0000 111']);
});
