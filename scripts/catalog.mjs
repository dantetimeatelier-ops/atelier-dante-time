// Katalog hodinek v repozitáři (složka katalog/<slug>/).
// Hodinky připravuje agent z podkladů majitele (fotografie, údaje, cena) a nasazení je
// automaticky zapíše do databáze e-shopu a fotografie do úložiště. Administrace zůstává
// plně funkční; pole spravovaná katalogem se při dalším nasazení přepíší podle repozitáře.
//
// Struktura:
//   katalog/<slug>/hodinky.json   – údaje (viz CATALOG_FIELDS)
//   katalog/<slug>/NN-l.webp      – fotografie velká (max. 2000 px), bez metadat
//   katalog/<slug>/NN-s.webp      – fotografie malá (max. 800 px)
//   katalog/<slug>/NN.mp4         – video (u položky s "video": true; NN-l/-s.webp je náhled)
// Pořadí fotografií = pořadí v poli "fotky"; první je hlavní.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { puncCheck } from '../src/shop/punc.mjs';
import { KIND, METAL } from '../src/shop/format.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const CATALOG_DIR = path.join(ROOT, 'katalog');

export const CATALOG_FIELDS = ['title', 'kind', 'brand', 'model', 'reference', 'year', 'movement', 'movement_type', 'case_metal', 'hallmark', 'plating',
  'precious_weight_g', 'case_material', 'case_diameter_mm', 'lug_width_mm', 'crystal', 'water_resistance', 'dial', 'strap', 'condition', 'service_done',
  'original_parts', 'authenticity_parts', 'authenticity_note', 'serial_ref', 'replaced_parts', 'accessories', 'manufacturer_info', 'safety_info',
  'description_cs', 'description_en', 'seo_title', 'seo_description', 'price_czk', 'featured', 'sort_order'];
const STATUSES = ['draft', 'in_progress', 'available'];

const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12);

/** Načte a zkontroluje celý katalog. Při chybě vyhodí výjimku s popisem (nasazení se zastaví). */
export function loadCatalog(dir = CATALOG_DIR) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const slug of readdirSync(dir).sort()) {
    const file = path.join(dir, slug, 'hodinky.json');
    if (!existsSync(file)) continue;
    const w = JSON.parse(readFileSync(file, 'utf8'));
    const err = (m) => { throw new Error(`katalog/${slug}: ${m}`); };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err('název složky smí obsahovat jen malá písmena, číslice a pomlčky');
    if (!STATUSES.includes(w.status)) err(`stav musí být jeden z ${STATUSES.join(', ')}`);
    if (!w.title) err('chybí název (title)');
    if (w.kind && !KIND[w.kind]) err(`neznámý druh ${w.kind}`);
    if (w.case_metal && !METAL[w.case_metal]) err(`neznámý materiál pouzdra ${w.case_metal}`);
    if (w.status === 'available' && !(Number.isInteger(w.price_czk) && w.price_czk > 0)) err('hodinky „skladem“ musí mít cenu v Kč');
    if (w.status === 'available' && !w.fotky?.length) err('hodinky „skladem“ musí mít alespoň jednu fotografii');
    for (const k of Object.keys(w)) if (!CATALOG_FIELDS.includes(k) && !['status', 'fotky', 'poznamka'].includes(k)) err(`neznámé pole ${k}`);
    const punc = puncCheck(w, { punc_notified: process.env.PUNC_NOTIFIED || '0' });
    if (punc) err(punc);
    const fotky = (w.fotky || []).map((f, i) => {
      const large = path.join(dir, slug, `${f.soubor}-l.webp`);
      const small = path.join(dir, slug, `${f.soubor}-s.webp`);
      if (!existsSync(large) || !existsSync(small)) err(`chybí soubory fotografie ${f.soubor}`);
      const h = sha(large);
      const item = { id: `kat-${slug}-${i + 1}`, alt: f.alt || w.title, width: f.width ?? null, height: f.height ?? null, sort: i, media: f.video ? 'video' : 'image',
        large: { file: large, key: `catalog/${slug}/${h}-l.webp`, type: 'image/webp' }, small: { file: small, key: `catalog/${slug}/${h}-s.webp`, type: 'image/webp' } };
      if (f.video) {
        const v = path.join(dir, slug, `${f.soubor}.mp4`);
        if (!existsSync(v)) err(`chybí video ${f.soubor}.mp4`);
        if (readFileSync(v).length > 20e6) err(`video ${f.soubor}.mp4 je větší než 20 MB`);
        item.video = { file: v, key: `catalog/${slug}/${sha(v)}.mp4`, type: 'video/mp4' };
      }
      return item;
    });
    const dupName = out.find((x) => String(x.title).trim().toLowerCase() === String(w.title).trim().toLowerCase());
    if (dupName) err(`název modelu „${w.title}“ už má katalog/${dupName.slug} – každý kus musí mít jiný název`);
    out.push({ ...w, id: `kat-${slug}`, slug, fotky });
  }
  return out;
}

/** SQL: vloží nové hodinky a aktualizuje existující. Rezervované a prodané kusy si stav ponechají. */
export function catalogSql(list) {
  let sql = '';
  for (const w of list) {
    const cols = CATALOG_FIELDS.filter((k) => k in w);
    const vals = cols.map((k) => q(w[k] ?? null));
    const pub = w.status === 'draft' ? 'NULL' : "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
    sql += `INSERT INTO products (id, slug, status, published_at, ${cols.join(', ')}) VALUES (${q(w.id)}, ${q(w.slug)}, ${q(w.status)}, ${pub}, ${vals.join(', ')})
ON CONFLICT(id) DO UPDATE SET ${cols.map((k) => `${k} = excluded.${k}`).join(', ')},
  status = CASE WHEN products.status IN ('reserved', 'sold') THEN products.status ELSE excluded.status END,
  published_at = COALESCE(products.published_at, excluded.published_at),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');\n`;
    sql += `DELETE FROM product_images WHERE product_id = ${q(w.id)};\n`;
    for (const f of w.fotky) {
      sql += `INSERT INTO product_images (id, product_id, key_large, key_small, width, height, alt, sort_order, media, key_video) VALUES (${[f.id, w.id, f.large.key, f.small.key, f.width, f.height, f.alt, f.sort, f.media, f.video?.key ?? null].map(q).join(', ')});\n`;
    }
  }
  return sql;
}

/** Seznam souborů k nahrání do úložiště fotografií. */
export const catalogMedia = (list) => list.flatMap((w) => w.fotky.flatMap((f) => [f.large, f.small, f.video].filter(Boolean)));
