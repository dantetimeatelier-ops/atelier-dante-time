// Zpracování potvrzení platby kartou – společné pro Stripe i Comgate.
// Zaplaceno → objednávka zaplacena, kus prodán, faktura a e-mail zákazníkovi (markPaid).
// Pokud kus mezitím koupil někdo jiný (rezervace propadla), objednávka se NEoznačí
// a majitel dostane e-mail s pokynem platbu vrátit – kus se nikdy neprodá dvakrát.
import { markPaid, cancelOrder } from './orders.js';
import { amountMatches } from './payments.js';
import { audit } from './db.js';
import { sendEmail, ownerEmail } from './email.js';

export async function applyPaymentStatus(env, order, st, origin, actor) {
  if (!amountMatches(order, st)) {
    await audit(env, actor, 'nesouhlasi_castka', 'order', order.id, { cents: st.cents, currency: st.currency });
    await sendEmail(env, { to: ownerEmail(env), subject: `Pozor: nesouhlasí částka platby u objednávky ${order.number}`, related: `order:${order.id}`,
      body: `<p>Brána ${actor} hlásí platbu ${st.cents / 100} ${st.currency}, objednávka čeká jinou částku. Objednávka nebyla označena jako zaplacená. Zkontrolujte ji prosím v administraci.</p>` });
    return 'mismatch';
  }
  if (st.status === 'PAID') {
    try {
      await markPaid(env, order.id, actor, origin);
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
