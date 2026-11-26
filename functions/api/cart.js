// Ověření obsahu košíku: aktuální ceny a dostupnost
import { json, handle, readJson } from '../../server/http.js';
import { productsWithImages, releaseExpired } from '../../server/db.js';
import { productName } from '../../src/shop/describe.mjs';
import { productPath } from '../../src/shop/views.mjs';

export const onRequestPost = handle(async ({ env, request }) => {
  const body = await readJson(request);
  const lang = body.lang === 'en' ? 'en' : 'cs';
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x) => typeof x === 'string'))].slice(0, 10) : [];
  if (!ids.length) return json({ items: [], unavailable: [] });
  await releaseExpired(env);
  const products = await productsWithImages(env, `id IN (${ids.map(() => '?').join(',')})`, ids);
  const items = products.filter((p) => p.status === 'available' && p.price_czk != null).map((p) => ({
    id: p.id, title: productName(p), price: p.price_czk, url: productPath(p, lang),
    image: p.images[0] ? `/media/${p.images[0].key_small}` : null,
  }));
  return json({ items, unavailable: ids.filter((id) => !items.some((i) => i.id === id)) });
});
