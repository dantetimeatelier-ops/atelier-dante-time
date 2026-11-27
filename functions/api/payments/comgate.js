// Oznámení o změně stavu platby od Comgate (PŘIPRAVENO, aktivní až po nastavení brány)
import { paymentStatus, gateway } from '../../../server/payments.js';
import { applyPaymentStatus } from '../../../server/payment-events.js';

const reply = (code, message) => new Response(`code=${code}&message=${encodeURIComponent(message)}`, { status: code === 0 ? 200 : 400, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

export const onRequestPost = async ({ env, request }) => {
  if (gateway(env) !== 'comgate') return reply(1, 'disabled');
  const form = Object.fromEntries(new URLSearchParams(await request.text()));
  if (form.merchant !== env.COMGATE_MERCHANT || form.secret !== env.COMGATE_SECRET) return reply(1, 'unauthorized');
  // Stav si vždy ověříme přímo u brány
  const st = await paymentStatus(env, form.transId);
  const order = await env.DB.prepare('SELECT * FROM orders WHERE number = ? AND payment_ref = ?').bind(st.ref, form.transId).first();
  if (!order) return reply(1, 'order not found');
  const r = await applyPaymentStatus(env, order, st, new URL(request.url).origin, 'comgate');
  return r === 'mismatch' ? reply(1, 'amount mismatch') : reply(0, 'OK');
};
