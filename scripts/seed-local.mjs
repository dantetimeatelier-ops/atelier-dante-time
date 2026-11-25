// Testovací data POUZE pro místní vývoj (nikdy na ostrý web).
// Spuštění: npm run seed:local
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = path.join(ROOT, '.wrangler', 'seed');
mkdirSync(tmp, { recursive: true });
const w = (...args) => execFileSync('npx', ['wrangler', ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });

const watches = [
  ['t1', 'test-prim-sport-1968', 'available', 'TEST – PRIM Sport', 'PRIM', 'Sport', '1968', 'PRIM 50', 'manual', 'chromovaná mosaz', 35, 18, 18500, 1],
  ['t2', 'test-omega-seamaster-1962', 'available', 'TEST – Omega Seamaster', 'Omega', 'Seamaster', '1962', 'Omega cal. 552', 'automatic', 'ocel', 34, 18, 42000, 1],
  ['t3', 'test-zaria-1975', 'sold', 'TEST – Zaria', 'Zaria', '', '1975', 'Zaria 2009', 'manual', 'pozlacená mosaz', 33, 16, 6900, 0],
  ['t4', 'test-doxa-projekt', 'in_progress', 'TEST – Doxa (renovace)', 'Doxa', '', '1955', 'Doxa cal. 102', 'manual', 'ocel', 35, 18, null, 0],
];
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
let sql = "DELETE FROM product_images; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products WHERE id LIKE 't%';\n";
for (const [id, slug, status, title, brand, model, year, movement, mt, mat, dia, lug, price, featured] of watches) {
  sql += `INSERT INTO products (id, slug, status, title, brand, model, year, movement, movement_type, case_material, case_diameter_mm, lug_width_mm, dial, crystal, strap, condition, service_done, original_parts, replaced_parts, price_czk, featured, published_at, description_cs, description_en)
VALUES (${[id, slug, status, title, brand, model, year, movement, mt, mat, dia, lug, 'stříbrný', 'akrylátové', 'kožený, hnědý', 'velmi dobrý, drobné stopy používání', 'kompletní servis, čištění, mazání, regulace', 'strojek, ciferník, ručky, pouzdro', 'sklíčko, řemínek', price, featured].map(q).join(', ')}, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ${q(`Testovací kus ${title}. Popis vygeneruje administrace.`)}, ${q(`Test piece ${title}.`)});\n`;
  sql += `INSERT INTO product_images (id, product_id, key_large, key_small, width, height, alt, sort_order) VALUES ('img${id}', '${id}', 'products/${id}/img${id}-l.webp', 'products/${id}/img${id}-s.webp', 720, 1280, ${q(title)}, 0);\n`;
}
sql += `UPDATE settings SET value='99' WHERE key='shipping_zasilkovna_czk'; UPDATE settings SET value='89' WHERE key='shipping_balikovna_czk';\n`;
writeFileSync(path.join(tmp, 'seed.sql'), sql);
w('d1', 'execute', 'DB', '--local', '--file', path.join(tmp, 'seed.sql'));
for (const [id] of watches) {
  w('r2', 'object', 'put', `dante-time-media/products/${id}/img${id}-l.webp`, '--local', '--file', path.join(ROOT, 'public/img/watch-box-720.webp'), '--content-type', 'image/webp');
  w('r2', 'object', 'put', `dante-time-media/products/${id}/img${id}-s.webp`, '--local', '--file', path.join(ROOT, 'public/img/watch-box-400.webp'), '--content-type', 'image/webp');
}
console.log('✅ Testovací data nahrána (jen místně).');
