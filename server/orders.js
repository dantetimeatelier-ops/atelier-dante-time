// Objednávky: nabídka dopravy a plateb, vytvoření objednávky s atomickou
// rezervací unikátních kusů, zaplacení a e-maily.
import { HttpError } from './http.js';
import { mode, getSettings, releaseExpired, nextCounter, randomId, randomToken, now, addMinutes, audit } from './db.js';
import { str, email as vEmail, oneOf } from './validate.js';
import { sendEmail, ownerEmail } from './email.js';
import { OPERATOR, SITE } from '../src/site.mjs';
import { SHIPPING, PAYMENT, formatCzk } from '../src/shop/format.mjs';
import { isValidIban } from '../src/shop/spd.mjs';
import { terms, withdrawal, LEGAL_VERSION } from '../src/legal/docs.mjs';
import { productName } from '../src/shop/describe.mjs';
import { createCardPayment, cardPaymentsAvailable } from './payments.js';

export async function shopConfig(env, lang = 'cs') {
  const m = mode(env);
  const s = await getSettings(env);
  const shipping = [];
  for (const id of ['zasilkovna', 'balikovna']) {
    const price = s[`shipping_${id}_czk`];
    if (price != null && price !== '' && Number.isInteger(Number(price))) shipping.push({ id, label: SHIPPING[id][lang], price: Number(price) });
  }
  if (s.shipping_osobni_enabled === '1') shipping.push({ id: 'osobni', label: SHIPPING.osobni[lang], price: 0 });
  const payment = [];
  const iban = env.SHOP_IBAN || OPERATOR.iban;
  if (iban && isValidIban(iban)) payment.push({ id: 'bank_transfer', label: PAYMENT.bank_transfer[lang], note: lang === 'cs' ? 'Platební údaje a QR kód obdržíte hned po objednávce.' : 'Payment details and a QR code will be shown right after ordering.' });
  if (cardPaymentsAvailable(env)) payment.push({ id: 'card', label: PAYMENT.card[lang] });
  return { mode: m, shipping, payment, packetaKey: env.PACKETA_API_KEY || null, settings: s };
}

export async function createOrder(env, body, origin) {
  const m = mode(env);
  if (m === 'preview') throw new HttpError('E-shop zatím nepřijímá objednávky', 403);
  const lang = body.lang === 'en' ? 'en' : 'cs';
  const cfg = await shopConfig(env, lang);

  if (body.terms !== true) throw new HttpError('Pro objednání je nutný souhlas s obchodními podmínkami');
  const ids = Array.isArray(body.items) ? [...new Set(body.items.filter((x) => typeof x === 'string'))] : [];
  if (!ids.length || ids.length > 10) throw new HttpError('Košík je prázdný');
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

  await releaseExpired(env);

  const ph = ids.map(() => '?').join(',');
  const { results: products } = await env.DB.prepare(`SELECT id, title, brand, model, price_czk, status FROM products WHERE id IN (${ph})`).bind(...ids).all();
  const unavailable = ids.filter((id) => { const p = products.find((x) => x.id === id); return !p || p.status !== 'available' || p.price_czk == null; });
  if (unavailable.length) throw new HttpError('Některé hodinky už nejsou k dispozici', 409, { unavailable });

  const itemsTotal = products.reduce((s, p) => s + p.price_czk, 0);
  const total = itemsTotal + ship.price;
  const seq = await nextCounter(env, 'order');
  const year = new Date().getFullYear();
  const number = `${year}-${String(seq).padStart(4, '0')}`;
  const vs = `${String(year).slice(2)}${String(seq).padStart(4, '0')}`;
  const orderId = randomId();
  const token = randomToken(24);
  const s = cfg.settings;
  const reservedUntil = pay.id === 'card' ? addMinutes(Number(s.reservation_minutes_card || 30)) : addMinutes(Number(s.reservation_hours_bank || 72) * 60);
  const t = now();

  // Vše v jedné dávce = jedné transakci. Pokud se některý kus nepodaří
  // rezervovat, vložení položky selže (title NOT NULL) a celá dávka se vrátí zpět.
  const stmts = [
    env.DB.prepare(`INSERT INTO customers (id, email, name, phone) VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name, phone=excluded.phone, updated_at=?`).bind(randomId(), customer.email, customer.name, customer.phone, t),
    env.DB.prepare(`INSERT INTO orders (id, number, public_token, status, mode, customer_id, email, name, phone,
      billing_street, billing_city, billing_zip, company, company_ico, company_dic, shipping_method, pickup_point_id, pickup_point_name,
      payment_method, items_total, shipping_price, total, variable_symbol, customer_note, terms_version, terms_accepted_at, reserved_until)
      VALUES (?, ?, ?, 'awaiting_payment', ?, (SELECT id FROM customers WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, number, token, m, customer.email, customer.email, customer.name, customer.phone, customer.street, customer.city, customer.zip,
        customer.company, customer.ico, customer.dic, ship.id, pickupId, pickupName, pay.id, itemsTotal, ship.price, total, vs, customer.note,
        s.terms_version || LEGAL_VERSION, t, reservedUntil),
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

async function orderEmails(env, order, items, origin) {
  const rows = items.map((i) => `<tr><td style="padding:6px 0">${i.title}</td><td style="text-align:right">${formatCzk(i.price_czk)}</td></tr>`).join('');
  const table = `<table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding:6px 0">Doprava: ${SHIPPING[order.shipping_method]?.cs || order.shipping_method}${order.pickup_point_name ? ` (${order.pickup_point_name})` : ''}</td><td style="text-align:right">${formatCzk(order.shipping_price)}</td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #ddd"><strong>Celkem</strong></td><td style="text-align:right;border-top:1px solid #ddd"><strong>${formatCzk(order.total)}</strong></td></tr></table>`;
  const link = `${origin}/objednavka/${order.public_token}`;
  await sendEmail(env, {
    to: order.email,
    subject: `Potvrzení objednávky ${order.number}`,
    related: `order:${order.id}`,
    body: `<h1 style="font-family:Georgia,serif;font-weight:normal">Děkujeme za objednávku</h1>
<p>Dobrý den, ${order.name},</p>
<p>potvrzujeme přijetí vaší objednávky <strong>${order.number}</strong>. Tímto potvrzením je kupní smlouva uzavřena.</p>
${table}
<p>Platba: ${PAYMENT[order.payment_method]?.cs}. ${order.payment_method === 'bank_transfer' ? `Platební údaje a QR kód najdete na stránce objednávky. Hodinky jsou pro vás rezervovány do ${new Date(order.reserved_until).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
<p><a href="${link}" style="display:inline-block;background:#c8a24a;color:#000;padding:10px 18px;border-radius:999px;text-decoration:none">Zobrazit objednávku</a></p>
<p style="font-size:13px;color:#555">Od kupní smlouvy můžete jako spotřebitel odstoupit do 14 dnů od převzetí hodinek, např. pomocí funkce <a href="${origin}/odstoupeni">Odstoupit od smlouvy</a>.</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:18px">Obchodní podmínky (verze ${order.terms_version})</h2>
<div style="font-size:12px;color:#444">${terms.body()}</div>
<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:18px">Poučení o odstoupení od smlouvy</h2>
<div style="font-size:12px;color:#444">${withdrawal.body()}</div>`,
  });
  await sendEmail(env, {
    to: ownerEmail(env),
    subject: `Nová objednávka ${order.number} – ${formatCzk(order.total)}`,
    related: `order:${order.id}`,
    body: `<p>Nová objednávka <strong>${order.number}</strong> (${order.mode === 'test' ? 'TEST' : 'ostrá'}).</p>${table}<p>Zákazník: ${order.name}, ${order.email}, ${order.phone || ''}</p><p><a href="${origin}/admin/#/objednavky/${order.id}">Otevřít v administraci</a></p>`,
  });
}

/** Označí objednávku jako zaplacenou: hodinky prodány, faktura, e-mail. */
export async function markPaid(env, orderId, actor, origin) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  if (order.status === 'paid' || order.status === 'shipped' || order.status === 'completed') return order;
  const t = now();
  // Pokud rezervace mezitím propadla a kus koupil někdo jiný, nelze označit jako zaplacené automaticky
  const { results: conflicts } = await env.DB.prepare(`SELECT p.id, p.title FROM order_items i JOIN products p ON p.id = i.product_id
    WHERE i.order_id = ? AND NOT (p.status = 'reserved' AND p.reserved_order_id = ?) AND NOT (p.status='available')`).bind(orderId, orderId).all();
  if (conflicts.length) throw new HttpError(`Hodinky ${conflicts.map((c) => c.title).join(', ')} už nejsou pro tuto objednávku rezervované. Vyřešte prosím ručně (vrácení platby).`, 409);
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='paid', paid_at=?, updated_at=?, reserved_until=NULL WHERE id=?").bind(t, t, orderId),
    env.DB.prepare(`UPDATE products SET status='sold', sold_at=?, reserved_until=NULL, updated_at=? WHERE id IN (SELECT product_id FROM order_items WHERE order_id=?)`).bind(t, t, orderId),
  ]);
  await issueInvoice(env, orderId);
  await audit(env, actor, 'objednavka_zaplacena', 'order', orderId);
  const fresh = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  await sendEmail(env, {
    to: fresh.email, subject: `Platba přijata – objednávka ${fresh.number}`, related: `order:${orderId}`,
    body: `<p>Dobrý den, ${fresh.name},</p><p>děkujeme, platbu za objednávku <strong>${fresh.number}</strong> jsme přijali. Hodinky pečlivě zabalíme a odešleme. O odeslání vás budeme informovat.</p>
${fresh.invoice_number ? `<p>Fakturu najdete zde: <a href="${origin}/faktura/${fresh.public_token}">faktura ${fresh.invoice_number}</a></p>` : ''}`,
  });
  return fresh;
}

export async function issueInvoice(env, orderId) {
  const o = await env.DB.prepare('SELECT invoice_number FROM orders WHERE id=?').bind(orderId).first();
  if (o?.invoice_number) return o.invoice_number;
  const seq = await nextCounter(env, 'invoice');
  const number = `${new Date().getFullYear()}${String(seq).padStart(4, '0')}`;
  await env.DB.prepare('UPDATE orders SET invoice_number=?, invoice_issued_at=? WHERE id=?').bind(number, now(), orderId).run();
  return number;
}

export async function markShipped(env, orderId, tracking, actor) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError('Objednávka neexistuje', 404);
  if (order.status !== 'paid') throw new HttpError('Odeslat lze jen zaplacenou objednávku');
  await env.DB.prepare("UPDATE orders SET status='shipped', shipped_at=?, tracking_number=?, updated_at=? WHERE id=?").bind(now(), tracking, now(), orderId).run();
  await audit(env, actor, 'objednavka_odeslana', 'order', orderId, { tracking });
  await sendEmail(env, {
    to: order.email, subject: `Objednávka ${order.number} je na cestě`, related: `order:${orderId}`,
    body: `<p>Dobrý den, ${order.name},</p><p>vaše hodinky jsou na cestě${order.pickup_point_name ? ` na výdejní místo ${order.pickup_point_name}` : ''}.${tracking ? ` Číslo zásilky: <strong>${tracking}</strong>.` : ''}</p><p>Po převzetí doporučujeme nechat hodinky několik hodin v klidu při pokojové teplotě. Rady k péči: <a href="${SITE.origin}/care">Péče o hodinky</a>.</p>`,
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
