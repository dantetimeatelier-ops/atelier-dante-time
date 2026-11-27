// Dante Time OS – etapa E2: ekonomika (marže, zisk, přehledy, podklady pro účetní).
// Klasické výpočty bez AI. Tržby = vystavené faktury (ostrý režim), náklady = tabulka costs.
import { HttpError } from './http.js';
import { randomId, getSettings, audit } from './db.js';
import { str, int, num, oneOf } from './validate.js';

export const COST_CATS = { nakup: 'Nákup hodinek', dil: 'Díly', material: 'Materiál', prace: 'Práce', doprava: 'Doprava', poplatky: 'Poplatky', reklama: 'Reklama', provoz: 'Provoz', jine: 'Jiné' };
export const PART_KINDS = { strojek: 'Strojek', cifernik: 'Ciferník', rucicky: 'Ručičky', pouzdro: 'Pouzdro', sklo: 'Sklo', remen: 'Řemínek', naramek: 'Náramek', korunka: 'Korunka', krabicka: 'Krabička', jine: 'Jiné' };
const SOLD = "('paid','shipped','completed')";
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : new Date().toISOString().slice(0, 10));

const flag = (v) => (v === true || v === 1 || v === '1' || v === 'on' || v === 'true' ? 1 : 0);

/**
 * Hodnota jednoho nákladu rozdělená na tři části, aby se nic nezapočítalo dvakrát:
 *  paid = skutečně zaplacený výdaj, own = vlastní práce (hodiny × sazba nebo Kč), est = odhad (zatím nenastal).
 */
export const costValue = (c, rate = 0) => {
  const labor = Math.round((Number(c.hours) || 0) * (Number(rate) || 0));
  const amt = Number(c.amount_czk) || 0;
  if (c.estimate) return { paid: 0, own: 0, est: amt + labor };
  return { paid: c.own_work ? 0 : amt, own: labor + (c.own_work ? amt : 0), est: 0 };
};

export function costInput(b) {
  return {
    product_id: b.product_id ? str(b.product_id, { max: 40 }) : null,
    commission_id: b.commission_id ? str(b.commission_id, { max: 40 }) : null,
    category: oneOf(b.category, Object.keys(COST_CATS), 'druh nákladu'),
    description: str(b.description, { max: 300, required: true, name: 'popis' }),
    amount_czk: int(b.amount_czk ?? 0, { min: 0, max: 50000000, nullable: false, name: 'částka' }) ?? 0,
    hours: num(b.hours, { min: 0, max: 1000, name: 'hodiny' }),
    cost_date: ymd(b.cost_date),
    supplier: str(b.supplier, { max: 200 }) || null,
    document_ref: str(b.document_ref, { max: 200 }) || null,
    estimate: flag(b.estimate),
    own_work: flag(b.own_work),
    part_kind: b.part_kind ? oneOf(b.part_kind, Object.keys(PART_KINDS), 'druh dílu') : null,
  };
}
export async function addCost(env, b, actor) {
  const d = costInput(b);
  if (!d.amount_czk && !d.hours) throw new HttpError('Vyplňte částku nebo odpracované hodiny');
  if (d.product_id && d.commission_id) throw new HttpError('Náklad patří buď k hodinkám, nebo k zakázce');
  if (d.own_work && d.category !== 'prace') d.category = 'prace';
  const id = randomId(); const k = Object.keys(d);
  await env.DB.prepare(`INSERT INTO costs (id, created_by, ${k.join(', ')}) VALUES (?, ?, ${k.map(() => '?').join(', ')})`).bind(id, actor, ...k.map((x) => d[x])).run();
  await audit(env, actor, 'naklad_pridan', 'cost', id, { category: d.category, amount: d.amount_czk, product: d.product_id, commission: d.commission_id, estimate: d.estimate, own: d.own_work });
  return id;
}

/**
 * Úprava existujícího nákladu: přiřazení k zakázce (bez nového zadání), převod odhadu na skutečný náklad.
 * Náklad patří vždy nejvýš k jedné věci (hodinky NEBO zakázka), takže se nezapočítá dvakrát.
 */
export async function updateCost(env, id, b, actor) {
  const c = await env.DB.prepare('SELECT * FROM costs WHERE id = ?').bind(id).first();
  if (!c) throw new HttpError('Náklad nenalezen', 404);
  const d = {};
  // Přiřazení: náklad patří vždy nejvýš k jedné věci (hodinky NEBO zakázka) → nikdy se nezapočítá dvakrát.
  // Pošle-li se jen commission_id (rychlé přiřazení ze zakázky), náklad hodinek se nepřesune bez vědomí.
  const move = 'product_id' in b && 'commission_id' in b;
  if ('product_id' in b) {
    const pid = b.product_id ? str(b.product_id, { max: 40 }) : null;
    if (pid && !(await env.DB.prepare('SELECT 1 FROM products WHERE id = ?').bind(pid).first())) throw new HttpError('Hodinky nenalezeny', 404);
    d.product_id = pid;
  }
  if ('commission_id' in b) {
    const kid = b.commission_id ? str(b.commission_id, { max: 40 }) : null;
    if (kid) {
      if (!(await env.DB.prepare('SELECT 1 FROM commissions WHERE id = ?').bind(kid).first())) throw new HttpError('Zakázka nenalezena', 404);
      if (c.product_id && !move) throw new HttpError('Náklad už patří k hodinkám – nejdřív ho u hodinek odeberte');
      if (c.part_id && !c.amount_czk) throw new HttpError('Tento nákup je naskladněný jako díl – jeho cena se počítá při použití dílu');
    }
    d.commission_id = kid;
  }
  if (d.product_id && d.commission_id) throw new HttpError('Náklad patří buď k hodinkám, nebo k zakázce');
  if ('description' in b) d.description = str(b.description, { max: 300, required: true, name: 'popis' });
  if ('category' in b) d.category = oneOf(b.category, Object.keys(COST_CATS), 'druh nákladu');
  if ('part_kind' in b) d.part_kind = b.part_kind ? oneOf(b.part_kind, Object.keys(PART_KINDS), 'druh dílu') : null;
  if ('supplier' in b) d.supplier = str(b.supplier, { max: 200 }) || null;
  if ('document_ref' in b) d.document_ref = str(b.document_ref, { max: 200 }) || null;
  if ('note' in b) d.note = str(b.note, { max: 2000 }) || null;
  if ('estimate' in b) d.estimate = flag(b.estimate);
  if ('amount_czk' in b && b.amount_czk !== '' && b.amount_czk != null) d.amount_czk = int(b.amount_czk, { min: 0, max: 50000000, nullable: false, name: 'částka' });
  if ('cost_date' in b && b.cost_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.cost_date))) throw new HttpError('Neplatné datum');
    d.cost_date = b.cost_date;
  }
  // Nákup naskladněný jako díl: cena se počítá u dílu (při nákupu / použití) – částka u nákladu by ji započítala podruhé
  if (c.part_id && d.amount_czk) throw new HttpError('Tento nákup je naskladněný jako díl – cenu upravte u dílu ve Skladu dílů');
  const amount = d.amount_czk ?? c.amount_czk;
  const own = c.own_work; const hours = c.hours;
  if (!amount && !hours && !own && !c.part_id && ('amount_czk' in b)) throw new HttpError('Vyplňte částku');
  const k = Object.keys(d).filter((x) => d[x] !== c[x]);
  if (!k.length) return { changed: [] };
  await env.DB.prepare(`UPDATE costs SET ${k.map((x) => `${x} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...k.map((x) => d[x]), new Date().toISOString(), id).run();
  // Do historie: co se změnilo (z → na)
  await audit(env, actor, 'naklad_upraven', 'cost', id, Object.fromEntries(k.map((x) => [x, { z: c[x] ?? null, na: d[x] ?? null }])));
  return { changed: k };
}

/** Detail výdaje: údaje, přiřazení, všechny přílohy a historie změn. */
export async function getCost(env, id) {
  const c = await env.DB.prepare(`SELECT c.*, p.title AS product_title, k.number AS commission_number, COALESCE(cu.name, k.contact_name) AS commission_customer,
      x.title AS part_title, x.qty AS part_qty, x.unit_cost_czk AS part_unit_cost
    FROM costs c LEFT JOIN products p ON p.id = c.product_id LEFT JOIN commissions k ON k.id = c.commission_id
    LEFT JOIN customers cu ON cu.id = k.customer_id LEFT JOIN parts x ON x.id = c.part_id WHERE c.id = ?`).bind(id).first();
  if (!c) throw new HttpError('Náklad nenalezen', 404);
  const { results: docs } = await env.DB.prepare('SELECT id, kind, filename, mime, size, note, created_at, created_by FROM documents WHERE cost_id = ? ORDER BY created_at').bind(id).all();
  const { results: history } = await env.DB.prepare("SELECT at, actor, action, details FROM audit_log WHERE entity = 'cost' AND entity_id = ? ORDER BY id DESC LIMIT 50").bind(id).all().catch(() => ({ results: [] }));
  return { cost: c, docs, history, categories: COST_CATS, partKinds: PART_KINDS };
}

/**
 * Smazání výdaje. Přílohy se buď odpojí (zůstanou mezi doklady bez nákladu), nebo smažou (withDocs).
 * Nákup naskladněný jako díl: díl zůstává ve skladu (má vlastní cenu).
 */
export async function deleteCost(env, id, actor, { withDocs = false, removeDoc } = {}) {
  const c = await env.DB.prepare('SELECT id, description, amount_czk FROM costs WHERE id = ?').bind(id).first();
  if (!c) throw new HttpError('Náklad nenalezen', 404);
  const { results: docs } = await env.DB.prepare('SELECT id FROM documents WHERE cost_id = ?').bind(id).all();
  await env.DB.prepare('DELETE FROM costs WHERE id = ?').bind(id).run();
  if (withDocs && removeDoc) for (const x of docs) await removeDoc(env, x.id, actor);
  else await env.DB.prepare('UPDATE documents SET cost_id = NULL WHERE cost_id = ?').bind(id).run();
  await audit(env, actor, 'naklad_smazan', 'cost', id, { description: c.description, amount: c.amount_czk, docs: docs.length, docsDeleted: !!withDocs });
  return { docs: docs.length };
}

/**
 * Použití dílu ze skladu v zakázce. Při použití části zásoby se položka rozdělí (zbytek zůstane skladem),
 * takže celková hodnota nákupu se nemění a nic se nezapočítá dvakrát.
 */
export async function usePartInCommission(env, commissionId, partId, qty, actor) {
  if (!(await env.DB.prepare('SELECT 1 FROM commissions WHERE id = ?').bind(commissionId).first())) throw new HttpError('Zakázka nenalezena', 404);
  const p = await env.DB.prepare('SELECT * FROM parts WHERE id = ?').bind(partId).first();
  if (!p) throw new HttpError('Díl nenalezen', 404);
  if (p.status !== 'skladem' || p.product_id || p.commission_id) throw new HttpError(`${p.title} není skladem`);
  const n = int(qty == null || qty === '' ? 1 : qty, { min: 1, max: 10000, nullable: false, name: 'počet kusů' });
  if (n > (p.qty || 0)) throw new HttpError(`Skladem je jen ${p.qty} ks`);
  const t = new Date().toISOString();
  let id = partId;
  if (n === p.qty) {
    await env.DB.prepare("UPDATE parts SET status = 'pouzito', commission_id = ?, updated_at = ? WHERE id = ? AND status = 'skladem'").bind(commissionId, t, partId).run();
  } else {
    id = randomId();
    await env.DB.prepare('UPDATE parts SET qty = qty - ?, updated_at = ? WHERE id = ?').bind(n, t, partId).run();
    await env.DB.prepare(`INSERT INTO parts (id, kind, title, brand, caliber, original, condition, qty, unit_cost_czk, purchase_date, supplier, status, commission_id, note)
      SELECT ?, kind, title, brand, caliber, original, condition, ?, unit_cost_czk, purchase_date, supplier, 'pouzito', ?, note FROM parts WHERE id = ?`).bind(id, n, commissionId, partId).run();
  }
  await audit(env, actor, 'dil_pouzit_v_zakazce', 'part', id, { commission: commissionId, qty: n, from: partId });
  return id;
}

/** Vrácení dílu ze zakázky zpět na sklad. */
export async function returnPartFromCommission(env, commissionId, partId, actor) {
  const r = await env.DB.prepare("UPDATE parts SET status = 'skladem', commission_id = NULL, updated_at = ? WHERE id = ? AND commission_id = ?").bind(new Date().toISOString(), partId, commissionId).run();
  if (r?.meta && !r.meta.changes) throw new HttpError('Díl u této zakázky není', 404);
  await audit(env, actor, 'dil_vracen_na_sklad', 'part', partId, { commission: commissionId });
}

/** Prodej hodinek ruční fakturou: tržba = položka hodinek (bez dopravy), snížená o dobropisy. */
async function invoiceSale(env, productId) {
  const inv = await env.DB.prepare("SELECT id, number, items, issued_at FROM invoices WHERE product_id = ? AND kind = 'faktura' AND cancelled_at IS NULL AND order_id IS NULL ORDER BY issued_at DESC LIMIT 1").bind(productId).first();
  if (!inv) return null;
  const first = JSON.parse(inv.items || '[]')[0];
  const credit = (await env.DB.prepare("SELECT COALESCE(SUM(total),0) AS s FROM invoices WHERE related_invoice_id = ? AND kind = 'dobropis' AND cancelled_at IS NULL").bind(inv.id).first()).s;
  const price = (first ? (first.qty || 1) * first.price : 0) + credit;
  return { price_czk: price, number: inv.number, created_at: inv.issued_at };
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

/** Ekonomika jednoho kusu: zaplacené náklady podle druhu, díly ze skladu, vlastní práce zvlášť, tržba, marže. */
export async function productEconomics(env, productId) {
  const s = await getSettings(env);
  const rate = Number(s.labor_rate_czk) || 0;
  const { results: costs } = await env.DB.prepare("SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS docs FROM costs c WHERE c.product_id = ? AND c.status = 'potvrzeno' ORDER BY c.cost_date, c.created_at").bind(productId).all();
  const { results: parts } = await env.DB.prepare("SELECT * FROM parts WHERE product_id = ? AND status IN ('pouzito','prodano')").bind(productId).all();
  // Tržba z e-shopu = cena hodinek + podíl dopravy a dobírky, které zaplatil zákazník (náklad dopravce je v nákladech „Doprava“)
  const sale = (await env.DB.prepare(`SELECT i.price_czk + CASE WHEN o.items_total > 0 THEN CAST(ROUND((COALESCE(o.shipping_price, 0) + COALESCE(o.cod_fee, 0)) * i.price_czk * 1.0 / o.items_total) AS INTEGER) ELSE 0 END AS price_czk, o.number, o.created_at FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND o.status IN ${SOLD} ORDER BY o.created_at DESC LIMIT 1`).bind(productId).first())
    || (await invoiceSale(env, productId))
    || (await env.DB.prepare("SELECT total_czk AS price_czk, COALESCE(number, 'prodej mimo e-shop') AS number, issued_on AS created_at FROM sales WHERE product_id = ? AND status = 'potvrzeno' ORDER BY issued_on DESC LIMIT 1").bind(productId).first());
  const p = await env.DB.prepare('SELECT price_czk, status FROM products WHERE id = ?').bind(productId).first();
  const byCat = {};
  let hours = 0; let own = 0; let est = 0;
  for (const c of costs) {
    const v = costValue(c, rate);
    if (v.paid) byCat[c.category] = (byCat[c.category] || 0) + v.paid;
    own += v.own; est += v.est;
    if (!c.estimate) hours += c.hours || 0;
  }
  const partsCost = parts.reduce((a, x) => a + (x.unit_cost_czk || 0) * (x.qty || 1), 0);
  const total = Object.values(byCat).reduce((a, b) => a + b, 0) + partsCost; // jen skutečně zaplacené
  const revenue = sale ? sale.price_czk : null;
  const expected = revenue ?? p?.price_czk ?? null;
  const margin = expected != null ? expected - total : null;
  return {
    costs, parts, byCat, hours, rate, laborCost: own, ownWork: own, estimate: est, partsCost, total,
    sold: !!sale, saleOrder: sale?.number || null, revenue, expected,
    margin, marginPct: expected ? pct(margin, expected) : null,
    marginAfterWork: margin != null ? margin - own : null,
    hasPurchase: (byCat.nakup || 0) > 0,
  };
}

/** Které faktury se počítají: v ostrém provozu jen ostré, v testu všechny (aby šlo vše vyzkoušet). */
const invMode = (env) => ((env.SHOP_MODE || 'preview') === 'live' ? " AND mode = 'live'" : '');

/**
 * Ekonomika zakázky: náklady (zaplacené / vlastní práce / odhad), cena, faktury, zálohy, přijato, zbývá, zisk a marže.
 * Zálohová faktura není tržba (tržbou je až vyúčtovací faktura); přijaté peníze se počítají jen jednou:
 * záloha při úhradě zálohy, faktura jen částkou po odečtení zálohy.
 */
export async function commissionEconomics(env, commissionId) {
  const k = await env.DB.prepare('SELECT * FROM commissions WHERE id = ?').bind(commissionId).first();
  if (!k) throw new HttpError('Zakázka nenalezena', 404);
  const s = await getSettings(env);
  const rate = Number(s.labor_rate_czk) || 0;
  const { results: costs } = await env.DB.prepare("SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS docs FROM costs c WHERE c.commission_id = ? AND c.status = 'potvrzeno' ORDER BY c.estimate DESC, c.cost_date, c.created_at").bind(commissionId).all();
  const byCat = {};
  let paid = 0; let own = 0; let est = 0;
  for (const c of costs) {
    const v = costValue(c, rate);
    Object.assign(c, v);
    paid += v.paid; own += v.own; est += v.est;
    if (v.paid) byCat[c.category] = (byCat[c.category] || 0) + v.paid;
  }
  // Díly ze skladu použité v zakázce (cena se počítá při použití, nákup na sklad je v měsíčních nákladech)
  const { results: parts } = await env.DB.prepare("SELECT * FROM parts WHERE commission_id = ? AND status IN ('pouzito','prodano') ORDER BY updated_at").bind(commissionId).all();
  const partsCost = parts.reduce((a, x) => a + (x.unit_cost_czk || 0) * (x.qty || 1), 0);
  paid += partsCost;
  const { results: invoices } = await env.DB.prepare(`SELECT id, number, public_token, kind, total, advance_deducted, related_invoice_id, issued_at, due_date, paid_at, sent_at, cancelled_at, buyer_email, mode,
      (SELECT COALESCE(SUM(p.amount_czk),0) FROM invoice_payments p WHERE p.invoice_id = invoices.id AND p.cancelled_at IS NULL) AS paid_sum,
      (SELECT 1 FROM approvals a WHERE a.kind = 'faktura_odeslani' AND a.payload = invoices.id AND a.status = 'ceka') AS awaiting_send
    FROM invoices WHERE commission_id = ?${invMode(env)} ORDER BY issued_at`).bind(commissionId).all();
  const live = invoices.filter((i) => !i.cancelled_at);
  const finals = live.filter((i) => i.kind !== 'zalohova');
  const advances = live.filter((i) => i.kind === 'zalohova');
  const invoiced = finals.reduce((a, i) => a + i.total, 0);
  // Přijato = skutečné platby (i částečné); zálohová faktura se počítá jen do výše uhrazené částky
  const advancesPaid = advances.reduce((a, i) => a + (i.paid_sum || 0), 0);
  const paidInvoices = finals.reduce((a, i) => a + (i.paid_sum || 0), 0);
  const depositCash = Number(k.deposit_czk) || 0; // záloha přijatá bez zálohové faktury (např. hotově)
  // Část hotovostní zálohy už odečtená ve fakturách (odečet nad rámec uhrazené zálohové faktury)
  const advTotal = Object.fromEntries(advances.map((a) => [a.id, a.total]));
  const cashUsed = finals.filter((i) => i.kind === 'faktura').reduce((a, i) => a + Math.max(0, (i.advance_deducted || 0) - (advTotal[i.related_invoice_id] || 0)), 0);
  const received = advancesPaid + paidInvoices + depositCash;
  const hasFinal = finals.some((i) => i.kind === 'faktura');
  const price = hasFinal ? invoiced : (k.final_price_czk ?? k.estimate_czk ?? null);
  const priceSource = hasFinal ? 'faktura' : k.final_price_czk != null ? 'konecna' : k.estimate_czk != null ? 'orientacni' : null;
  const profit = price != null ? price - paid : null;
  const today = new Date().toISOString();
  return {
    commission: { id: k.id, number: k.number, status: k.status },
    costs, byCat, parts, partsCost, paid, ownWork: own, estimate: est, rate,
    price, priceSource, invoiced, invoices, hasFinal,
    advancesPaid, advancesOpen: advances.filter((i) => !i.paid_at).reduce((a, i) => a + Math.max(0, i.total - (i.paid_sum || 0)), 0),
    depositCash, depositCashLeft: Math.max(0, depositCash - cashUsed), paidInvoices, received,
    remaining: price != null ? price - received : null,
    overdue: live.filter((i) => !i.paid_at && i.kind !== 'dobropis' && i.due_date && i.due_date < today).length,
    profit, marginPct: price ? pct(profit, price) : null,
    profitAfterWork: profit != null ? profit - own : null,
    expectedProfit: price != null ? price - paid - est : null,
  };
}

/**
 * Přehled roku po měsících.
 *  Fakturováno (tržby) = vystavené faktury a dobropisy (ne zálohové) podle data vystavení + importované prodeje.
 *  Přijato = skutečně přijaté peníze podle data úhrady: zálohové faktury, faktury po odečtení záloh (jen jednou),
 *            zálohy bez dokladu u zakázek, importované prodeje (k datu prodeje).
 *  Náklady = skutečně zaplacené výdaje (bez odhadů a bez vlastní práce) + nákupy dílů na sklad.
 *  Vlastní práce se vykazuje zvlášť (není výdaj), zisk po ocenění práce také zvlášť.
 */
export async function overview(env, year) {
  const y = /^\d{4}$/.test(String(year)) ? String(year) : String(new Date().getUTCFullYear());
  const s = await getSettings(env);
  const goal = Number(s.revenue_goal_czk) || 2000000;
  const rate = Number(s.labor_rate_czk) || 0;
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${y}-${String(i + 1).padStart(2, '0')}`, revenue: 0, received: 0, costs: 0, purchases: 0, overhead: 0, ownWork: 0 }));
  const idx = (d) => Number(String(d).slice(5, 7)) - 1;
  const { results: inv } = await env.DB.prepare("SELECT issued_at, total FROM invoices WHERE cancelled_at IS NULL AND kind <> 'zalohova' AND mode = 'live' AND substr(issued_at,1,4) = ?").bind(y).all();
  for (const r of inv) months[idx(r.issued_at)].revenue += r.total;
  // Prodeje mimo systém a importované faktury (bez duplicit s fakturami vystavenými v systému)
  const { results: sl } = await env.DB.prepare("SELECT issued_on, total_czk FROM sales WHERE status = 'potvrzeno' AND substr(issued_on,1,4) = ? AND (number IS NULL OR number NOT IN (SELECT number FROM invoices WHERE mode = 'live'))").bind(y).all();
  for (const r of sl) { months[idx(r.issued_on)].revenue += r.total_czk; months[idx(r.issued_on)].received += r.total_czk; }
  // Přijaté platby (podle data úhrady)
  // Přijaté platby podle data úhrady (evidence plateb: i částečné platby, doplatky a vrácení)
  const { results: pay } = await env.DB.prepare("SELECT p.paid_on, p.amount_czk FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.cancelled_at IS NULL AND i.cancelled_at IS NULL AND i.mode = 'live' AND substr(p.paid_on,1,4) = ?").bind(y).all();
  for (const r of pay) months[idx(r.paid_on)].received += r.amount_czk;
  const { results: dep } = await env.DB.prepare("SELECT deposit_czk, COALESCE(deposit_received_on, received_at, substr(created_at,1,10)) AS d FROM commissions WHERE deposit_czk > 0 AND status <> 'zruseno'").all();
  for (const r of dep) if (String(r.d).slice(0, 4) === y) months[idx(r.d)].received += r.deposit_czk;
  const { results: cs } = await env.DB.prepare("SELECT cost_date, category, amount_czk, hours, product_id, commission_id, estimate, own_work FROM costs WHERE status = 'potvrzeno' AND substr(cost_date,1,4) = ?").bind(y).all();
  for (const c of cs) {
    const m = months[idx(c.cost_date)];
    const v = costValue(c, rate);
    m.costs += v.paid; m.ownWork += v.own;
    if (c.category === 'nakup') m.purchases += v.paid;
    if (!c.product_id && !c.commission_id) m.overhead += v.paid;
  }
  const { results: pc } = await env.DB.prepare("SELECT purchase_date, unit_cost_czk, qty FROM parts WHERE substr(COALESCE(purchase_date,''),1,4) = ?").bind(y).all();
  for (const x of pc) months[idx(x.purchase_date)].costs += (x.unit_cost_czk || 0) * (x.qty || 1);
  for (const m of months) m.profit = m.revenue - m.costs;
  const sum = (k) => months.reduce((a, m) => a + m[k], 0);
  // Kusy: marže prodaných a hodnota skladu (náklady neprodaných)
  const { results: prods } = await env.DB.prepare("SELECT id, title, status, price_czk FROM products WHERE status IN ('available','reserved','sold','in_progress','draft')").all();
  const pieces = [];
  let stockValue = 0;
  for (const p of prods) {
    const e = await productEconomics(env, p.id);
    if (!e.total && !e.sold) continue;
    if (!e.sold) stockValue += e.total;
    pieces.push({ kind: 'hodinky', id: p.id, title: p.title, status: p.status, cost: e.total, price: e.expected, margin: e.margin, marginPct: e.marginPct, ownWork: e.ownWork, sold: e.sold, hasPurchase: e.hasPurchase });
  }
  // Zakázky: ziskovost a rozpracovanost (náklady nedokončených zakázek)
  const { results: ks } = await env.DB.prepare("SELECT k.id, k.number, k.status, COALESCE(c.name, k.contact_name) AS name FROM commissions k LEFT JOIN customers c ON c.id = k.customer_id WHERE k.status <> 'zruseno' AND (EXISTS (SELECT 1 FROM costs x WHERE x.commission_id = k.id) OR EXISTS (SELECT 1 FROM invoices i WHERE i.commission_id = k.id AND i.cancelled_at IS NULL)) ORDER BY k.created_at DESC LIMIT 200").all();
  const jobs = [];
  let wipValue = 0;
  for (const k of ks) {
    const e = await commissionEconomics(env, k.id);
    const done = k.status === 'predano' || e.hasFinal;
    if (!done) wipValue += e.paid;
    jobs.push({ kind: 'zakazka', id: k.id, title: `${k.number}${k.name ? ` · ${k.name}` : ''}`, status: k.status, cost: e.paid, price: e.price, margin: e.profit, marginPct: e.marginPct, ownWork: e.ownWork, estimate: e.estimate, sold: done, received: e.received, remaining: e.remaining });
  }
  pieces.sort((a, b) => (b.margin ?? -1e12) - (a.margin ?? -1e12));
  jobs.sort((a, b) => (b.margin ?? -1e12) - (a.margin ?? -1e12));
  // Pohledávky: neuhrazené doklady (ostré), z toho po splatnosti
  const nowIso = new Date().toISOString();
  const open = (await env.DB.prepare("SELECT COALESCE(SUM(total - advance_deducted - (SELECT COALESCE(SUM(p.amount_czk),0) FROM invoice_payments p WHERE p.invoice_id = invoices.id AND p.cancelled_at IS NULL)),0) AS s, COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < ? THEN total - advance_deducted - (SELECT COALESCE(SUM(p.amount_czk),0) FROM invoice_payments p WHERE p.invoice_id = invoices.id AND p.cancelled_at IS NULL) ELSE 0 END),0) AS o, COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END),0) AS n FROM invoices WHERE cancelled_at IS NULL AND mode = 'live' AND paid_at IS NULL AND kind <> 'dobropis'").bind(nowIso, nowIso).first());
  const revenue = sum('revenue');
  const costs = sum('costs');
  const ownWork = sum('ownWork');
  return {
    year: y, goal, goalPct: Math.round((revenue / goal) * 1000) / 10, months, revenue, received: sum('received'), costs, purchases: sum('purchases'), overhead: sum('overhead'),
    ownWork, profit: revenue - costs, profitAfterWork: revenue - costs - ownWork, cashProfit: sum('received') - costs,
    unpaid: open.s, overdue: open.o, overdueCount: open.n, stockValue, wipValue, pieces, jobs, rate,
  };
}

/** CSV pro účetní: náklady a vystavené faktury za období (středník, UTF-8 s BOM pro Excel). */
export async function exportCsv(env, kind, from, to) {
  const f = ymd(from); const t = ymd(to);
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  let rows;
  if (kind === 'naklady') {
    const { results } = await env.DB.prepare("SELECT c.cost_date, c.category, c.description, c.amount_czk, c.hours, c.own_work, c.supplier, c.document_ref, p.title AS hodinky, k.number AS zakazka, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS prilohy FROM costs c LEFT JOIN products p ON p.id = c.product_id LEFT JOIN commissions k ON k.id = c.commission_id WHERE c.status = 'potvrzeno' AND c.estimate = 0 AND c.cost_date BETWEEN ? AND ? ORDER BY c.cost_date").bind(f, t).all();
    // Vlastní práce není zaplacený výdaj – v podkladech pro účetní je označená a bez částky výdaje
    rows = [['Datum', 'Druh', 'Popis', 'Částka Kč', 'Hodiny', 'Dodavatel', 'Doklad', 'Hodinky', 'Zakázka', 'Doklad nahrán'], ...results.map((r) => [r.cost_date, r.own_work || (r.hours && !r.amount_czk) ? 'Vlastní práce (není výdaj)' : COST_CATS[r.category], r.description, r.own_work ? 0 : r.amount_czk, r.hours ?? '', r.supplier, r.document_ref, r.hodinky, r.zakazka, r.prilohy ? 'ano' : 'ne'])];
  } else {
    const { results } = await env.DB.prepare("SELECT number, kind, channel, substr(issued_at,1,10) AS d, buyer_name, total, pay_currency AS currency, payment_method, paid_at, cancelled_at FROM invoices WHERE mode = 'live' AND substr(issued_at,1,10) BETWEEN ? AND ? ORDER BY issued_at").bind(f, t).all();
    const KIND = { faktura: 'faktura', zalohova: 'zálohová faktura (není tržba)', dobropis: 'opravný doklad' };
    rows = [['Číslo', 'Druh', 'Datum vystavení', 'Odběratel', 'Celkem Kč', 'Měna platby', 'Způsob platby', 'Uhrazeno', 'Stornováno', 'Zdroj'], ...results.map((r) => [r.number, KIND[r.kind] || r.kind, r.d, r.buyer_name, r.total, r.currency || 'CZK', r.payment_method, r.paid_at ? r.paid_at.slice(0, 10) : '', r.cancelled_at ? r.cancelled_at.slice(0, 10) : '', `Dante Time OS – ${r.channel || 'eshop'}`])];
    const { results: imp } = await env.DB.prepare("SELECT number, issued_on, buyer_name, total_czk, currency, payment_method FROM sales WHERE status = 'potvrzeno' AND issued_on BETWEEN ? AND ? AND (number IS NULL OR number NOT IN (SELECT number FROM invoices WHERE mode = 'live')) ORDER BY issued_on").bind(f, t).all();
    rows.push(...imp.map((r) => [r.number || '', 'faktura (import)', r.issued_on, r.buyer_name, r.total_czk, r.currency, r.payment_method || '', '', '', 'import / mimo e-shop']));
  }
  return `﻿${rows.map((r) => r.map(esc).join(';')).join('\r\n')}\r\n`;
}

export function partInput(b) {
  return {
    kind: oneOf(b.kind, Object.keys(PART_KINDS), 'druh dílu'),
    title: str(b.title, { max: 200, required: true, name: 'název dílu' }),
    brand: str(b.brand, { max: 100 }) || null, caliber: str(b.caliber, { max: 100 }) || null,
    original: b.original ? 1 : 0, condition: str(b.condition, { max: 200 }) || null,
    qty: int(b.qty, { min: 0, max: 10000, nullable: false, name: 'počet' }) ?? 1,
    unit_cost_czk: int(b.unit_cost_czk, { min: 0, max: 10000000, name: 'cena za kus' }),
    purchase_date: b.purchase_date ? ymd(b.purchase_date) : null, supplier: str(b.supplier, { max: 200 }) || null,
    status: oneOf(b.status || 'skladem', ['skladem', 'pouzito', 'prodano', 'vyrazeno'], 'stav'),
    product_id: b.product_id ? str(b.product_id, { max: 40 }) : null, note: str(b.note, { max: 1000 }) || null,
  };
}
