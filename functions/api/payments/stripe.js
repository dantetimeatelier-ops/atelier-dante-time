// Oznámení (webhook) od Stripe – PŘIPRAVENO, aktivní až po vložení klíčů majitelem.
// V Stripe se nastaví adresa https://atelier-dante-time.cz/api/payments/stripe a události
// checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired.
import { gateway, verifyStripeSignature, paymentStatus } from '../../../server/payments.js';
import { applyPaymentStatus } from '../../../server/payment-events.js';

const EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);
const ok = (t = 'ok') => new Response(t, { status: 200 });

export const onRequestPost = async ({ env, request }) => {
  if (gateway(env) !== 'stripe') return new Response('disabled', { status: 404 });
  const payload = await request.text();
  if (!(await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) return new Response('bad signature', { status: 400 });
  let event;
  try { event = JSON.parse(payload); } catch { return new Response('bad json', { status: 400 }); }
  if (!EVENTS.has(event.type)) return ok('ignored');
  const sessionId = event.data?.object?.id;
  if (!sessionId) return ok('ignored');
  const order = await env.DB.prepare('SELECT * FROM orders WHERE payment_ref = ?').bind(sessionId).first();
  if (!order) return ok('unknown');
  // Stav si vždy ověříme přímo u Stripe, ne jen z obsahu oznámení
  const st = await paymentStatus(env, sessionId);
  await applyPaymentStatus(env, order, st, new URL(request.url).origin, 'stripe');
  return ok();
};
