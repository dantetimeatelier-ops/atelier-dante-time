// Zpracování potvrzení platby kartou – společné pro Stripe i Comgate.
// Zaplaceno → objednávka zaplacena, kus prodán, faktura a e-mail zákazníkovi (markPaid).
// Pokud kus mezitím koupil někdo jiný (rezervace propadla), objednávka se NEoznačí
// a majitel dostane e-mail s pokynem platbu vrátit – kus se nikdy neprodá dvakrát.
import { markPaid, cancelOrder } from './orders.js';
import { amountMatches, paymentFee } from './payments.js';
import { addCost } from './finance.js';
import { audit } from './db.js';
import { sendEmail, ownerEmail } from './email.js';

export async function applyPaymentStatus(env, order, st, origin, actor) {
  if (!amountMatches(order, st)) {
    await audit(env, actor, 'nesouhlasi_castka', 'order', order.id, { cents: st.cents, currency: st.currency });
    await sendEmail(env, { to: ownerEmail(env), subject: `Pozor: nesouhlasí částka platby u objednávky ${order.number}`, related: `order:${order.id}`,
      body: `<p>Brána ${actor} hlásí platbu ${st.cents / 100} ${st.currency}, objednávka čeká jinou částku. Objednávka nebyla označena jako zaplacená. Zkontrolujte ji prosím v administraci.</p>` });
    return 'mismatch';
  }
  if (st.status === 'PAID' && st.testMode && env.SHOP_MODE === 'live') {
    // Zkouška majitele testovací kartou na ostrém webu: nic se neprodá, nevystaví se faktura, kus se uvolní
    if (order.status === 'awaiting_payment') await cancelOrder(env, order.id, actor);
    await audit(env, actor, 'testovaci_platba_ok', 'order', order.id, { cents: st.cents });
    await sendEmail(env, { to: ownerEmail(env), subject: `Test platby kartou proběhl v pořádku (${order.number})`, related: `order:${order.id}`,
      body: `<p>Stripe potvrdil testovací platbu ${st.cents / 100} ${st.currency} za objednávku <strong>${order.number}</strong>.</p><p>Šlo o zkoušku bez skutečných peněz: objednávka se zrušila, hodinky jsou znovu v nabídce a faktura se nevystavila.</p>` });
    return 'test';
  }
  if (st.status === 'PAID') {
    try {
      await markPaid(env, order.id, actor, origin);
      try { await recordCardFee(env, order.id); } catch (e) { console.error('Poplatek brány: zápis selhal', e?.message); } // doplní se při další hodinové kontrole
      return 'paid';
    } catch (e) {
      if (e?.status !== 409) throw e;
      await audit(env, actor, 'platba_po_prodeji', 'order', order.id, { error: e.message });
      await sendEmail(env, { to: ownerEmail(env), subject: `Vrátit platbu: objednávka ${order.number}`, related: `order:${order.id}`,
        body: `<p>Platba kartou za objednávku <strong>${order.number}</strong> dorazila, ale hodinky už nejsou pro tuto objednávku rezervované (${e.message}).</p><p>Kus se tedy neprodal podruhé. Platbu prosím vraťte zákazníkovi v administraci platební brány a objednávku zrušte.</p>` });
      return 'conflict';
    }
  }
  if (st.status === 'CANCELLED' && order.status === 'awaiting_payment') {
    await cancelOrder(env, order.id, actor);
    return 'cancelled';
  }
  return 'pending';
}

/**
 * Poplatek platební brány → náklad „Poplatky“ u konkrétních prodaných hodinek (Dante Time OS / Ekonomika).
 * Více kusů v objednávce: poplatek se rozdělí podle ceny. Zapisuje se právě jednou (orders.card_fee_czk).
 * @returns {Promise<number|null>} poplatek v Kč, nebo null když ho brána zatím neuvádí
 */
export async function recordCardFee(env, orderId, deps = {}) {
  const o = await env.DB.prepare('SELECT id, number, payment_method, payment_ref, card_fee_czk, paid_at FROM orders WHERE id = ?').bind(orderId).first();
  if (!o || o.payment_method !== 'card' || !o.payment_ref || o.card_fee_czk != null) return o?.card_fee_czk ?? null;
  const fee = await paymentFee(env, o.payment_ref, deps);
  if (fee == null) return null;
  const czk = Math.round(fee / 100);
  const { results: items } = await env.DB.prepare('SELECT product_id, title, price_czk FROM order_items WHERE order_id = ? ORDER BY price_czk DESC').bind(orderId).all();
  // Nejdřív označit, pak zapsat – opakované oznámení tak nezapíše poplatek dvakrát
  const mark = await env.DB.prepare('UPDATE orders SET card_fee_czk = ? WHERE id = ? AND card_fee_czk IS NULL').bind(czk, orderId).run();
  if (!mark?.meta?.changes) return czk;
  const sum = items.reduce((a, i) => a + (i.price_czk || 0), 0) || 1;
  let left = czk;
  const day = (o.paid_at || new Date().toISOString()).slice(0, 10);
  for (const [n, i] of items.entries()) {
    const part = n === items.length - 1 ? left : Math.round((czk * (i.price_czk || 0)) / sum);
    left -= part;
    if (part > 0) await addCost(env, { product_id: i.product_id, category: 'poplatky', description: `Poplatek platební brány – objednávka ${o.number}`, amount_czk: part, cost_date: day, supplier: 'Stripe', document_ref: `stripe:${o.payment_ref}` }, 'DT Finance');
  }
  return czk;
}

/** Hodinová kontrola: doplní poplatky, které brána při potvrzení platby ještě neuváděla. */
export async function recordMissingCardFees(env, deps) {
  const { results } = await env.DB.prepare("SELECT id FROM orders WHERE payment_method = 'card' AND status IN ('paid','shipped','completed') AND card_fee_czk IS NULL AND payment_ref IS NOT NULL ORDER BY paid_at DESC LIMIT 10").all();
  let done = 0;
  for (const r of results) { try { if ((await recordCardFee(env, r.id, deps)) != null) done++; } catch { /* zkusí se příště */ } }
  return done;
}
