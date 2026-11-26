// Platební brána Comgate – PŘIPRAVENO, NEAKTIVNÍ.
// Aktivuje se až nastavením COMGATE_MERCHANT a COMGATE_SECRET (tajné hodnoty
// v Cloudflare). Dokud není PAYMENTS_LIVE=true a SHOP_MODE=live, posílá se
// každá platba v testovacím režimu brány. Agent PAYMENTS_LIVE nikdy nenastavuje.
// ⚠️ Před aktivací ověřit aktuální API Comgate (docs/INTEGRATIONS.md).
import { HttpError } from './http.js';

const API = 'https://payments.comgate.cz/v1.0';

export const cardPaymentsAvailable = (env) => Boolean(env.COMGATE_MERCHANT && env.COMGATE_SECRET);
const isLive = (env) => env.PAYMENTS_LIVE === 'true' && env.SHOP_MODE === 'live';

async function call(env, endpoint, params) {
  const body = new URLSearchParams({ merchant: env.COMGATE_MERCHANT, secret: env.COMGATE_SECRET, ...params });
  const res = await fetch(`${API}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const out = Object.fromEntries(new URLSearchParams(await res.text()));
  if (out.code !== '0') throw new HttpError(`Platební brána odmítla požadavek (${out.message || out.code})`, 502);
  return out;
}

export async function createCardPayment(env, order, origin) {
  if (!cardPaymentsAvailable(env)) throw new HttpError('Platba kartou není dostupná', 400);
  const out = await call(env, 'create', {
    test: isLive(env) ? 'false' : 'true',
    price: String(order.total * 100),
    curr: 'CZK',
    label: `Objednávka ${order.number}`.slice(0, 16),
    refId: order.number,
    method: 'ALL',
    email: order.email,
    prepareOnly: 'true',
    country: 'CZ',
    lang: 'cs',
  });
  return { transId: out.transId, redirect: out.redirect || `${origin}/objednavka/${order.public_token}` };
}

/** Ověření stavu platby přímo u brány (nevěříme jen datům z callbacku). */
export async function paymentStatus(env, transId) {
  const out = await call(env, 'status', { transId });
  return { status: out.status, refId: out.refId, price: Number(out.price) };
}
