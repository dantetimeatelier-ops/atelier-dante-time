// Objednávky: nabídka dopravy a plateb, vytvoření objednávky s atomickou
// rezervací unikátních kusů, zaplacení a e-maily.
import { HttpError } from './http.js';
import { mode, getSettings, releaseExpired, nextCounter, randomId, randomToken, now, addMinutes, audit } from './db.js';
import { str, email as vEmail, oneOf } from './validate.js';
import { sendEmail, ownerEmail } from './email.js';
import { OPERATOR, SITE, bankDetails } from '../src/site.mjs';
import { SHIPPING, PAYMENT, METAL, formatCzk } from '../src/shop/format.mjs';
import { isValidIban } from '../src/shop/spd.mjs';
import { EU_COUNTRIES, countryName, czkToEurCents, formatEur } from '../src/shop/eu.mjs';
import { legalDoc, LEGAL_VERSION } from '../src/legal/docs.mjs';
import { TERMS } from '../src/terms.mjs';
import { createForOrder } from './warranty.js';

// Texty e-mailů v jazyce objednávky (zákazníci z EU objednávají i anglicky)
const tr = (o, cs, en) => (o?.lang === 'en' ? en : cs);
const dt = (o, iso) => new Date(iso).toLocaleString(o?.lang === 'en' ? 'en-GB' : 'cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
import { productName } from '../src/shop/describe.mjs';
import { createCardPayment, cardPaymentsAvailable } from './payments.js';

const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Nabídka dopravy, plateb a měn pro danou zemi a hodnotu zboží.
 * Konečná cena dopravy je vždy známá před odesláním objednávky.
 */
export async function shopConfig(env, lang = 'cs', { country = 'CZ', itemsTotal = 0 } = {}) {
  const m = mode(env);
  const s = await getSettings(env);
  const L = (cs, en) => (lang === 'cs' ? cs : en);
  const cc = EU_COUNTRIES[country] ? country : 'CZ';
  const insuredFrom = num(s.insured_threshold_czk);
  const insuredOnly = insuredFrom != null && itemsTotal >= insuredFrom;
  let euPrices = {};
  try { euPrices = JSON.parse(s.shipping_eu_json || '{}'); } catch { euPrices = {}; }
  let euInsured = {};
  try { euInsured = JSON.parse(s.shipping_eu_insured_json || '{}'); } catch { euInsured = {}; }

  const shipping = [];
  if (cc === 'CZ' && !insuredOnly) {
    for (const id of ['zasilkovna', 'balikovna']) {
      const price = num(s[`shipping_${id}_czk`]);
      if (price != null) shipping.push({ id, label: SHIPPING[id][lang], price, pickup: true });
    }
  }
  if (cc !== 'CZ' && !insuredOnly && num(euPrices[cc]) != null) {
    shipping.push({ id: 'eu', label: L(`Doprava do země ${countryName(cc, 'cs')} – doručení na adresu`, `Delivery to ${countryName(cc, 'en')} – to your address`), price: num(euPrices[cc]), note: L('Dopravce podle cílové země (např. Zásilkovna a její partneři).', 'Carrier depends on the destination country (e.g. Packeta and its partners).') });
  }
  if (insuredOnly) {
    const price = num(cc === 'CZ' ? s.insured_price_czk : (euInsured[cc] ?? s.insured_eu_price_czk));
    if (price != null) shipping.push({ id: 'pojistena', label: L('Pojištěná přeprava kurýrem na plnou hodnotu', 'Courier delivery insured for the full value'), price, note: L('U hodinek vyšší hodnoty posíláme jen pojištěnou zásilkou.', 'Higher-value watches are sent only by insured shipment.') });
  }
  if (s.shipping_osobni_enabled === '1') {
    shipping.push({ id: 'osobni', label: SHIPPING.osobni[lang], price: 0, note: L('Pouze po předchozí individuální domluvě. Nemáme kamennou prodejnu.', 'Only by prior individual arrangement. We have no retail shop.') });
  }

  const payment = [];
  const iban = OPERATOR.iban;
  if (iban && isValidIban(iban)) payment.push({ id: 'bank_transfer', label: PAYMENT.bank_transfer[lang], note: L('Platební údaje a QR kód obdržíte hned po objednávce. Splatnost 3 dny.', 'Payment details and a QR code are shown right after ordering. Due within 3 days.') });
  if (cardPaymentsAvailable(env)) payment.push({ id: 'card', label: PAYMENT.card[lang] });
  // Dobírka jen v ČR a jen s výdejním místem; zahraniční objednávky pouze s platbou předem
  if (s.cod_enabled === '1' && cc === 'CZ' && !insuredOnly) {
    payment.push({ id: 'cod', label: PAYMENT.cod[lang], price: num(s.cod_fee_czk) || 0, onlyWith: ['zasilkovna', 'balikovna'], note: L('Platíte při převzetí zásilky (jen Zásilkovna a Balíkovna v ČR).', 'Pay on collection (Czech pickup points only).') });
  }

  const eurRate = num(s.eur_rate);
  const currencies = ['CZK', ...(eurRate ? ['EUR'] : [])];
  return { mode: m, country: cc, insuredOnly, insuredFrom, shipping, payment, currencies, eurRate, packetaKey: env.PACKETA_API_KEY || null, settings: s };
}

export async function createOrder(env, body, origin) {
  const m = mode(env);
  if (m === 'preview') throw new HttpError('E-shop zatím nepřijímá objednávky', 403);
  const lang = body.lang === 'en' ? 'en' : 'cs';
  const country = EU_COUNTRIES[body.country] ? body.country : null;
  if (!country) throw new HttpError('Vyberte prosím zemi doručení (doručujeme do zemí EU)');

  if (body.terms !== true) throw new HttpError('Pro objednání je nutný souhlas s obchodními podmínkami');
  const ids = Array.isArray(body.items) ? [...new Set(body.items.filter((x) => typeof x === 'string'))] : [];
  if (!ids.length || ids.length > 10) throw new HttpError('Košík je prázdný');
  await releaseExpired(env);
  const ph0 = ids.map(() => '?').join(',');
  const pre = await env.DB.prepare(`SELECT COALESCE(SUM(price_czk), 0) AS total FROM products WHERE id IN (${ph0})`).bind(...ids).first();
  const cfg = await shopConfig(env, lang, { country, itemsTotal: pre.total });
  const ship = cfg.shipping.find((x) => x.id === body.shipping);
  if (!ship) throw new HttpError('Zvolený způsob dopravy není dostupný');
  const pay = cfg.payment.find((x) => x.id === body.payment);
  if (!pay) throw new HttpError('Zvolený způsob platby není dostupný');

  const customer = {
    name: str(body.name, { max: 120, required: true, name: 'jméno' }),
    email: vEmail(body.email),
    phone: str(body.phone, { max: 40, required: true, name: 'telefon' }),
    street: str(body.street, { max: 200, required: true, name: 'ulici' }),
    city: str(body.city, { max: 120, required: true, name: 'město' }),
    zip: str(body.zip, { max: 12, required: true, name: 'PSČ' }),
    company: str(body.company, { max: 200 }), ico: str(body.ico, { max: 20 }), dic: str(body.dic, { max: 20 }),
    note: str(body.note, { max: 1000 }),
  };
  const pickupId = str(body.pickupPointId, { max: 40 });
  const pickupName = str(body.pickupPointName, { max: 200 });
  if (['zasilkovna', 'balikovna'].includes(ship.id) && !pickupName) throw new HttpError('Vyberte prosím výdejní místo');
  if (ship.id === 'balikovna' && pickupId && !/^[BP]\d{5}$/.test(pickupId)) throw new HttpError('Neplatné výdejní místo Balíkovny');
  if (pay.onlyWith && !pay.onlyWith.includes(ship.id)) throw new HttpError('Dobírku lze zvolit jen s výdejním místem v ČR');
  const currency = body.currency === 'EUR' && cfg.currencies.includes('EUR') ? 'EUR' : 'CZK';
  if (currency === 'EUR' && pay.id !== 'bank_transfer') throw new HttpError('V eurech lze zatím platit jen převodem');

  const ph = ids.map(() => '?').join(',');
  const { results: products } = await env.DB.prepare(`SELECT id, title, brand, model, price_czk, status, serial_ref FROM products WHERE id IN (${ph})`).bind(...ids).all();
  const unavailable = ids.filter((id) => { const p = products.find((x) => x.id === id); return !p || p.status !== 'available' || p.price_czk == null; });
  if (unavailable.length) throw new HttpError('Některé hodinky už nejsou k dispozici', 409, { unavailable });

  const itemsTotal = products.reduce((s, p) => s + p.price_czk, 0);
  const codFee = pay.id === 'cod' ? (pay.price || 0) : 0;
  const total = itemsTotal + ship.price + codFee;
  const payCents = currency === 'EUR' ? czkToEurCents(total, cfg.eurRate) : total * 100;
  const seq = await nextCounter(env, 'order');
  const year = new Date().getFullYear();
  const number = `${year}-${String(seq).padStart(4, '0')}`;
  const vs = `${String(year).slice(2)}${String(seq).padStart(4, '0')}`;
  const orderId = randomId();
  const token = randomToken(24);
  const s = cfg.settings;
  // Dobírka: kus zůstává rezervovaný až do odeslání (bez lhůty), ostatní podle splatnosti
  const reservedUntil = pay.id === 'cod' ? null : pay.id === 'card' ? addMinutes(Number(s.reservation_minutes_card || 30)) : addMinutes(Number(s.reservation_hours_bank || 72) * 60);
  const t = now();

  // Vše v jedné dávce = jedné transakci. Pokud se některý kus nepodaří
  // rezervovat, vložení položky selže (title NOT NULL) a celá dávka se vrátí zpět.
  const stmts = [
    env.DB.prepare(`INSERT INTO customers (id, email, name, phone) VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name, phone=excluded.phone, updated_at=?`).bind(randomId(), customer.email, customer.name, customer.phone, t),
    env.DB.prepare(`INSERT INTO orders (id, number, public_token, status, mode, customer_id, email, name, phone,
      billing_street, billing_city, billing_zip, company, company_ico, company_dic, shipping_method, pickup_point_id, pickup_point_name,
      payment_method, items_total, shipping_price, total, variable_symbol, customer_note, terms_version, terms_accepted_at, reserved_until, cod_fee,
      billing_country, pay_currency, pay_amount_cents, eur_rate, lang, bank_account, bank_iban, bank_bic)
      VALUES (?, ?, ?, 'awaiting_payment', ?, (SELECT id FROM customers WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, number, token, m, customer.email, customer.email, customer.name, customer.phone, customer.street, customer.city, customer.zip,
        customer.company, customer.ico, customer.dic, ship.id, pickupId, pickupName, pay.id, itemsTotal, ship.price, total, vs, customer.note,
        LEGAL_VERSION, t, reservedUntil, codFee, country, currency, payCents, currency === 'EUR' ? cfg.eurRate : null, lang,
        ...Object.values(bankDetails())),
  ];
  for (const p of products) {
    stmts.push(env.DB.prepare(`UPDATE products SET status='reserved', reserved_order_id=?, reserved_until=?, updated_at=? WHERE id=? AND status='available'`).bind(orderId, reservedUntil, t, p.id));
    stmts.push(env.DB.prepare(`INSERT INTO order_items (id, order_id, product_id, title, price_czk)
      VALUES (?, ?, ?, (SELECT title FROM products WHERE id=? AND status='reserved' AND reserved_order_id=?), ?)`).bind(randomId(), orderId, p.id, p.id, orderId, p.price_czk));
  }
  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (/NOT NULL|constraint/i.test(String(e.message))) {
      const { results } = await env.DB.prepare(`SELECT id FROM products WHERE id IN (${ph}) AND status <> 'available'`).bind(...ids).all();
      throw new HttpError('Některé hodinky si právě objednal někdo jiný', 409, { unavailable: results.map((r) => r.id) });
    }
    throw e;
  }

  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  const items = products.map((p) => ({ title: productName(p), price_czk: p.price_czk }));
  await audit(env, 'zakaznik', 'objednavka_vytvorena', 'order', orderId, { number, total, mode: m });
  await orderEmails(env, order, items, origin);

  let redirect = `/objednavka/${token}`;
  if (pay.id === 'card') {
    const payment = await createCardPayment(env, order, origin);
    await env.DB.prepare('UPDATE orders SET payment_ref=? WHERE id=?').bind(payment.transId, orderId).run();
    redirect = payment.redirect;
  }
  return { number, token, redirect };
}

// Obchodní podmínky a poučení o odstoupení v jazyce, ve kterém zákazník objednal (smlouvu lze uzavřít česky i anglicky)
function legalAttachment(order) {
  const en = order.lang === 'en';
  const terms = legalDoc('terms', en ? 'en' : 'cs');
  const withdrawal = legalDoc('withdrawal', en ? 'en' : 'cs');
  const warranty = legalDoc('warranty', en ? 'en' : 'cs');
  const h = (t) => `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:18px">${t}</h2>`;
  // Záruční list v textové podobě (§ 2174a OZ) je součástí potvrzení objednávky
  return `${h(en ? `General Terms and Conditions (version ${order.terms_version})` : `Obchodní podmínky (verze ${order.terms_version})`)}
<div style="font-size:12px;color:#444">${terms.body()}</div>
${h(en ? 'Withdrawal information and model form' : 'Poučení o odstoupení od smlouvy')}
<div style="font-size:12px;color:#444">${withdrawal.body()}</div>
${h(en ? 'Warranty statement and authenticity guarantee (warranty card)' : 'Prohlášení o záruce a garance pravosti (záruční list)')}
<div style="font-size:12px;color:#444">${warranty.body()}</div>`;
}

async function orderEmails(env, order, items, origin) {
  const rows = items.map((i) => `<tr><td style="padding:6px 0">${i.title}</td><td style="text-align:right">${formatCzk(i.price_czk)}</td></tr>`).join('');
  const table = `<table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding:6px 0">${tr(order, 'Doprava', 'Shipping')}: ${SHIPPING[order.shipping_method]?.[order.lang === 'en' ? 'en' : 'cs'] || SHIPPING[order.shipping_method]?.cs || order.shipping_method}${order.pickup_point_name ? ` (${order.pickup_point_name})` : ''}</td><td style="text-align:right">${formatCzk(order.shipping_price)}</td></tr>
${order.cod_fee ? `<tr><td style="padding:6px 0">Dobírka</td><td style="text-align:right">${formatCzk(order.cod_fee)}</td></tr>` : ''}
<tr><td style="padding:8px 0;border-top:1px solid #ddd"><strong>Celkem</strong></td><td style="text-align:right;border-top:1px solid #ddd"><strong>${formatCzk(order.total)}</strong>${order.pay_currency === 'EUR' ? `<br>k úhradě ${formatEur(order.pay_amount_cents)}` : ''}</td></tr></table>`;
  const link = `${origin}/objednavka/${order.public_token}`;
  await sendEmail(env, {
    to: order.email,
    subject: tr(order, `Potvrzení objednávky ${order.number}`, `Order confirmation ${order.number}`),
    related: `order:${order.id}`,
    body: `<h1 style="font-family:Georgia,serif;font-weight:normal">${tr(order, 'Děkujeme za objednávku', 'Thank you for your order')}</h1>
<p>${tr(order, 'Dobrý den', 'Dear')} ${order.name},</p>
<p>${tr(order, `potvrzujeme přijetí vaší objednávky <strong>${order.number}</strong>. Tímto potvrzením je kupní smlouva uzavřena.`, `we confirm receipt of your order <strong>${order.number}</strong>. With this confirmation the purchase contract is concluded.`)}</p>
${table}
<p>${tr(order, 'Platba', 'Payment')}: ${PAYMENT[order.payment_method]?.[order.lang === 'en' ? 'en' : 'cs'] || PAYMENT[order.payment_method]?.cs}. ${order.payment_method === 'cod' ? tr(order, 'Částku zaplatíte při převzetí zásilky. Hodinky jsou pro vás rezervovány.', 'You pay on delivery. The watch is reserved for you.') : ''} ${order.payment_method === 'bank_transfer' ? tr(order, `Platební údaje a QR kód najdete na stránce objednávky. Hodinky jsou pro vás rezervovány do ${dt(order, order.reserved_until)}.`, `Payment details and a QR code are on the order page. The watch is reserved for you until ${dt(order, order.reserved_until)}.`) : ''}</p>
<p><a href="${link}" style="display:inline-block;background:#c8a24a;color:#000;padding:10px 18px;border-radius:999px;text-decoration:none">${tr(order, 'Zobrazit objednávku', 'View order')}</a></p>
<p style="font-size:13px;color:#555">${tr(order, `Od kupní smlouvy můžete jako spotřebitel odstoupit do ${TERMS.withdrawalDays} dnů od převzetí hodinek, např. pomocí funkce <a href="${origin}/odstoupeni">Odstoupit od smlouvy</a>.`, `As a consumer you may withdraw from the purchase contract within ${TERMS.withdrawalDays} days of receiving the watch, e.g. using the <a href="${origin}/odstoupeni">withdrawal function</a>.`)}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
${legalAttachment(order)}`,
  });
  await sendEmail(env, {
    to: ownerEmail(env),
    subject: `Nová objednávka ${order.number} – ${formatCzk(order.total)}`,
    related: `order:${order.id}`,
    body: `<p>Nová objednávka <strong>${order.number}</strong> (${order.mode === 'test' ? 'TEST' : 'ostrá'}).</p>${table}<p>Zákazník: ${order.name}, ${order.email}, ${order.phone || ''}</p><p><a href="${origin}/admin/#/objednavky/${order.id}">Otevřít v administraci</a></p>`,
  });
}

/** Skutečné převzetí hodinek zákazníkem: dokončí objednávku a založí garanční prohlídky (od tohoto dne). */
export async function markDelivered(env, orderId, deliveredOn, actor) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  if (!['shipped', 'completed'].includes(order.status)) throw new HttpError('Převzetí lze zapsat jen u odeslané objednávky');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(deliveredOn || '') ? deliveredOn : now().slice(0, 10);
  if (day > now().slice(0, 10)) throw new HttpError('Datum převzetí nemůže být v budoucnosti');
  await env.DB.prepare("UPDATE orders SET status='completed', completed_at=COALESCE(completed_at, ?), delivered_on=?, updated_at=? WHERE id=?").bind(now(), day, now(), orderId).run();
  const created = await createForOrder(env, order, day);
  if (!created) { // už existují → jen opravit datum převzetí
    const { results } = await env.DB.prepare("SELECT id FROM warranty_inspections WHERE order_id = ? AND status <> 'hotova'").bind(orderId).all();
    const { setHandover } = await import('./warranty.js');
    for (const r of results) await setHandover(env, r.id, day, actor);
  }
  await audit(env, actor, 'objednavka_prevzata', 'order', orderId, { day });
}

/** Označí objednávku jako zaplacenou: hodinky prodány, faktura, e-mail. */
export async function markPaid(env, orderId, actor, origin) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  if (order.status === 'paid' || order.status === 'completed') return order;
  const t = now();
  if (order.status === 'shipped') {
    // Dobírka: peníze dorazily po odeslání → objednávka je dokončena
    // Dobírka: zákazník platí při převzetí → den platby = skutečné převzetí (lze upravit v administraci)
    await env.DB.prepare("UPDATE orders SET status='completed', paid_at=?, completed_at=?, delivered_on=COALESCE(delivered_on, ?), updated_at=? WHERE id=?").bind(t, t, t.slice(0, 10), t, orderId).run();
    await createForOrder(env, { ...order, delivered_on: t.slice(0, 10) }, t.slice(0, 10));
    const inv = await issueInvoice(env, orderId);
    await audit(env, actor, 'dobirka_zaplacena', 'order', orderId);
    await invoiceEmail(env, orderId, inv, origin);
    return env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  }
  // Pokud rezervace mezitím propadla a kus koupil někdo jiný, nelze označit jako zaplacené automaticky
  const { results: conflicts } = await env.DB.prepare(`SELECT p.id, p.title FROM order_items i JOIN products p ON p.id = i.product_id
    WHERE i.order_id = ? AND NOT (p.status = 'reserved' AND p.reserved_order_id = ?) AND NOT (p.status='available')`).bind(orderId, orderId).all();
  if (conflicts.length) throw new HttpError(`Hodinky ${conflicts.map((c) => c.title).join(', ')} už nejsou pro tuto objednávku rezervované. Vyřešte prosím ručně (vrácení platby).`, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='paid', paid_at=?, updated_at=?, reserved_until=NULL WHERE id=?").bind(t, t, orderId),
    env.DB.prepare(`UPDATE products SET status='sold', sold_at=?, reserved_until=NULL, updated_at=? WHERE id IN (SELECT product_id FROM order_items WHERE order_id=?)`).bind(t, t, orderId),
  ]);
  const inv = await issueInvoice(env, orderId);
  await audit(env, actor, 'objednavka_zaplacena', 'order', orderId);
  const fresh = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  await sendEmail(env, {
    to: fresh.email, subject: tr(fresh, `Platba přijata – objednávka ${fresh.number}`, `Payment received – order ${fresh.number}`), related: `order:${orderId}`,
    body: tr(fresh, `<p>Dobrý den, ${fresh.name},</p><p>děkujeme, platbu za objednávku <strong>${fresh.number}</strong> jsme přijali. Hodinky pečlivě zabalíme a odešleme. O odeslání vás budeme informovat.</p>
<p>Fakturu najdete zde: <a href="${origin}/faktura/${inv.public_token}">faktura ${inv.number}</a></p>`, `<p>Dear ${fresh.name},</p><p>thank you, we have received the payment for order <strong>${fresh.number}</strong>. We will pack and ship your watch with care and let you know when it is on its way.</p>
<p>Your invoice: <a href="${origin}/faktura/${inv.public_token}">invoice ${inv.number}</a></p>`),
  });
  return fresh;
}

async function invoiceEmail(env, orderId, inv, origin) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  await sendEmail(env, {
    to: o.email, subject: tr(o, `Faktura k objednávce ${o.number}`, `Invoice for order ${o.number}`), related: `order:${orderId}`,
    body: tr(o, `<p>Dobrý den, ${o.name},</p><p>děkujeme za zaplacení objednávky <strong>${o.number}</strong>. Fakturu najdete zde: <a href="${origin}/faktura/${inv.public_token}">faktura ${inv.number}</a>.</p>`, `<p>Dear ${o.name},</p><p>thank you for paying for order <strong>${o.number}</strong>. Your invoice: <a href="${origin}/faktura/${inv.public_token}">invoice ${inv.number}</a>.</p>`),
  });
}

/** Vystaví fakturu (doklad) k objednávce. Opakované volání vrátí existující. */
export async function issueInvoice(env, orderId) {
  const existing = await env.DB.prepare('SELECT * FROM invoices WHERE order_id = ? AND cancelled_at IS NULL').bind(orderId).first();
  if (existing) return existing;
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId).first();
  const { results: items } = await env.DB.prepare('SELECT i.title, i.price_czk, p.serial_ref, p.case_metal, p.hallmark, p.precious_weight_g FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.order_id = ?').bind(orderId).all();
  // Zákon o puncovnictví: u zboží z drahých kovů uvést druh, hmotnost a ryzost
  const metalText = (i) => (['zlato', 'stribro', 'platina'].includes(i.case_metal)
    ? `; pouzdro: ${METAL[i.case_metal].cs}${i.hallmark ? `, ${i.hallmark}` : ''}${i.precious_weight_g ? `, hmotnost drahého kovu ${i.precious_weight_g} g` : ''}` : '');
  const lines = items.map((i) => ({ text: `${i.title}${i.serial_ref ? ` (identifikace: ${i.serial_ref}` : ' ('}${metalText(i)})`.replace(' ()', '').replace('(; ', '('), price: i.price_czk }));
  lines.push({ text: `Doprava – ${SHIPPING[o.shipping_method]?.cs || o.shipping_method}`, price: o.shipping_price });
  if (o.cod_fee) lines.push({ text: 'Dobírka', price: o.cod_fee });
  const inv = await createInvoice(env, {
    source: 'order', order_id: orderId, mode: o.mode,
    buyer_name: o.name, buyer_company: o.company, buyer_ico: o.company_ico, buyer_dic: o.company_dic,
    buyer_street: o.billing_street, buyer_city: o.billing_city, buyer_zip: o.billing_zip, buyer_email: o.email,
    items: lines, payment_method: o.payment_method, taxable_date: o.paid_at || now(), paid_at: o.paid_at || now(), variable_symbol: o.variable_symbol,
    note: `Objednávka ${o.number}`,
    pay_currency: o.pay_currency || 'CZK', pay_amount_cents: o.pay_currency === 'EUR' ? o.pay_amount_cents : null, eur_rate: o.eur_rate || null,
  });
  await env.DB.prepare('UPDATE orders SET invoice_number=?, invoice_issued_at=? WHERE id=?').bind(inv.number, inv.issued_at, orderId).run();
  return inv;
}

/** Obecné vystavení faktury (objednávka, zakázka, ruční). */
export async function createInvoice(env, d) {
  const items = (d.items || []).filter((i) => i && String(i.text || '').trim() && Number.isInteger(Number(i.price)));
  if (!items.length) throw new HttpError('Faktura musí mít alespoň jednu položku');
  const total = items.reduce((sum, i) => sum + Number(i.price), 0);
  const seq = await nextCounter(env, 'invoice');
  const number = `${new Date().getFullYear()}${String(seq).padStart(4, '0')}`;
  const inv = {
    id: randomId(), number, public_token: randomToken(24), source: d.source, order_id: d.order_id || null, commission_id: d.commission_id || null,
    mode: d.mode || (mode(env) === 'live' ? 'live' : 'test'),
    buyer_name: d.buyer_name, buyer_company: d.buyer_company || null, buyer_ico: d.buyer_ico || null, buyer_dic: d.buyer_dic || null,
    buyer_street: d.buyer_street || null, buyer_city: d.buyer_city || null, buyer_zip: d.buyer_zip || null, buyer_email: d.buyer_email || null,
    items: JSON.stringify(items.map((i) => ({ text: String(i.text).slice(0, 300), price: Number(i.price) }))), total,
    payment_method: d.payment_method || 'bank_transfer', issued_at: now(), taxable_date: d.taxable_date || now(),
    due_date: d.due_date || null, paid_at: d.paid_at || null, variable_symbol: d.variable_symbol || number, note: d.note || null,
    pay_currency: d.pay_currency || 'CZK', pay_amount_cents: d.pay_amount_cents ?? null, eur_rate: d.eur_rate ?? null,
    ...bankDetails(), // účet, na který je faktura vystavena (pozdější změna účtu ji neovlivní)
  };
  const keys = Object.keys(inv);
  await env.DB.prepare(`INSERT INTO invoices (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map((k) => inv[k])).run();
  return inv;
}

export async function markShipped(env, orderId, tracking, actor) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  const cod = order.payment_method === 'cod' && order.status === 'awaiting_payment';
  if (order.status !== 'paid' && !cod) throw new HttpError('Odeslat lze jen zaplacenou objednávku nebo dobírku');
  const t = now();
  const stmts = [env.DB.prepare("UPDATE orders SET status='shipped', shipped_at=?, tracking_number=?, updated_at=? WHERE id=?").bind(t, tracking, t, orderId)];
  // Dobírka: odesláním se kus považuje za prodaný
  if (cod) stmts.push(env.DB.prepare("UPDATE products SET status='sold', sold_at=?, reserved_until=NULL, updated_at=? WHERE id IN (SELECT product_id FROM order_items WHERE order_id=?)").bind(t, t, orderId));
  await env.DB.batch(stmts);
  await audit(env, actor, 'objednavka_odeslana', 'order', orderId, { tracking });
  await sendEmail(env, {
    to: order.email, subject: tr(order, `Objednávka ${order.number} je na cestě`, `Order ${order.number} is on its way`), related: `order:${orderId}`,
    body: tr(order, `<p>Dobrý den, ${order.name},</p>${cod ? `<p>Při převzetí zaplatíte <strong>${formatCzk(order.total)}</strong>.</p>` : ''}<p>vaše hodinky jsou na cestě${order.pickup_point_name ? ` na výdejní místo ${order.pickup_point_name}` : ''}.${tracking ? ` Číslo zásilky: <strong>${tracking}</strong>.` : ''}</p><p>Po převzetí doporučujeme nechat hodinky několik hodin v klidu při pokojové teplotě. Rady k péči: <a href="${SITE.origin}/care">Péče o hodinky</a>.</p>${TERMS.inspection.enabled ? `<p style="font-size:13px;color:#555">Záruka za jakost: ${TERMS.warrantyMonths} měsíců, ve druhém roce po garanční prohlídce ${TERMS.inspection.afterMonths} měsíců od převzetí. Podrobnosti: <a href="${SITE.origin}/warranty">Záruka a garance pravosti</a>.</p>` : ''}`,
      `<p>Dear ${order.name},</p>${cod ? `<p>You pay <strong>${formatCzk(order.total)}</strong> on delivery.</p>` : ''}<p>your watch is on its way${order.pickup_point_name ? ` to the pickup point ${order.pickup_point_name}` : ''}.${tracking ? ` Tracking number: <strong>${tracking}</strong>.` : ''}</p><p>After receipt we recommend letting the watch rest for a few hours at room temperature. Care tips: <a href="${SITE.origin}/en/care">Watch care</a>.</p>${TERMS.inspection.enabled ? `<p style="font-size:13px;color:#555">Quality warranty: ${TERMS.warrantyMonths} months, in the second year after a warranty inspection ${TERMS.inspection.afterMonths} months after receipt. Details: <a href="${SITE.origin}/en/warranty">Warranty and authenticity guarantee</a>.</p>` : ''}`),
  });
}

/** Zrušení objednávky: uvolní rezervaci (pokud ještě nebyla zaplacena). */
export async function cancelOrder(env, orderId, actor) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='cancelled', cancelled_at=?, updated_at=? WHERE id=?").bind(t, t, orderId),
    env.DB.prepare("UPDATE products SET status='available', reserved_order_id=NULL, reserved_until=NULL, updated_at=? WHERE reserved_order_id=? AND status='reserved'").bind(t, orderId),
  ]);
  await audit(env, actor, 'objednavka_zrusena', 'order', orderId);
}
