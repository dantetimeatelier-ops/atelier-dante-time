// Kontrola všech stránek běžícího webu na mobilu, tabletu a počítači.
// Spuštění: BASE=http://localhost:8788 npm run test:smoke
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8788';
const WIDTHS = [375, 768, 1280];
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const fromSitemap = [...xml.matchAll(/<loc>https:\/\/atelier-dante-time\.cz([^<]*)<\/loc>/g)].map((m) => m[1]);
const pages = [...new Set([...fromSitemap, '/kosik', '/en/cart', '/odstoupeni'])];
const special = { '/neexistujici-stranka': 404, '/admin/': 200 };

const errors = [];
const fail = (msg) => { errors.push(msg); console.log(`  ✗ ${msg}`); };
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const url of [...pages, ...Object.keys(special)]) {
    const label = `${url} @ ${width}px`;
    const before = errors.length;
    const jsErrors = []; const bad = [];
    page.removeAllListeners('pageerror'); page.removeAllListeners('response');
    page.on('pageerror', (e) => jsErrors.push(e.message));
    page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && r.url() !== BASE + url && !r.url().includes('/api/admin/')) bad.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
    const resp = await page.goto(BASE + url, { waitUntil: 'networkidle' });
    const expected = special[url] ?? 200;
    if (resp.status() !== expected) fail(`${label}: stav ${resp.status()} (očekáváno ${expected})`);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); } });
    await page.waitForLoadState('networkidle');
    const info = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      title: document.title, h1: document.querySelectorAll('h1').length,
      desc: document.querySelector('meta[name=description]')?.content || '',
      canonical: document.querySelector('link[rel=canonical]')?.href || '',
      broken: [...document.images].filter((i) => i.loading !== 'lazy' && (!i.complete || !i.naturalWidth)).map((i) => i.getAttribute('src')),
      noAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
      todo: document.body.innerText.includes('[DOPLNIT'),
    }));
    if (info.sw > width) fail(`${label}: stránka se rozjíždí do strany (${info.sw}px)`);
    if (jsErrors.length) fail(`${label}: chyba JavaScriptu: ${jsErrors.join('; ')}`);
    if (bad.length) fail(`${label}: chybějící soubory: ${bad.join(', ')}`);
    if (info.broken.length) fail(`${label}: nenačtené obrázky: ${info.broken.join(', ')}`);
    if (info.noAlt) fail(`${label}: ${info.noAlt} obrázků bez alt`);
    if (!info.title) fail(`${label}: chybí title`);
    if (url !== '/admin/') {
      if (info.h1 !== 1) fail(`${label}: počet h1 je ${info.h1}`);
      if (expected === 200 && info.desc.length < 30) fail(`${label}: chybí meta description`);
      if (expected === 200 && !info.canonical.startsWith('https://atelier-dante-time.cz/')) fail(`${label}: chybí canonical`);
    }
    if (info.todo && width === 1280) console.log(`  ⚠ ${url}: obsahuje údaje k doplnění [DOPLNIT]`);
    if (errors.length === before) console.log(`✓ ${label}`);
  }
  await page.close();
}
await browser.close();
if (errors.length) { console.log(`\n❌ ${errors.length} problémů.`); process.exit(1); }
console.log(`\n✅ Všech ${(pages.length + Object.keys(special).length) * WIDTHS.length} kontrol prošlo.`);
