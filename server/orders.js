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
import { legalPdfs } from '../src/legal/pdf-files.mjs';
import { TERMS } from '../src/terms.mjs';
import { createForOrder } from './warranty.js';
import { onDelivered } from './passport.js';
import { createInvoice } from './invoicing.js';

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
  const items = products.map((p) => ({ id: p.id, title: productName(p), price_czk: p.price_czk }));
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
  const h = (t) => `<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:18px;color:#f2f2f2">${t}</h2>`;
  // Záruční list v textové podobě (§ 2174a OZ) je součástí potvrzení objednávky
  return `${h(en ? `General Terms and Conditions (version ${order.terms_version})` : `Obchodní podmínky (verze ${order.terms_version})`)}
<div style="font-size:12px;color:#b9b9b9">${terms.body()}</div>
${h(en ? 'Withdrawal information and model form' : 'Poučení o odstoupení od smlouvy')}
<div style="font-size:12px;color:#b9b9b9">${withdrawal.body()}</div>
${h(en ? 'Warranty statement and authenticity guarantee (warranty card)' : 'Prohlášení o záruce a garance pravosti (záruční list)')}
<div style="font-size:12px;color:#b9b9b9">${warranty.body()}</div>`;
}

// Další postup po objednávce podle způsobu platby a dopravy (krátce, bez právních formulací)
function nextSteps(order) {
  const en = order.lang === 'en';
  const pickup = ['zasilkovna', 'balikovna'].includes(order.shipping_method);
  const handover = order.shipping_method === 'osobni';
  const steps = [];
  if (order.payment_method === 'bank_transfer') steps.push(en ? `Pay by bank transfer – payment details and a QR code are on the order page. The watch is reserved for you until ${dt(order, order.reserved_until)}.` : `Uhraďte objednávku převodem – platební údaje a QR kód najdete na stránce objednávky. Hodinky jsou pro vás rezervovány do ${dt(order, order.reserved_until)}.`);
  if (order.payment_method === 'card') steps.push(en ? 'Once the card payment is confirmed, we will send you the invoice.' : 'Jakmile se potvrdí platba kartou, pošleme vám fakturu.');
  if (order.payment_method === 'cod') steps.push(en ? 'You pay on delivery. The watch is reserved for you.' : 'Zaplatíte při převzetí. Hodinky jsou pro vás rezervovány.');
  steps.push(handover
    ? (en ? 'We will contact you to arrange the handover in person.' : 'Ozveme se vám a domluvíme osobní předání.')
    : (en ? 'We will carefully check, pack and insure the watch and send it within a few working days.' : 'Hodinky pečlivě zkontrolujeme, zabalíme a do několika pracovních dnů odešleme.'));
  if (!handover) steps.push(pickup
    ? (en ? 'You will receive an e-mail with the tracking number; the carrier will let you know when the parcel is ready for pickup.' : 'Pošleme vám e-mail s číslem zásilky a dopravce vás vyrozumí, až bude připravena k vyzvednutí.')
    : (en ? 'You will receive an e-mail with the tracking number.' : 'Pošleme vám e-mail s číslem zásilky.'));
  return steps;
}

async function orderEmails(env, order, items, origin) {
  const en = order.lang === 'en';
  const lang = en ? 'en' : 'cs';
  const ship = SHIPPING[order.shipping_method]?.[lang] || SHIPPING[order.shipping_method]?.cs || order.shipping_method;
  const pay = PAYMENT[order.payment_method]?.[lang] || PAYMENT[order.payment_method]?.cs || order.payment_method;
  const link = `${origin}/objednavka/${order.public_token}`;
  // Hlavní fotografie každého kusu (náhled 800 px z veřejného úložiště fotek)
  const ids = items.map((i) => i.id).filter(Boolean);
  const imgs = new Map();
  if (ids.length) {
    const { results } = await env.DB.prepare(`SELECT product_id, key_small FROM product_images WHERE product_id IN (${ids.map(() => '?').join(',')}) AND key_small IS NOT NULL ORDER BY sort_order, created_at`).bind(...ids).all().catch(() => ({ results: [] }));
    for (const r of results) if (!imgs.has(r.product_id)) imgs.set(r.product_id, `${SITE.origin}/media/${r.key_small}`);
  }
  const F = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const S = "font-family:Georgia,'Times New Roman',serif";
  const line = '<tr><td colspan="2" style="padding:0;border-top:1px solid #2a2a2a;font-size:0;line-height:0">&nbsp;</td></tr>';
  const row = (l, v, strong) => `<tr><td style="padding:10px 12px 10px 0;color:#9a9a9a;font-size:14px;vertical-align:top">${l}</td><td align="right" style="padding:10px 0;color:${strong ? '#c8a24a' : '#e6e6e6'};font-size:${strong ? '19px' : '14px'};vertical-align:top;${strong ? S : ''}">${v}</td></tr>`;
  const watches = items.map((i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>
${imgs.get(i.id) ? `<td width="96" style="width:96px;padding:0 16px 0 0;vertical-align:middle"><img src="${imgs.get(i.id)}" width="96" height="120" alt="${i.title}" style="display:block;width:96px;height:120px;object-fit:cover;border-radius:12px;border:1px solid #2a2418;background:#0b0b0b"></td>` : ''}
<td style="vertical-align:middle"><div style="${S};font-size:18px;line-height:1.35;color:#f2f2f2">${i.title}</div><div style="${F};font-size:14px;color:#c8a24a;margin-top:6px">${formatCzk(i.price_czk)}</div></td></tr></table>`).join('');
  const summary = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${F};margin:6px 0 4px">
${line}${row(en ? 'Delivery' : 'Doprava', `${ship}${order.pickup_point_name ? `<br><span style="color:#9a9a9a;font-size:13px">${order.pickup_point_name}</span>` : ''}${order.shipping_price ? `<br><span style="color:#9a9a9a;font-size:13px">${formatCzk(order.shipping_price)}</span>` : ''}`)}
${line}${row(en ? 'Payment' : 'Platba', `${pay}${order.cod_fee ? `<br><span style="color:#9a9a9a;font-size:13px">${en ? 'COD fee' : 'Dobírka'} ${formatCzk(order.cod_fee)}</span>` : ''}`)}
${line}${row(en ? 'Total' : 'Celkem', `${formatCzk(order.total)}${order.pay_currency === 'EUR' ? `<br><span style="${F};color:#9a9a9a;font-size:13px">${en ? 'to pay' : 'k úhradě'} ${formatEur(order.pay_amount_cents)}</span>` : ''}`, true)}
${line}</table>`;
  const steps = nextSteps(order).map((t, n) => `<tr><td width="28" style="width:28px;vertical-align:top;padding:4px 0;${S};color:#c8a24a;font-size:15px">${n + 1}.</td><td style="vertical-align:top;padding:4px 0;color:#d6d6d6;font-size:14px">${t}</td></tr>`).join('');
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 8px"><tr><td bgcolor="#c8a24a" style="background:#c8a24a;border-radius:999px"><a href="${link}" style="display:inline-block;padding:14px 34px;${F};font-size:15px;font-weight:600;letter-spacing:.04em;color:#070707;text-decoration:none;border-radius:999px">${en ? 'View order' : 'Zobrazit objednávku'}</a></td></tr></table>`;
  const pdfs = legalPdfs(lang, order.terms_version || LEGAL_VERSION);
  const legal = `<p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #2a2a2a;${F};font-size:12px;line-height:1.6;color:#8c8c8c">${en
    ? `This confirmation concludes the purchase contract. Attached you will find the Terms and Conditions (version ${order.terms_version}), the withdrawal information with a model withdrawal form and the warranty card. As a consumer you may withdraw within ${TERMS.withdrawalDays} days of receiving the watch – simply via <a href="${origin}/en/withdrawal" style="color:#c8a24a">this form</a>.`
    : `Tímto potvrzením je kupní smlouva uzavřena. V příloze najdete obchodní podmínky (verze ${order.terms_version}), poučení o odstoupení od smlouvy se vzorovým formulářem a záruční list. Jako spotřebitel můžete od smlouvy odstoupit do ${TERMS.withdrawalDays} dnů od převzetí hodinek – jednoduše přes <a href="${origin}/odstoupeni" style="color:#c8a24a">tento formulář</a>.`}</p>`;
  const contact = `<p style="margin:16px 0 0;${F};font-size:13px;line-height:1.7;color:#b9b9b9">${en ? 'Any questions? Simply reply to this e-mail.' : 'Máte dotaz? Stačí odpovědět na tento e-mail.'}<br><span style="color:#f2f2f2">${SITE.name}</span> · ${OPERATOR.name}<br><a href="mailto:${SITE.email}" style="color:#c8a24a;text-decoration:none">${SITE.email}</a> · <a href="${SITE.origin}" style="color:#c8a24a;text-decoration:none">${SITE.origin.replace('https://', '')}</a></p>`;
  const body = `<h1 class="dt-h1" style="margin:0 0 6px;${S};font-weight:normal;font-size:28px;line-height:1.25;color:#f2f2f2">${en ? 'Thank you for your order' : 'Děkujeme za vaši objednávku'}</h1>
<p style="margin:0 0 22px;${F};font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#c8a24a">${en ? 'Order' : 'Objednávka'} ${order.number}</p>
<p style="margin:0 0 22px;color:#d6d6d6">${en ? `Dear ${order.name}, we are delighted that you have chosen a watch from our atelier.` : `Dobrý den, ${order.name}, děkujeme, že jste si vybrali hodinky z našeho ateliéru.`}</p>
${watches}
${summary}
<h2 style="margin:26px 0 8px;${S};font-weight:normal;font-size:18px;color:#f2f2f2">${en ? 'What happens next' : 'Co bude dál'}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${F}">${steps}</table>
${button}
${contact}
${legal}`;
  await sendEmail(env, {
    to: order.email,
    lang,
    subject: tr(order, `Potvrzení objednávky ${order.number} – Dante Time`, `Order confirmation ${order.number} – Dante Time`),
    related: `order:${order.id}`,
    body,
    attachments: pdfs.map((p) => ({ filename: p.filename, path: p.path })),
    // Kdyby přílohy nešly připojit, dokumenty půjdou v plném znění přímo v e-mailu (zákonná povinnost)
    fallbackBody: `${body}<hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0">${legalAttachment(order)}`,
  });
  const ownerRows = items.map((i) => `<tr><td style="padding:4px 0">${i.title}</td><td style="text-align:right">${formatCzk(i.price_czk)}</td></tr>`).join('');
  await sendEmail(env, {
    to: ownerEmail(env),
    subject: `Nová objednávka ${order.number} – ${formatCzk(order.total)}`,
    related: `order:${order.id}`,
    body: `<p>Nová objednávka <strong>${order.number}</strong> (${order.mode === 'test' ? 'TEST' : 'ostrá'}).</p><table style="width:100%;border-collapse:collapse">${ownerRows}<tr><td style="padding:4px 0">Doprava: ${ship}${order.pickup_point_name ? ` (${order.pickup_point_name})` : ''}</td><td style="text-align:right">${formatCzk(order.shipping_price)}</td></tr>${order.cod_fee ? `<tr><td>Dobírka</td><td style="text-align:right">${formatCzk(order.cod_fee)}</td></tr>` : ''}<tr><td style="padding:6px 0;border-top:1px solid #2a2a2a"><strong>Celkem</strong> · ${pay}</td><td style="text-align:right;border-top:1px solid #2a2a2a"><strong>${formatCzk(order.total)}</strong></td></tr></table><p>Zákazník: ${order.name}, ${order.email}, ${order.phone || ''}</p><p><a href="${origin}/admin/#/objednavky/${order.id}">Otevřít v administraci</a></p>`,
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
  try { await onDelivered(env, orderId, day, actor); } catch (e) { console.error('Pas: založení selhalo', e?.message); }
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
    try { await onDelivered(env, orderId, t.slice(0, 10), actor); } catch (e) { console.error('Pas: založení selhalo', e?.message); }
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
  const { results: items } = await env.DB.prepare('SELECT i.title, i.price_czk, i.product_id, p.serial_ref, p.case_metal, p.hallmark, p.precious_weight_g FROM order_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.order_id = ?').bind(orderId).all();
  // Zákon o puncovnictví: u zboží z drahých kovů uvést druh, hmotnost a ryzost
  const metalText = (i) => (['zlato', 'stribro', 'platina'].includes(i.case_metal)
    ? `; pouzdro: ${METAL[i.case_metal].cs}${i.hallmark ? `, ${i.hallmark}` : ''}${i.precious_weight_g ? `, hmotnost drahého kovu ${i.precious_weight_g} g` : ''}` : '');
  const lines = items.map((i) => ({ text: `${i.title}${i.serial_ref ? ` (identifikace: ${i.serial_ref}` : ' ('}${metalText(i)})`.replace(' ()', '').replace('(; ', '('), price: i.price_czk }));
  lines.push({ text: `Doprava – ${SHIPPING[o.shipping_method]?.cs || o.shipping_method}`, price: o.shipping_price });
  if (o.cod_fee) lines.push({ text: 'Dobírka', price: o.cod_fee });
  const inv = await createInvoice(env, {
    source: 'order', order_id: orderId, mode: o.mode, channel: 'eshop',
    product_id: items[0]?.product_id || null, watch_model: items[0]?.title || null, serial_ref: items[0]?.serial_ref || null,
    buyer_name: o.name, buyer_company: o.company, buyer_ico: o.company_ico, buyer_dic: o.company_dic,
    buyer_street: o.billing_street, buyer_city: o.billing_city, buyer_zip: o.billing_zip, buyer_email: o.email,
    items: lines, payment_method: o.payment_method, taxable_date: o.paid_at || now(), paid_at: o.paid_at || now(), variable_symbol: o.variable_symbol,
    note: `Objednávka ${o.number}`,
    pay_currency: o.pay_currency || 'CZK', pay_amount_cents: o.pay_currency === 'EUR' ? o.pay_amount_cents : null, eur_rate: o.eur_rate || null,
  });
  await env.DB.prepare('UPDATE orders SET invoice_number=?, invoice_issued_at=? WHERE id=?').bind(inv.number, inv.issued_at, orderId).run();
  return inv;
}

// Obecné vystavení faktury je v server/invoicing.js (centrální fakturace).
export { createInvoice } from './invoicing.js';

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
export { orderEmails as orderEmailsForTest }; // jen pro jednotkové testy
