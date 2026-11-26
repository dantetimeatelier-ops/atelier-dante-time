// Jednotkové testy klíčové logiky. Spuštění: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { spdString, isValidIban } from '../../src/shop/spd.mjs';
import { describe, productName, productJsonLd } from '../../src/shop/describe.mjs';
import { slugify, formatCzk } from '../../src/shop/format.mjs';
import { esc } from '../../src/layout.mjs';
import { ALL_LEGAL } from '../../src/legal/docs.mjs';
import { SERVICES_OFFERED } from '../../src/site.mjs';
import { base32Encode, base32Decode, totpCode, verifyTotp, hashPassword, timingSafeEqual } from '../../server/auth.js';

test('IBAN a QR platba (SPD)', () => {
  assert.ok(isValidIban('CZ65 0800 0000 1920 0014 5399'));
  assert.ok(!isValidIban('CZ65 0800 0000 1920 0014 5398'));
  assert.equal(spdString({ iban: 'CZ6508000000192000145399', amount: 38999, vs: '260001', message: 'Objednávka 2026-0001' }),
    'SPD*1.0*ACC:CZ6508000000192000145399*AM:38999.00*CC:CZK*X-VS:260001*MSG:Objednavka 2026-0001');
  assert.throws(() => spdString({ iban: 'CZ00', amount: 1, vs: '1' }));
  assert.throws(() => spdString({ iban: 'CZ6508000000192000145399', amount: 1, vs: 'abc' }));
});

test('automatický popis nic nevymýšlí', () => {
  const d = describe({ brand: 'PRIM', model: 'Sport', year: '1968', movement_type: 'manual', original_parts: 'strojek, ciferník', authenticity_parts: 'strojek,cifernik' });
  assert.match(d.description_cs, /PRIM Sport z roku 1968/);
  assert.match(d.description_cs, /ručním nátahem/);
  assert.match(d.description_cs, /garance pravosti/);
  assert.match(d.description_cs, /nejsou určeny ke kontaktu s vodou/);
  assert.doesNotMatch(d.description_cs, /undefined|null/);
  assert.ok(d.seo_title.length <= 70 && d.seo_description.length <= 160);
  const empty = describe({ title: 'Hodinky' });
  assert.doesNotMatch(empty.description_cs, /undefined|null|false|Provedené|Stav:/i);
  const part = describe({ brand: 'PRIM', kind: 'prestavba', case_metal: 'pozlaceno', plating: '20 µm', dial: 'černý' });
  assert.doesNotMatch(part.description_cs + part.description_en, /undefined|null|false/i);
  assert.match(part.description_cs, /pozlacené – obecný kov, není z drahého kovu, 20 µm/);
  assert.match(part.description_cs, /Ateliérová přestavba Dante Time/);
  assert.equal(productName({ brand: 'Omega', model: 'Genève' }), 'Omega Genève');
});

test('strukturovaná data: prodané hodinky nemají nabídku', () => {
  const sold = productJsonLd({ id: 'a', slug: 'x', status: 'sold', price_czk: 1000, brand: 'Doxa' }, [], 'https://e.cz');
  assert.equal(sold.offers, undefined);
  const av = productJsonLd({ id: 'a', slug: 'x', status: 'available', price_czk: 1000 }, [], 'https://e.cz');
  assert.equal(av.offers.availability, 'https://schema.org/InStock');
});

test('pomocné funkce', () => {
  assert.equal(slugify('Omega Genève 1968 – Žluťoučký'), 'omega-geneve-1968-zlutoucky');
  assert.equal(esc('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  assert.equal(esc('A &amp; B & C'), 'A &amp; B &amp; C');
  assert.equal(formatCzk(38900).replace(/\s/g, ' '), '38 900 Kč');
});

test('TOTP odpovídá RFC 6238 (testovací vektor)', async () => {
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
  assert.deepEqual([...base32Decode(secret)], [...new TextEncoder().encode('12345678901234567890')]);
  // RFC 6238, čas 59 s → krok 1 → 94287082 (8 číslic) → 6 číslic 287082
  assert.equal(await totpCode(secret, 1), '287082');
  assert.equal(await totpCode(secret, 37037036), '081804');
  assert.equal(await verifyTotp(secret, '287082', 59000), 1);
  assert.equal(await verifyTotp(secret, '000000', 59000), null);
  assert.equal(await verifyTotp(secret, 'abc', 59000), null);
});

test('hesla: PBKDF2 a porovnání v konstantním čase', async () => {
  const h = await hashPassword('tajne-heslo-123');
  const again = await hashPassword('tajne-heslo-123', h.salt, h.iterations);
  const wrong = await hashPassword('jine-heslo-1234', h.salt, h.iterations);
  assert.ok(timingSafeEqual(h.hash, again.hash));
  assert.ok(!timingSafeEqual(h.hash, wrong.hash));
  assert.equal(h.iterations, 100000);
});

test('rezervace: kus nelze prodat dvakrát ani při souběhu (SQL na SQLite)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../migrations/0001_zaklad.sql', import.meta.url), 'utf8'));
  db.exec("INSERT INTO products (id, slug, status, title, price_czk) VALUES ('p1', 'p1', 'available', 'Hodinky', 1000)");
  const reserve = (orderId) => {
    // Stejná posloupnost příkazů jako v server/orders.js, provedená jako jedna transakce
    db.exec('BEGIN');
    try {
      db.prepare(`INSERT INTO orders (id, number, public_token, mode, email, name, shipping_method, payment_method, items_total, shipping_price, total, variable_symbol, terms_version, terms_accepted_at)
        VALUES (?, ?, ?, 'test', 'a@b.cz', 'A', 'osobni', 'bank_transfer', 1000, 0, 1000, '1', 'v', 'now')`).run(orderId, orderId, orderId);
      db.prepare("UPDATE products SET status='reserved', reserved_order_id=? WHERE id='p1' AND status='available'").run(orderId);
      db.prepare("INSERT INTO order_items (id, order_id, product_id, title, price_czk) VALUES (?, ?, 'p1', (SELECT title FROM products WHERE id='p1' AND status='reserved' AND reserved_order_id=?), 1000)").run(`i-${orderId}`, orderId, orderId);
      db.exec('COMMIT');
      return true;
    } catch { db.exec('ROLLBACK'); return false; }
  };
  assert.equal(reserve('A'), true);
  assert.equal(reserve('B'), false); // druhý zákazník neuspěje
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders WHERE id='B'").get().n, 0); // nic po něm nezůstalo
  assert.equal(db.prepare("SELECT reserved_order_id AS r FROM products WHERE id='p1'").get().r, 'A');
});

test('právní dokumenty: obsahují povinné náležitosti (CZ)', () => {
  const all = ALL_LEGAL.filter((d) => d.lang === 'cs').map((d) => d.body()).join('\n');
  for (const must of ['14 dnů', '24 měsíců', 'Odstoupit od smlouvy', 'adr.coi.cz', 'Úřad pro ochranu osobních údajů', '363/2013 Sb.', '§ 1837', 'každého dalšího majitele', 'identifikace hodinek', 'vrácení kupní ceny', '539/1992 Sb.', 'Pozlacen', 'dobírk', 'nemá vliv', 'strojky, ciferníky a ručičky', '±30', '30 dnů', '3 pracovních dnů', 'IBAN', 'PRIM', 'Evropské spotřebitelské centrum',
    ...(SERVICES_OFFERED ? ['20–30 %', 'Skladné se neúčtuje', 'jen po vzájemné dohodě', 'garanční prohlídk'] : [])]) {
    assert.ok(all.includes(must), `Chybí: ${must}`);
  }
  // Bez služeb se nenabízí servis ani zakázky (otevřený právní bod L1)
  if (!SERVICES_OFFERED) assert.ok(!/zakazkova-vyroba|custom-work/.test(ALL_LEGAL.map((d) => d.body()).join('')));
  assert.ok(!/ec\.europa\.eu\/consumers\/odr/.test(all)); // zrušená platforma ODR
  assert.ok(!all.includes('19/1993')); // chybné číslo puncovního zákona
});

test('právní dokumenty: anglická verze má stejné dokumenty a náležitosti', () => {
  const cs = ALL_LEGAL.filter((d) => d.lang === 'cs').map((d) => d.key).sort();
  const en = ALL_LEGAL.filter((d) => d.lang === 'en');
  assert.deepEqual(en.map((d) => d.key).sort(), cs);
  for (const d of en) assert.ok(d.path.startsWith('/en/'), d.path);
  const all = en.map((d) => d.body()).join('\n');
  for (const must of ['14 days', 'up to 24 months', 'every subsequent owner', 'movements, dials and hands', '539/1992 Coll.', '363/2013 Coll.', 'adr.coi.cz', 'Rome I', '2018/302', 'IBAN', 'Model withdrawal form']) {
    assert.ok(all.includes(must), `Missing: ${must}`);
  }
  assert.equal(new Set(ALL_LEGAL.map((d) => d.path)).size, ALL_LEGAL.length); // unikátní URL
});

test('puncovní zákon: pozlacené pouzdro bez klamavých výrazů, drahý kov jen po oznámení', async () => {
  const { misleadingWords, puncCheck } = await import('../../src/shop/punc.mjs');
  assert.deepEqual(misleadingWords({ case_metal: 'pozlaceno', dial: 'v barvě zlata', description_cs: 'Pouzdro: pozlacené – obecný kov, není z drahého kovu.', description_en: 'gold-plated base metal – not a precious metal' }), []);
  assert.deepEqual(misleadingWords({ case_metal: 'pozlaceno', dial: 'zlaté indexy' }), ['zlaté']);
  assert.ok(misleadingWords({ case_metal: 'ocel', description_en: 'Solid 18k gold case' }).includes('18k'));
  assert.deepEqual(misleadingWords({ case_metal: 'zlato', dial: 'zlatý' }), []);
  const gold = { status: 'available', case_metal: 'zlato', hallmark: 'Au 585/1000', precious_weight_g: 9.1 };
  assert.match(puncCheck(gold, { punc_notified: '0' }), /Puncovnímu úřadu/);
  assert.equal(puncCheck(gold, { punc_notified: '1' }), null);
  assert.match(puncCheck({ ...gold, precious_weight_g: null }, { punc_notified: '1' }), /hmotnost/);
  assert.equal(puncCheck({ status: 'draft', case_metal: 'pozlaceno', dial: 'zlatý' }), null); // koncept se nekontroluje
});

test('katalog hodinek: zápis do databáze, prodané kusy si stav ponechají, kontrola punc', async () => {
  const { loadCatalog, catalogSql } = await import('../../scripts/catalog.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(`${tmpdir()}/kat-`);
  const put = (slug, w) => { mkdirSync(`${dir}/${slug}`, { recursive: true }); writeFileSync(`${dir}/${slug}/hodinky.json`, JSON.stringify(w)); };
  mkdirSync(`${dir}/prim-test`); writeFileSync(`${dir}/prim-test/01-l.webp`, 'a'); writeFileSync(`${dir}/prim-test/01-s.webp`, 'b');
  put('prim-test', { status: 'available', title: "PRIM Sport – test", kind: 'original', brand: 'PRIM', case_metal: 'pozlaceno', dial: 'v barvě zlata', price_czk: 12900, fotky: [{ soubor: '01', alt: 'PRIM' }] });
  const list = loadCatalog(dir);
  assert.equal(list.length, 1);
  const db = new DatabaseSync(':memory:');
  for (const m of ['0001_zaklad', '0002_druhy_kovy_dobirka_faktury', '0003_eu_meny_garance', '0004_punc_pojisteni_eu', '0005_video_v_galerii', '0006_bankovni_ucet_na_dokladu']) db.exec(readFileSync(new URL(`../../migrations/${m}.sql`, import.meta.url), 'utf8'));
  db.exec(catalogSql(list));
  assert.equal(db.prepare("SELECT status FROM products WHERE id='kat-prim-test'").get().status, 'available');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM product_images WHERE product_id='kat-prim-test'").get().n, 1);
  db.exec("UPDATE products SET status='sold' WHERE id='kat-prim-test'");
  db.exec(catalogSql(list)); // další nasazení
  assert.equal(db.prepare("SELECT status FROM products WHERE id='kat-prim-test'").get().status, 'sold');
  // Klamavé označení u pozlaceného pouzdra zastaví nasazení
  put('prim-test', { status: 'available', title: 'PRIM zlaté', case_metal: 'pozlaceno', price_czk: 1, fotky: [{ soubor: '01' }] });
  assert.throws(() => loadCatalog(dir), /klamat/);
});

test('katalog hodinek v repozitáři je platný', async () => {
  const { loadCatalog } = await import('../../scripts/catalog.mjs');
  assert.doesNotThrow(() => loadCatalog());
});

test('otisk stylů v src/asset-version.mjs odpovídá souborům (spusťte npm run build a uložte)', async () => {
  const { computeAssetVersion } = await import('../../scripts/asset-version.mjs');
  const { ASSET_V } = await import('../../src/asset-version.mjs');
  assert.equal(ASSET_V, computeAssetVersion());
});

test('bankovní údaje: podnikatelský účet, platný IBAN odpovídá číslu účtu, QR platby', async () => {
  const { OPERATOR, docBank } = await import('../../src/site.mjs');
  const { isValidIban, spdString } = await import('../../src/shop/spd.mjs');
  const { epcString } = await import('../../src/shop/eu.mjs');
  assert.equal(OPERATOR.bankAccount, '7058919329/0800');
  assert.ok(isValidIban(OPERATOR.iban));
  // CZ IBAN = CZkk + kód banky (4) + předčíslí (6) + číslo účtu (10)
  const [num, bank] = OPERATOR.bankAccount.split('/');
  assert.equal(OPERATOR.iban.slice(4, 8), bank);
  assert.equal(OPERATOR.iban.slice(14), num.padStart(10, '0'));
  assert.equal(OPERATOR.ibanPretty, 'CZ76 0800 0000 0070 5891 9329');
  const spd = spdString({ iban: OPERATOR.iban, amount: 9099, vs: '2026000123', message: 'Objednavka 2026-0001', recipient: 'Atelier Dante Time' });
  assert.match(spd, /ACC:CZ7608000000007058919329\*AM:9099\.00\*CC:CZK\*X-VS:2026000123/);
  const epc = epcString({ bic: OPERATOR.bic, name: OPERATOR.accountHolder, iban: OPERATOR.iban, cents: 36400, reference: 'VS 2026000123 2026-0001' });
  assert.match(epc, /GIBACZPX\nPatrik Hu.i.ka\nCZ7608000000007058919329\nEUR364\.00/);
  // Starý doklad si ponechá svůj účet
  assert.equal(docBank({ bank_iban: 'CZ6308000000002854824133', bank_account: '2854824133/0800' }).account, '2854824133/0800');
  assert.equal(docBank({}).account, '7058919329/0800');
});

test('bezpečnostní hlavičky: _headers má jediný blok /* s HSTS, CSP a X-Frame-Options', async () => {
  const h = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
  assert.equal(h.match(/^\/\*$/gm).length, 1);
  for (const k of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']) assert.ok(h.includes(k), k);
});

test('garanční prohlídky: termíny 12 měsíců ±30 dnů a prodloužení záruky', async () => {
  const W = await import('../../src/shop/warranty.mjs');
  assert.equal(W.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(W.addMonths('2026-11-26', 12), '2027-11-26');
  const s = W.schedule('2026-11-26');
  assert.equal(s.due_date, '2027-11-26');
  assert.equal(s.window_from, '2027-10-27');
  assert.equal(s.window_to, '2027-12-26');
  assert.equal(s.remind_on, '2027-10-13');
  assert.equal(s.warranty_full_until, '2028-11-26');
  const row = { ...s, status: 'planovana', reminder_sent_at: null };
  assert.equal(W.phase(row, '2027-06-01'), 'planovana');
  assert.equal(W.phase(row, '2027-10-20'), 'pripomenout');
  assert.equal(W.phase(row, '2027-11-01'), 'v_okne');
  assert.equal(W.phase(row, '2027-12-27'), 'zmeskana');
  assert.equal(W.warrantyUntilAfter(row, '2027-11-20'), '2028-11-26');      // v termínu → 24 měsíců
  assert.equal(W.warrantyUntilAfter(row, '2028-01-15'), '2027-11-26');      // po termínu → jen 12 měsíců
  assert.equal(W.inspectionApplies('1.1'), true);
  assert.equal(W.inspectionApplies('1.0'), false);                          // ne zpětně
  assert.equal(W.inspectionApplies('2026-12-navrh-3'), false);
});

test('právní dokumenty: žádná nevyplněná proměnná ${…} v textu', () => {
  for (const d of ALL_LEGAL) assert.ok(!/\$\{/.test(d.body()), `${d.path} obsahuje nevyplněnou proměnnou`);
});

test('ekonomika: nákupní ceny a náklady nejsou ve veřejných tabulkách', () => {
  const m = readFileSync(new URL('../../migrations/0009_ekonomika.sql', import.meta.url), 'utf8');
  assert.ok(!/ALTER TABLE products/i.test(m), 'interní ekonomické údaje nesmí být ve sloupcích tabulky products (veřejný web ji čte)');
});

test('digitální pas: kód bez zaměnitelných znaků, zkrácené výrobní číslo, žádné osobní údaje v tabulce', async () => {
  const { newCode, maskSerial, publicBody } = await import('../../server/passport.js');
  const codes = new Set(Array.from({ length: 500 }, () => newCode()));
  assert.equal(codes.size, 500);
  for (const c of codes) assert.match(c, /^[2-9A-HJKMNP-Z]{12}$/);
  assert.equal(maskSerial('AB 123 4567'), '••••4567');
  assert.equal(maskSerial('12'), '••••');
  assert.equal(maskSerial(null), '');
  const m = readFileSync(new URL('../../migrations/0010_pas_hodinek.sql', import.meta.url), 'utf8');
  assert.ok(!/customer|email|name\b|price/i.test(m.replace(/--.*$/gm, '')), 'pas nesmí ukládat zákazníka ani cenu');
  const html = publicBody({ p: { code: 'ABCDEFGHJKMN', title: 'PRIM <test>', status: 'platny', issued_on: '2026-11-26', serial_ref: 'X99887766', authenticity_parts: 'strojek,cifernik' }, events: [] }, 'cs');
  assert.ok(html.includes('&lt;test&gt;') && !html.includes('X99887766') && html.includes('••••7766') && html.includes('strojek, ciferník'));
});
