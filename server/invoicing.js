// Dante Time OS – centrální fakturace: e-shop, ruční prodej (Vinted, Aukro, Instagram, osobně…), zálohy, dobropisy.
// Faktura s hodinkami ze skladu sama: označí kus jako prodaný, zapíše tržbu (ekonomika), založí pas hodinek
// a případně garanční prohlídku.
import { HttpError } from './http.js';
import { mode, randomId, randomToken, now, audit } from './db.js';
import { str, email as vEmail, oneOf, int } from './validate.js';
import { sendEmail } from './email.js';
import { SITE, OPERATOR, bankDetails } from '../src/site.mjs';
import { METAL, formatCzk } from '../src/shop/format.mjs';
import { INVOICE_KINDS, SALE_CHANNELS, INVOICE_PAY, invoiceNumber, invoiceVs, pragueYear, invoiceTotals } from '../src/shop/invoice.mjs';
import { createFromProduct, addEvent } from './passport.js';
import { createManual as createInspection } from './warranty.js';

/** Tržby = faktury a dobropisy (ne zálohové faktury), nestornované, ostrý režim. SQL podmínka pro tabulku invoices. */
export const REVENUE_SQL = "cancelled_at IS NULL AND kind <> 'zalohova'";

/** Atomicky přidělí další číslo řady DT-RRRR-NNNN (každý rok od 1). Unikátnost hlídá i databáze. */
export async function nextInvoiceNo(env, iso) {
  const year = pragueYear(iso);
  const name = `invoice-dt-${year}`;
  await env.DB.prepare('INSERT OR IGNORE INTO counters (name, value) VALUES (?, 0)').bind(name).run();
  const row = await env.DB.prepare('UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value').bind(name).first();
  return { number: invoiceNumber(year, row.value), vs: invoiceVs(year, row.value) };
}

/** Metadata drahých kovů do textu položky (zákon o puncovnictví). */
export const metalText = (p) => (['zlato', 'stribro', 'platina'].includes(p?.case_metal)
  ? `pouzdro: ${METAL[p.case_metal].cs}${p.hallmark ? `, ${p.hallmark}` : ''}${p.precious_weight_g ? `, hmotnost drahého kovu ${p.precious_weight_g} g` : ''}` : '');

/** Obecné vystavení dokladu (používá e-shop i ruční fakturace). */
export async function createInvoice(env, d) {
  const kind = d.kind || 'faktura';
  const { items, total } = invoiceTotals(d.items);
  if (!items.length) throw new HttpError('Faktura musí mít alespoň jednu položku');
  if (kind !== 'dobropis' && total <= 0) throw new HttpError('Celková částka musí být kladná');
  const issued = now();
  const { number, vs } = await nextInvoiceNo(env, issued);
  const inv = {
    id: randomId(), number, public_token: randomToken(24), source: d.source || 'manual', order_id: d.order_id || null, commission_id: d.commission_id || null,
    mode: d.mode || (mode(env) === 'live' ? 'live' : 'test'), kind, channel: d.channel || 'eshop',
    buyer_name: d.buyer_name, buyer_company: d.buyer_company || null, buyer_ico: d.buyer_ico || null, buyer_dic: d.buyer_dic || null,
    buyer_street: d.buyer_street || null, buyer_city: d.buyer_city || null, buyer_zip: d.buyer_zip || null, buyer_email: d.buyer_email || null,
    items: JSON.stringify(items), total, advance_deducted: Math.max(0, d.advance_deducted || 0),
    payment_method: d.payment_method || 'bank_transfer', issued_at: issued, taxable_date: d.taxable_date || issued,
    due_date: d.due_date || null, paid_at: d.paid_at || null, variable_symbol: d.variable_symbol || vs, note: d.note || null,
    pay_currency: d.pay_currency || 'CZK', pay_amount_cents: d.pay_amount_cents ?? null, eur_rate: d.eur_rate ?? null,
    related_invoice_id: d.related_invoice_id || null, product_id: d.product_id || null, watch_model: d.watch_model || null, serial_ref: d.serial_ref || null,
    ...bankDetails(), // účet, na který je faktura vystavena (pozdější změna účtu ji neovlivní)
  };
  const keys = Object.keys(inv);
  await env.DB.prepare(`INSERT INTO invoices (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).bind(...keys.map((k) => inv[k])).run();
  return inv;
}

async function upsertCustomer(env, inv) {
  if (!inv.buyer_email) return;
  await env.DB.prepare('INSERT INTO customers (id, email, name) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = COALESCE(customers.name, excluded.name), updated_at = ?')
    .bind(randomId(), inv.buyer_email, inv.buyer_company || inv.buyer_name, now()).run();
}

const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

/** Ruční faktura / zálohová faktura z administrace, volitelně s hodinkami ze skladu. */
export async function issueManual(env, b, actor, origin = SITE.origin) {
  const kind = oneOf(b.kind || 'faktura', ['faktura', 'zalohova'], 'druh dokladu');
  const channel = oneOf(b.channel || 'osobne', Object.keys(SALE_CHANNELS), 'zdroj prodeje');
  const lines = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => ({
    text: str(i.text, { max: 300, required: true, name: 'položku' }),
    qty: int(i.qty, { min: 1, max: 1000, name: 'množství' }) ?? 1,
    price: int(i.price, { min: -50000000, max: 50000000, nullable: false, name: 'cenu položky' }),
  }));
  // Hodinky ze skladu: položka, model a výrobní číslo se doplní z karty hodinek
  let product = null;
  if (b.product_id) {
    product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(str(b.product_id, { max: 40 })).first();
    if (!product) throw new HttpError('Hodinky nenalezeny', 404);
    if (kind === 'faktura' && product.status === 'sold') throw new HttpError(`${product.title} už jsou prodané`);
    if (product.status === 'reserved' && product.reserved_order_id) throw new HttpError(`${product.title} jsou rezervované objednávkou z e-shopu`);
    const price = int(b.product_price, { min: 0, max: 50000000, name: 'cenu hodinek' }) ?? product.price_czk;
    if (price == null) throw new HttpError('Zadejte cenu hodinek');
    const extra = [product.serial_ref ? `výrobní číslo ${product.serial_ref}` : '', metalText(product)].filter(Boolean).join('; ');
    lines.unshift({ text: `${product.title}${extra ? ` (${extra})` : ''}`.slice(0, 300), qty: 1, price });
  }
  const shipping = int(b.shipping_czk, { min: 0, max: 100000, name: 'dopravu' });
  if (shipping) lines.push({ text: 'Doprava', qty: 1, price: shipping });
  // Odečtení uhrazené zálohy (vyúčtování)
  let advance = null;
  if (b.advance_id) {
    if (kind !== 'faktura') throw new HttpError('Zálohu lze odečíst jen ve faktuře');
    advance = await env.DB.prepare("SELECT * FROM invoices WHERE id = ? AND kind = 'zalohova' AND cancelled_at IS NULL").bind(str(b.advance_id, { max: 40 })).first();
    if (!advance) throw new HttpError('Zálohová faktura nenalezena');
    if (!advance.paid_at) throw new HttpError(`Záloha ${advance.number} ještě není uhrazená`);
    const used = await env.DB.prepare("SELECT number FROM invoices WHERE related_invoice_id = ? AND kind = 'faktura' AND cancelled_at IS NULL").bind(advance.id).first();
    if (used) throw new HttpError(`Záloha ${advance.number} už je vyúčtovaná ve faktuře ${used.number}`);
  }
  const paid = Boolean(b.paid);
  const dueDays = int(b.due_days, { max: 90 }) ?? 14;
  const taxable = ymd(b.taxable_date);
  const buyerEmail = b.buyer_email ? vEmail(b.buyer_email) : null;
  const inv = await createInvoice(env, {
    kind, channel, source: b.commission_id ? 'commission' : 'manual', commission_id: b.commission_id || null,
    buyer_name: str(b.buyer_name, { max: 200, required: true, name: 'odběratele' }), buyer_company: str(b.buyer_company, { max: 200 }),
    buyer_ico: str(b.buyer_ico, { max: 20 }), buyer_dic: str(b.buyer_dic, { max: 20 }), buyer_street: str(b.buyer_street, { max: 200 }),
    buyer_city: str(b.buyer_city, { max: 120 }), buyer_zip: str(b.buyer_zip, { max: 12 }), buyer_email: buyerEmail,
    items: lines, payment_method: oneOf(b.payment_method || 'bank_transfer', Object.keys(INVOICE_PAY), 'způsob úhrady'),
    taxable_date: taxable ? `${taxable}T12:00:00.000Z` : now(), paid_at: paid ? now() : null,
    due_date: paid ? null : new Date(Date.now() + dueDays * 86400000).toISOString(), note: str(b.note, { max: 500 }),
    advance_deducted: advance ? advance.total : 0, related_invoice_id: advance?.id || null,
    product_id: product?.id || null, watch_model: str(b.watch_model, { max: 200 }) || product?.title || null,
    serial_ref: str(b.serial_ref, { max: 120 }) || product?.serial_ref || null,
  });
  if (inv.total - inv.advance_deducted < 0) throw new HttpError('Záloha je vyšší než faktura');
  await upsertCustomer(env, inv);
  const done = [];
  // Prodej hodinek: sklad → prodáno, pas hodinek, garanční prohlídka (jen u faktury, ne u zálohy)
  if (product && kind === 'faktura') {
    const day = (taxable || now().slice(0, 10));
    await env.DB.prepare("UPDATE products SET status = 'sold', sold_at = COALESCE(sold_at, ?), reserved_until = NULL, reserved_order_id = NULL, updated_at = ? WHERE id = ?").bind(now(), now(), product.id).run();
    done.push('hodinky označeny jako prodané');
    try {
      const pid = await createFromProduct(env, product.id, actor);
      await addEvent(env, pid, { kind: 'predani', event_date: day, text_cs: 'Předáno majiteli z ateliéru Dante Time.', text_en: 'Handed over to its owner by Atelier Dante Time.', ref: `invoice:${inv.id}` });
      done.push('pas hodinek připraven');
    } catch (e) { console.error('Pas: založení selhalo', e?.message); }
    if (b.inspection !== false && b.inspection !== 'false' && buyerEmail) {
      try {
        await createInspection(env, { watch_title: product.title, customer_name: inv.buyer_name, customer_email: buyerEmail, lang: 'cs', handover_date: day, product_id: product.id }, actor);
        done.push('garanční prohlídka naplánována');
      } catch (e) { console.error('Prohlídka: založení selhalo', e?.message); }
    }
  }
  await audit(env, actor, kind === 'zalohova' ? 'zaloha_vystavena' : 'faktura_vystavena', 'invoice', inv.id, { number: inv.number, total: inv.total, channel, product: product?.id || null });
  if (b.send && buyerEmail) { await sendInvoice(env, inv.id, actor, origin); done.push('odesláno e-mailem'); }
  return { ...inv, done };
}

/** Opravný doklad (dobropis) k faktuře. Bez částky = celá faktura; hodinky se mohou vrátit na sklad. */
export async function creditNote(env, id, b, actor) {
  const orig = await env.DB.prepare("SELECT * FROM invoices WHERE id = ? AND kind = 'faktura' AND cancelled_at IS NULL").bind(id).first();
  if (!orig) throw new HttpError('Fakturu nelze opravit (neexistuje, je stornovaná nebo to není faktura)', 404);
  const credited = (await env.DB.prepare("SELECT COALESCE(SUM(total),0) AS s FROM invoices WHERE related_invoice_id = ? AND kind = 'dobropis' AND cancelled_at IS NULL").bind(id).first()).s;
  const left = orig.total + credited; // dobropisy jsou záporné
  const amount = int(b.amount, { min: 1, max: 50000000, name: 'částku dobropisu' }) ?? left;
  if (amount > left) throw new HttpError(`Dobropis může být nejvýše ${formatCzk(left)}`);
  const reason = str(b.reason, { max: 300, required: true, name: 'důvod opravy' });
  const inv = await createInvoice(env, {
    kind: 'dobropis', channel: orig.channel, source: orig.source, order_id: orig.order_id, commission_id: orig.commission_id, mode: orig.mode,
    buyer_name: orig.buyer_name, buyer_company: orig.buyer_company, buyer_ico: orig.buyer_ico, buyer_dic: orig.buyer_dic,
    buyer_street: orig.buyer_street, buyer_city: orig.buyer_city, buyer_zip: orig.buyer_zip, buyer_email: orig.buyer_email,
    items: [{ text: `Oprava faktury ${orig.number}: ${reason}`, qty: 1, price: -amount }],
    payment_method: orig.payment_method, related_invoice_id: orig.id, product_id: orig.product_id, watch_model: orig.watch_model, serial_ref: orig.serial_ref,
    note: `Opravný doklad k faktuře ${orig.number}`, paid_at: b.refunded ? now() : null,
  });
  if (amount === left && orig.product_id && b.restock !== false && b.restock !== 'false') {
    await env.DB.prepare("UPDATE products SET status = 'available', sold_at = NULL, updated_at = ? WHERE id = ? AND status = 'sold'").bind(now(), orig.product_id).run();
  }
  await audit(env, actor, 'dobropis_vystaven', 'invoice', inv.id, { to: orig.number, amount });
  return inv;
}

/** Storno (chybně vystavený doklad). Hodinky prodané touto fakturou se vrátí na sklad. */
export async function cancelInvoice(env, id, actor) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv || inv.cancelled_at) return;
  if (inv.order_id && inv.kind === 'faktura') throw new HttpError('Fakturu z e-shopu opravte dobropisem');
  await env.DB.prepare('UPDATE invoices SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL').bind(now(), id).run();
  if (inv.kind === 'faktura' && inv.product_id) {
    await env.DB.prepare("UPDATE products SET status = 'available', sold_at = NULL, updated_at = ? WHERE id = ? AND status = 'sold'").bind(now(), inv.product_id).run();
  }
  await audit(env, actor, 'faktura_stornovana', 'invoice', id, { number: inv.number });
}

/** Pošle doklad zákazníkovi e-mailem (odkaz na fakturu, která jde uložit do PDF). */
export async function sendInvoice(env, id, actor, origin = SITE.origin) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv) throw new HttpError('Doklad nenalezen', 404);
  if (!inv.buyer_email) throw new HttpError('U dokladu chybí e-mail zákazníka');
  const label = INVOICE_KINDS[inv.kind] || 'Faktura';
  const due = inv.total - (inv.advance_deducted || 0);
  const res = await sendEmail(env, {
    to: inv.buyer_email, related: `invoice:${inv.id}`, replyTo: SITE.email,
    subject: `${label} ${inv.number} – ${OPERATOR.tradeName}`,
    body: `<p>Dobrý den,</p><p>zasíláme vám ${label.toLowerCase()} <strong>${inv.number}</strong>${inv.kind === 'dobropis' ? '' : ` na částku <strong>${formatCzk(due)}</strong>`}.</p>
<p><a href="${origin}/faktura/${inv.public_token}">Zobrazit a uložit doklad (PDF)</a></p>
${!inv.paid_at && inv.kind !== 'dobropis' && inv.payment_method === 'bank_transfer' ? '<p>Na dokladu najdete platební údaje i QR kód pro rychlou platbu.</p>' : ''}
<p>Děkujeme za nákup a projevenou důvěru.</p><p>S úctou<br>Dante Time – druhý život času</p>`,
  });
  if (res?.failed) throw new HttpError('E-mail se nepodařilo odeslat (viz E-maily)', 502);
  await env.DB.prepare('UPDATE invoices SET sent_at = ? WHERE id = ?').bind(now(), id).run();
  await audit(env, actor, 'faktura_odeslana', 'invoice', id, {});
}

/** Seznam dokladů s filtry: q (číslo, odběratel, model), rok, kanál, druh, stav. */
export async function listInvoices(env, f = {}) {
  const where = []; const binds = [];
  if (f.q) { where.push('(number LIKE ? OR buyer_name LIKE ? OR buyer_company LIKE ? OR watch_model LIKE ? OR serial_ref LIKE ?)'); const q = `%${String(f.q).slice(0, 60)}%`; binds.push(q, q, q, q, q); }
  if (/^\d{4}$/.test(f.year || '')) { where.push('substr(issued_at,1,4) = ?'); binds.push(f.year); }
  if (SALE_CHANNELS[f.channel]) { where.push('channel = ?'); binds.push(f.channel); }
  if (INVOICE_KINDS[f.kind]) { where.push('kind = ?'); binds.push(f.kind); }
  if (f.status === 'neuhrazeno') where.push("paid_at IS NULL AND cancelled_at IS NULL AND kind <> 'dobropis'");
  if (f.status === 'uhrazeno') where.push('paid_at IS NOT NULL AND cancelled_at IS NULL');
  if (f.status === 'storno') where.push('cancelled_at IS NOT NULL');
  const sql = `SELECT id, number, public_token, kind, channel, source, buyer_name, buyer_company, buyer_email, total, advance_deducted, issued_at, due_date, paid_at, cancelled_at, sent_at, mode, order_id, commission_id, related_invoice_id, product_id, watch_model, serial_ref, payment_method
    FROM invoices ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY issued_at DESC LIMIT 500`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const live = results.filter((r) => r.mode === 'live' && !r.cancelled_at);
  const revenue = live.filter((r) => r.kind !== 'zalohova').reduce((s, r) => s + r.total, 0);
  const unpaid = live.filter((r) => !r.paid_at && r.kind !== 'dobropis').reduce((s, r) => s + r.total - (r.advance_deducted || 0), 0);
  return { invoices: results, revenue, unpaid, kinds: INVOICE_KINDS, channels: SALE_CHANNELS, pay: INVOICE_PAY };
}
