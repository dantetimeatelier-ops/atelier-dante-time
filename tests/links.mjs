// Kontrola odkazů uvnitř webu bez připojení k internetu:
// každý odkaz a obrázek musí vést na existující soubor a každá kotva (#id)
// musí na cílové stránce existovat. Spuštění: npm run test:links
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), process.argv[2] || '..');
const files = (await readdir(ROOT)).filter(f => f.endsWith('.html'));
const idsCache = new Map();
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
const idsOf = async (file) => {
  if (!idsCache.has(file)) {
    const html = await readFile(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
  }
  return idsCache.get(file);
};

const errors = [];
let checked = 0;
for (const f of files) {
  const html = await readFile(path.join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const url = m[1];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(url)) continue;
    checked++;
    const [pathPart, hash] = url.split('#');
    const target = pathPart === ''
      ? path.join(ROOT, f)
      : path.join(ROOT, pathPart.startsWith('/') ? pathPart : path.join(path.dirname(f), pathPart), pathPart.endsWith('/') ? 'index.html' : '');
    if (!(await exists(target))) { errors.push(`${f}: odkaz „${url}“ vede na neexistující soubor`); continue; }
    if (hash && target.endsWith('.html') && !(await idsOf(target)).has(hash)) errors.push(`${f}: kotva „#${hash}“ na stránce ${path.relative(ROOT, target)} neexistuje`);
  }
}
for (const e of errors) console.log('✗ ' + e);
if (errors.length) { console.log(`\n❌ ${errors.length} nefunkčních odkazů.`); process.exit(1); }
console.log(`✅ Zkontrolováno ${checked} odkazů v ${files.length} stránkách, vše v pořádku.`);
