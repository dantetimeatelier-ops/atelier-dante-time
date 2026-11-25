// Sestavení webu do složky dist/
// Spuštění: npm run build   (proměnná SHOP_MODE: preview | test | live)
import { mkdir, writeFile, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { writeAssetVersion } from './asset-version.mjs';
// Otisk stylů musí vzniknout dřív, než se načte vzhled stránek (proto dynamické importy)
writeAssetVersion();
const { layout, hero } = await import('../src/layout.mjs');
const { PAGES, SITE } = await import('../src/site.mjs');
const M = await import('../src/pages/marketing.mjs');
const S = await import('../src/pages/shop.mjs');
const { ALL_LEGAL } = await import('../src/legal/docs.mjs');
const { notFoundBody, SHOP_BANNER } = await import('../src/shop/views.mjs');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const MODE = process.env.SHOP_MODE || 'preview';
if (!['preview', 'test', 'live'].includes(MODE)) throw new Error(`Neplatný SHOP_MODE: ${MODE}`);
const shop = MODE !== 'preview';

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp(path.join(ROOT, 'public'), DIST, { recursive: true });

const files = [];
async function page(urlPath, html) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.endsWith('/') ? `${urlPath.slice(1)}index.html` : `${urlPath.slice(1)}.html`;
  const file = path.join(DIST, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  files.push(rel);
}
const common = { shop, banner: SHOP_BANNER[MODE] };

// Prezentační stránky v obou jazycích
for (const fn of [M.home, M.about, M.services, M.care, M.contact, S.cart]) {
  for (const lang of ['cs', 'en']) {
    const p = fn(lang);
    const other = lang === 'cs' ? 'en' : 'cs';
    await page(PAGES[p.key][lang], layout({ ...common, ...p, lang, path: PAGES[p.key][lang], alternate: PAGES[p.key][other], active: p.key }));
  }
}

// Právní dokumenty v obou jazycích (stejné klíče → odkaz na druhou jazykovou verzi)
for (const d of ALL_LEGAL) {
  const other = ALL_LEGAL.find((x) => x.key === d.key && x.lang !== d.lang);
  await page(d.path, layout({ ...common, lang: d.lang, title: d.title, description: d.description, path: d.path, alternate: other?.path,
    body: `${hero({ eyebrow: d.lang === 'cs' ? 'Právní informace' : 'Legal information', title: d.title, small: true })}<section class="section" style="padding-top:8px"><div class="wrap"><div class="card prose">${d.body()}</div></div></section>` }));
}
const w = S.withdrawalForm();
await page('/odstoupeni', layout({ ...common, lang: 'cs', ...w, path: '/odstoupeni' }));

// Stránka 404 (Cloudflare Pages ji použije automaticky)
await page('/404', layout({ ...common, lang: 'cs', title: 'Stránka nenalezena', description: 'Stránka nenalezena.', path: '/404', noindex: true, body: notFoundBody('cs') }));

// Zkušební verze se nesmí dostat do vyhledávačů
const PREVIEW = process.env.SITE_ENV === 'preview';
if (PREVIEW) {
  // Přidat do PRVNÍHO bloku „/*“ – druhý blok se stejnou cestou by na Cloudflare přebil
  // bezpečnostní hlavičky (HSTS, CSP, X-Frame-Options).
  const { readFile } = await import('node:fs/promises');
  const hf = path.join(DIST, '_headers');
  const h = await readFile(hf, 'utf8');
  if (!h.startsWith('/*\n')) throw new Error('public/_headers musí začínat blokem /*');
  await writeFile(hf, h.replace('/*\n', '/*\n  X-Robots-Tag: noindex, nofollow\n'));
}
await writeFile(path.join(DIST, 'robots.txt'), PREVIEW ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /kosik\nDisallow: /en/cart\nDisallow: /objednavka/\nDisallow: /faktura/\n\nSitemap: ${SITE.origin}/sitemap.xml\n`);
await writeFile(path.join(DIST, 'build-info.json'), JSON.stringify({ mode: MODE, builtAt: new Date().toISOString(), pages: files.length }, null, 2));

// Pojistka: v ostrém režimu nesmí na webu zůstat nevyplněné údaje
if (MODE === 'live') {
  const { readFile } = await import('node:fs/promises');
  const bad = [];
  for (const rel of files) { const t = await readFile(path.join(DIST, rel), 'utf8'); if (t.includes('[DOPLNIT') || t.includes('[OVĚŘIT')) bad.push(rel); }
  if (bad.length) throw new Error(`Ostrý režim nelze sestavit – chybí údaje k doplnění na stránkách: ${bad.join(', ')}`);
}

const count = (await readdir(DIST, { recursive: true })).length;
console.log(`✅ Sestaveno ${files.length} stránek (režim ${MODE}), celkem ${count} souborů v dist/.`);
