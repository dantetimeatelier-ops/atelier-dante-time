// Jednotná správa výdajů: detail, úpravy s historií, přiřazení (hodinky / zakázka / provoz), přílohy, smazání.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function makeEnv() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../../migrations/', import.meta.url)).sort()) {
    try { db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8')); } catch { /* část schématu mimo SQLite */ }
  }
  const stmt = (sql) => { let a = []; const o = { bind: (...b) => { a = b; return o; }, run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; }, first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }) }; return o; };
  return { db, env: { DB: { prepare: stmt, batch: async (l) => { for (const s of l) await s.run(); } }, SHOP_MODE: 'live' } };
}
const Y = String(new Date().getUTCFullYear());
const pdf = (txt) => new File([`%PDF-1.4\n% ${txt}\n`], `${txt}.pdf`, { type: 'application/pdf' });
const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

test('migrace 0027: poznámka a čas úpravy u výdaje, data beze změny', () => {
  const { db } = makeEnv();
  const cols = db.prepare('PRAGMA table_info(costs)').all().map((x) => x.name);
  assert.ok(cols.includes('note') && cols.includes('updated_at'));
  assert.doesNotMatch(readFileSync(new URL('../../migrations/0027_sprava_vydaju.sql', import.meta.url), 'utf8'), /^\s*(DROP|DELETE|UPDATE)\b/im);
});

test('úprava výdaje: všechna pole, historie „z → na“, přepočet ekonomiky zakázky i roku, žádná změna = nic', async () => {
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO commissions (id, number, type, status, final_price_czk) VALUES ('k1', 'Z-1', 'servis', 'v_praci', 10000)");
  const id = await FIN.addCost(env, { commission_id: 'k1', category: 'dil', description: 'Pouzdro', amount_czk: 1000, cost_date: `${Y}-03-01`, supplier: 'Aliexpres' }, 'majitel');
  assert.equal((await FIN.commissionEconomics(env, 'k1')).profit, 9000);
  const r = await FIN.updateCost(env, id, { description: 'Pouzdro ocelové 40 mm', category: 'dil', part_kind: 'pouzdro', amount_czk: '1250', cost_date: `${Y}-04-02`, supplier: 'AliExpress', document_ref: 'AE-123', note: 'vráceno 1x, druhé OK', estimate: false }, 'majitel');
  assert.deepEqual(r.changed.sort(), ['amount_czk', 'cost_date', 'description', 'document_ref', 'note', 'part_kind', 'supplier'].sort());
  const c = db.prepare('SELECT * FROM costs WHERE id = ?').get(id);
  assert.equal(c.amount_czk, 1250); assert.equal(c.note, 'vráceno 1x, druhé OK'); assert.ok(c.updated_at);
  const e = await FIN.commissionEconomics(env, 'k1');
  assert.equal(e.paid, 1250); assert.equal(e.profit, 8750); assert.equal(e.marginPct, 87.5);
  const o = await FIN.overview(env, Y);
  assert.equal(o.months[2].costs, 0); assert.equal(o.months[3].costs, 1250); // přesun na nový měsíc, nic dvakrát
  const d = await FIN.getCost(env, id);
  const h = d.history.find((x) => x.action === 'naklad_upraven');
  assert.deepEqual(JSON.parse(h.details).amount_czk, { z: 1000, na: 1250 });
  assert.equal(d.cost.commission_number, 'Z-1');
  assert.deepEqual((await FIN.updateCost(env, id, { amount_czk: 1250, note: 'vráceno 1x, druhé OK' }, 'm')).changed, []);
  await assert.rejects(() => FIN.updateCost(env, id, { description: '' }, 'm'), /popis/);
  await assert.rejects(() => FIN.updateCost(env, id, { cost_date: '27.11.2026' }, 'm'), /Neplatné datum/);
  await assert.rejects(() => FIN.updateCost(env, id, { amount_czk: '-5' }, 'm'));
  await assert.rejects(() => FIN.updateCost(env, 'neni', { note: 'x' }, 'm'), /nenalezen/);
});

test('přiřazení: přesun mezi zakázkou, hodinkami a provozem – výdaj se počítá vždy jen jednou', async () => {
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO commissions (id, number, type, status, final_price_czk) VALUES ('k1', 'Z-1', 'servis', 'v_praci', 5000)");
  db.exec("INSERT INTO products (id, slug, title, status, price_czk) VALUES ('p1', 'prim', 'PRIM', 'available', 9000)");
  const id = await FIN.addCost(env, { commission_id: 'k1', category: 'dil', description: 'Sklo', amount_czk: 300, cost_date: `${Y}-05-05` }, 'm');
  await FIN.updateCost(env, id, { product_id: 'p1', commission_id: null }, 'm'); // zakázka → hodinky
  assert.equal((await FIN.commissionEconomics(env, 'k1')).paid, 0);
  assert.equal((await FIN.productEconomics(env, 'p1')).total, 300);
  await assert.rejects(() => FIN.updateCost(env, id, { commission_id: 'k1' }, 'm'), /patří k hodinkám/); // rychlé přiřazení nepřesouvá potichu
  await assert.rejects(() => FIN.updateCost(env, id, { product_id: 'p1', commission_id: 'k1' }, 'm'), /buď k hodinkám, nebo k zakázce/);
  await assert.rejects(() => FIN.updateCost(env, id, { product_id: 'neni', commission_id: null }, 'm'), /Hodinky nenalezeny/);
  await FIN.updateCost(env, id, { product_id: null, commission_id: null }, 'm'); // → provoz (odebrat bez smazání)
  assert.equal((await FIN.productEconomics(env, 'p1')).total, 0);
  const o = await FIN.overview(env, Y);
  assert.equal(o.costs, 300); assert.equal(o.overhead, 300);
  assert.ok(db.prepare('SELECT 1 FROM costs WHERE id = ?').get(id));
});

test('nákup naskladněný jako díl: částku nelze upravit u výdaje (počítá se u dílu)', async () => {
  const FIN = await import('../../server/finance.js');
  const { db, env } = makeEnv();
  db.exec(`INSERT INTO parts (id, kind, title, qty, unit_cost_czk, purchase_date, status) VALUES ('x1', 'sklo', 'Sklo', 2, 100, '${Y}-01-01', 'skladem')`);
  db.exec(`INSERT INTO costs (id, category, description, amount_czk, cost_date, part_id) VALUES ('c1', 'dil', 'Sklo 2 ks', 0, '${Y}-01-01', 'x1')`);
  await assert.rejects(() => FIN.updateCost(env, 'c1', { amount_czk: 200 }, 'm'), /cenu upravte u dílu/);
  await FIN.updateCost(env, 'c1', { note: 'safírové', supplier: 'Temu' }, 'm');
  const d = await FIN.getCost(env, 'c1');
  assert.equal(d.cost.part_title, 'Sklo'); assert.equal(d.cost.note, 'safírové');
  assert.equal((await FIN.overview(env, Y)).months[0].costs, 200);
});

test('přílohy: více dokladů k výdaji, náhled bez záznamu, stažení originálu, úprava, odpojení, smazání, historie', async () => {
  const FIN = await import('../../server/finance.js');
  const DOC = await import('../../server/documents.js');
  const { db, env } = makeEnv();
  const id = await FIN.addCost(env, { category: 'provoz', description: 'Krabičky', amount_czk: 600 }, 'm');
  const d1 = await DOC.upload(env, form({ file: pdf('faktura-1'), cost_id: id, kind: 'faktura' }), 'm');
  const d2 = await DOC.upload(env, form({ file: pdf('uctenka-2'), cost_id: id }), 'm');
  await assert.rejects(() => DOC.upload(env, form({ file: pdf('faktura-1'), cost_id: id }), 'm'), (e) => e.status === 409 && e.extra.cost_id === id);
  let g = await FIN.getCost(env, id);
  assert.deepEqual(g.docs.map((x) => x.id), [d1, d2]);
  const audits = () => db.prepare("SELECT action FROM audit_log WHERE entity = 'document'").all().map((x) => x.action);
  const before = audits().length;
  let res = await DOC.file(env, d1, 'm', { preview: true });
  assert.equal(audits().length, before); // miniatura se nezapisuje
  assert.match(res.headers.get('Content-Disposition'), /^inline; filename="faktura-1\.pdf"/);
  res = await DOC.file(env, d1, 'm', { download: true });
  assert.match(res.headers.get('Content-Disposition'), /^attachment; filename="faktura-1\.pdf"/);
  assert.equal(new TextDecoder().decode(await res.arrayBuffer()), '%PDF-1.4\n% faktura-1\n'); // originál beze změny
  assert.equal(audits().at(-1), 'doklad_stazen');
  await DOC.update(env, d2, { kind: 'uctenka', note: 'platba kartou' }, 'm');
  await assert.rejects(() => DOC.update(env, 'neni', { note: 'x' }, 'm'), /nenalezen/);
  // odpojení → doklad bez výdaje (zůstane), znovu připojení
  await DOC.assign(env, d2, null, 'm');
  assert.deepEqual((await DOC.list(env, { unassigned: true })).map((x) => x.id), [d2]);
  await DOC.assign(env, d2, id, 'm');
  assert.equal((await DOC.list(env, { unassigned: true })).length, 0);
  // „nahradit“ = nový soubor + smazání starého
  const d3 = await DOC.upload(env, form({ file: pdf('faktura-1-oprava'), cost_id: id }), 'm');
  await DOC.remove(env, d1, 'm');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM document_chunks WHERE document_id = ?').get(d1).n, 0);
  g = await FIN.getCost(env, id);
  assert.deepEqual(g.docs.map((x) => x.id).sort(), [d2, d3].sort());
  const acts = g.history.map((h) => h.action);
  for (const a of ['priloha_pridana', 'priloha_odebrana', 'priloha_smazana']) assert.ok(acts.includes(a), a);
  // doklad prodeje není „bez výdaje“
  db.exec("INSERT INTO documents (id, sale_id, purpose, mime, size, sha256, data) VALUES ('s1', 'sale1', 'prodej', 'application/pdf', 1, 'x', X'00')");
  assert.ok(!(await DOC.list(env, { unassigned: true })).some((x) => x.id === 's1'));
});

test('smazání výdaje: doklady se odpojí (výchozí), nebo smažou na přání; ekonomika se přepočítá', async () => {
  const FIN = await import('../../server/finance.js');
  const DOC = await import('../../server/documents.js');
  const { db, env } = makeEnv();
  db.exec("INSERT INTO commissions (id, number, type, status, final_price_czk) VALUES ('k1', 'Z-1', 'servis', 'v_praci', 5000)");
  const a = await FIN.addCost(env, { commission_id: 'k1', category: 'dil', description: 'A', amount_czk: 700 }, 'm');
  const b = await FIN.addCost(env, { commission_id: 'k1', category: 'dil', description: 'B', amount_czk: 300 }, 'm');
  const da = await DOC.upload(env, form({ file: pdf('a'), cost_id: a }), 'm');
  const db1 = await DOC.upload(env, form({ file: pdf('b'), cost_id: b }), 'm');
  assert.deepEqual(await FIN.deleteCost(env, a, 'm'), { docs: 1 });
  assert.equal(db.prepare('SELECT cost_id FROM documents WHERE id = ?').get(da).cost_id, null); // doklad zůstal
  await FIN.deleteCost(env, b, 'm', { withDocs: true, removeDoc: DOC.remove });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE id = ?').get(db1).n, 0);
  assert.equal((await FIN.commissionEconomics(env, 'k1')).paid, 0);
  await assert.rejects(() => FIN.deleteCost(env, a, 'm'), /nenalezen/);
  const del = db.prepare("SELECT details FROM audit_log WHERE action = 'naklad_smazan'").all().map((x) => JSON.parse(x.details));
  assert.deepEqual(del.map((x) => [x.description, x.amount, x.docsDeleted]), [['A', 700, false], ['B', 300, true]]);
});

test('poptávka: smazání i s fotkami, ne když z ní vznikla zakázka', async () => {
  const CPH = await import('../../server/commission-photos.js');
  const { db, env } = makeEnv();
  const deleted = [];
  env.MEDIA = { delete: async (k) => { deleted.push(k); } };
  db.exec("INSERT INTO commission_photos (id, inquiry_id, commission_id, source, key_large, key_small) VALUES ('f1', 'q1', NULL, 'zakaznik', 'l1', 's1'), ('f2', 'q2', 'k2', 'zakaznik', 'l2', 's2')");
  assert.equal(await CPH.removeForInquiry(env, 'q1'), 1);
  assert.equal(await CPH.removeForInquiry(env, 'q2'), 0); // fotka už patří zakázce
  assert.deepEqual(deleted, [['l1', 's1']]);
  const api = readFileSync(new URL('../../functions/api/admin/[[path]].js', import.meta.url), 'utf8');
  assert.match(api, /route\('DELETE', 'inquiries\/:id'[\s\S]*?vznikla zakázka/);
});

test('administrace: detail výdaje dostupný ze všech seznamů a s úplnými akcemi', () => {
  const ui = readFileSync(new URL('../../public/admin/admin.js', import.meta.url), 'utf8');
  assert.match(ui, /views\['naklady\/:id'\]/); assert.match(ui, /views\['prodeje\/:id'\]/);
  for (const t of ['Uložit změny', 'Přidat doklad nebo fotku', 'Nahradit', 'Stáhnout originál', 'Připojit nahraný doklad bez výdaje', 'Odebrat ze zakázky (výdaj zůstane v evidenci)', 'Trvale smazat výdaj', 'Historie změn']) assert.ok(ui.includes(t), t);
  assert.ok((ui.match(/costRow\(/g) || []).length >= 3, 'jednotný řádek výdaje ve Výdajích, u hodinek, v nákupech');
  assert.match(ui, /href="#\/naklady\/\$\{esc\(c\.id\)\}"/);
  const api = readFileSync(new URL('../../functions/api/admin/[[path]].js', import.meta.url), 'utf8');
  for (const r of ["route('GET', 'costs/:id'", "route('GET', 'sales/:id'", "download: u.get('download') === '1'"]) assert.ok(api.includes(r), r);
});

test('faktura: oprava odběratele (adresa, e-mail, splatnost) s historií; storno s důvodem, ne při aktivním dobropisu', async () => {
  const INV = await import('../../server/invoicing.js');
  const { db, env } = makeEnv();
  const base = { buyer_name: 'Pavel Testovací', buyer_email: 'pavel@example.cz', items: [{ text: 'Renovace', price: 13000 }], send_mode: 'ulozit' };
  const a = await INV.issueManual(env, base, 'm', 'https://x');
  const b = await INV.issueManual(env, { ...base, allow_duplicate: true }, 'm', 'https://x');
  // oprava údajů – číslo a částka zůstávají
  const r = await INV.updateBuyer(env, a.id, { buyer_name: 'Pavel Testovací', buyer_street: 'Masarykova 12', buyer_city: 'Brno', buyer_zip: '602 00', buyer_email: 'Pavel@Example.cz', due_date: '2026-12-15' }, 'm');
  assert.deepEqual(r.changed.sort(), ['buyer_city', 'buyer_street', 'buyer_zip', 'due_date'].sort());
  const v = db.prepare('SELECT number, total, buyer_street, buyer_city, buyer_zip, due_date FROM invoices WHERE id = ?').get(a.id);
  assert.deepEqual({ ...v }, { number: a.number, total: 13000, buyer_street: 'Masarykova 12', buyer_city: 'Brno', buyer_zip: '602 00', due_date: '2026-12-15T23:59:59.000Z' });
  const h = db.prepare("SELECT details FROM audit_log WHERE action = 'odberatel_upraven' AND entity_id = ?").get(a.id);
  assert.deepEqual(JSON.parse(h.details).buyer_city, { z: null, na: 'Brno' });
  await assert.rejects(() => INV.updateBuyer(env, a.id, { buyer_name: '' }, 'm'), /jméno odběratele/);
  await assert.rejects(() => INV.updateBuyer(env, a.id, { buyer_email: 'spatne@' }, 'm'), /platný e-mail/);
  // duplicitní faktura: omylem vystavený dobropis brání stornu, dokud není stornován on
  const cr = await INV.creditNote(env, b.id, { reason: 'omyl' }, 'm');
  await assert.rejects(() => INV.cancelInvoice(env, b.id, 'm', 'Vystaveno omylem dvakrát'), new RegExp(`dobropis ${cr.number}`));
  await assert.rejects(() => INV.cancelInvoice(env, cr.id, 'm', ''), /důvod storna/);
  await INV.cancelInvoice(env, cr.id, 'm', 'Dobropis omylem');
  await INV.cancelInvoice(env, b.id, 'm', 'Vystaveno omylem dvakrát');
  assert.equal(db.prepare('SELECT cancel_reason FROM invoices WHERE id = ?').get(b.id).cancel_reason, 'Vystaveno omylem dvakrát');
  await assert.rejects(() => INV.updateBuyer(env, b.id, { buyer_city: 'Praha' }, 'm'), /Stornovaný/);
  const ui = readFileSync(new URL('../../public/admin/admin.js', import.meta.url), 'utf8');
  assert.match(ui, /data-storno[\s\S]{0,400}prompt\([\s\S]{0,300}Vystaveno omylem dvakrát[\s\S]{0,200}cancel`, \{ reason/);
});
