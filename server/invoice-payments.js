// Platby k fakturám (evidence úhrad): záloha, částečná platba, doplatek, přeplatek, vrácení. (Platby kartou v e-shopu: payments.js)
// Zdroj pravdy pro „přijato“ a pohledávky. Sloupec invoices.paid_at = den, kdy byl doklad uhrazen celý (odvozený).
import { HttpError } from './http.js';
import { randomId, now, audit } from './db.js';
import { str, int } from './validate.js';

export const PAY_METHODS = { bank_transfer: 'Převodem', cash: 'Hotově', card: 'Kartou', cod: 'Dobírka', other: 'Jinak' };
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

/** Částka k úhradě (po odečtení zálohy). U dobropisu záporná (= k vrácení). */
export const dueOf = (inv) => (inv.total || 0) - (inv.advance_deducted || 0);

/** Stav úhrady podle součtu plateb (jako iDoklad: neuhrazeno, částečně, uhrazeno, přeplaceno). */
export function payState(inv, paid) {
  if (inv.cancelled_at) return 'storno';
  const due = dueOf(inv);
  if (due < 0) return paid <= due ? 'vraceno' : 'k_vraceni';
  if (!paid) return due === 0 ? 'uhrazeno' : 'neuhrazeno';
  if (paid < due) return 'castecne';
  return paid > due ? 'preplaceno' : 'uhrazeno';
}
export const STATE_LABEL = { neuhrazeno: 'neuhrazeno', castecne: 'částečně uhrazeno', uhrazeno: 'uhrazeno', preplaceno: 'přeplaceno', storno: 'storno', vraceno: 'vráceno', k_vraceni: 'k vrácení' };

export async function paidSum(env, invoiceId) {
  return (await env.DB.prepare('SELECT COALESCE(SUM(amount_czk),0) AS s FROM invoice_payments WHERE invoice_id = ? AND cancelled_at IS NULL').bind(invoiceId).first()).s;
}

/** Přepočítá paid_at podle plateb (uhrazeno celé = datum poslední platby; jinak prázdné). */
export async function syncPaid(env, invoiceId) {
  const inv = await env.DB.prepare('SELECT id, total, advance_deducted, paid_at FROM invoices WHERE id = ?').bind(invoiceId).first();
  if (!inv) return;
  const paid = await paidSum(env, invoiceId);
  const due = dueOf(inv);
  const settled = due >= 0 ? (paid >= due && (paid !== 0 || due === 0)) : paid <= due;
  let paidAt = null;
  if (settled) {
    const last = await env.DB.prepare('SELECT MAX(paid_on) AS d FROM invoice_payments WHERE invoice_id = ? AND cancelled_at IS NULL').bind(invoiceId).first();
    // Původní přesný čas ponechat, pokud sedí na datum poslední platby
    paidAt = inv.paid_at && last.d && inv.paid_at.slice(0, 10) === last.d ? inv.paid_at : last.d ? `${last.d}T12:00:00.000Z` : inv.paid_at || now();
  }
  if ((paidAt || null) !== (inv.paid_at || null)) await env.DB.prepare('UPDATE invoices SET paid_at = ? WHERE id = ?').bind(paidAt, invoiceId).run();
  return { paid, due, paidAt };
}

/** Platba při vystavení dokladu (e-shop zaplaceno, „Již uhrazeno“, vrácený dobropis). */
export async function recordInitialPayment(env, inv, actor = 'system') {
  if (!inv.paid_at) return;
  await env.DB.prepare('INSERT INTO invoice_payments (id, invoice_id, amount_czk, paid_on, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(randomId(), inv.id, dueOf(inv), inv.paid_at.slice(0, 10), inv.payment_method || null, 'Uhrazeno při vystavení', actor).run();
}

export async function addPayment(env, invoiceId, b, actor) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first();
  if (!inv) throw new HttpError('Doklad nenalezen', 404);
  if (inv.cancelled_at) throw new HttpError('Ke stornovanému dokladu nelze zapsat platbu');
  const amount = int(b.amount, { min: -50000000, max: 50000000, nullable: false, name: 'částku platby' });
  if (!amount) throw new HttpError('Zadejte částku platby');
  const day = ymd(b.paid_on) || now().slice(0, 10);
  if (day > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) throw new HttpError('Datum úhrady nemůže být v budoucnu');
  const method = PAY_METHODS[b.method] ? b.method : (inv.payment_method || 'bank_transfer');
  const id = randomId();
  await env.DB.prepare('INSERT INTO invoice_payments (id, invoice_id, amount_czk, paid_on, method, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, invoiceId, amount, day, method, str(b.note, { max: 300 }), actor).run();
  const s = await syncPaid(env, invoiceId);
  await audit(env, actor, amount < 0 ? 'platba_vracena' : 'platba_zaznamenana', 'invoice', invoiceId, { number: inv.number, amount, paid_on: day, payment: id });
  return { id, ...s, state: payState(inv, s.paid) };
}

/** Oprava chybně zadané platby: zruší se s důvodem (zůstává v historii), přepočte se stav dokladu. */
export async function cancelPayment(env, paymentId, reason, actor) {
  const p = await env.DB.prepare('SELECT p.*, i.number FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = ?').bind(paymentId).first();
  if (!p) throw new HttpError('Platba nenalezena', 404);
  if (p.cancelled_at) return p;
  const why = str(reason, { max: 300, required: true, name: 'důvod opravy platby' });
  await env.DB.prepare('UPDATE invoice_payments SET cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?').bind(now(), actor, why, paymentId).run();
  await syncPaid(env, p.invoice_id);
  await audit(env, actor, 'platba_zrusena', 'invoice', p.invoice_id, { number: p.number, amount: p.amount_czk, paid_on: p.paid_on, reason: why });
  return p;
}

export async function listPayments(env, invoiceId) {
  const { results } = await env.DB.prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on, created_at').bind(invoiceId).all();
  return results;
}
