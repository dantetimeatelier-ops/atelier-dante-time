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

  // 2) Nastavení dopravy (administrace → Dopravci)
  await page.goto(`${BASE}/admin/#/dopravci/zasilkovna`);
  await page.getByRole('heading', { name: /Zásilkovna/ }).first().waitFor();
  await page.getByLabel('Česko – cena').fill('99');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
  await page.locator('.toast', { hasText: 'Uloženo' }).waitFor();
  // Pojištění na plnou hodnotu: dražší kus než limit Zásilkovny (20 000 Kč) jde jen Cennou zásilkou – majitel ji zapne
  await page.goto(`${BASE}/admin/#/dopravci/pojistena`);
  await page.getByRole('heading', { name: /Cenná zásilka/ }).waitFor(); // počkat, až se místo Zásilkovny vykreslí editor Cenné zásilky
  await page.getByLabel('Stav').selectOption('aktivni');
  await page.getByLabel('Česko – cena').fill('450');
  const [put] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/shipping-methods/pojistena') && r.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Uložit', exact: true }).click(),
  ]);
  assert.equal((await put.json()).method?.status, 'aktivni', 'Cenná zásilka se má zapnout');
  await page.goto(`${BASE}/admin/#/dopravci`);
  await page.locator('#pvout', { hasText: 'Cenná zásilka' }).waitFor(); // náhled „co uvidí zákazník“
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
  assert.match(desc, /DT – OMEGA Genève z roku 1968/); assert.match(desc, /garance pravosti/);
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
  // Omega za 38 900 Kč: Zásilkovna ani Balíkovna ji na plnou hodnotu nepojistí → nabídne se jen pojištěná přeprava a osobní předání
  assert.equal(await shop.getByLabel(/Zásilkovna – výdejní místo/).count(), 0);
  if (!(await shop.getByLabel(/Cenná zásilka, pojištěno na plnou hodnotu/).count())) {
    console.log('Nabídka dopravy:', JSON.stringify(await shop.evaluate(async () => (await (await fetch(`/api/config?country=CZ&items=${JSON.parse(localStorage.getItem('dt_cart') || '[]').join(',')}`)).json()).shipping)));
  }
  await shop.getByLabel(/Cenná zásilka, pojištěno na plnou hodnotu/).check();
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
  const inv = await page.locator('a', { hasText: /^DT-\d{4}-\d{4}$/ }).getAttribute('href');
  const invPage = await ctx.newPage();
  await invPage.goto(`${BASE}${inv}`);
  await invPage.getByText('Stav platby').waitFor();
  assert.match(await invPage.content(), /Uhrazeno/);
  assert.match(await invPage.content(), /Dante Time – druhý život času/);
  await shot(invPage, '5-faktura');
  step('faktura vystavena');
  await page.getByLabel(/Číslo zásilky/).fill('Z1234567890');
  await page.getByRole('button', { name: /Předáno dopravci/ }).click();
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
  await page.goto(`${BASE}/admin/#/dopravci/balikovna`);
  await page.getByRole('heading', { name: /Balíkovna/ }).first().waitFor();
  await page.getByLabel('Česko – cena').fill('89');
  // Majitel ověřil u České pošty podmínky pro hodinky → limit Balíkovny 50 000 Kč, dobírka 40 Kč
  await page.getByLabel(/Max. krytá hodnota v ČR/).fill('50000');
  await page.getByLabel('Nabízet dobírku').check();
  await page.getByLabel(/Příplatek pro zákazníka/).fill('40');
  await page.getByRole('button', { name: 'Uložit', exact: true }).click();
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
  await shop.locator('[data-summary]').getByText('13 029 Kč').waitFor(); // 12 900 + 89 + 40
  for (const [l, v] of [['Jméno a příjmení', 'Karel Dobírka'], ['E-mail', 'karel@example.com'], [/Telefon/, '+420 600 000 002'], ['Ulice a číslo', 'Testovací 9'], ['Město', 'Praha'], ['PSČ', '17000']]) await shop.getByLabel(l).fill(v);
  await shop.locator('input[name=terms]').check();
  await shop.getByRole('button', { name: 'Objednávka zavazující k platbě' }).click();
  await shop.waitForURL(/\/objednavka\//);
  await shop.getByText(/Platíte dobírkou při převzetí/).waitFor();
  step('dobírka s výběrem Balíkovny na mapě');
  await page.goto(`${BASE}/admin/#/objednavky`);
  await page.locator('.item', { hasText: 'Karel Dobírka' }).click();
  await page.getByRole('button', { name: /Předáno dopravci \(dobírka\)/ }).click();
  await page.locator('.chip.shipped').waitFor();
  await page.getByRole('button', { name: /Dobírka zaplacena/ }).click();
  await page.locator('.chip.completed').waitFor();
  await page.locator('a', { hasText: /^DT-\d{4}-\d{4}$/ }).waitFor();
  step('dobírka: odesláno → zaplaceno → faktura');

  // 10) Faktura k zakázce z administrace
  await page.goto(`${BASE}/admin/#/zakazky`);
  await page.locator('.item').first().click();
  await page.getByRole('link', { name: 'Vystavit fakturu' }).click();
  await page.locator('#lines [name=price]').first().fill('1800');
  await page.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await page.getByRole('heading', { name: 'Ekonomika zakázky' }).waitFor(); // po vystavení zpět v zakázce
  await page.locator('#kecon .item', { hasText: /DT-\d{4}-\d{4} · Faktura/ }).waitFor();
  await page.goto(`${BASE}/admin/#/faktury`);
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
  // Řádek nákupu otevře detail výdaje s přílohami
  await page.locator('a.item', { hasText: 'Nákup hodinek – test' }).first().click();
  await page.getByRole('heading', { name: 'Nákup hodinek – test' }).waitFor();
  await page.locator('#docs .item').first().waitFor();
  const docHref = `/api/admin/documents/${await page.locator('#docs [data-view]').first().getAttribute('data-view')}/file`;
  const docRes = await page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, t: r.headers.get('content-type'), n: (await r.arrayBuffer()).byteLength }; }, `${BASE}${docHref}`);
  assert.equal(docRes.s, 200); assert.match(docRes.t, /^image\//); assert.ok(docRes.n > 1000);
  assert.equal((await fetch(`${BASE}${docHref}`)).status, 401, 'doklad nesmí být dostupný bez přihlášení');
  step('doklad: nahrán s nákladem, chráněn přihlášením');
  await page.goto(`${BASE}/admin/#/doklady`);
  await page.getByRole('heading', { name: 'Nákupy a prodeje' }).waitFor();

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
  await page.getByRole('heading', { name: 'Sklad dílů' }).waitFor();
  await page.getByText('Strojek PRIM 66 – eBay test').waitFor();

  // Velké PDF (3,5 MB, např. faktura z Pages s logem) se uloží po částech a vrátí se beze změny
  const big = await page.evaluate(async () => {
    const n = 3_500_000; const b = new Uint8Array(n); b.set(new TextEncoder().encode('%PDF-1.4\n'));
    for (let i = 9; i < n; i++) b[i] = (i * 31 + 7) % 251;
    const fd = new FormData(); fd.append('file', new Blob([b], { type: 'application/pdf' }), 'velka-faktura.pdf'); fd.append('purpose', 'prodej');
    const up = await (await fetch('/api/admin/inbox/upload', { method: 'POST', headers: { 'X-DT-Admin': '1' }, body: fd })).json();
    const back = new Uint8Array(await (await fetch(`/api/admin/documents/${up.id}/file`)).arrayBuffer());
    let same = back.length === n; for (let i = 0; same && i < n; i += 997) same = back[i] === b[i];
    return { id: up.id, len: back.length, same };
  });
  assert.equal(big.len, 3_500_000); assert.ok(big.same, 'velké PDF se musí vrátit beze změny');
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
  // Stejné velké PDF podruhé → duplicita (bez načítání souboru); import faktur lze smazat a začít znovu
  const bigAgain = await page.evaluate(async () => {
    const n = 3_500_000; const b = new Uint8Array(n); b.set(new TextEncoder().encode('%PDF-1.4\n'));
    for (let i = 9; i < n; i++) b[i] = (i * 31 + 7) % 251;
    const fd = new FormData(); fd.append('file', new Blob([b], { type: 'application/pdf' }), 'velka-faktura.pdf'); fd.append('purpose', 'prodej');
    return (await fetch('/api/admin/inbox/upload', { method: 'POST', headers: { 'X-DT-Admin': '1' }, body: fd })).json();
  });
  assert.equal(bigAgain.duplicate, true);
  const post = (u, b) => page.evaluate(async ([u2, b2]) => { const r = await fetch(`/api/admin/${u2}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DT-Admin': '1' }, body: JSON.stringify(b2) }); return { s: r.status, j: await r.json().catch(() => ({})) }; }, [u, b]);
  assert.equal((await post('inbox/reset-sales', { confirm: 'ne' })).s, 400);
  const reset = await post('inbox/reset-sales', { confirm: 'SMAZAT' });
  assert.equal(reset.s, 200, JSON.stringify(reset.j)); assert.ok(reset.j.files >= 1 && reset.j.sales >= 1);
  assert.equal(await page.evaluate(async (id) => (await fetch(`/api/admin/documents/${id}/file`)).status, big.id), 404);
  assert.match(await page.evaluate(async (b) => (await fetch(`${b}/api/admin/finance/export?kind=faktury&from=2000-01-01&to=2100-01-01`)).text(), BASE), /2026-IMPORT-1/);
  step('import faktur: duplicita velkého PDF, smazání importu (ručně zadané prodeje zůstanou)');
  await page.goto(`${BASE}/admin/#/ekonomika`);
  await page.getByText('Marže hodinek').waitFor();
  await page.locator('a.item', { hasText: 'marže' }).first().waitFor();
  const csv = await page.evaluate(async (b) => (await fetch(`${b}/api/admin/finance/export?kind=naklady&from=2000-01-01&to=2100-01-01`)).text(), BASE);
  assert.match(csv, /Nákup hodinek – test/);
  step('ekonomika: náklad zapsán, marže spočítána, export pro účetní');

  // Centrální fakturace: prodej hodinek ze skladu mimo e-shop (Vinted) → sklad, pas, tržba, marže; záloha; dobropis
  const api = (method, p, body) => page.evaluate(async ([m, u, b]) => { const r = await fetch(`/api/admin/${u}`, { method: m, headers: { 'Content-Type': 'application/json', 'X-DT-Admin': '1' }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; }, [method, p, body]);
  // Zakázka bez e-mailu (zákazník z Instagramu) – jméno a kontakt přímo u zakázky
  const kz = await api('POST', 'commissions', { type: 'renovace', status: 'v_praci', name: 'Instagram Zákazník', email: '', phone: '+420 777 000 111', contact_info: '@test_ig', watch: 'Glashütte 17 Rubis' });
  assert.equal(kz.s, 201, JSON.stringify(kz.j));
  const kl = await api('GET', 'commissions');
  const kk = kl.j.commissions.find((x) => x.id === kz.j.id);
  assert.equal(kk.customer_name, 'Instagram Zákazník'); assert.equal(kk.customer_email, null); assert.match(kk.customer_phone, /777 000 111.*@test_ig/);
  step('zakázka bez e-mailu uložena (jméno a kontakt u zakázky)');
  // Adresa u zakázky a koncept faktury (bez čísla; po vystavení zmizí)
  const ka = await api('PUT', `commissions/${kz.j.id}`, { contact_street: 'Testovací 1', contact_city: 'Praha', contact_zip: '11000' });
  assert.equal(ka.s, 200, JSON.stringify(ka.j));
  const dr = await api('POST', 'invoice-drafts', { commission_id: kz.j.id, total_czk: 7300, data: { fields: { kind: 'faktura', buyer_name: 'Instagram Zákazník', buyer_street: 'Testovací 1' }, items: [{ text: 'Renovace', qty: 1, price: 7300 }], flags: { paid: false } } });
  assert.equal(dr.s, 200, JSON.stringify(dr.j));
  const kl2 = await api('GET', 'commissions');
  const kk2 = kl2.j.commissions.find((x) => x.id === kz.j.id);
  assert.equal(kk2.invoice_draft_id, dr.j.id); assert.equal(kk2.contact_city, 'Praha');
  const dl = await api('GET', 'invoice-drafts');
  assert.ok(dl.j.drafts.some((x) => x.id === dr.j.id && x.total_czk === 7300));
  const dg = await api('GET', `invoice-drafts/${dr.j.id}`);
  assert.equal(dg.j.data.items[0].price, 7300);
  const iv = await api('POST', 'invoices', { kind: 'faktura', channel: 'zakazka', commission_id: kz.j.id, buyer_name: 'Instagram Zákazník', buyer_street: 'Testovací 1', buyer_city: 'Praha', buyer_zip: '11000', items: [{ text: 'Renovace', qty: 1, price: 7300 }], payment_method: 'bank_transfer', draft_id: dr.j.id });
  assert.equal(iv.s, 201, JSON.stringify(iv.j));
  assert.ok(!(await api('GET', 'invoice-drafts')).j.drafts.some((x) => x.id === dr.j.id));
  step('koncept faktury uložen, adresa ze zakázky, po vystavení koncept zmizel');
  // Duplicitní faktura, částečné platby, oprava platby, storno s důvodem, detail dokladu
  const dup1 = await api('POST', 'invoices', { kind: 'faktura', channel: 'osobne', buyer_name: 'Duplicitní Zákazník', items: [{ text: 'Sestava', qty: 1, price: 13000 }], send_mode: 'ulozit' });
  assert.equal(dup1.s, 201, JSON.stringify(dup1.j));
  const dup2 = await api('POST', 'invoices', { kind: 'faktura', channel: 'osobne', buyer_name: 'Duplicitní Zákazník', items: [{ text: 'Sestava', qty: 1, price: 13000 }], send_mode: 'ulozit' });
  assert.equal(dup2.s, 409); assert.equal(dup2.j.code, 'duplicate');
  const dup3 = await api('POST', 'invoices', { kind: 'faktura', channel: 'osobne', buyer_name: 'Duplicitní Zákazník', items: [{ text: 'Sestava', qty: 1, price: 13000 }], send_mode: 'ulozit', allow_duplicate: true });
  assert.equal(dup3.s, 201);
  assert.equal((await api('POST', `invoices/${dup3.j.id}/cancel`, {})).s, 400, 'storno bez důvodu nejde');
  assert.equal((await api('POST', `invoices/${dup3.j.id}/cancel`, { reason: 'vystaveno omylem dvakrát' })).s, 200);
  const p1 = await api('POST', `invoices/${dup1.j.id}/payments`, { amount: 5000, paid_on: new Date().toISOString().slice(0, 10), method: 'cash', note: 'záloha' });
  assert.equal(p1.s, 201); assert.equal(p1.j.state, 'castecne');
  const p2 = await api('POST', `invoices/${dup1.j.id}/payments`, { amount: 50000 });
  assert.equal(p2.j.state, 'preplaceno');
  assert.equal((await api('POST', `invoice-payments/${p2.j.id}/cancel`, { reason: 'překlep' })).s, 200);
  let det = (await api('GET', `invoices/${dup1.j.id}`)).j;
  assert.deepEqual([det.state, det.paid, det.remaining, det.payments.length], ['castecne', 5000, 8000, 2]);
  assert.ok(det.history.some((h) => h.action === 'platba_zrusena'));
  const dupList = (await api('GET', 'invoices?q=Duplicitn')).j;
  // (souhrn pohledávek počítá jen ostré doklady – v testovacím režimu kontrolujeme jednotlivé doklady)
  assert.equal(dupList.invoices.find((x) => x.id === dup1.j.id).remaining, 8000, 'zbývá jen rozdíl po částečné platbě');
  assert.ok(dupList.invoices.find((x) => x.id === dup3.j.id).cancelled_at, 'duplicita stornována');
  await page.goto(`${BASE}/admin/#/faktury/${dup1.j.id}`);
  await page.getByText('ČÁSTEČNĚ UHRAZENO', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zapsat platbu' }).click(); // předvyplněný doplatek 8 000
  await page.getByText('UHRAZENO', { exact: true }).waitFor();
  await page.goto(`${BASE}/admin/#/faktury/${dup3.j.id}`);
  await page.getByText('STORNOVÁNO', { exact: true }).waitFor(); await page.getByText('vystaveno omylem dvakrát').first().waitFor();
  step('duplicita zachycena, částečná platba, oprava platby, doplatek, storno s důvodem');
  // Bezpečné mazání: zakázka s fakturou ne (archiv), prázdná ano; historie změn
  assert.equal((await api('DELETE', `commissions/${kz.j.id}`)).s, 409, 'zakázku s fakturou smazat nejde');
  const empty = await api('POST', 'commissions', { type: 'servis', name: 'Omylem Založená' });
  assert.equal((await api('DELETE', `commissions/${empty.j.id}`)).s, 200);
  assert.ok(!(await api('GET', 'commissions')).j.commissions.some((x) => x.id === empty.j.id));
  const hist = (await api('GET', `history/commission/${kz.j.id}`)).j.history;
  assert.ok(hist.some((h) => h.action === 'zakazka_vytvorena'));
  await page.goto(`${BASE}/admin/#/zakazky?f=vse&q=Instagram`);
  await page.locator('.item', { hasText: 'Instagram Zákazník' }).first().waitFor();
  step('mazání jen bez dokladů, filtr a hledání zakázek, historie');
  const np = await api('POST', 'products', { title: 'Prim Classic Test LTD.01', brand: 'PRIM', serial_ref: '26-9.9', price_czk: 5000 });
  assert.equal(np.s, 201, JSON.stringify(np.j));
  const stockId = np.j.id;
  assert.equal((await api('GET', `products/${stockId}`)).j.product.title, 'DT – PRIM Classic Test LTD.01', 'jednotný název DT – ZNAČKA … (R26)');
  await page.goto(`${BASE}/admin/#/faktury/nova`);
  await page.getByRole('heading', { name: 'Nová faktura' }).waitFor();
  await page.locator('select[name=product_id]').selectOption(stockId);
  await page.locator('select[name=channel]').selectOption('vinted');
  await page.getByLabel('Prodejní cena hodinek (Kč)').fill('5000');
  await page.getByLabel('Doprava (Kč)').fill('150');
  await page.locator('input[name=buyer_name]').fill('Vinted Kupující');
  await page.locator('input[name=buyer_email]').fill('vinted@example.com');
  await page.locator('input[name=paid]').check();
  // Náhled faktury: zobrazí doklad bez uložení a bez čísla
  await page.getByRole('button', { name: 'Náhled', exact: true }).click();
  const nf = page.frameLocator('iframe[title="Náhled faktury"]');
  await nf.getByText(/NÁHLED – doklad ještě není vystavený/).waitFor();
  await nf.getByText(/DT – PRIM Classic Test LTD\.01/).first().waitFor();
  assert.equal((await api('GET', 'invoices?channel=vinted')).j.invoices.length, 0, 'náhled nesmí vystavit doklad');
  await page.getByRole('button', { name: 'Zavřít náhled' }).click();
  step('náhled faktury bez vystavení');
  await page.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await page.getByRole('heading', { name: /^Faktura DT-\d{4}-\d{4}$/ }).waitFor(); // po vystavení detail dokladu
  await page.getByText('UHRAZENO', { exact: true }).waitFor();
  const list = (await api('GET', 'invoices?channel=vinted')).j.invoices;
  assert.equal(list.length, 1); assert.match(list[0].number, /^DT-\d{4}-\d{4}$/); assert.equal(list[0].total, 5150);
  assert.equal((await api('GET', `products/${stockId}`)).j.product.status, 'sold', 'hodinky musí být prodané');
  assert.ok((await api('GET', 'passports')).j.passports.some((x) => x.product_id === stockId), 'pas hodinek musí vzniknout');
  const econ = (await api('GET', `finance/products/${stockId}`)).j;
  assert.equal(econ.sold, true); assert.equal(econ.revenue, 5000, 'tržba hodinek bez dopravy');
  const vp = await ctx.newPage(); await vp.goto(`${BASE}/faktura/${list[0].public_token}`);
  const vh = await vp.content(); await vp.close();
  assert.match(vh, /Neplátce DPH/); assert.match(vh, /<!--email_off-->/); assert.doesNotMatch(vh, /uskutečnění plnění/); assert.match(vh, /Model: DT – PRIM Classic Test LTD\.01/); assert.match(vh, /Serial no: 26-9.9/); assert.match(vh, /Děkujeme za nákup/); assert.match(vh, /útulku pro zvířata/);
  // Záloha 2 000 Kč → vyúčtování 9 000 Kč (zbývá 7 000), záloha se nezapočítá do tržeb dvakrát
  const adv = await api('POST', 'invoices', { kind: 'zalohova', channel: 'zakazka', buyer_name: 'Zálohový Zákazník', items: [{ text: 'Záloha na zakázkovou sestavu', qty: 1, price: 2000 }], paid: true, payment_method: 'bank_transfer' });
  assert.equal(adv.s, 201);
  const fin = await api('POST', 'invoices', { kind: 'faktura', channel: 'zakazka', buyer_name: 'Zálohový Zákazník', items: [{ text: 'Zakázková sestava', qty: 1, price: 9000 }], advance_id: adv.j.id, payment_method: 'bank_transfer' });
  assert.equal(fin.s, 201);
  const twice = await api('POST', 'invoices', { kind: 'faktura', buyer_name: 'X', items: [{ text: 'Y', qty: 1, price: 9000 }], advance_id: adv.j.id });
  assert.equal(twice.s, 400, 'záloha nesmí jít vyúčtovat dvakrát');
  const fp = await ctx.newPage(); await fp.goto(`${BASE}/faktura/${fin.j.token}`); const fh = await fp.content(); await fp.close();
  assert.match(fh, /Zbývá uhradit/); assert.match(fh, /7(\s|&nbsp;)000/); assert.match(fh, /QR platba/);
  // Dobropis celé faktury → hodinky zpět na sklad, číslování bez duplicit
  const cr = await api('POST', `invoices/${list[0].id}/credit`, { reason: 'vrácení hodinek', restock: true });
  assert.equal(cr.s, 201);
  assert.equal((await api('GET', `products/${stockId}`)).j.product.status, 'available');
  const all = (await api('GET', 'invoices')).j.invoices.map((x) => x.number);
  assert.equal(new Set(all).size, all.length, 'čísla dokladů musí být unikátní');
  const sums = (await api('GET', 'invoices?kind=zalohova')).j;
  assert.equal(sums.revenue, 0, 'záloha není tržba');
  step('fakturace: prodej ze skladu (Vinted), pas, marže, záloha a vyúčtování, dobropis, unikátní čísla');

  // Zakázky: náklady (zaplacené / vlastní práce / odhad), přiřazení výdaje, záloha bez dokladu, schválení odeslání, platby
  assert.equal((await api('GET', 'settings')).j.settings.invoice_autosend, '0', 'automatické odesílání je výchozí vypnuté');
  const k2 = await api('POST', 'commissions', { type: 'prestavba', status: 'v_praci', name: 'Ekonomika Test', email: 'ekonomika@example.com', watch: 'PRIM Datejust test', final_price_czk: 13000, deposit_czk: 1000, deposit_received_on: '2026-03-01' });
  assert.equal(k2.s, 201, JSON.stringify(k2.j));
  const kid = k2.j.id;
  await page.goto(`${BASE}/admin/#/zakazky/${kid}`);
  await page.getByRole('heading', { name: 'Ekonomika zakázky' }).waitFor();
  await page.locator('#addc summary').click();
  await page.locator('#cq button', { hasText: 'Pouzdro' }).click();
  await page.locator('#jcf [name=amount_czk]').fill('1500');
  await page.locator('#jcf button.primary').click();
  await page.locator('#kecon .item', { hasText: 'Pouzdro' }).waitFor();
  assert.equal((await api('POST', 'costs', { commission_id: kid, category: 'prace', own_work: true, description: 'Vlastní práce test', amount_czk: 2000 })).s, 201);
  assert.equal((await api('POST', 'costs', { commission_id: kid, category: 'dil', estimate: true, description: 'Sklo odhad', amount_czk: 400 })).s, 201);
  assert.equal((await api('POST', 'costs', { category: 'material', description: 'Těsnění volné', amount_czk: 500 })).s, 201);
  await page.goto(`${BASE}/admin/#/zakazky/${kid}`);
  await page.locator('#assign summary').click();
  await page.locator('#free .item', { hasText: 'Těsnění volné' }).getByRole('button', { name: 'Přiřadit' }).click();
  await page.locator('#kecon .item', { hasText: 'Těsnění volné' }).waitFor();
  let ke = (await api('GET', `commissions/${kid}/economics`)).j;
  assert.deepEqual([ke.paid, ke.ownWork, ke.estimate, ke.price, ke.profit, ke.marginPct, ke.received, ke.remaining], [2000, 2000, 400, 13000, 11000, 84.6, 1000, 12000]);
  // Faktura ze zakázky: záloha bez dokladu se odečte, odeslání čeká na schválení
  await page.getByRole('link', { name: 'Vystavit fakturu' }).click();
  await page.getByRole('heading', { name: 'Nová faktura' }).waitFor();
  assert.equal(await page.locator('input[name=deduct_cash_deposit]').isChecked(), true);
  assert.equal(await page.locator('input[name=send_mode][value=odeslat]').isDisabled(), true, 'okamžité odeslání je bez povolení vypnuté');
  await page.locator('input[name=send_mode][value=schvalit]').check();
  await page.getByRole('button', { name: 'Vystavit fakturu' }).click();
  await page.getByRole('heading', { name: 'Ekonomika zakázky' }).waitFor();
  await page.locator('#kecon .item', { hasText: 'čeká na schválení odeslání' }).waitFor();
  assert.ok(!(await api('GET', 'emails')).j.emails.some((m) => m.to_addr === 'ekonomika@example.com'), 'před schválením se nic neodeslalo');
  await page.getByRole('button', { name: 'Schválit a odeslat' }).click();
  await page.locator('#kecon .item', { hasText: 'odesláno' }).waitFor();
  const sent = (await api('GET', 'emails')).j.emails.filter((m) => m.to_addr === 'ekonomika@example.com');
  assert.equal(sent.length, 1); assert.match(sent[0].subject, /^\[TEST\] Faktura DT-/); assert.equal(sent[0].status, 'stored', 'v testu se e-mail jen uloží');
  ke = (await api('GET', `commissions/${kid}/economics`)).j;
  assert.deepEqual([ke.invoiced, ke.received, ke.remaining, ke.depositCashLeft, ke.invoices[0].advance_deducted], [13000, 1000, 12000, 0, 1000]);
  await page.locator('#kecon').getByRole('button', { name: 'Uhrazeno' }).click();
  await page.locator('#kecon').getByRole('button', { name: 'Uhrazeno' }).waitFor({ state: 'detached' });
  ke = (await api('GET', `commissions/${kid}/economics`)).j;
  assert.deepEqual([ke.received, ke.remaining, ke.profit], [13000, 0, 11000]);
  const ov = (await api('GET', `finance/overview?year=${new Date().getFullYear()}`)).j;
  assert.ok(ov.jobs.some((j) => j.id === kid && j.margin === 11000), 'zakázka v přehledu ziskovosti');
  await page.goto(`${BASE}/admin/#/ekonomika`);
  await page.getByText('Ziskovost zakázek').waitFor();
  await page.getByText('skutečně přijato').waitFor();
  step('zakázky: náklady, vlastní práce, odhad, přiřazení výdaje, záloha, schválení odeslání, platby, zisk a marže');

  // Díl ze skladu použitý v zakázce: 1 ze 3 kusů (dotaz na počet se v testu potvrdí výchozí 1) → náklad zakázky, zbytek skladem, vrácení na sklad
  const sp = await api('POST', 'parts', { kind: 'sklo', title: 'Sklo safírové 30 mm test', qty: 3, unit_cost_czk: 250, status: 'skladem' });
  assert.equal(sp.s, 201, JSON.stringify(sp.j));
  await page.goto(`${BASE}/admin/#/zakazky/${kid}`);
  await page.locator('#usep summary').click();
  await page.locator('#stock .item', { hasText: 'Sklo safírové 30 mm test' }).getByRole('button', { name: 'Použít' }).click();
  await page.getByRole('heading', { name: 'Díly ze skladu' }).waitFor();
  ke = (await api('GET', `commissions/${kid}/economics`)).j;
  assert.deepEqual([ke.partsCost, ke.paid, ke.profit], [250, 2250, 10750]);
  assert.equal((await api('GET', 'parts')).j.parts.find((x) => x.id === sp.j.id).qty, 2);
  await page.getByRole('button', { name: 'Vrátit na sklad' }).click();
  await page.getByRole('heading', { name: 'Díly ze skladu' }).waitFor({ state: 'detached' });
  assert.equal((await api('GET', `commissions/${kid}/economics`)).j.partsCost, 0);
  step('díly ze skladu: použití části zásoby v zakázce, náklad a zisk, vrácení na sklad');

  // Jednotná správa výdajů: detail, úprava s přepočtem, více dokladů, nahrazení, stažení, přiřazení, hledání, smazání
  const vy = await api('POST', 'costs', { commission_id: kid, category: 'dil', part_kind: 'sklo', description: 'Sklo safírové e2e', amount_czk: 800 });
  assert.equal(vy.s, 201, JSON.stringify(vy.j));
  const vid = vy.j.id;
  const paid0 = (await api('GET', `commissions/${kid}/economics`)).j.paid;
  await page.goto(`${BASE}/admin/#/zakazky`);
  await page.goto(`${BASE}/admin/#/zakazky/${kid}`);
  await page.locator('#kecon a', { hasText: 'Sklo safírové e2e' }).click();
  await page.getByRole('heading', { name: 'Sklo safírové e2e' }).waitFor();
  const pdfFile = (t) => ({ name: `${t}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n% ${t} ${Date.now()}\n`) });
  await page.setInputFiles('#dadd', [pdfFile('faktura-skla'), pdfFile('uctenka-skla')]);
  await page.locator('#docs .item', { hasText: 'uctenka-skla.pdf' }).waitFor();
  let vd = (await api('GET', `costs/${vid}`)).j;
  assert.deepEqual(vd.docs.map((x) => x.filename).sort(), ['faktura-skla.pdf', 'uctenka-skla.pdf']);
  const firstDoc = vd.docs.find((x) => x.filename === 'faktura-skla.pdf').id;
  const disp = await page.evaluate(async (d) => (await fetch(`/api/admin/documents/${d}/file?download=1`)).headers.get('content-disposition'), firstDoc);
  assert.match(disp, /^attachment; filename="faktura-skla\.pdf"/);
  await page.locator('#cedit [name=amount_czk]').fill('950');
  await page.locator('#cedit [name=note]').fill('dodáno s těsněním');
  await page.getByRole('button', { name: 'Uložit změny' }).click();
  await page.locator('.stat b', { hasText: /950\s*Kč/ }).waitFor();
  vd = (await api('GET', `costs/${vid}`)).j;
  assert.deepEqual([vd.cost.amount_czk, vd.cost.note], [950, 'dodáno s těsněním']);
  assert.ok(vd.history.some((h) => h.action === 'naklad_upraven' && /"z":800,"na":950/.test(h.details)));
  assert.equal((await api('GET', `commissions/${kid}/economics`)).j.paid, paid0 + 150, 'zisk a náklady zakázky přepočítané');
  await page.setInputFiles(`[data-repl="${firstDoc}"]`, pdfFile('faktura-skla-oprava'));
  await page.locator('#docs .item', { hasText: 'faktura-skla-oprava.pdf' }).waitFor();
  vd = (await api('GET', `costs/${vid}`)).j;
  assert.deepEqual(vd.docs.map((x) => x.filename).sort(), ['faktura-skla-oprava.pdf', 'uctenka-skla.pdf'], 'nahrazený doklad je pryč');
  await page.locator('#docs .item', { hasText: 'uctenka-skla.pdf' }).locator('[data-dremove]').click();
  await page.locator('#docs .item', { hasText: 'uctenka-skla.pdf' }).waitFor({ state: 'detached' });
  await page.locator('#cassign [data-tg=provoz]').click();
  await page.getByRole('button', { name: 'Uložit přiřazení' }).click();
  await page.locator('.stat', { hasText: 'společný náklad' }).waitFor();
  assert.equal((await api('GET', `costs/${vid}`)).j.cost.commission_id, null);
  assert.equal((await api('GET', `commissions/${kid}/economics`)).j.paid, paid0 - 800, 'odebráno ze zakázky, výdaj zůstal v evidenci');
  await page.goto(`${BASE}/admin/#/naklady?q=${encodeURIComponent('Sklo safírové e2e')}`);
  await page.locator('a.item', { hasText: 'Sklo safírové e2e' }).click();
  await page.getByRole('heading', { name: 'Sklo safírové e2e' }).waitFor();
  await page.getByRole('button', { name: 'Trvale smazat výdaj' }).click(); // obě potvrzení odsouhlasena → i doklady
  await page.getByRole('heading', { name: 'Výdaje' }).waitFor();
  assert.equal((await api('GET', `costs/${vid}`)).s, 404);
  assert.ok(!(await api('GET', 'documents')).j.documents.some((x) => /skla/.test(x.filename || '')), 'doklady smazané spolu s výdajem');
  const ms = (await api('GET', 'inbox')).j.sales.find((x) => x.kind === 'import');
  if (ms) { await page.goto(`${BASE}/admin/#/prodeje/${ms.id}`); await page.getByRole('heading', { name: /^Prodej/ }).waitFor(); await page.locator('form.sform').waitFor(); }
  step('výdaje: detail, úprava s přepočtem, více dokladů, nahrazení, stažení, přiřazení, hledání, smazání; detail prodeje');

  // Fotky zakázky: fáze, hlavní fotka, celá obrazovka, smazání s potvrzením, miniatura v přehledu
  const ph = await page.evaluate(async (id) => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 50; const x = c.getContext('2d'); x.fillStyle = '#c8a24a'; x.fillRect(0, 0, 40, 50);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8)); const out = [];
    for (const phase of ['pred', 'po']) {
      const fd = new FormData(); fd.append('large', b, 'l.jpg'); fd.append('small', b, 's.jpg'); fd.append('width', '40'); fd.append('height', '50'); fd.append('phase', phase);
      const r = await fetch(`/api/admin/commissions/${id}/photos`, { method: 'POST', headers: { 'X-DT-Admin': '1' }, body: fd }); out.push((await r.json()).id);
    }
    return out;
  }, kid);
  assert.equal((await api('GET', 'commissions')).j.commissions.find((x) => x.id === kid).cover_photo_id, ph[1], 'bez volby je hlavní fotka „po“');
  await page.goto(`${BASE}/admin/#/zakazky`); // jiná adresa → detail zakázky se znovu načte i s novými fotkami
  await page.goto(`${BASE}/admin/#/zakazky/${kid}`);
  await page.locator('#kphotos .photo').nth(1).waitFor();
  await page.locator('#kphotos .photo .tag', { hasText: 'Před' }).waitFor();
  await page.locator('#kphotos .open').first().click();
  await page.locator('.lightbox img').waitFor();
  await page.getByRole('button', { name: '☆ Nastavit jako hlavní' }).click();
  await page.getByRole('button', { name: '★ Hlavní fotka' }).waitFor();
  await page.locator('.lightbox .lb-x').click();
  assert.equal((await api('GET', 'commissions')).j.commissions.find((x) => x.id === kid).cover_photo_id, ph[0]);
  await page.locator('#kphotos .photo.main [data-kdel]').click(); // potvrzení se v testu odsouhlasí
  await page.waitForFunction(() => document.querySelectorAll('#kphotos .photo').length === 1);
  assert.equal((await api('GET', `commissions/${kid}/photos`)).j.photos.length, 1);
  await page.goto(`${BASE}/admin/#/zakazky`);
  await page.locator(`a.item[href="#/zakazky/${kid}"] img`).waitFor();
  await page.locator('a.item .watchph').first().waitFor(); // zakázka bez fotky = ikona hodinek
  step('fotky zakázky: fáze, hlavní fotka, celá obrazovka, smazání, miniatury v přehledu');

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
