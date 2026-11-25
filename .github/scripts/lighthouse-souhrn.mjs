// Vypíše výsledky Lighthouse jako přehlednou tabulku (Markdown).
import { readFile } from 'node:fs/promises';

const dir = '.lighthouseci/reports';
let manifest;
try {
  manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
} catch {
  console.log('Výsledky Lighthouse nejsou k dispozici.');
  process.exit(0);
}
const pct = (v) => (v == null ? '–' : Math.round(v * 100));
console.log('### Rychlost a SEO (Lighthouse, simulace mobilu)\n');
console.log('| Stránka | Výkon | Přístupnost | Správné postupy | SEO | Velikost |');
console.log('|---|---|---|---|---|---|');
for (const run of manifest) {
  const r = JSON.parse(await readFile(run.jsonPath, 'utf8'));
  const c = r.categories;
  const kb = Math.round((r.audits['total-byte-weight']?.numericValue || 0) / 1024);
  const page = new URL(run.url).pathname;
  console.log(`| ${page} | ${pct(c.performance?.score)} | ${pct(c.accessibility?.score)} | ${pct(c['best-practices']?.score)} | ${pct(c.seo?.score)} | ${kb} kB |`);
}
