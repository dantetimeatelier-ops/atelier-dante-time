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
  const d = describe({ brand: 'PRIM', model: 'Sport', year: '1968', movement_type: 'manual', original_parts: 'strojek, ciferník' });
  assert.match(d.description_cs, /PRIM Sport z roku 1968/);
  assert.match(d.description_cs, /ručním nátahem/);
  assert.match(d.description_cs, /garance pravosti/);
  assert.match(d.description_cs, /nejsou určeny ke kontaktu s vodou/);
  assert.doesNotMatch(d.description_cs, /undefined|null/);
  assert.ok(d.seo_title.length <= 70 && d.seo_description.length <= 160);
  const empty = describe({ title: 'Hodinky' });
  assert.doesNotMatch(empty.description_cs, /undefined|null|Provedené|Stav:/);
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

test('právní dokumenty: obsahují povinné náležitosti', () => {
  const all = ALL_LEGAL.map((d) => d.body()).join('\n');
  for (const must of ['14 dnů', '24 měsíců', 'Odstoupit od smlouvy', 'adr.coi.cz', 'Úřad pro ochranu osobních údajů', 'nařízení vlády č. 363/2013 Sb.', '§ 1837', 'garanc', 'Objednávka zavazující k platbě', '§ 89 odst. 3']) {
    assert.ok(all.includes(must), `Chybí: ${must}`);
  }
  // Zrušená evropská platforma ODR se už nesmí uvádět
  assert.ok(!/ec\.europa\.eu\/consumers\/odr/.test(all));
});
