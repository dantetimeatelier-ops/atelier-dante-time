// Automatický test webu: otevře každou stránku na mobilu, tabletu a počítači
// a zkontroluje, že funguje. Spuštění: npm run test:smoke
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WIDTHS = [375, 768, 1280];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };

// Jednoduchý server, který se chová jako GitHub Pages (včetně stránky 404)
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  try {
    if (!file.startsWith(ROOT) || !(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    res.end(await readFile(path.join(ROOT, '404.html')));
  }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// Seznam stránek bereme ze sitemap.xml, takže test hlídá i ji
const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https:\/\/atelier-dante-time\.cz\/([^<]*)<\/loc>/g)].map(m => '/' + m[1]);

const errors = [];
const fail = (msg) => { errors.push(msg); console.log('  ✗ ' + msg); };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const url of [...pages, '/neexistujici-stranka']) {
    const label = `${url} @ ${width}px`;
    const before = errors.length;
    const jsErrors = [], badResponses = [];
    page.removeAllListeners('pageerror'); page.removeAllListeners('response');
    page.on('pageerror', e => jsErrors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400 && r.url() !== BASE + url) badResponses.push(`${r.status()} ${r.url().replace(BASE, '')}`); });

    const resp = await page.goto(BASE + url, { waitUntil: 'load' });
    const expect404 = url === '/neexistujici-stranka';
    if (expect404 ? resp.status() !== 404 : resp.status() !== 200) fail(`${label}: neočekávaný stav ${resp.status()}`);

    // posun dolů, aby se načetly i obrázky s lazy loading
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } });
    await page.waitForLoadState('networkidle');

    const info = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      h1: document.querySelectorAll('h1').length,
      description: document.querySelector('meta[name=description]')?.content || '',
      canonical: document.querySelector('link[rel=canonical]')?.href || '',
      brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
      missingAlt: [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')),
    }));

    if (info.scrollWidth > width) fail(`${label}: stránka se rozjíždí do strany (${info.scrollWidth}px)`);
    if (jsErrors.length) fail(`${label}: chyba JavaScriptu: ${jsErrors.join('; ')}`);
    if (badResponses.length) fail(`${label}: chybějící soubory: ${badResponses.join(', ')}`);
    if (info.brokenImages.length) fail(`${label}: nenačtené obrázky: ${info.brokenImages.join(', ')}`);
    if (info.missingAlt.length) fail(`${label}: obrázky bez alt textu: ${info.missingAlt.join(', ')}`);
    if (!info.title) fail(`${label}: chybí <title>`);
    if (info.h1 !== 1) fail(`${label}: má být právě jeden <h1>, je jich ${info.h1}`);
    if (!expect404) {
      if (info.description.length < 50) fail(`${label}: chybí nebo je příliš krátký meta description`);
      if (!info.canonical.startsWith('https://atelier-dante-time.cz/')) fail(`${label}: chybí canonical`);
    }
    if (errors.length === before) console.log(`✓ ${label}`);
  }
  await page.close();
}
await browser.close();
server.close();

if (errors.length) {
  console.log(`\n❌ Nalezeno ${errors.length} problémů.`);
  process.exit(1);
}
console.log(`\n✅ Všech ${(pages.length + 1) * WIDTHS.length} kontrol prošlo.`);
