// Ukázková data pro ZKUŠEBNÍ verzi a místní vývoj. Nikdy pro ostrý web.
// Ceny i údaje jsou smyšlené a hodinky jsou označeny jako ukázka.
import { describe } from '../src/shop/describe.mjs';

const W = [
  { id: 'demo1', slug: 'ukazka-omega-seamaster-1962', status: 'available', kind: 'original', brand: 'Omega', model: 'Seamaster', year: '1962', movement: 'Omega cal. 552', movement_type: 'automatic', case_metal: 'ocel', case_diameter_mm: 34, lug_width_mm: 18, dial: 'stříbrný s patinou', crystal: 'akrylátové', strap: 'kožený, hnědý', condition: 'velmi dobrý, drobné stopy používání', service_done: 'kompletní servis, čištění, mazání, regulace chodu', original_parts: 'strojek, ciferník, ručky, korunka, pouzdro', replaced_parts: 'sklíčko, řemínek', price_czk: 42000, featured: 1 },
  { id: 'demo2', slug: 'ukazka-omega-geneve-zlato-1958', status: 'available', kind: 'original', brand: 'Omega', model: 'Genève', year: '1958', movement: 'Omega cal. 284', movement_type: 'manual', case_metal: 'zlato', hallmark: 'Au 750/1000, česká puncovní značka (ukázka)', case_diameter_mm: 35, lug_width_mm: 18, dial: 'champagne', crystal: 'akrylátové', strap: 'kožený, černý', condition: 'výborný', service_done: 'kompletní servis, nové těsnění korunky', original_parts: 'strojek, ciferník, ručky, pouzdro', price_czk: 89000, featured: 1 },
  { id: 'demo3', slug: 'ukazka-prim-sport-prestavba', status: 'available', kind: 'prestavba', brand: 'PRIM', model: 'Sport', year: '1968', movement: 'PRIM 50', movement_type: 'manual', case_metal: 'pozlaceno', plating: 'pozlaceno 20 µm', case_diameter_mm: 35, lug_width_mm: 18, dial: 'černý, renovovaný', crystal: 'akrylátové', strap: 'kožený, tmavě hnědý', condition: 'po renovaci', service_done: 'servis strojku, renovace ciferníku', original_parts: 'strojek, pouzdro', replaced_parts: 'ciferník (renovovaný), ručky (dobové, neoriginální)', price_czk: 14900, featured: 1 },
  { id: 'demo4', slug: 'ukazka-prim-1965', status: 'sold', kind: 'original', brand: 'PRIM', model: 'Orlík', year: '1965', movement: 'PRIM 70', movement_type: 'manual', case_metal: 'pozlaceno', plating: 'pozlaceno', case_diameter_mm: 34, lug_width_mm: 18, dial: 'bílý', crystal: 'akrylátové', strap: 'kovový tah', condition: 'velmi dobrý', service_done: 'kompletní servis', original_parts: 'strojek, ciferník, ručky', price_czk: 9900, featured: 0 },
];

const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

/** SQL, které vloží ukázková data jen jednou (příznak demo_seeded). */
export function demoSql({ reset = false } = {}) {
  let sql = '';
  if (reset) sql += "DELETE FROM withdrawals; DELETE FROM invoices; DELETE FROM product_images; DELETE FROM order_items; DELETE FROM orders; DELETE FROM products WHERE id LIKE 'demo%'; DELETE FROM settings WHERE key = 'demo_seeded';\n";
  for (const w of W) {
    const d = describe(w);
    const p = { ...w, title: `${w.brand} ${w.model} – ukázka`, condition: `${w.condition} (ukázkový kus)`, ...d };
    p.description_cs = `UKÁZKA – smyšlený kus pro zkušební verzi. ${d.description_cs}`;
    const keys = Object.keys(p);
    sql += `INSERT INTO products (${keys.join(', ')}, published_at) SELECT ${keys.map((k) => q(p[k])).join(', ')}, strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n`;
    sql += `INSERT INTO product_images (id, product_id, key_large, key_small, width, height, alt, sort_order) SELECT 'img${w.id}', '${w.id}', 'products/${w.id}/img${w.id}-l.webp', 'products/${w.id}/img${w.id}-s.webp', 800, 1000, ${q(`${w.brand} ${w.model}`)}, 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n`;
  }
  // Ukázkové nastavení dopravy a dobírky (jen zkušební verze)
  sql += "UPDATE settings SET value = '99' WHERE key = 'shipping_zasilkovna_czk' AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n";
  sql += "UPDATE settings SET value = '89' WHERE key = 'shipping_balikovna_czk' AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n";
  sql += "UPDATE settings SET value = '1' WHERE key = 'cod_enabled' AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n";
  sql += "UPDATE settings SET value = '40' WHERE key = 'cod_fee_czk' AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'demo_seeded');\n";
  sql += "INSERT OR IGNORE INTO settings (key, value) VALUES ('demo_seeded', '1');\n";
  return sql;
}

export const demoImages = W.flatMap((w) => [
  { key: `products/${w.id}/img${w.id}-l.webp`, file: `scripts/demo-media/${w.id}-l.webp` },
  { key: `products/${w.id}/img${w.id}-s.webp`, file: `scripts/demo-media/${w.id}-s.webp` },
]);
