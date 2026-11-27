// Zakázky: náklady (zaplacené / vlastní práce / odhad), zálohy, faktury, odesílání, po splatnosti, fotky.
// Spuštění: npm run test:unit. Žádný e-mail neodchází – bez poskytovatele se e-maily jen ukládají do databáze.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function makeEnv(extra = {}) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../../migrations/', import.meta.url)).sort()) {
    try { db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8')); } catch { /* část schématu mimo SQLite */ }
  }
  const stmt = (sql) => { let a = []; const o = { bind: (...b) => { a = b; return o; }, run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }) }; return o; };
  const env = { DB: { prepare: stmt, batch: async (l) => { for (const s of l) await s.run(); } }, SHOP_MODE: 'live', OWNER_EMAIL: 'majitel@example.cz', ...extra };
  return { db, env };
}
const Y = String(new Date().getUTCFullYear());
const ORIGIN = 'https://atelier-dante-time.cz';

test('migrace 0022: nové sloupce, výchozí vypnuté automatické odesílání, dřívější „jen hodiny“ = vlastní práce', () => {
  const { db } = makeEnv();
  for (const [t, c] of [['costs', 'estimate'], ['costs', 'own_work'], ['costs', 'part_kind'], ['commissions', 'main_photo_id'], ['commissions', 'deposit_received_on'], ['commission_photos', 'phase']]) {
    assert.ok(db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c), `${t}.${c}`);
  }
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'invoice_autosend'").get().value, '0');
  const sql = readFileSync(new URL('../../migrations/0022_zakazky_ekonomika_fotky.sql', import.meta.url), 'utf8');
  assert.match(sql, /UPDATE costs SET own_work = 1 WHERE category = 'prace' AND COALESCE\(amount_czk, 0\) = 0 AND COALESCE\(hours, 0\) > 0/);
  assert.doesNotMatch(sql, /DROP|DELETE/i); // existující data zůstávají
});

test('hodnota nákladu: zaplaceno, vlastní práce a odhad se nikdy nesčítají dohromady', async () => {
  const { costValue } = await import('../../server/finance.js');
  assert.deepEqual(costValue({ amount_czk: 1000 }, 500), { paid: 1000, own: 0, est: 0 });
  assert.deepEqual(costValue({ amount_czk: 0, hours: 3 }, 500), { paid: 0, own: 1500, est: 0 });
  assert.deepEqual(costValue({ amount_czk: 800, own_work: 1 }, 500), { paid: 0, own: 800, est: 0 });
  assert.deepEqual(costValue({ amount_czk: 400, estimate: 1 }, 500), { paid: 0, own: 0, est: 400 });
  assert.deepEqual(costValue({ amount_czk: 0, hours: 2, estimate: 1 }, 500), { paid: 0, own: 0, est: 1000 });
});

test('zakázka: náklady, přiřazení výdaje, záloha (faktura i hotově), vyúčtování – zisk, marže, přijato, zbývá, bez dvojího započtení', async () => {
  const FIN = await import('../../server/finance.js');
  const INV = await import('../../server/invoicing.js');
  const { db, env } = makeEnv();
  db.exec("UPDATE settings SET value = '500' WHERE key = 'labor_rate_czk'");
  db.exec(`INSERT INTO commissions (id, number, type, status, contact_name, final_price_czk, estimate_czk, deposit_czk, deposit_received_on) VALUES ('k1', 'Z-${Y}-001', 'prestavba', 'v_praci', 'Pavel Testovací', 13000, 12000, 2000, '${Y}-03-01')`);
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p1', 'prim-x', 'PRIM X', 'available', 9000)");
  const d = `${Y}-03-10`;
  await FIN.addCost(env, { commission_id: 'k1', category: 'nakup', part_kind: 'strojek', description: 'Strojek', amount_czk: 3000, cost_date: d }, 'test');
  await FIN.addCost(env, { commission_id: 'k1', category: 'dil', part_kind: 'pouzdro', description: 'Pouzdro', amount_czk: 1500, cost_date: d }, 'test');
  await FIN.addCost(env, { commission_id: 'k1', category: 'dil', part_kind: 'sklo', description: 'Sklo (odhad)', amount_czk: 400, estimate: true, cost_date: d }, 'test');
  await FIN.addCost(env, { commission_id: 'k1', category: 'jine', description: 'Moje práce', hours: 4, own_work: true, cost_date: d }, 'test');
  await FIN.addCost(env, { commission_id: 'k1', category: 'prace', description: 'Leštění sám', amount_czk: 1000, own_work: 'on', cost_date: d }, 'test');
  assert.equal(db.prepare("SELECT category FROM costs WHERE description = 'Moje práce'").get().category, 'prace'); // vlastní práce = práce
  await assert.rejects(() => FIN.addCost(env, { commission_id: 'k1', product_id: 'p1', category: 'dil', description: 'x', amount_czk: 1 }, 't'), /buď k hodinkám, nebo k zakázce/);
  // Už zapsaný provozní výdaj → přiřadit k zakázce (bez nového zadání)
  const free = await FIN.addCost(env, { category: 'material', description: 'Těsnění', amount_czk: 700, cost_date: d }, 'test');
  await FIN.updateCost(env, free, { commission_id: 'k1' }, 'test');
  const prod = await FIN.addCost(env, { product_id: 'p1', category: 'dil', description: 'Díl hodinek', amount_czk: 50, cost_date: d }, 'test');
  await assert.rejects(() => FIN.updateCost(env, prod, { commission_id: 'k1' }, 'test'), /patří k hodinkám/);
  await assert.rejects(() => FIN.updateCost(env, free, { commission_id: 'neni' }, 'test'), /Zakázka nenalezena/);

  let e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.paid, 3000 + 1500 + 700); assert.equal(e.ownWork, 2000 + 1000); assert.equal(e.estimate, 400);
  assert.equal(e.price, 13000); assert.equal(e.priceSource, 'konecna');
  assert.equal(e.profit, 13000 - 5200); assert.equal(e.marginPct, 60); assert.equal(e.profitAfterWork, 7800 - 3000); assert.equal(e.expectedProfit, 7800 - 400);
  assert.equal(e.received, 2000); assert.equal(e.remaining, 11000); assert.equal(e.depositCashLeft, 2000);

  // Zálohová faktura 3 000 Kč → uhrazena
  const adv = await INV.issueManual(env, { kind: 'zalohova', commission_id: 'k1', buyer_name: 'Pavel Testovací', items: [{ text: 'Záloha', qty: 1, price: 3000 }], send_mode: 'ulozit' }, 'test', ORIGIN);
  assert.equal(adv.channel, 'osobne'); assert.equal(adv.commission_id, 'k1');
  db.prepare('UPDATE invoices SET paid_at = ? WHERE id = ?').run(`${Y}-04-01T10:00:00.000Z`, adv.id);
  e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.received, 5000); assert.equal(e.invoiced, 0); assert.equal(e.price, 13000); // záloha není tržba

  // Vyúčtování: odečte zálohovou fakturu i zálohu bez dokladu → zákazník doplácí 8 000 Kč
  await assert.rejects(() => INV.issueManual(env, { commission_id: 'k1', buyer_name: 'P', items: [{ text: 'x', price: 4000 }], advance_id: adv.id, deduct_cash_deposit: true }, 'test', ORIGIN), /Záloha je vyšší než faktura/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE kind = 'faktura'").get().n, 0); // chybná faktura se nevystavila
  const fin = await INV.issueManual(env, { commission_id: 'k1', buyer_name: 'Pavel Testovací', items: [{ text: 'Přestavba PRIM', qty: 1, price: 13000 }], advance_id: adv.id, deduct_cash_deposit: true, send_mode: 'ulozit' }, 'test', ORIGIN);
  assert.equal(fin.total, 13000); assert.equal(fin.advance_deducted, 5000); assert.equal(fin.related_invoice_id, adv.id);
  e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.price, 13000); assert.equal(e.priceSource, 'faktura'); assert.equal(e.invoiced, 13000);
  assert.equal(e.received, 5000); assert.equal(e.remaining, 8000); assert.equal(e.depositCashLeft, 0);
  await assert.rejects(() => INV.issueManual(env, { commission_id: 'k1', buyer_name: 'P', items: [{ text: 'x', price: 100 }], deduct_cash_deposit: true }, 'test', ORIGIN), /neodečtenou zálohu/);
  db.prepare('UPDATE invoices SET paid_at = ? WHERE id = ?').run(`${Y}-05-02T10:00:00.000Z`, fin.id);
  e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.received, 13000); assert.equal(e.remaining, 0); assert.equal(e.profit, 7800);

  // Odhad → skutečný náklad
  const est = db.prepare("SELECT id FROM costs WHERE description = 'Sklo (odhad)'").get().id;
  await FIN.updateCost(env, est, { estimate: false, amount_czk: 450, cost_date: `${Y}-05-01` }, 'test');
  e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.paid, 5650); assert.equal(e.estimate, 0); assert.equal(e.profit, 13000 - 5650);

  // Roční přehled: fakturováno jen faktura (ne záloha), přijato přesně jednou, náklady bez vlastní práce a odhadů
  const o = await FIN.overview(env, Y);
  const mo = Number(fin.issued_at.slice(5, 7)) - 1;
  assert.equal(o.revenue, 13000); assert.equal(o.months[mo].revenue, 13000);
  assert.equal(o.received, 2000 + 3000 + 8000);
  assert.equal(o.months[2].received, 2000); assert.equal(o.months[3].received, 3000); assert.equal(o.months[4].received, 8000);
  assert.equal(o.costs, 5650 + 50); assert.equal(o.ownWork, 3000);
  assert.equal(o.profit, 13000 - 5700); assert.equal(o.profitAfterWork, 13000 - 5700 - 3000);
  assert.equal(o.goal, 2000000); assert.equal(o.goalPct, 0.7);
  const job = o.jobs.find((j) => j.id === 'k1');
  assert.equal(job.margin, 13000 - 5650); assert.equal(job.remaining, 0);
  assert.equal(o.unpaid, 0);
  // Podklady pro účetní: odhady ne, vlastní práce označená bez částky výdaje, zakázka uvedená
  const csv = await FIN.exportCsv(env, 'naklady', `${Y}-01-01`, `${Y}-12-31`);
  assert.match(csv, /Vlastní práce \(není výdaj\);Leštění sám;0/); assert.match(csv, new RegExp(`Z-${Y}-001`));
});

test('ekonomika hodinek: odhad se nezapočítá, vlastní práce zvlášť (dřívější hodiny zůstávají vlastní prací)', async () => {
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec("UPDATE settings SET value = '400' WHERE key = 'labor_rate_czk'");
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p1', 'prim-a', 'PRIM A', 'available', 10000)");
  await FIN.addCost(env, { product_id: 'p1', category: 'nakup', description: 'Nákup', amount_czk: 4000 }, 't');
  await FIN.addCost(env, { product_id: 'p1', category: 'prace', description: 'Servis', hours: 5 }, 't');
  await FIN.addCost(env, { product_id: 'p1', category: 'dil', description: 'Sklo', amount_czk: 300, estimate: 1 }, 't');
  const e = await FIN.productEconomics(env, 'p1');
  assert.equal(e.total, 4000); assert.equal(e.ownWork, 2000); assert.equal(e.estimate, 300);
  assert.equal(e.margin, 6000); assert.equal(e.marginPct, 60); assert.equal(e.marginAfterWork, 4000);
});

test('faktura: jen uložit / schválit ručně / odeslat ihned – automatické odesílání výchozí vypnuté, e-mail jen při platné adrese', async () => {
  const INV = await import('../../server/invoicing.js');
  const { db, env } = makeEnv();
  const mails = () => db.prepare('SELECT to_addr, subject, status FROM emails').all();
  const base = { buyer_name: 'Jana Testovací', buyer_email: 'jana@example.cz', items: [{ text: 'Servis', price: 1500 }] };
  // 1) jen uložit
  const a = await INV.issueManual(env, { ...base, send_mode: 'ulozit' }, 't', ORIGIN);
  assert.equal(a.sendMode, 'ulozit'); assert.equal(mails().length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM approvals').get().n, 0);
  // bez volby a s vypnutým automatickým odesíláním = jen uložit (jako dosud)
  assert.equal((await INV.issueManual(env, base, 't', ORIGIN)).sendMode, 'ulozit');
  // 2) „odeslat ihned“ při vypnutém nastavení → čeká na schválení, nic neodešlo
  const b = await INV.issueManual(env, { ...base, send_mode: 'odeslat' }, 't', ORIGIN);
  assert.equal(b.sendMode, 'schvalit'); assert.match(b.done.join(), /vypnuté/); assert.equal(mails().length, 0);
  const ap = db.prepare("SELECT * FROM approvals WHERE kind = 'faktura_odeslani' AND payload = ?").get(b.id);
  assert.equal(ap.status, 'ceka'); assert.match(ap.title, new RegExp(b.number));
  assert.equal((await INV.listInvoices(env, { status: 'ke_schvaleni' })).invoices.map((i) => i.id).join(), b.id);
  // schválení = odeslání; žádost se uzavře
  await INV.sendInvoice(env, b.id, 'majitel', ORIGIN);
  assert.equal(db.prepare('SELECT status FROM approvals WHERE id = ?').get(ap.id).status, 'schvaleno');
  assert.ok(db.prepare('SELECT sent_at FROM invoices WHERE id = ?').get(b.id).sent_at);
  assert.deepEqual(mails().map((m) => [m.to_addr, m.status]), [['jana@example.cz', 'stored']]); // bez poskytovatele se nic neodešle ven
  // 3) automatické odesílání zapnuto → odešle ihned (výchozí volba)
  db.exec("UPDATE settings SET value = '1' WHERE key = 'invoice_autosend'");
  const c = await INV.issueManual(env, base, 't', ORIGIN);
  assert.equal(c.sendMode, 'odeslat'); assert.equal(mails().length, 2); assert.match(mails()[1].subject, new RegExp(c.number));
  // bez e-mailu se neodesílá nic
  const n = await INV.issueManual(env, { ...base, buyer_email: '', send_mode: 'odeslat' }, 't', ORIGIN);
  assert.equal(n.sendMode, 'ulozit'); assert.equal(mails().length, 2);
  await assert.rejects(() => INV.issueManual(env, { ...base, buyer_email: 'neplatny@', send_mode: 'odeslat' }, 't', ORIGIN), /platný e-mail/);
  // ruční schválení i při zapnutém nastavení; storno žádost zamítne
  const s = await INV.issueManual(env, { ...base, send_mode: 'schvalit' }, 't', ORIGIN);
  assert.equal(s.sendMode, 'schvalit'); assert.equal(mails().length, 2);
  await INV.cancelInvoice(env, s.id, 't');
  assert.equal(db.prepare('SELECT status FROM approvals WHERE payload = ?').get(s.id).status, 'zamitnuto');
  await assert.rejects(() => INV.sendInvoice(env, s.id, 't', ORIGIN), /Stornovaný/);
  // testovací režim: předmět označený [TEST]
  const { env: tenv, db: tdb } = makeEnv({ SHOP_MODE: 'test' });
  tdb.exec("UPDATE settings SET value = '1' WHERE key = 'invoice_autosend'");
  await INV.issueManual(tenv, base, 't', ORIGIN);
  assert.match(tdb.prepare('SELECT subject FROM emails').get().subject, /^\[TEST\]/);
});

test('po splatnosti: stav ve fakturách, upozornění a denní souhrn jen majiteli (zákazníkům nic)', async () => {
  const INV = await import('../../server/invoicing.js');
  const OS = await import('../../server/os.js');
  const { db, env } = makeEnv();
  const inv = await INV.issueManual(env, { buyer_name: 'Petr Testovací', buyer_email: 'petr@example.cz', items: [{ text: 'Renovace', price: 4200 }], send_mode: 'ulozit' }, 't', ORIGIN);
  const ok = await INV.issueManual(env, { buyer_name: 'Ok', items: [{ text: 'x', price: 100 }] }, 't', ORIGIN);
  db.prepare('UPDATE invoices SET due_date = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', inv.id);
  const l = await INV.listInvoices(env, { status: 'po_splatnosti' });
  assert.deepEqual(l.invoices.map((i) => i.id), [inv.id]); assert.equal(l.overdue, 4200);
  assert.equal((await INV.listInvoices(env, {})).invoices.find((i) => i.id === ok.id).overdue, 0);
  const r = await OS.financeCheck(env);
  assert.match(r.summary, /1 faktur po splatnosti/);
  assert.match(db.prepare("SELECT title FROM os_findings WHERE role_id = 'finance' AND check_key LIKE 'splatnost:%'").get().title, new RegExp(`Faktura ${inv.number} je \\d+ dní po splatnosti`));
  await OS.financeCheck(env); // druhý běh týž den → souhrn se neposílá znovu
  const mails = db.prepare('SELECT to_addr, subject, html FROM emails').all();
  assert.equal(mails.length, 1); assert.equal(mails[0].to_addr, 'majitel@example.cz');
  assert.match(mails[0].subject, /Faktury po splatnosti: 1/); assert.match(mails[0].html, /Zákazníkům nebyla odeslána žádná automatická upomínka/);
  assert.ok(!mails.some((m) => m.to_addr === 'petr@example.cz'));
  db.prepare('UPDATE invoices SET paid_at = ? WHERE id = ?').run(new Date().toISOString(), inv.id);
  await OS.financeCheck(env);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM os_findings WHERE check_key LIKE 'splatnost:%' AND resolved_at IS NULL").get().n, 0);
});

test('fotky zakázky: fáze, hlavní fotka jen z vlastní zakázky, smazání hlavní fotky ji zruší', async () => {
  const CPH = await import('../../server/commission-photos.js');
  const { db, env } = makeEnv();
  const deleted = [];
  env.MEDIA = { delete: async (k) => { deleted.push(k); } };
  db.exec("INSERT INTO commissions (id, number, type, status) VALUES ('k1', 'Z-1', 'servis', 'v_praci'), ('k2', 'Z-2', 'servis', 'v_praci')");
  db.exec("INSERT INTO commission_photos (id, commission_id, source, key_large, key_small, created_at) VALUES ('f1', 'k1', 'atelier', 'l1', 's1', '2026-01-01'), ('f2', 'k1', 'atelier', 'l2', 's2', '2026-01-02'), ('f3', 'k2', 'atelier', 'l3', 's3', '2026-01-03')");
  await CPH.setPhase(env, 'f1', 'pred'); await CPH.setPhase(env, 'f2', 'nesmysl');
  await assert.rejects(() => CPH.setPhase(env, 'neni', 'po'), /nenalezena/);
  await CPH.setMain(env, 'k1', 'f2');
  await assert.rejects(() => CPH.setMain(env, 'k1', 'f3'), /nepatří/);
  let p = await CPH.forCommission(env, 'k1');
  assert.deepEqual(p.map((x) => [x.id, x.phase, x.main]), [['f1', 'pred', 0], ['f2', null, 1]]);
  await CPH.remove(env, 'f2');
  assert.deepEqual(deleted, [['l2', 's2']]);
  assert.equal(db.prepare("SELECT main_photo_id FROM commissions WHERE id = 'k1'").get().main_photo_id, null);
  p = await CPH.forCommission(env, 'k1');
  assert.deepEqual(p.map((x) => x.id), ['f1']);
});

test('administrace: nové cesty jsou zaregistrované a datum zakázek je ve formátu DD.MM.RRRR', () => {
  const api = readFileSync(new URL('../../functions/api/admin/[[path]].js', import.meta.url), 'utf8');
  for (const r of ["route('PUT', 'costs/:id'", "route('GET', 'commissions/:id/economics'", "route('PUT', 'commissions/:id/main-photo'", "route('PUT', 'commission-photos/:id'", "invoice_autosend: 'bool'"]) assert.ok(api.includes(r), r);
  const ui = readFileSync(new URL('../../public/admin/admin.js', import.meta.url), 'utf8');
  const src = ui.match(/const dmy = \(v\) => \{[\s\S]*?\n {2}\};/)[0];
  const dmy = new Function(`${src}; return dmy;`)();
  assert.equal(dmy('2027-05-01'), '01.05.2027');
  assert.equal(dmy('2026-11-27T07:35:00.000Z'), '27.11.2026');
  assert.equal(dmy('2026-12-31T23:30:00.000Z'), '01.01.2027'); // pražský čas
  assert.equal(dmy(null), '');
  assert.match(ui, /watchph/); assert.match(ui, /Opravdu smazat tuto fotografii/);
});

test('díly ze skladu v zakázce: rozdělení zásoby, náklad zakázky, vrácení na sklad, bez dvojího započtení', async () => {
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO commissions (id, number, type, status, final_price_czk) VALUES ('k1', 'Z-1', 'renovace', 'v_praci', 5000)");
  db.exec(`INSERT INTO parts (id, kind, title, qty, unit_cost_czk, purchase_date, status) VALUES ('s1', 'sklo', 'Sklo 30 mm', 5, 120, '${Y}-02-01', 'skladem'), ('r1', 'remen', 'Řemínek hnědý', 1, 400, '${Y}-02-01', 'skladem'), ('h1', 'strojek', 'Strojek v hodinkách', 1, 900, '${Y}-02-01', 'pouzito')`);
  const before = (await FIN.overview(env, Y)).months[1].costs;
  const used = await FIN.usePartInCommission(env, 'k1', 's1', 2, 't');
  assert.notEqual(used, 's1');
  assert.equal(db.prepare("SELECT qty FROM parts WHERE id = 's1'").get().qty, 3);
  assert.deepEqual({ ...db.prepare('SELECT qty, status, commission_id, unit_cost_czk FROM parts WHERE id = ?').get(used) }, { qty: 2, status: 'pouzito', commission_id: 'k1', unit_cost_czk: 120 });
  assert.equal(await FIN.usePartInCommission(env, 'k1', 'r1', undefined, 't'), 'r1'); // celý kus → bez rozdělení
  await assert.rejects(() => FIN.usePartInCommission(env, 'k1', 's1', 4, 't'), /Skladem je jen 3 ks/);
  await assert.rejects(() => FIN.usePartInCommission(env, 'k1', 'r1', 1, 't'), /není skladem/);
  await assert.rejects(() => FIN.usePartInCommission(env, 'k1', 'h1', 1, 't'), /není skladem/);
  await assert.rejects(() => FIN.usePartInCommission(env, 'neni', 's1', 1, 't'), /Zakázka nenalezena/);
  let e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.partsCost, 240 + 400); assert.equal(e.paid, 640); assert.equal(e.profit, 5000 - 640); assert.equal(e.parts.length, 2);
  // Měsíční náklady (nákup dílů) se použitím nezmění – díl se nepočítá dvakrát
  assert.equal((await FIN.overview(env, Y)).months[1].costs, before);
  assert.equal(before, 5 * 120 + 400 + 900);
  await FIN.returnPartFromCommission(env, 'k1', 'r1', 't');
  assert.deepEqual({ ...db.prepare("SELECT status, commission_id FROM parts WHERE id = 'r1'").get() }, { status: 'skladem', commission_id: null });
  await assert.rejects(() => FIN.returnPartFromCommission(env, 'k1', 'r1', 't'), /není/);
  e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.paid, 240);
});
