// Sestavení webu do složky dist/
// Spuštění: npm run build   (proměnná SHOP_MODE: preview | test | live)
import { mkdir, writeFile, cp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { layout, hero } from '../src/layout.mjs';
import { PAGES, SITE } from '../src/site.mjs';
import * as M from '../src/pages/marketing.mjs';
import * as S from '../src/pages/shop.mjs';
import { ALL_LEGAL } from '../src/legal/docs.mjs';
import { notFoundBody, SHOP_BANNER } from '../src/shop/views.mjs';

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

// Právní dokumenty (česky)
for (const d of ALL_LEGAL) {
  await page(d.path, layout({ ...common, lang: 'cs', title: d.title, description: d.description, path: d.path,
    body: `${hero({ eyebrow: 'Právní informace', title: d.title, small: true })}<section class="section" style="padding-top:8px"><div class="wrap"><div class="card prose">${d.body()}</div></div></section>` }));
}
const w = S.withdrawalForm();
await page('/odstoupeni', layout({ ...common, lang: 'cs', ...w, path: '/odstoupeni' }));

// Stránka 404 (Cloudflare Pages ji použije automaticky)
await page('/404', layout({ ...common, lang: 'cs', title: 'Stránka nenalezena', description: 'Stránka nenalezena.', path: '/404', noindex: true, body: notFoundBody('cs') }));

await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /kosik\nDisallow: /en/cart\nDisallow: /objednavka/\nDisallow: /faktura/\n\nSitemap: ${SITE.origin}/sitemap.xml\n`);
await writeFile(path.join(DIST, 'build-info.json'), JSON.stringify({ mode: MODE, builtAt: new Date().toISOString(), pages: files.length }, null, 2));

// Pojistka: v ostrém režimu nesmí na webu zůstat nevyplněné údaje
if (MODE === 'live') {
  const { readFile } = await import('node:fs/promises');
  const bad = [];
  for (const rel of files) if ((await readFile(path.join(DIST, rel), 'utf8')).includes('[DOPLNIT')) bad.push(rel);
  if (bad.length) throw new Error(`Ostrý režim nelze sestavit – chybí údaje k doplnění na stránkách: ${bad.join(', ')}`);
}

const count = (await readdir(DIST, { recursive: true })).length;
console.log(`✅ Sestaveno ${files.length} stránek (režim ${MODE}), celkem ${count} souborů v dist/.`);
