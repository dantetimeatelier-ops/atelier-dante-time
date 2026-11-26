// Rekonstrukce nákladů 2026: rozpočítání objednávek, třídění, duplicity, průměrné ceny, sklad a exporty.
// Spuštění: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { ruleClassify, familyOf, allocateOrder, split, decideLine, computeRecon } from '../../server/recon.js';

// Jednoduchá náhrada Cloudflare D1 nad SQLite (stejné rozhraní prepare/bind/first/all/run/batch)
function d1(db) {
  const prepare = (sql) => {
    let args = [];
    const st = {
      bind: (...a) => { args = a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)); return st; },
      first: async () => db.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    };
    return st;
  };
  return { prepare, batch: async (list) => { for (const s of list) await s.run(); } };
}
function freshDb() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../../migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  return db;
}

test('rekonstrukce: pravidla podle názvu – nářadí má přednost, nejasné zůstane nejasné', () => {
  assert.deepEqual(ruleClassify('Watch case opener tool'), { purpose: 'naradi', component: null, family: null });
  assert.equal(ruleClassify('Spring bar tool 2 in 1').purpose, 'naradi');
  assert.deepEqual(ruleClassify('Stainless steel case for Rolex Submariner 40mm'), { purpose: 'komponent', component: 'pouzdro', family: 'ROLEX' });
  assert.equal(ruleClassify('Genuine leather strap 20mm with buckle').component, 'remen');
  assert.equal(ruleClassify('Gift box for watches black').component, 'krabicka');
  assert.equal(ruleClassify('Bubble envelope mailer 50 pcs').component, 'obal');
  assert.equal(ruleClassify('Watch oil 5ml lubricant').purpose, 'material');
  assert.equal(ruleClassify('XYZ-123 gadget').purpose, null);           // pravidla nevědí → AI / majitel
  assert.equal(ruleClassify('Watch box with strap').purpose, null);      // krabička i řemínek → nejednoznačné
  assert.equal(familyOf('Omega Seamaster dial'), 'OMEGA');
  assert.equal(familyOf('PRIM Sport 1968'), 'PRIM');
  assert.equal(familyOf('Primary color case'), null);
  assert.equal(familyOf('fits Rolex and Omega'), null);                  // dva typy → neurčeno
});

test('rekonstrukce: doprava, sleva a vratka se rozpočítají na položky, součet sedí na haléř', () => {
  assert.deepEqual(split(10, [1, 1, 1]), [3.34, 3.33, 3.33]);
  const o = allocateOrder({ status: 'dokoncena', shipping: 3, discount: 3, total_paid: 30, items: [
    { title: 'Case', qty: 2, price: 20 }, { title: 'Strap', qty: 5, price: 10 }] });
  assert.ok(o.sumOk);
  assert.deepEqual(o.lines.map((l) => [l.shipping_orig, l.discount_orig, l.net]), [[2, 2, 20], [1, 1, 10]]);
  const part = allocateOrder({ status: 'castecne_vracena', shipping: 0, discount: 0, total_paid: 200, items: [{ title: 'Box', qty: 10, price: 200, refunded_qty: 2, refund: 40 }] });
  assert.equal(part.lines[0].net, 160); assert.equal(part.lines[0].refund_qty, 2);
  const cancelled = allocateOrder({ status: 'zrusena', shipping: 1, total_paid: 11, items: [{ title: 'X', qty: 1, price: 10 }] });
  assert.equal(cancelled.lines[0].net, 0);
  assert.equal(allocateOrder({ status: 'dokoncena', total_paid: 99, items: [{ title: 'X', qty: 1, price: 10 }] }).sumOk, false);
});

test('rekonstrukce: rozhodnutí – soukromé, nejasné a rozpory jdou vždy ke kontrole', () => {
  const ok = decideLine({ ai: { purpose: 'komponent', component: 'pouzdro', family: 'ROLEX', confident: true }, rule: ruleClassify('Case for Rolex'), sumOk: true });
  assert.equal(ok.status, 'potvrzeno');
  assert.equal(decideLine({ ai: { purpose: 'soukrome', confident: true }, rule: {}, sumOk: true }).status, 'ke_kontrole');
  assert.equal(decideLine({ ai: { purpose: 'nejasne', confident: false }, rule: {}, sumOk: true }).status, 'ke_kontrole');
  const clash = decideLine({ ai: { purpose: 'komponent', component: 'pouzdro', confident: true }, rule: ruleClassify('Watch case opener'), sumOk: true });
  assert.equal(clash.status, 'ke_kontrole'); assert.match(clash.notes.join(), /Nářadí/);
  assert.equal(decideLine({ ai: { purpose: 'naradi', confident: true }, rule: {}, sumOk: false }).status, 'ke_kontrole');
  assert.equal(decideLine({ ai: { purpose: 'naradi', confident: true }, rule: {}, sumOk: true, dupNote: 'duplicita' }).status, 'ke_kontrole');
});

test('rekonstrukce: průměrné ceny podle typu, spotřeba podle kusovníku, sklad a ztráty', () => {
  const L = (component, family, qty, amount, extra = {}) => ({ status: 'potvrzeno', purpose: 'komponent', component, family, qty, refund_qty: 0, amount_czk: amount, ...extra });
  const r = computeRecon({
    lines: [L('pouzdro', 'ROLEX', 2, 460), L('pouzdro', null, 4, 400), L('remen', null, 5, 230), L('pouzdro', 'PRIM', 1, 999, { status: 'ke_kontrole' })],
    recipes: { ROLEX: { pouzdro: 1, remen: 1 }, PRIM: { pouzdro: 1, remen: 1 } },
    sold: [{ key: 'a', family: 'ROLEX', revenue: 10000, real_cost: 0 }, { key: 'b', family: 'PRIM', revenue: 5000, real_cost: 3000 }, { key: 'c', family: null, revenue: 100 }, { key: 'd', is_watch: 0, revenue: 800 }],
    adjustments: [{ kind: 'poskozeno', component: 'remen', family: null, qty: 1, adj_date: '2026-05-01' }, { kind: 'inventura', component: 'pouzdro', family: null, qty: 2, adj_date: '2026-11-01' }],
    overhead: 300,
  });
  const piece = Object.fromEntries(r.pieces.map((p) => [p.key, p]));
  assert.equal(piece.a.material, 230 + 46);                 // vlastní fond ROLEX + univerzální řemínek
  assert.equal(piece.b.material, 100 + 46);                 // PRIM nemá potvrzená pouzdra → univerzální průměr (neověřená položka se nepočítá)
  assert.equal(piece.b.profitMaterial, 5000 - 3000 - 146);
  assert.equal(piece.a.overheadShare, 100);                 // režie / 3 prodané hodinky (faktura „není hodinky“ se nepočítá)
  assert.deepEqual(piece.c.missing, ['typ hodinek']);
  const pool = (c, f) => r.pools.find((p) => p.component === c && p.family === f);
  assert.equal(pool('pouzdro', 'ROLEX').remaining, 1);
  assert.equal(pool('remen', null).remaining, 5 - 2 - 1);
  assert.equal(pool('remen', null).loss, 46);
  assert.equal(pool('pouzdro', null).remaining, 2);          // inventura nahradí odhad (4 − 1 = 3)
  assert.equal(pool('pouzdro', null).difference, 1);
  assert.equal(r.stockValue, 230 + 2 * 46 + 2 * 100);
});

test('rekonstrukce: import PDF → položky, ochrana proti duplicitám, ruční opravy, export pro poradce', async () => {
  const db = freshDb();
  const env = { DB: d1(db), ANTHROPIC_API_KEY: 'test' };
  db.prepare("INSERT INTO fx_rates (day, code, rate) VALUES ('2026-03-02', 'USD', 23), (?, 'USD', 23)").run(new Date().toISOString().slice(0, 10));
  const REC = await import('../../server/recon.js');
  const FIN = await import('../../server/finance.js');
  const ai = {
    page_count: 2, note: null, orders: [
      { order_ref: 'A1', order_date: '2026-03-02', start_page: 1, seller: 'Shop A', currency: 'USD', status: 'dokoncena', shipping: 3, discount: 3, refund: null, total_paid: 30, uncertain: [], items: [
        { title: 'Stainless case for Rolex 40mm', variant: 'silver', qty: 2, price: 20, refunded_qty: null, refund: null, purpose: 'komponent', component: 'pouzdro', family: 'ROLEX', confident: true },
        { title: 'Leather strap 20mm', variant: null, qty: 5, price: 10, refunded_qty: null, refund: null, purpose: 'komponent', component: 'remen', family: null, confident: true }] },
      { order_ref: 'B2', order_date: '2026-04-10', start_page: 1, seller: null, currency: 'CZK', status: 'dokoncena', shipping: 0, discount: 0, refund: 0, total_paid: 600, uncertain: [], items: [
        { title: 'Precision screwdriver set', variant: null, qty: 1, price: 300, refunded_qty: null, refund: null, purpose: 'naradi', component: null, family: null, confident: true },
        { title: 'Kids T-shirt', variant: null, qty: 1, price: 200, refunded_qty: null, refund: null, purpose: 'soukrome', component: null, family: null, confident: true },
        { title: 'XYZ-123 gadget', variant: null, qty: 1, price: 100, refunded_qty: null, refund: null, purpose: 'nejasne', component: null, family: null, confident: false }] },
      { order_ref: 'C3', order_date: '2026-05-20', start_page: 2, seller: null, currency: 'CZK', status: 'castecne_vracena', shipping: 0, discount: 0, refund: 0, total_paid: 200, uncertain: [], items: [
        { title: 'Watch gift box black', variant: null, qty: 10, price: 200, refunded_qty: 2, refund: 40, purpose: 'obaly', component: 'krabicka', family: null, confident: true }] },
    ],
  };
  let calls = 0;
  const client = { messages: { create: async () => { calls++; return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify(ai) }] }; } } };
  const pdf = () => { const fd = new FormData(); fd.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10, 1, 2, 3])], 'aliexpress-2026.pdf', { type: 'application/pdf' })); fd.append('platform', 'aliexpress'); return fd; };

  const up = await REC.uploadSummary(env, pdf(), 'majitel');
  assert.ok(up.id && !up.duplicate);
  assert.equal((await REC.uploadSummary(env, pdf(), 'majitel')).duplicate, true);   // stejný soubor podruhé
  assert.equal(db.prepare("SELECT purpose FROM documents WHERE id = ?").get(up.id).purpose, 'souhrn');

  const r1 = await REC.extractSummary(env, up.id, { from: 1, to: 6 }, 'majitel', { client });
  assert.equal(r1.status, 'ok'); assert.equal(r1.added, 6); assert.equal(r1.finished, true);
  const r2 = await REC.extractSummary(env, up.id, { from: 1, to: 6 }, 'majitel', { client });
  assert.equal(r2.added, 0); assert.equal(r2.duplicates, 6);                          // opakované čtení nic nezdvojí
  const line = (t) => db.prepare('SELECT * FROM recon_lines WHERE title = ?').get(t);
  assert.equal(line('Stainless case for Rolex 40mm').amount_czk, 460);               // (20 + 2 doprava − 2 sleva) × 23
  assert.equal(line('Stainless case for Rolex 40mm').status, 'potvrzeno');
  assert.equal(line('Kids T-shirt').status, 'ke_kontrole');                           // soukromé nikdy samo
  assert.equal(line('XYZ-123 gadget').status, 'ke_kontrole');                         // nejasné se nemaže ani nedomýšlí
  assert.equal(line('Watch gift box black').status, 'ke_kontrole');                   // částečná vratka → kontrola
  assert.equal(line('Watch gift box black').amount_czk, 160);

  // Hromadné potvrzení: nejasná položka se potvrdit nedá
  const bc = await REC.bulkConfirm(env, [line('Watch gift box black').id, line('XYZ-123 gadget').id], 'majitel');
  assert.deepEqual(bc, { confirmed: 1, skipped: 1 });
  // Ruční oprava: nejasná položka → provozní výdaj; soukromé potvrzeno jako soukromé
  await assert.rejects(REC.saveLine(env, line('XYZ-123 gadget').id, { status: 'potvrzeno' }, 'majitel'), /Nejasnou položku nelze potvrdit/);
  await REC.saveLine(env, line('XYZ-123 gadget').id, { purpose: 'provoz', status: 'potvrzeno' }, 'majitel');
  assert.equal(line('XYZ-123 gadget').edited, 1); assert.equal(line('XYZ-123 gadget').amount_czk, 100);
  await REC.saveLine(env, line('Kids T-shirt').id, { purpose: 'soukrome', status: 'potvrzeno' }, 'majitel');

  // Prodané hodinky 2026
  const inv = db.prepare("INSERT INTO invoices (id, number, public_token, source, mode, buyer_name, items, total, payment_method, issued_at, kind, watch_model) VALUES (?, ?, ?, 'manual', 'live', 'Zákazník', ?, ?, 'bank_transfer', ?, 'faktura', ?)");
  inv.run('i1', 'DT-2026-0001', 't1', JSON.stringify([{ text: 'Hodinky', qty: 1, price: 10000 }]), 10000, '2026-06-01T10:00:00Z', 'Rolex Datejust renovace');
  inv.run('i2', 'DT-2026-0002', 't2', JSON.stringify([{ text: 'Servis', qty: 1, price: 800 }]), 800, '2026-06-02T10:00:00Z', null);
  await REC.addAdjustment(env, { kind: 'poskozeno', component: 'remen', qty: 1, adj_date: '2026-07-01' }, 'majitel');

  let s = await REC.summary(env, '2026');
  const piece = (n) => s.pieces.find((p) => p.number === n);
  assert.equal(piece('DT-2026-0001').family, 'ROLEX');
  assert.equal(piece('DT-2026-0001').material, 230 + 46 + 20);                       // pouzdro + řemínek + krabička (výchozí kusovník)
  assert.deepEqual(piece('DT-2026-0002').missing, ['typ hodinek']);
  assert.equal(s.review.salesWithoutFamily, 1);
  await REC.setSaleFamily(env, 'invoice', 'i2', { is_watch: 0 }, 'majitel');          // servis, ne hodinky
  s = await REC.summary(env, '2026');
  assert.equal(s.review.salesWithoutFamily, 0);
  assert.equal(s.real.revenue, 10800);
  assert.equal(s.real.expensesRecon, 460 + 230 + 300 + 160 + 100);                     // bez soukromého trička
  assert.equal(s.real.privateExcluded, 200);
  assert.equal(s.review.lines, 0);
  assert.equal(s.pools.find((p) => p.component === 'remen').remaining, 5 - 1 - 1);
  assert.equal(s.estimate.resultWithStock, s.real.result + s.estimate.stockValue);

  // Ekonomika započítá rekonstrukci, export pro poradce obsahuje jen skutečné výdaje bez soukromých
  const o = await FIN.overview(env, '2026');
  assert.equal(o.recon, 1250);
  const tax = await FIN.exportCsv(env, 'naklady', '2026-01-01', '2026-12-31');
  assert.match(tax, /Stainless case for Rolex 40mm/); assert.match(tax, /rekonstrukce 2026/);
  assert.doesNotMatch(tax, /Kids T-shirt/);
  const out = await FIN.exportCsv(env, 'nezahrnuto', '2026-01-01', '2026-12-31');
  assert.match(out, /Kids T-shirt;.*soukromý nákup/);
  const est = await REC.exportCsv(env, 'ziskovost', '2026');
  assert.match(est, /^﻿ODHAD/);

  // Objednávka zapsaná už dříve v Nákupech a prodejích → nové PDF ji dá ke kontrole (dvojí započtení)
  db.prepare("INSERT INTO costs (id, category, description, amount_czk, cost_date, platform, order_ref, status) VALUES ('c1', 'dil', 'x', 50, '2026-08-01', 'aliexpress', 'D4', 'potvrzeno')").run();
  ai.orders = [{ order_ref: 'D4', order_date: '2026-08-01', start_page: 1, seller: null, currency: 'CZK', status: 'dokoncena', shipping: 0, discount: 0, refund: 0, total_paid: 50, uncertain: [], items: [{ title: 'Crown 6mm', variant: null, qty: 1, price: 50, refunded_qty: null, refund: null, purpose: 'komponent', component: 'korunka', family: null, confident: true }] }];
  const fd = new FormData(); fd.append('file', new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 9, 9])], 'temu.pdf')); fd.append('platform', 'aliexpress');
  const up2 = await REC.uploadSummary(env, fd, 'majitel');
  await REC.extractSummary(env, up2.id, { from: 1, to: 6 }, 'majitel', { client });
  assert.equal(line('Crown 6mm').status, 'ke_kontrole'); assert.match(line('Crown 6mm').check_note, /dvojí započtení/);
  // Smazání položek importu zachová původní PDF
  await assert.rejects(REC.resetImport(env, up2.id, 'ne', 'majitel'));
  assert.equal((await REC.resetImport(env, up2.id, 'SMAZAT', 'majitel')).removed, 1);
  assert.ok(db.prepare('SELECT id FROM documents WHERE id = ?').get(up2.id));
  assert.ok(calls >= 3);
});
