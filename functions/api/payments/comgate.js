// Oznámení o změně stavu platby od Comgate (PŘIPRAVENO, aktivní až po nastavení brány)
import { markPaid, cancelOrder } from '../../../server/orders.js';
import { paymentStatus, cardPaymentsAvailable } from '../../../server/payments.js';
import { audit } from '../../../server/db.js';

const reply = (code, message) => new Response(`code=${code}&message=${encodeURIComponent(message)}`, { status: code === 0 ? 200 : 400, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

export const onRequestPost = async ({ env, request }) => {
  if (!cardPaymentsAvailable(env)) return reply(1, 'disabled');
  const form = Object.fromEntries(new URLSearchParams(await request.text()));
  if (form.merchant !== env.COMGATE_MERCHANT || form.secret !== env.COMGATE_SECRET) return reply(1, 'unauthorized');
  // Stav si vždy ověříme přímo u brány
  const st = await paymentStatus(env, form.transId);
  const order = await env.DB.prepare('SELECT * FROM orders WHERE number = ? AND payment_ref = ?').bind(st.refId, form.transId).first();
  if (!order) return reply(1, 'order not found');
  if (st.price !== order.total * 100) { await audit(env, 'comgate', 'nesouhlasi_castka', 'order', order.id, { price: st.price }); return reply(1, 'amount mismatch'); }
  if (st.status === 'PAID') await markPaid(env, order.id, 'comgate', new URL(request.url).origin);
  else if (st.status === 'CANCELLED' && order.status === 'awaiting_payment') await cancelOrder(env, order.id, 'comgate');
  return reply(0, 'OK');
};
