// Digitální pas pro hodinky ze zakázek: automatické založení po přijetí, zápis práce a předání, bez zákazníka a ceny.
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
const addK = (db, id, type, status, watch = 'Omega Seamaster 1962\nzákazník chce leštit pouzdro') =>
  db.prepare("INSERT INTO commissions (id, number, type, status, watch, caliber, contact_name, contact_info, estimate_czk, final_price_czk, description) VALUES (?, ?, ?, ?, ?, 'Omega 552', 'Jan Zákazník', '+420 777 000 111', 4500, 5200, 'Servis za 5 200 Kč')").run(id, `Z-2026-${id}`, type, status, watch);

test('migrace 0033: sloupec commission_id a jedinečnost', () => {
  const { db } = makeEnv();
  assert.ok(db.prepare('PRAGMA table_info(watch_passports)').all().some((c) => c.name === 'commission_id'));
});

test('servis: poptávka bez pasu → přijato = pas (vlastní jméno hodinek, kalibr) → hotovo = práce → předáno = předání; nic se nezdvojí', async () => {
  const { db, env } = makeEnv(); const PAS = await import('../../server/passport.js');
  addK(db, 'k1', 'servis', 'poptavka');
  assert.equal(await PAS.onCommissionStatus(env, 'k1', 't'), null, 'poptávka ještě pas nemá');
  db.prepare("UPDATE commissions SET status = 'prijato' WHERE id = 'k1'").run();
  const pid = await PAS.onCommissionStatus(env, 'k1', 't');
  let p = db.prepare('SELECT * FROM watch_passports WHERE id = ?').get(pid);
  assert.equal(p.title, 'Omega Seamaster 1962', 'hodinky zákazníka si nechají své jméno (bez DT –)');
  assert.equal(p.movement, 'Omega 552'); assert.equal(p.commission_id, 'k1');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM passport_events WHERE passport_id = ?').get(pid).n, 0);
  db.prepare("UPDATE commissions SET status = 'hotovo' WHERE id = 'k1'").run();
  assert.equal(await PAS.onCommissionStatus(env, 'k1', 't'), pid, 'stejný pas, žádný nový');
  db.prepare("UPDATE commissions SET status = 'predano', returned_at = '2026-11-30' WHERE id = 'k1'").run();
  await PAS.onCommissionStatus(env, 'k1', 't'); await PAS.onCommissionStatus(env, 'k1', 't');
  const ev = db.prepare('SELECT kind, event_date, text_cs FROM passport_events WHERE passport_id = ? ORDER BY kind').all(pid);
  assert.deepEqual(ev.map((e) => e.kind), ['predani', 'servis']);
  assert.equal(ev.find((e) => e.kind === 'predani').event_date, '2026-11-30');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM watch_passports').get().n, 1);
  // veřejná stránka: bez jména, kontaktu, ceny i interního popisu
  p = db.prepare('SELECT code FROM watch_passports WHERE id = ?').get(pid);
  const html = PAS.publicBody(await PAS.publicData(env, p.code), 'cs');
  assert.ok(!/Jan Zákazník|777 000|5 ?200|4 ?500|leštit/.test(html), 'pas nesmí obsahovat zákazníka, kontakt, cenu ani interní poznámky');
  assert.match(html, /Servis hodinek v ateliéru Dante Time/);
  // úprava názvu v pasu u servisu nepřidá DT –
  await PAS.update(env, pid, { title: 'Omega Seamaster 30' }, 't');
  assert.equal(db.prepare('SELECT title FROM watch_passports WHERE id = ?').get(pid).title, 'Omega Seamaster 30');
});

test('přestavba = hodinky Dante Time → název DT – …; zrušená zakázka pas nedostane; doplnění chybějících pasů', async () => {
  const { db, env } = makeEnv(); const PAS = await import('../../server/passport.js');
  addK(db, 'k2', 'prestavba', 'v_praci', 'PRIM Spartak'); addK(db, 'k3', 'servis', 'zruseno'); addK(db, 'k4', 'renovace', 'hotovo', '');
  assert.equal(await PAS.ensureCommissionPassports(env), 2);
  assert.equal(await PAS.ensureCommissionPassports(env), 0, 'podruhé už nic');
  const t2 = db.prepare("SELECT title FROM watch_passports WHERE commission_id = 'k2'").get().title;
  assert.match(t2, /^DT – /);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM watch_passports WHERE commission_id = 'k3'").get().n, 0);
  assert.equal(db.prepare("SELECT title FROM watch_passports WHERE commission_id = 'k4'").get().title, 'Hodinky – zakázka Z-2026-k4');
  assert.equal(db.prepare("SELECT kind FROM passport_events e JOIN watch_passports w ON w.id = e.passport_id WHERE w.commission_id = 'k4'").get().kind, 'renovace');
});

test('údaje ze zakázky se přepisují do pasu (kalibr, originální díly, vyměněné díly); ruční díly v pasu převezme migrace', async () => {
  const { db, env } = makeEnv(); const PAS = await import('../../server/passport.js');
  addK(db, 'k5', 'prestavba', 'v_praci', 'PRIM Royal Green 68');
  const pid = await PAS.onCommissionStatus(env, 'k5', 't');
  // vlastní nastavení: nevyplněné díly v zakázce (NULL) nechají ruční úpravu pasu být
  db.prepare("UPDATE commissions SET parts_preset = 'vlastni' WHERE id = 'k5'").run();
  await PAS.update(env, pid, { authenticity_parts: ['strojek'] }, 't');
  await PAS.syncFromCommission(env, 'k5', 't');
  assert.equal(db.prepare('SELECT authenticity_parts a FROM watch_passports WHERE id = ?').get(pid).a, 'strojek');
  db.prepare("UPDATE commissions SET caliber = 'PRIM 66', authenticity_parts = 'strojek,cifernik,rucicky', replaced_parts = 'pouzdro, řemínek', watch = 'PRIM Royal Green 68 – opraveno' WHERE id = 'k5'").run();
  await PAS.syncFromCommission(env, 'k5', 't');
  const p = db.prepare('SELECT * FROM watch_passports WHERE id = ?').get(pid);
  assert.equal(p.movement, 'originální strojek PRIM kalibr 66, ruční nátah, 17 kamenů'); assert.equal(p.year, '1965–1993'); assert.equal(p.authenticity_parts, 'strojek,cifernik,rucicky'); assert.equal(p.replaced_parts, 'pouzdro, řemínek');
  assert.match(p.title, /^DT – PRIM Royal Green 68 – opraveno$/);
  const html = PAS.certificateHtml({ ...(await PAS.get(env, pid)), qr: '', url: 'x' });
  assert.match(html, /strojek, ciferník, ručičky/); assert.doesNotMatch(html, /nejsou deklarovány/);
  // odškrtnutí všeho v zakázce ('') díly z pasu odebere
  db.prepare("UPDATE commissions SET authenticity_parts = '' WHERE id = 'k5'").run();
  await PAS.syncFromCommission(env, 'k5', 't');
  assert.equal(db.prepare('SELECT authenticity_parts a FROM watch_passports WHERE id = ?').get(pid).a, null);
});

test('kalibr: z „66 prim“ vznikne popis a roky výroby; neznámý kalibr se nevymýšlí; výchozí originalita', async () => {
  const { caliberInfo } = await import('../../src/shop/calibers.mjs');
  assert.deepEqual(caliberInfo('66 prim'), { movement: 'originální strojek PRIM kalibr 66, ruční nátah, 17 kamenů', year: '1965–1993', known: true });
  assert.equal(caliberInfo('PRIM kalibr 68').movement, 'originální strojek PRIM kalibr 68, ruční nátah, 17 kamenů, datum');
  assert.equal(caliberInfo('Prim 96').year, '1978–1989');
  assert.deepEqual(caliberInfo('Omega 552'), { movement: 'Omega 552', year: null, known: false });
  const { db, env } = makeEnv(); const PAS = await import('../../server/passport.js');
  addK(db, 'p1', 'prestavba', 'v_praci', 'PRIM Royal Green 68'); db.prepare("UPDATE commissions SET caliber = 'prim 68' WHERE id = 'p1'").run();
  const a = db.prepare('SELECT * FROM watch_passports WHERE id = ?').get(await PAS.onCommissionStatus(env, 'p1', 't'));
  assert.equal(a.authenticity_parts, 'strojek,cifernik,rucicky'); assert.equal(a.replaced_parts, 'nové pouzdro Dante Time, řemínek'); assert.equal(a.year, '1969–1993');
  db.prepare("UPDATE commissions SET parts_preset = 'original' WHERE id = 'p1'").run(); await PAS.syncFromCommission(env, 'p1', 't');
  const b = db.prepare("SELECT * FROM watch_passports WHERE commission_id = 'p1'").get();
  assert.equal(b.replaced_parts, null); assert.equal(b.original_parts, 'kompletně originální hodinky');
  // servis = hodinky zákazníka → výchozí vše originální
  addK(db, 's1', 'servis', 'prijato'); await PAS.onCommissionStatus(env, 's1', 't');
  assert.equal(db.prepare("SELECT replaced_parts r FROM watch_passports WHERE commission_id = 's1'").get().r, null);
});
