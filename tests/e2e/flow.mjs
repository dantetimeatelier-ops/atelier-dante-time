// Celý obchodní proces v prohlížeči (mobil iPhone):
// první nastavení administrace → přidání hodinek s fotkou → zveřejnění →
// nákup zákazníkem → platba → faktura → odstoupení od smlouvy.
// Spuštění: BASE=http://localhost:8788 SETUP_TOKEN=… node tests/e2e/flow.mjs
import { chromium, devices } from 'playwright';
import { createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
const TOKEN = process.env.SETUP_TOKEN;
const SHOTS = process.env.SHOTS;
// Heslo testovacího účtu se generuje při každém běhu (v kódu žádné heslo není)
const PASS = randomBytes(18).toString('base64url');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32dec = (s) => { let bits = 0; let v = 0; const out = []; for (const c of s) { v = (v << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, offset = 0) => { const step = Math.floor(Date.now() / 30000) + offset; const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0); msg.writeUInt32BE(step >>> 0, 4); const h = createHmac('sha1', b32dec(secret)).update(msg).digest(); const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); };
const step = (msg) => console.log(`✓ ${msg}`);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-${name}.png`, fullPage: true }); };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => d.accept());

try {
  // 1) První nastavení administrace
  await page.goto(`${BASE}/admin/`);
  await page.getByLabel('Instalační kód').fill(TOKEN);
  await page.getByLabel('Váš e-mail').fill('majitel@example.com');
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  const secret = (await page.locator('.code').textContent()).trim();
  await shot(page, '1-2fa');
  await page.getByLabel('Heslo').fill(PASS);
  await page.getByLabel('Ověřovací kód').fill(totp(secret));
  await page.getByRole('button', { name: 'Dokončit' }).click();
  await page.getByRole('heading', { name: 'Přehled' }).waitFor();
  step('první nastavení administrace s dvoufázovým ověřením');

  // Přihlášení se špatným kódem musí selhat
  const bad = await page.evaluate(async (pw) => (await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'majitel@example.com', password: pw, code: '000000' }) })).status, PASS);
  assert.equal(bad, 401); step('přihlášení se špatným kódem odmítnuto');

  // 2) Nastavení dopravy
  await page.goto(`${BASE}/admin/#/nastaveni`);
  await page.getByLabel(/Zásilkovna – cena/).fill('99');
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await page.locator('.toast', { hasText: 'Uloženo' }).waitFor();
  step('nastavena cena dopravy');

  // 3) Přidání hodinek s fotografií
  await page.goto(`${BASE}/admin/#/`);
  await page.getByRole('link', { name: '+ Přidat hodinky' }).click();
  await page.locator('#files').setInputFiles(path.join(ROOT, 'assets/originals/service-watch-box-2.jpg'));
  await page.locator('.photo img').first().waitFor({ timeout: 20000 });
  step('fotografie zmenšena v telefonu a nahrána');
  await page.getByLabel('Značka', { exact: true }).fill('Omega');
  await page.getByLabel('Model', { exact: true }).fill('Genève');
  await page.getByLabel('Rok výroby').fill('1968');
  await page.getByLabel('Cena (Kč)').fill('38900');
  await page.locator('summary', { hasText: 'Strojek a pouzdro' }).click();
  await page.getByLabel('Strojek (kalibr)').fill('Omega cal. 601');
  await page.getByLabel('Nátah').selectOption('manual');
  await page.getByLabel('Průměr pouzdra (mm)').fill('34');
  await page.locator('summary', { hasText: 'Stav, práce a originalita' }).click();
  await page.getByLabel('Původní originální součásti (popis)').fill('strojek, ciferník, ručky, korunka');
  await page.getByRole('checkbox', { name: 'Strojek', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Ciferník', exact: true }).check();
  await page.locator('summary', { hasText: 'Popis a SEO' }).click();
  await page.getByRole('button', { name: /Vygenerovat popis/ }).click();
  await page.locator('.toast', { hasText: 'Popis vygenerován' }).waitFor();
  const desc = await page.getByLabel('Popis (česky)').inputValue();
  assert.match(desc, /Omega Genève z roku 1968/); assert.match(desc, /garance pravosti/);
  step('popis a SEO vygenerovány z parametrů');
  // Pojistka: zlaté pouzdro bez puncu nelze zveřejnit
  await page.locator('summary', { hasText: 'Pouzdro a punc' }).click();
  await page.locator('select[name=case_metal]').selectOption('zlato');
  await page.getByLabel('Stav v e-shopu').selectOption('available');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.locator('.toast.err', { hasText: 'puncovní značku' }).waitFor();
  step('zlaté pouzdro bez puncu zveřejnit nelze');
  await page.getByLabel(/Ryzost a punc/).fill('Au 585/1000, česká puncovní značka');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.locator('.toast.err', { hasText: 'hmotnost' }).waitFor();
  await page.getByLabel(/Hmotnost drahého kovu/).fill('9.4');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.locator('.toast.err', { hasText: 'Puncovnímu úřadu' }).waitFor();
  step('drahý kov jen s hmotností a po oznámení Puncovnímu úřadu');
  // Skutečný sortiment: pozlacené pouzdro – bez klamavých výrazů (puncovní zákon § 40)
  await page.locator('select[name=case_metal]').selectOption('pozlaceno');
  await page.evaluate(() => document.querySelectorAll('#pf details').forEach((d) => { d.open = true; }));
  await page.locator('input[name=dial]').fill('zlaté indexy');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.locator('.toast.err', { hasText: 'může klamat' }).waitFor();
  await page.locator('input[name=dial]').fill('champagne, indexy v barvě zlata');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.getByRole('link', { name: /Zobrazit na webu/ }).waitFor();
  step('pozlacené pouzdro: klamavé označení zachyceno, správné projde');
  await shot(page, '2-editor');
  step('hodinky zveřejněny');

  // 4) Zákazník: kolekce → detail → košík → objednávka
  const shop = await ctx.newPage();
  shop.on('pageerror', (e) => errors.push(e.message));
  await shop.goto(`${BASE}/kolekce`);
  await shop.locator('a.product-card[href="/hodinky/omega-geneve-1968"]').click();
  await shop.waitForLoadState('load'); // skripty stránky (defer) musí být načtené, jinak tlačítko ještě nereaguje
  await shop.getByRole('button', { name: 'Vložit do košíku' }).click();
  await shop.getByRole('heading', { name: 'Košík' }).waitFor();
  await shop.locator('[data-cart-items] .cart-item').waitFor();
  await shop.getByLabel('Výdejní místo (název a adresa)').fill('Z-BOX Praha 7, Dukelských hrdinů 1');
  await shop.getByLabel('Jméno a příjmení').fill('Jana Testovací');
  await shop.getByLabel('E-mail').fill('jana@example.com');
  await shop.getByLabel(/Telefon/).fill('+420 600 000 000');
  await shop.getByLabel('Ulice a číslo').fill('Testovací 5');
  await shop.getByLabel('Město').fill('Praha');
  await shop.getByLabel('PSČ').fill('17000');
  await shop.locator('input[name=terms]').check();
  assert.equal(await shop.getByRole('button', { name: 'Vybrat výdejní místo' }).isVisible(), false);
  await shot(shop, '3-kosik');
  await shop.getByRole('button', { name: 'Objednávka zavazující k platbě' }).click();
  await shop.waitForURL(/\/objednavka\//);
  assert.ok(await shop.getByText('Jana Testovací').count() === 0); // osobní údaje se na stránce nezobrazují
  await shop.getByRole('heading', { name: 'Čeká na platbu' }).waitFor();
  assert.ok(await shop.locator('svg').count() >= 1);
  await shot(shop, '4-objednavka');
  step('objednávka vytvořena, zobrazena QR platba');

  // Hodinky jsou rezervované – druhý zákazník je koupit nemůže
  const again = await shop.evaluate(async () => {
    const r = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: JSON.parse(localStorage.getItem('dt_cart') || '[]').concat([]) }) });
    return r.status;
  });
  assert.equal(again, 200);
  const status = await shop.evaluate(async () => (await fetch('/api/products?limit=5')).json());
  assert.match(status.html, /Rezervováno/); step('kus je po objednávce rezervován');

  // 5) Majitel: platba přijata → faktura
  await page.goto(`${BASE}/admin/#/objednavky`);
  await page.locator('.item', { hasText: 'Jana Testovací' }).click();
  await page.getByRole('button', { name: /Platba přijata/ }).click();
  await page.locator('.chip.paid').waitFor();
  step('platba označena, hodinky prodány');
  const inv = await page.locator('a', { hasText: /^\d{8}$/ }).getAttribute('href');
  const invPage = await ctx.newPage();
  await invPage.goto(`${BASE}${inv}`);
  await invPage.getByText('Uhrazeno – neplaťte.').waitFor();
  await shot(invPage, '5-faktura');
  step('faktura vystavena');
  await page.getByLabel(/Číslo zásilky/).fill('Z1234567890');
  await page.getByRole('button', { name: /Odesláno/ }).click();
  await page.locator('.chip.shipped').waitFor();
  step('odeslání označeno');
  const orderUrl = page.url();

  // 5b) Převzetí zákazníkem → garanční prohlídka vznikne automaticky (podmínky 1.1) a jde zapsat protokol
  await page.getByRole('button', { name: /Převzato zákazníkem/ }).click();
  await page.locator('.chip.completed').waitFor();
  await page.goto(`${BASE}/admin/#/prohlidky`);
  await page.locator('.list a.item').first().click();
  await page.getByText('Termín prohlídky').waitFor();
  await page.getByLabel(/Odchylka chodu/).fill('+4');
  await page.getByLabel(/Amplituda/).fill('285');
  await page.getByRole('button', { name: /Uložit protokol/ }).click();
  await page.getByText('Provedeno', { exact: true }).waitFor();
  await page.getByText('Zákonná práva do').waitFor();
  step('převzetí zapsáno, garanční prohlídka založena a zapsán protokol');
  // 5c) Digitální pas: vznikl sám při převzetí, má záznam o předání a prohlídce, veřejná stránka bez zákazníka
  await page.goto(`${BASE}/admin/#/pasy`);
  await page.locator('.list a.item').first().click();
  await page.getByText('Předání majiteli', { exact: false }).first().waitFor();
  await page.getByText('Garanční prohlídka', { exact: false }).first().waitFor();
  const pasUrl = await page.getByRole('link', { name: 'Otevřít pas ↗' }).getAttribute('href');
  const pasPath = new URL(pasUrl).pathname;
  const pas = await page.context().newPage();
  const pr = await pas.goto(`${BASE}${pasPath}`);
  assert.equal(pr.status(), 200);
  await pas.getByText('Pas je platný').waitFor();
  await pas.getByText('Historie hodinek').waitFor();
  const pasHtml = await pas.content();
  assert.ok(!/Jana Testovací|jana@example|Testovací 5|600 000 000/.test(pasHtml), 'pas nesmí obsahovat zákazníka ani cenu');
  assert.equal((await pas.goto(`${BASE}/pas/ABCDEFGHJKMN`)).status(), 404);
  await pas.close();
  const cert = await page.evaluate(async (u) => (await fetch(u)).text(), `${BASE}/api/admin/passports/${page.url().split('/').pop()}/certificate`);
  assert.match(cert, /Certifikát pravosti/);
  step('digitální pas: založen při převzetí, historie, veřejné ověření bez osobních údajů, certifikát');
  await page.goto(orderUrl);

  // 6) Online odstoupení od smlouvy (dva kroky)
  const orderNumber = (await page.locator('h1').textContent()).trim();
  await shop.goto(`${BASE}/odstoupeni`);
  await shop.getByLabel('Jméno a příjmení').fill('Jana Testovací');
  await shop.getByLabel(/E-mail použitý/).fill('jana@example.com');
  await shop.getByLabel('Číslo objednávky').fill(orderNumber);
  await shop.getByRole('button', { name: 'Odstoupit od smlouvy' }).click();
  await shop.getByRole('button', { name: 'Potvrdit odstoupení od smlouvy' }).click();
  await shop.getByText(/Odstoupení od smlouvy jsme přijali/).waitFor();
  step('odstoupení od smlouvy přijato a potvrzeno');

  // 7) E-maily uloženy (bez poskytovatele se neodesílají)
  await page.goto(`${BASE}/admin/#/emaily`);
  await page.getByText('Potvrzení objednávky').first().waitFor();
  await page.getByText('Potvrzení přijetí odstoupení').first().waitFor();
  step('e-maily (potvrzení, platba, odeslání, odstoupení) připraveny');

  // 8) Poptávka z webu
  await shop.goto(`${BASE}/kontakt`);
  await shop.getByLabel('Jméno').fill('Petr Poptávka');
  await shop.getByLabel('E-mail').fill('petr@example.com');
  await shop.getByLabel('Zpráva').fill('Mám zájem o hodinky PRIM z kolekce.');
  await shop.getByRole('button', { name: 'Odeslat poptávku' }).click();
  await shop.getByText(/poptávka byla odeslána/).waitFor();
  await page.goto(`${BASE}/admin/#/poptavky`);
  await page.getByText('Petr Poptávka').waitFor();
  await page.getByRole('link', { name: '→ Zakázka' }).first().click();
  await page.getByRole('button', { name: 'Uložit' }).click();
  await page.getByText(/^Z-\d{4}-\d{3}$/).waitFor();
  step('poptávka převedena na zakázku');

  // 9) Dobírka + výběr Balíkovny (okno České pošty nahrazeno testovací stránkou)
  await page.goto(`${BASE}/admin/#/nastaveni`);
  await page.getByLabel(/Balíkovna – cena/).fill('89');
  await page.getByLabel('Nabízet platbu dobírkou').check();
  await page.getByLabel(/Příplatek za dobírku/).fill('40');
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await page.locator('.toast', { hasText: 'Uloženo' }).waitFor();
  await page.goto(`${BASE}/admin/#/hodinky/nove`);
  await page.getByLabel('Značka', { exact: true }).waitFor();
  await page.getByLabel('Značka', { exact: true }).fill('PRIM');
  await page.getByLabel('Model', { exact: true }).fill('Sport');
  await page.getByLabel('Cena (Kč)').fill('12900');
  await page.getByLabel('Druh hodinek').selectOption('prestavba');
  await page.getByLabel('Stav v e-shopu').selectOption('available');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.getByRole('link', { name: /Zobrazit na webu/ }).waitFor();
  await ctx.route('https://b2c.cpost.cz/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body><script>
    parent.postMessage({ message: 'pickerResult', point: { id: 'B12345', name: 'Balíkovna Praha 7', street: 'Dukelských hrdinů 1', zip: '17000', municipality_name: 'Praha' } }, '*');
  </script></body></html>` }));
  await shop.goto(`${BASE}/kolekce`);
  await shop.locator('a.product-card[href="/hodinky/prim-sport"]').click();
  await shop.waitForLoadState('load');
  await shop.getByRole('button', { name: 'Vložit do košíku' }).click();
  await shop.locator('[data-cart-items] .cart-item').waitFor();
  await shop.getByLabel(/Balíkovna – výdejní místo/).check();
  await shop.getByRole('button', { name: 'Vybrat Balíkovnu na mapě' }).click();
  await shop.getByText('Balíkovna Praha 7, Dukelských hrdinů 1, 17000 Praha').waitFor();
  await shop.getByLabel(/Dobírka/).check();
  await shop.getByText('13 029 Kč').waitFor(); // 12 900 + 89 + 40
  for (const [l, v] of [['Jméno a příjmení', 'Karel Dobírka'], ['E-mail', 'karel@example.com'], [/Telefon/, '+420 600 000 002'], ['Ulice a číslo', 'Testovací 9'], ['Město', 'Praha'], ['PSČ', '17000']]) await shop.getByLabel(l).fill(v);
  await shop.locator('input[name=terms]').check();
  await shop.getByRole('button', { name: 'Objednávka zavazující k platbě' }).click();
  await shop.waitForURL(/\/objednavka\//);
  await shop.getByText(/Platíte dobírkou při převzetí/).waitFor();
  step('dobírka s výběrem Balíkovny na mapě');
  await page.goto(`${BASE}/admin/#/objednavky`);
  await page.locator('.item', { hasText: 'Karel Dobírka' }).click();
  await page.getByRole('button', { name: /Odesláno na dobírku/ }).click();
  await page.locator('.chip.shipped').waitFor();
  await page.getByRole('button', { name: /Dobírka zaplacena/ }).click();
  await page.locator('.chip.completed').waitFor();
  await page.locator('a', { hasText: /^\d{8}$/ }).waitFor();
  step('dobírka: odesláno → zaplaceno → faktura');

  // 10) Faktura k zakázce z administrace
  await page.goto(`${BASE}/admin/#/zakazky`);
  await page.locator('.item').first().click();
  await page.getByRole('link', { name: 'Vystavit fakturu' }).click();
  await page.locator('#lines [name=price]').first().fill('1800');
  await page.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await page.getByRole('heading', { name: 'Faktury' }).waitFor();
  await page.locator('.item', { hasText: 'Petr Poptávka' }).waitFor();
  step('faktura k zakázce vystavena z administrace');

  // 11) Výměna klíče dvoufázového ověření
  await page.goto(`${BASE}/admin/#/zabezpeceni`);
  await page.getByRole('button', { name: 'Vytvořit nový klíč' }).click();
  await page.locator('#tbox summary').click();
  const newSecret = (await page.locator('#tbox .code').innerText()).trim();
  await page.getByLabel('Heslo').fill(PASS);
  await page.getByLabel('Nový ověřovací kód').fill(totp(newSecret, 1));
  await page.getByRole('button', { name: 'Potvrdit výměnu' }).click();
  await page.locator('.toast', { hasText: 'Klíč vyměněn' }).waitFor();
  step('klíč dvoufázového ověření vyměněn');

  // Ekonomika (E2): nákupní cena u hodinek, marže, přehled a export pro účetní
  await page.goto(`${BASE}/admin/#/hodinky`);
  await page.locator('.list a.item').first().click();
  await page.getByRole('link', { name: 'Náklady a marže' }).click();
  await page.getByText('Interní údaje').waitFor();
  await page.getByLabel('Popis').fill('Nákup hodinek – test');
  await page.getByLabel('Částka (Kč)').fill('3000');
  await page.locator('#cf input[name=file]').setInputFiles(path.join(ROOT, 'assets/originals/service-watch-box-2.jpg'));
  await page.getByRole('button', { name: 'Přidat náklad' }).click();
  await page.locator('.toast', { hasText: 'Přidáno i s dokladem' }).waitFor();
  await page.getByText('Nákup hodinek – test').waitFor();
  // Doklad u nákladu: uložen, jde otevřít jen po přihlášení
  await page.goto(`${BASE}/admin/#/doklady`);
  await page.getByRole('heading', { name: 'Nákupy a prodeje' }).waitFor();
  const docLink = page.locator('.item', { hasText: 'Nákup hodinek – test' }).getByRole('link', { name: 'doklad' });
  const docHref = await docLink.getAttribute('href');
  const docRes = await page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, t: r.headers.get('content-type'), n: (await r.arrayBuffer()).byteLength }; }, `${BASE}${docHref}`);
  assert.equal(docRes.s, 200); assert.match(docRes.t, /^image\//); assert.ok(docRes.n > 1000);
  assert.equal((await fetch(`${BASE}${docHref}`)).status, 401, 'doklad nesmí být dostupný bez přihlášení');
  step('doklad: nahrán s nákladem, chráněn přihlášením');

  // Nákup ze screenshotu (bez AI): nahrát → ke kontrole → doplnit EUR s kurzem → naskladnit jako díl
  await page.locator('#up-nakup').setInputFiles(path.join(ROOT, 'assets/originals/service-watch-box-2.jpg'));
  await page.getByRole('heading', { name: /Ke kontrole/ }).waitFor();
  const pf = page.locator('form.pform[data-id]:not([data-id=""])').first();
  await pf.getByLabel('Co jste koupil').fill('Strojek PRIM 66 – eBay test');
  await pf.getByLabel('Platforma').selectOption('ebay');
  await pf.getByLabel('Měna').selectOption('EUR');
  await pf.getByLabel('Zaplaceno v měně (vč. dopravy)').fill('100');
  await pf.getByLabel('Kurz ČNB (Kč)').fill('25');
  assert.equal(await pf.getByLabel('Částka v Kč').inputValue(), '2500');
  await pf.locator('select[name=category]').selectOption('dil');
  await pf.locator('select[name=target]').selectOption('sklad');
  await pf.locator('select[name=part_kind]').selectOption('strojek');
  await pf.getByRole('button', { name: 'Potvrdit' }).click();
  await page.locator('.item', { hasText: 'Strojek PRIM 66 – eBay test' }).getByText('sklad dílů').waitFor();
  // Stejný soubor podruhé → rozpoznán jako duplicita
  await page.locator('#up-nakup').setInputFiles(path.join(ROOT, 'assets/originals/service-watch-box-2.jpg'));
  await page.getByText('už nahráno dříve, přeskočeno').waitFor();
  await page.goto(`${BASE}/admin/#/dily`);
  await page.getByText('Strojek PRIM 66 – eBay test').waitFor();
  step('nákup ze screenshotu: kontrola, kurz EUR, naskladnění dílu, duplicita odhalena');

  // Prodej mimo systém (např. historická faktura) → tržby a export pro účetní; duplicitní číslo odmítnuto
  await page.goto(`${BASE}/admin/#/doklady`);
  await page.getByText('Zadat prodej ručně').click();
  const sf = page.locator('form.sform[data-id=""]');
  await sf.getByLabel('Číslo faktury').fill('2026-IMPORT-1');
  await sf.getByLabel('Co bylo prodáno').fill('PRIM Orlík – historická faktura');
  await sf.getByLabel('Zaplaceno v měně (vč. dopravy)').fill('15000');
  await sf.getByLabel('Zákazník', { exact: true }).fill('Testovací Zákazník');
  await sf.getByRole('button', { name: 'Uložit prodej' }).click();
  await page.locator('.item', { hasText: '2026-IMPORT-1' }).waitFor();
  const dupSale = await page.evaluate(async () => (await fetch('/api/admin/sales', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DT-Admin': '1' }, body: JSON.stringify({ number: '2026-IMPORT-1', items: 'x', amount_orig: 1 }) })).status);
  assert.equal(dupSale, 409);
  const fcsv = await page.evaluate(async (b) => (await fetch(`${b}/api/admin/finance/export?kind=faktury&from=2000-01-01&to=2100-01-01`)).text(), BASE);
  assert.match(fcsv, /2026-IMPORT-1;.*15000/);
  step('prodej mimo systém: uložen, v exportu pro účetní, duplicitní číslo odmítnuto');
  await page.goto(`${BASE}/admin/#/ekonomika`);
  await page.getByText('Marže hodinek').waitFor();
  await page.locator('a.item', { hasText: 'marže' }).first().waitFor();
  const csv = await page.evaluate(async (b) => (await fetch(`${b}/api/admin/finance/export?kind=naklady&from=2000-01-01&to=2100-01-01`)).text(), BASE);
  assert.match(csv, /Nákup hodinek – test/);
  step('ekonomika: náklad zapsán, marže spočítána, export pro účetní');

  // Dante Time OS: přehled rolí, Guardian, záloha
  await page.goto(`${BASE}/admin/#/system`);
  await page.getByRole('button', { name: 'Spustit kontroly teď' }).click();
  await page.getByText('DT Guardian – otevřené nálezy').waitFor();
  await page.getByText('guardian · záloha').first().waitFor();
  await page.getByText('guardian · kontrola').first().waitFor();
  step('Dante Time OS: kontroly DT Guardian a záloha databáze proběhly');

  assert.deepEqual(errors, [], `Chyby v prohlížeči: ${errors.join(' | ')}`);
  console.log('\n✅ Celý proces funguje.');
} catch (e) {
  console.error('❌', e.message);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-chyba.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
