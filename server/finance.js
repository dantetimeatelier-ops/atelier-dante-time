// Dante Time OS – etapa E2: ekonomika (marže, zisk, přehledy, podklady pro účetní).
// Klasické výpočty bez AI. Tržby = vystavené faktury (ostrý režim), náklady = tabulka costs.
import { HttpError } from './http.js';
import { randomId, getSettings, audit } from './db.js';
import { str, int, num, oneOf } from './validate.js';

export const COST_CATS = { nakup: 'Nákup hodinek', dil: 'Díly', material: 'Materiál', prace: 'Práce', doprava: 'Doprava', poplatky: 'Poplatky', reklama: 'Reklama', provoz: 'Provoz', jine: 'Jiné' };
export const PART_KINDS = { strojek: 'Strojek', cifernik: 'Ciferník', rucicky: 'Ručičky', pouzdro: 'Pouzdro', sklo: 'Sklo', remen: 'Řemínek', naramek: 'Náramek', korunka: 'Korunka', krabicka: 'Krabička', jine: 'Jiné' };
const SOLD = "('paid','shipped','completed')";
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : new Date().toISOString().slice(0, 10));

export function costInput(b) {
  return {
    product_id: b.product_id ? str(b.product_id, { max: 40 }) : null,
    commission_id: b.commission_id ? str(b.commission_id, { max: 40 }) : null,
    category: oneOf(b.category, Object.keys(COST_CATS), 'druh nákladu'),
    description: str(b.description, { max: 300, required: true, name: 'popis' }),
    amount_czk: int(b.amount_czk, { min: 0, max: 50000000, nullable: false, name: 'částka' }) ?? 0,
    hours: num(b.hours, { min: 0, max: 1000, name: 'hodiny' }),
    cost_date: ymd(b.cost_date),
    supplier: str(b.supplier, { max: 200 }) || null,
    document_ref: str(b.document_ref, { max: 200 }) || null,
  };
}
export async function addCost(env, b, actor) {
  const d = costInput(b);
  if (!d.amount_czk && !d.hours) throw new HttpError('Vyplňte částku nebo odpracované hodiny');
  const id = randomId(); const k = Object.keys(d);
  await env.DB.prepare(`INSERT INTO costs (id, created_by, ${k.join(', ')}) VALUES (?, ?, ${k.map(() => '?').join(', ')})`).bind(id, actor, ...k.map((x) => d[x])).run();
  await audit(env, actor, 'naklad_pridan', 'cost', id, { category: d.category, amount: d.amount_czk, product: d.product_id });
  return id;
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

/** Ekonomika jednoho kusu: náklady podle druhu, díly ze skladu, práce, tržba, marže. */
export async function productEconomics(env, productId) {
  const s = await getSettings(env);
  const rate = Number(s.labor_rate_czk) || 0;
  const { results: costs } = await env.DB.prepare("SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS docs FROM costs c WHERE c.product_id = ? AND c.status = 'potvrzeno' ORDER BY c.cost_date, c.created_at").bind(productId).all();
  const { results: parts } = await env.DB.prepare("SELECT * FROM parts WHERE product_id = ? AND status IN ('pouzito','prodano')").bind(productId).all();
  const sale = (await env.DB.prepare(`SELECT i.price_czk, o.number, o.created_at FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND o.status IN ${SOLD} ORDER BY o.created_at DESC LIMIT 1`).bind(productId).first())
    || (await invoiceSale(env, productId))
    || (await env.DB.prepare("SELECT total_czk AS price_czk, COALESCE(number, 'prodej mimo e-shop') AS number, issued_on AS created_at FROM sales WHERE product_id = ? AND status = 'potvrzeno' ORDER BY issued_on DESC LIMIT 1").bind(productId).first());
  const p = await env.DB.prepare('SELECT price_czk, status FROM products WHERE id = ?').bind(productId).first();
  const byCat = {};
  let hours = 0;
  for (const c of costs) { byCat[c.category] = (byCat[c.category] || 0) + c.amount_czk; hours += c.hours || 0; }
  const partsCost = parts.reduce((a, x) => a + (x.unit_cost_czk || 0) * (x.qty || 1), 0);
  const laborCost = Math.round(hours * rate);
  const total = Object.values(byCat).reduce((a, b) => a + b, 0) + partsCost + laborCost;
  const revenue = sale ? sale.price_czk : null;
  const expected = revenue ?? p?.price_czk ?? null;
  const margin = expected != null ? expected - total : null;
  return {
    costs, parts, byCat, hours, rate, laborCost, partsCost, total,
    sold: !!sale, saleOrder: sale?.number || null, revenue, expected,
    margin, marginPct: expected ? Math.round((margin / expected) * 1000) / 10 : null,
    hasPurchase: (byCat.nakup || 0) > 0,
  };
}

/** Přehled roku: tržby a náklady po měsících, zisk, plnění cíle, hodnota skladu, marže kusů. */
export async function overview(env, year) {
  const y = /^\d{4}$/.test(String(year)) ? String(year) : String(new Date().getUTCFullYear());
  const s = await getSettings(env);
  const goal = Number(s.revenue_goal_czk) || 2000000;
  const rate = Number(s.labor_rate_czk) || 0;
  const months = Array.from({ length: 12 }, (_, i) => ({ month: `${y}-${String(i + 1).padStart(2, '0')}`, revenue: 0, costs: 0, purchases: 0, overhead: 0 }));
  const idx = (d) => Number(String(d).slice(5, 7)) - 1;
  const { results: inv } = await env.DB.prepare("SELECT issued_at, total FROM invoices WHERE cancelled_at IS NULL AND kind <> 'zalohova' AND mode = 'live' AND substr(issued_at,1,4) = ?").bind(y).all();
  for (const r of inv) months[idx(r.issued_at)].revenue += r.total;
  // Prodeje mimo systém a importované faktury (bez duplicit s fakturami vystavenými v systému)
  const { results: sl } = await env.DB.prepare("SELECT issued_on, total_czk FROM sales WHERE status = 'potvrzeno' AND substr(issued_on,1,4) = ? AND (number IS NULL OR number NOT IN (SELECT number FROM invoices WHERE mode = 'live'))").bind(y).all();
  for (const r of sl) months[idx(r.issued_on)].revenue += r.total_czk;
  const { results: cs } = await env.DB.prepare("SELECT cost_date, category, amount_czk, hours, product_id, commission_id FROM costs WHERE status = 'potvrzeno' AND substr(cost_date,1,4) = ?").bind(y).all();
  for (const c of cs) {
    const m = months[idx(c.cost_date)];
    const amt = c.amount_czk + Math.round((c.hours || 0) * rate);
    m.costs += amt;
    if (c.category === 'nakup') m.purchases += amt;
    if (!c.product_id && !c.commission_id) m.overhead += amt;
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
    pieces.push({ id: p.id, title: p.title, status: p.status, cost: e.total, price: e.expected, margin: e.margin, marginPct: e.marginPct, sold: e.sold, hasPurchase: e.hasPurchase });
  }
  pieces.sort((a, b) => (b.margin ?? -1e12) - (a.margin ?? -1e12));
  const revenue = sum('revenue');
  return { year: y, goal, goalPct: Math.round((revenue / goal) * 1000) / 10, months, revenue, costs: sum('costs'), purchases: sum('purchases'), overhead: sum('overhead'), profit: revenue - sum('costs'), stockValue, pieces, rate };
}

/** CSV pro účetní: náklady a vystavené faktury za období (středník, UTF-8 s BOM pro Excel). */
export async function exportCsv(env, kind, from, to) {
  const f = ymd(from); const t = ymd(to);
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  let rows;
  if (kind === 'naklady') {
    const { results } = await env.DB.prepare("SELECT c.cost_date, c.category, c.description, c.amount_czk, c.hours, c.supplier, c.document_ref, p.title AS hodinky, (SELECT COUNT(*) FROM documents d WHERE d.cost_id = c.id) AS prilohy FROM costs c LEFT JOIN products p ON p.id = c.product_id WHERE c.status = 'potvrzeno' AND c.cost_date BETWEEN ? AND ? ORDER BY c.cost_date").bind(f, t).all();
    rows = [['Datum', 'Druh', 'Popis', 'Částka Kč', 'Hodiny', 'Dodavatel', 'Doklad', 'Hodinky', 'Doklad nahrán'], ...results.map((r) => [r.cost_date, COST_CATS[r.category], r.description, r.amount_czk, r.hours ?? '', r.supplier, r.document_ref, r.hodinky, r.prilohy ? 'ano' : 'ne'])];
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
