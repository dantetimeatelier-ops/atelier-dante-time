// Platby kartou (Visa, Mastercard, Apple Pay, Google Pay) – PŘIPRAVENO, NEAKTIVNÍ.
//
// Podporované brány (stejné rozhraní, vybírá se proměnnou PAYMENT_GATEWAY):
//   stripe  – bez měsíčních poplatků, platí se jen z uskutečněné platby (doporučeno, docs/PLATBY-A-DOPRAVA.md)
//   comgate – česká brána, levnější % při vyšším obratu, ale měsíční poplatek pod 100 000 Kč obratu
//
// Brána se zapne AŽ ve chvíli, kdy majitel vloží tajné klíče do Cloudflare:
//   Stripe:  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   Comgate: COMGATE_MERCHANT, COMGATE_SECRET
// Bez klíčů se platba kartou zákazníkům vůbec nezobrazí (ukazujeme jen funkční možnosti).
// Ostré platby navíc jen při PAYMENTS_LIVE=true a SHOP_MODE=live – to nastavuje VÝHRADNĚ majitel.
import { HttpError } from './http.js';

const COMGATE_API = 'https://payments.comgate.cz/v1.0';
const STRIPE_API = 'https://api.stripe.com/v1';

export const isLive = (env) => env.PAYMENTS_LIVE === 'true' && env.SHOP_MODE === 'live';

const hasStripe = (env) => Boolean(String(env.STRIPE_SECRET_KEY || '').trim() && String(env.STRIPE_WEBHOOK_SECRET || '').trim());
const hasComgate = (env) => Boolean(env.COMGATE_MERCHANT && env.COMGATE_SECRET);

/** Která brána je nastavená (null = žádná, platba kartou se nenabízí). */
export function gateway(env) {
  const want = String(env.PAYMENT_GATEWAY || '').toLowerCase();
  if (want === 'stripe') return hasStripe(env) ? 'stripe' : null;
  if (want === 'comgate') return hasComgate(env) ? 'comgate' : null;
  if (hasStripe(env)) return 'stripe';
  if (hasComgate(env)) return 'comgate';
  return null;
}

/**
 * Bezpečnostní pojistka: ostrý klíč Stripe v testovacím režimu (nebo naopak) platbu nezaloží.
 * Tím nemůže omylem proběhnout skutečná platba, dokud majitel ostrý provoz výslovně nezapne.
 */
function stripeKeyAllowed(env) {
  const key = String(env.STRIPE_SECRET_KEY || '').trim();
  const liveKey = /^(sk|rk)_live_/.test(key);
  return isLive(env) ? liveKey : /^(sk|rk)_test_/.test(key);
}

export const cardPaymentsAvailable = (env) => {
  const g = gateway(env);
  if (g === 'stripe') return stripeKeyAllowed(env);
  return g === 'comgate';
};


/** Částka k úhradě v nejmenších jednotkách (haléře / centy) a měna objednávky. */
export function orderAmount(order) {
  const currency = order.pay_currency === 'EUR' ? 'EUR' : 'CZK';
  const cents = currency === 'EUR' ? Number(order.pay_amount_cents) : Math.round(Number(order.total) * 100);
  if (!Number.isInteger(cents) || cents <= 0) throw new HttpError('Neplatná částka objednávky', 400);
  return { currency, cents };
}

// --- Comgate ---------------------------------------------------------------------
async function comgateCall(env, endpoint, params, fetcher = fetch) {
  const body = new URLSearchParams({ merchant: env.COMGATE_MERCHANT, secret: env.COMGATE_SECRET, ...params });
  const res = await fetcher(`${COMGATE_API}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const out = Object.fromEntries(new URLSearchParams(await res.text()));
  if (out.code !== '0') throw new HttpError(`Platební brána odmítla požadavek (${out.message || out.code})`, 502);
  return out;
}

// --- Stripe (REST API bez knihovny, formát application/x-www-form-urlencoded) -------
/** Převede vnořený objekt na parametry Stripe: a[b][0][c]=… */
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripeCall(env, method, path, params, fetcher = fetch) {
  const res = await fetcher(`${STRIPE_API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${String(env.STRIPE_SECRET_KEY).trim()}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: method === 'GET' ? undefined : stripeForm(params || {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(`Platební brána odmítla požadavek (${out?.error?.message || res.status})`, 502);
  return out;
}

/** Ověření podpisu oznámení Stripe (hlavička Stripe-Signature, HMAC-SHA256, tolerance 5 minut). */
export async function verifyStripeSignature(payload, header, secret, nowSec = Math.floor(Date.now() / 1000)) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header || '').split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(nowSec - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret).trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

// --- Společné rozhraní -------------------------------------------------------------
/**
 * Založí platbu u brány a vrátí adresu, kam přesměrovat zákazníka.
 * Platnost platby = rezervace kusu, takže po vypršení rezervace už zaplatit nejde (ochrana proti dvojímu prodeji).
 */
export async function createCardPayment(env, order, origin, { fetcher } = {}) {
  if (!cardPaymentsAvailable(env)) throw new HttpError('Platba kartou není dostupná', 400);
  const { currency, cents } = orderAmount(order);
  const back = `${origin}/objednavka/${order.public_token}`;
  if (gateway(env) === 'stripe') {
    // Stripe: platnost 30 min až 24 h; bereme konec rezervace (nejméně 31 minut od teď)
    const until = Math.floor(new Date(order.reserved_until || Date.now() + 3600e3).getTime() / 1000);
    const expiresAt = Math.min(Math.floor(Date.now() / 1000) + 23 * 3600, Math.max(until, Math.floor(Date.now() / 1000) + 31 * 60));
    const s = await stripeCall(env, 'POST', 'checkout/sessions', {
      mode: 'payment',
      // Jen karty: Visa, Mastercard a peněženky Apple Pay / Google Pay (jsou součástí karet). Žádný PayPal, Link ani placené doplňky
      // (bez automatic_tax a invoice_creation – fakturu vystavuje vlastní systém).
      payment_method_types: ['card'],
      locale: order.lang === 'en' ? 'en' : 'cs',
      customer_email: order.email,
      client_reference_id: order.number,
      expires_at: expiresAt,
      success_url: `${back}?platba=ok`,
      cancel_url: `${back}?platba=zrusena`,
      line_items: [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: cents, product_data: { name: `Atelier Dante Time – objednávka ${order.number}` } } }],
      metadata: { order_id: order.id, order_number: order.number },
      payment_intent_data: { description: `Objednávka ${order.number}`, metadata: { order_id: order.id, order_number: order.number } },
    }, fetcher);
    return { transId: s.id, redirect: s.url || back };
  }
  const out = await comgateCall(env, 'create', {
    test: isLive(env) ? 'false' : 'true',
    price: String(cents),
    curr: currency,
    label: `Objednávka ${order.number}`.slice(0, 16),
    refId: order.number,
    method: 'ALL', // karty včetně Apple Pay a Google Pay
    email: order.email,
    prepareOnly: 'true',
    country: order.billing_country || 'CZ',
    lang: order.lang === 'en' ? 'en' : 'cs',
  }, fetcher);
  return { transId: out.transId, redirect: out.redirect || back };
}

/**
 * Stav platby ověřený přímo u brány (nevěříme jen datům z oznámení).
 * @returns {{status:'PAID'|'PENDING'|'CANCELLED', cents:number, currency:string, ref:string}}
 */
/**
 * Skutečný poplatek brány za zaplacenou platbu v Kč (haléřích), nebo null, pokud ho brána zatím neuvádí.
 * Stripe: poplatek z „balance transaction“ zaplacené platby (obsahuje i případný převod měny).
 */
export async function paymentFee(env, transId, { fetcher } = {}) {
  if (gateway(env) !== 'stripe') return null;
  const s = await stripeCall(env, 'GET', `checkout/sessions/${encodeURIComponent(transId)}?expand[]=payment_intent.latest_charge.balance_transaction`, null, fetcher);
  const bt = s?.payment_intent?.latest_charge?.balance_transaction;
  if (!bt || typeof bt !== 'object' || !Number.isInteger(bt.fee)) return null;
  if (String(bt.currency).toLowerCase() !== 'czk') return null; // účet Stripe vede poplatky v Kč
  return bt.fee;
}

export async function paymentStatus(env, transId, { fetcher } = {}) {
  if (gateway(env) === 'stripe') {
    const s = await stripeCall(env, 'GET', `checkout/sessions/${encodeURIComponent(transId)}`, null, fetcher);
    const status = s.payment_status === 'paid' ? 'PAID' : s.status === 'expired' ? 'CANCELLED' : 'PENDING';
    return { status, cents: Number(s.amount_total), currency: String(s.currency || '').toUpperCase(), ref: s.client_reference_id };
  }
  const out = await comgateCall(env, 'status', { transId }, fetcher);
  return { status: out.status, cents: Number(out.price), currency: String(out.curr || 'CZK').toUpperCase(), ref: out.refId };
}

/** Sedí částka a měna potvrzené platby s objednávkou? */
export function amountMatches(order, st) {
  const { currency, cents } = orderAmount(order);
  return st.cents === cents && st.currency === currency;
}
