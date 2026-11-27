// Dante Time OS – centrální fakturace: e-shop, ruční prodej (Vinted, Aukro, Instagram, osobně…), zálohy, dobropisy.
// Faktura s hodinkami ze skladu sama: označí kus jako prodaný, zapíše tržbu (ekonomika), založí pas hodinek
// a případně garanční prohlídku.
import { HttpError } from './http.js';
import { mode, randomId, randomToken, now, audit, getSettings } from './db.js';
import { str, email as vEmail, oneOf, int } from './validate.js';
import { sendEmail } from './email.js';
import { SITE, OPERATOR, bankDetails } from '../src/site.mjs';
import { METAL, formatCzk } from '../src/shop/format.mjs';
import { INVOICE_KINDS, SALE_CHANNELS, INVOICE_PAY, invoiceNumber, invoiceVs, pragueYear, invoiceTotals } from '../src/shop/invoice.mjs';
import { createFromProduct, addEvent } from './passport.js';
import { createManual as createInspection } from './warranty.js';
import { recordInitialPayment, paidSum, payState, dueOf, listPayments, STATE_LABEL } from './invoice-payments.js';

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
  await recordInitialPayment(env, inv, d.actor || 'system'); // uhrazeno už při vystavení → zápis platby
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
  // Záloha přijatá u zakázky bez zálohové faktury (např. hotově): odečte se ve faktuře, aby zákazník doplácel jen rozdíl
  let cashDeposit = 0;
  if (b.commission_id && kind === 'faktura' && (b.deduct_cash_deposit === true || b.deduct_cash_deposit === 'true' || b.deduct_cash_deposit === 'on')) {
    const k = await env.DB.prepare('SELECT deposit_czk FROM commissions WHERE id = ?').bind(str(b.commission_id, { max: 40 })).first();
    const { results: prev } = await env.DB.prepare("SELECT f.advance_deducted, COALESCE(a.total, 0) AS adv FROM invoices f LEFT JOIN invoices a ON a.id = f.related_invoice_id WHERE f.commission_id = ? AND f.kind = 'faktura' AND f.cancelled_at IS NULL").bind(b.commission_id).all();
    const used = prev.reduce((x, r) => x + Math.max(0, (r.advance_deducted || 0) - r.adv), 0);
    cashDeposit = Math.max(0, (Number(k?.deposit_czk) || 0) - used);
    if (!cashDeposit) throw new HttpError('Zakázka nemá žádnou neodečtenou zálohu bez dokladu');
  }
  if ((advance ? advance.total : 0) + cashDeposit > invoiceTotals(lines).total) throw new HttpError('Záloha je vyšší než faktura');
  // Ochrana proti omylem vystavené duplicitě (stejný odběratel a částka do 30 dnů, nebo druhá faktura k téže zakázce)
  if (!(b.allow_duplicate === true || b.allow_duplicate === 'true')) {
    const total = invoiceTotals(lines).total;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const dup = await env.DB.prepare("SELECT number, issued_at, total FROM invoices WHERE cancelled_at IS NULL AND kind = ? AND ((lower(buyer_name) = lower(?) AND total = ? AND issued_at > ?) OR (? IS NOT NULL AND commission_id = ? AND kind = 'faktura')) ORDER BY issued_at DESC LIMIT 1")
      .bind(kind, String(b.buyer_name || '').trim(), total, since, b.commission_id || null, b.commission_id || null).first();
    if (dup) throw new HttpError(`Podobný doklad už existuje: ${dup.number} ze dne ${new Date(dup.issued_at).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' })} na ${formatCzk(dup.total)}. Opravdu vystavit další?`, 409, { code: 'duplicate', number: dup.number });
  }
  // Ochrana unikátního kusu: hodinky se zaberou v jednom kroku DŘÍV, než vznikne doklad. Pokud je mezitím
  // rezervovala objednávka z e-shopu nebo je někdo prodal, prodej se nepovolí (nikdy dvojí prodej).
  let claimed = null;
  if (product) {
    const prev = product.status;
    const r = kind === 'faktura'
      ? await env.DB.prepare("UPDATE products SET status = 'sold', sold_at = COALESCE(sold_at, ?), reserved_until = NULL, reserved_order_id = NULL, updated_at = ? WHERE id = ? AND (status IN ('available','in_progress','draft') OR (status = 'reserved' AND reserved_order_id IS NULL))").bind(now(), now(), product.id).run()
      : await env.DB.prepare("UPDATE products SET status = 'reserved', reserved_order_id = NULL, reserved_until = NULL, updated_at = ? WHERE id = ? AND (status IN ('available','in_progress','draft') OR (status = 'reserved' AND reserved_order_id IS NULL))").bind(now(), product.id).run();
    if (!r?.meta?.changes) throw new HttpError(`${product.title} mezitím rezervovala objednávka z e-shopu nebo už jsou prodané`, 409);
    claimed = prev;
  }
  const paid = Boolean(b.paid);
  const dueDays = int(b.due_days, { max: 90 }) ?? 14;
  const taxable = ymd(b.taxable_date);
  const buyerEmail = b.buyer_email ? vEmail(b.buyer_email) : null;
  const release = async () => { if (product && claimed) await env.DB.prepare('UPDATE products SET status = ?, sold_at = NULL, updated_at = ? WHERE id = ?').bind(claimed, now(), product.id).run(); };
  let inv;
  try {
  inv = await createInvoice(env, {
    kind, channel, source: b.commission_id ? 'commission' : 'manual', commission_id: b.commission_id || null,
    buyer_name: str(b.buyer_name, { max: 200, required: true, name: 'odběratele' }), buyer_company: str(b.buyer_company, { max: 200 }),
    buyer_ico: str(b.buyer_ico, { max: 20 }), buyer_dic: str(b.buyer_dic, { max: 20 }), buyer_street: str(b.buyer_street, { max: 200 }),
    buyer_city: str(b.buyer_city, { max: 120 }), buyer_zip: str(b.buyer_zip, { max: 12 }), buyer_email: buyerEmail,
    items: lines, payment_method: oneOf(b.payment_method || 'bank_transfer', Object.keys(INVOICE_PAY), 'způsob úhrady'),
    taxable_date: taxable ? `${taxable}T12:00:00.000Z` : now(), paid_at: paid ? now() : null,
    due_date: paid ? null : new Date(Date.now() + dueDays * 86400000).toISOString(), note: str(b.note, { max: 500 }),
    advance_deducted: (advance ? advance.total : 0) + cashDeposit, related_invoice_id: advance?.id || null,
    product_id: product?.id || null, watch_model: str(b.watch_model, { max: 200 }) || product?.title || null,
    serial_ref: str(b.serial_ref, { max: 120 }) || product?.serial_ref || null, actor,
  });
  } catch (e) { await release(); throw e; }
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
  // Odeslání: ulozit = jen uložit | schvalit = čeká na schválení majitelem | odeslat = ihned (jen je-li povoleno v Nastavení)
  const settings = await getSettings(env);
  const autosend = settings.invoice_autosend === '1';
  let sendMode = ['ulozit', 'schvalit', 'odeslat'].includes(b.send_mode) ? b.send_mode : (b.send === true || b.send === 'on' ? 'odeslat' : (autosend ? 'odeslat' : 'ulozit'));
  if (sendMode === 'odeslat' && !autosend) { sendMode = 'schvalit'; done.push('automatické odesílání je vypnuté – faktura čeká na vaše schválení'); }
  if (sendMode !== 'ulozit' && !buyerEmail) { sendMode = 'ulozit'; done.push('bez e-mailu zákazníka – neodesláno'); }
  if (sendMode === 'odeslat') {
    try { await sendInvoice(env, inv.id, actor, origin); done.push('odesláno e-mailem'); } catch (e) { await requestSendApproval(env, inv); done.push(`odeslání selhalo (${e.message}) – čeká na schválení`); }
  } else if (sendMode === 'schvalit') { await requestSendApproval(env, inv); done.push('čeká na schválení odeslání'); }
  return { ...inv, done, sendMode };
}

/** Žádost o schválení odeslání faktury (zobrazí se ve Fakturách i v přehledu Systém → Ke schválení). */
export async function requestSendApproval(env, inv) {
  const exists = await env.DB.prepare("SELECT 1 FROM approvals WHERE kind = 'faktura_odeslani' AND payload = ? AND status = 'ceka'").bind(inv.id).first();
  if (exists) return;
  await env.DB.prepare("INSERT INTO approvals (id, role_id, kind, title, detail, payload, status, created_at) VALUES (?, 'finance', 'faktura_odeslani', ?, ?, ?, 'ceka', ?)")
    .bind(randomId(), `Odeslat ${(INVOICE_KINDS[inv.kind] || 'faktura').toLowerCase()} ${inv.number} zákazníkovi`, `${inv.buyer_name} · ${inv.buyer_email} · ${formatCzk(inv.total - (inv.advance_deducted || 0))}`, inv.id, now()).run();
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
    note: `Opravný doklad k faktuře ${orig.number}`, paid_at: b.refunded ? now() : null, actor,
  });
  if (amount === left && orig.product_id && b.restock !== false && b.restock !== 'false') {
    await env.DB.prepare("UPDATE products SET status = 'available', sold_at = NULL, updated_at = ? WHERE id = ? AND status = 'sold'").bind(now(), orig.product_id).run();
  }
  await audit(env, actor, 'dobropis_vystaven', 'invoice', inv.id, { to: orig.number, amount });
  return inv;
}

/** Storno (chybně vystavený doklad). Hodinky prodané touto fakturou se vrátí na sklad. */
export async function cancelInvoice(env, id, actor, reason) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv || inv.cancelled_at) return;
  if (inv.order_id && inv.kind === 'faktura') throw new HttpError('Fakturu z e-shopu opravte dobropisem');
  const why = str(reason, { max: 300, required: true, name: 'důvod storna' });
  const paid = await paidSum(env, id);
  if (paid) throw new HttpError(`Doklad má zaznamenané platby (${formatCzk(paid)}). Pokud jde o chybně zadanou platbu, nejdřív ji v detailu dokladu zrušte; pokud peníze opravdu přišly, vystavte dobropis.`);
  if (inv.kind === 'zalohova') {
    const used = await env.DB.prepare("SELECT number FROM invoices WHERE related_invoice_id = ? AND kind = 'faktura' AND cancelled_at IS NULL").bind(id).first();
    if (used) throw new HttpError(`Záloha je vyúčtovaná ve faktuře ${used.number} – nejdřív stornujte tu`);
  }
  await env.DB.prepare('UPDATE invoices SET cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ? AND cancelled_at IS NULL').bind(now(), actor, why, id).run();
  await env.DB.prepare("UPDATE approvals SET status = 'zamitnuto', decided_at = ?, decided_by = ? WHERE kind = 'faktura_odeslani' AND payload = ? AND status = 'ceka'").bind(now(), actor, id).run();
  if (inv.kind === 'faktura' && inv.product_id) {
    await env.DB.prepare("UPDATE products SET status = 'available', sold_at = NULL, updated_at = ? WHERE id = ? AND status = 'sold'").bind(now(), inv.product_id).run();
  }
  // Storno zálohy na hodinky: uvolní osobní rezervaci (ne rezervaci objednávky z e-shopu)
  if (inv.kind === 'zalohova' && inv.product_id) {
    await env.DB.prepare("UPDATE products SET status = 'available', updated_at = ? WHERE id = ? AND status = 'reserved' AND reserved_order_id IS NULL").bind(now(), inv.product_id).run();
  }
  await audit(env, actor, 'faktura_stornovana', 'invoice', id, { number: inv.number, reason: why });
}

/** Pošle doklad zákazníkovi e-mailem (odkaz na fakturu, která jde uložit do PDF). */
export async function sendInvoice(env, id, actor, origin = SITE.origin) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv) throw new HttpError('Doklad nenalezen', 404);
  if (!inv.buyer_email) throw new HttpError('U dokladu chybí e-mail zákazníka');
  if (inv.cancelled_at) throw new HttpError('Stornovaný doklad se neodesílá');
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
  // Odesláno = schváleno (žádost o schválení se uzavře)
  await env.DB.prepare("UPDATE approvals SET status = 'schvaleno', decided_at = ?, decided_by = ? WHERE kind = 'faktura_odeslani' AND payload = ? AND status = 'ceka'").bind(now(), actor, id).run();
  await audit(env, actor, 'faktura_odeslana', 'invoice', id, {});
}

/** Seznam dokladů s filtry: q (číslo, odběratel, model), rok, kanál, druh, stav. */
export async function listInvoices(env, f = {}) {
  const where = []; const binds = [];
  if (f.q) { where.push('(number LIKE ? OR buyer_name LIKE ? OR buyer_company LIKE ? OR watch_model LIKE ? OR serial_ref LIKE ?)'); const q = `%${String(f.q).slice(0, 60)}%`; binds.push(q, q, q, q, q); }
  if (/^\d{4}$/.test(f.year || '')) { where.push('substr(issued_at,1,4) = ?'); binds.push(f.year); }
  if (SALE_CHANNELS[f.channel]) { where.push('channel = ?'); binds.push(f.channel); }
  if (INVOICE_KINDS[f.kind]) { where.push('kind = ?'); binds.push(f.kind); }
  const PAID = '(SELECT COALESCE(SUM(p.amount_czk),0) FROM invoice_payments p WHERE p.invoice_id = invoices.id AND p.cancelled_at IS NULL)';
  if (f.status === 'neuhrazeno') where.push("paid_at IS NULL AND cancelled_at IS NULL AND kind <> 'dobropis'");
  if (f.status === 'castecne') where.push(`paid_at IS NULL AND cancelled_at IS NULL AND kind <> 'dobropis' AND ${PAID} > 0`);
  if (f.status === 'preplaceno') where.push(`cancelled_at IS NULL AND kind <> 'dobropis' AND ${PAID} > total - advance_deducted`);
  if (f.status === 'uhrazeno') where.push('paid_at IS NOT NULL AND cancelled_at IS NULL');
  if (f.status === 'storno') where.push('cancelled_at IS NOT NULL');
  if (f.status === 'po_splatnosti') { where.push("paid_at IS NULL AND cancelled_at IS NULL AND kind <> 'dobropis' AND due_date IS NOT NULL AND due_date < ?"); binds.push(now()); }
  if (f.status === 'ke_schvaleni') where.push("EXISTS (SELECT 1 FROM approvals a WHERE a.kind = 'faktura_odeslani' AND a.payload = invoices.id AND a.status = 'ceka')");
  if (f.commission_id) { where.push('commission_id = ?'); binds.push(String(f.commission_id).slice(0, 40)); }
  const sql = `SELECT id, number, public_token, kind, channel, source, buyer_name, buyer_company, buyer_email, total, advance_deducted, issued_at, due_date, paid_at, cancelled_at, sent_at, mode, order_id, commission_id, related_invoice_id, product_id, watch_model, serial_ref, payment_method,
    (SELECT 1 FROM approvals a WHERE a.kind = 'faktura_odeslani' AND a.payload = invoices.id AND a.status = 'ceka') AS awaiting_send,
    (SELECT number FROM commissions k WHERE k.id = invoices.commission_id) AS commission_number, ${PAID} AS paid_sum, cancel_reason
    FROM invoices ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY issued_at DESC LIMIT 500`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const live = results.filter((r) => r.mode === 'live' && !r.cancelled_at);
  const revenue = live.filter((r) => r.kind !== 'zalohova').reduce((s, r) => s + r.total, 0);
  const t = now();
  for (const r of results) {
    r.remaining = Math.max(0, dueOf(r) - (r.paid_sum || 0)); // zbývá uhradit
    r.overpaid = r.kind !== 'dobropis' ? Math.max(0, (r.paid_sum || 0) - dueOf(r)) : 0;
    r.state = payState(r, r.paid_sum || 0); r.state_label = STATE_LABEL[r.state];
    r.overdue = !r.paid_at && !r.cancelled_at && r.kind !== 'dobropis' && r.due_date && r.due_date < t ? 1 : 0;
  }
  const unpaid = live.filter((r) => !r.paid_at && r.kind !== 'dobropis').reduce((s, r) => s + r.remaining, 0);
  const overdue = live.filter((r) => r.overdue).reduce((s, r) => s + r.remaining, 0);
  return { invoices: results, revenue, unpaid, overdue, overpaid: live.reduce((s, r) => s + r.overpaid, 0), kinds: INVOICE_KINDS, channels: SALE_CHANNELS, pay: INVOICE_PAY };
}

/** Neuhrazené doklady po splatnosti (ostrý provoz) – pro denní souhrn majiteli. Zákazníkům se nic neposílá. */
export async function overdueInvoices(env, at = now()) {
  const { results } = await env.DB.prepare("SELECT i.id, i.number, i.kind, i.buyer_name, i.buyer_company, i.total, i.advance_deducted, i.due_date, i.sent_at, (SELECT number FROM commissions k WHERE k.id = i.commission_id) AS commission_number, (SELECT COALESCE(SUM(p.amount_czk),0) FROM invoice_payments p WHERE p.invoice_id = i.id AND p.cancelled_at IS NULL) AS paid_sum FROM invoices i WHERE i.cancelled_at IS NULL AND i.paid_at IS NULL AND i.kind <> 'dobropis' AND i.mode = 'live' AND i.due_date IS NOT NULL AND i.due_date < ? ORDER BY i.due_date").bind(at).all();
  return results.map((r) => ({ ...r, due: r.total - (r.advance_deducted || 0) - (r.paid_sum || 0), days: Math.floor((Date.parse(at) - Date.parse(r.due_date)) / 86400000) }));
}

/** Detail dokladu: položky, platby, navazující doklady a historie změn. */
export async function invoiceDetail(env, id) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv) throw new HttpError('Doklad nenalezen', 404);
  const payments = await listPayments(env, id);
  const paid = payments.filter((p) => !p.cancelled_at).reduce((a, p) => a + p.amount_czk, 0);
  const { results: related } = await env.DB.prepare('SELECT id, number, kind, total, issued_at, cancelled_at FROM invoices WHERE (related_invoice_id = ? OR id = ?) AND id <> ? ORDER BY issued_at').bind(id, inv.related_invoice_id || '', id).all();
  const { results: history } = await env.DB.prepare("SELECT at AS created_at, actor, action, details FROM audit_log WHERE entity = 'invoice' AND entity_id = ? ORDER BY id DESC LIMIT 50").bind(id).all();
  const commission = inv.commission_id ? await env.DB.prepare('SELECT id, number FROM commissions WHERE id = ?').bind(inv.commission_id).first() : null;
  const due = dueOf(inv);
  return {
    invoice: { ...inv, items: JSON.parse(inv.items || '[]') }, payments, paid, due,
    remaining: inv.kind === 'dobropis' ? Math.min(0, due - paid) : Math.max(0, due - paid),
    overpaid: inv.kind === 'dobropis' ? 0 : Math.max(0, paid - due),
    state: payState(inv, paid), state_label: STATE_LABEL[payState(inv, paid)], related, history, commission,
    kinds: INVOICE_KINDS, channels: SALE_CHANNELS, pay: INVOICE_PAY,
  };
}

/** Kopie dokladu jako nový koncept (bez čísla) – např. opakovaná zakázka nebo oprava po stornu. */
export async function copyToDraft(env, id, actor) {
  const inv = await env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!inv) throw new HttpError('Doklad nenalezen', 404);
  if (inv.kind === 'dobropis') throw new HttpError('Dobropis nelze kopírovat');
  const items = JSON.parse(inv.items || '[]').map((i) => ({ text: i.text, qty: i.qty || 1, price: i.price }));
  const fields = { kind: inv.kind, channel: inv.channel, buyer_name: inv.buyer_name, buyer_email: inv.buyer_email || '', buyer_street: inv.buyer_street || '', buyer_city: inv.buyer_city || '', buyer_zip: inv.buyer_zip || '', buyer_company: inv.buyer_company || '', buyer_ico: inv.buyer_ico || '', payment_method: inv.payment_method, note: inv.note || '' };
  const draftId = randomId();
  await env.DB.prepare('INSERT INTO invoice_drafts (id, commission_id, buyer_name, total_czk, data) VALUES (?, ?, ?, ?, ?)')
    .bind(draftId, inv.commission_id || null, inv.buyer_name, inv.total, JSON.stringify({ fields, items, flags: { paid: false, inspection: false } })).run();
  await audit(env, actor, 'faktura_zkopirovana', 'invoice', id, { number: inv.number, draft: draftId });
  return { draft_id: draftId };
}
