// Veřejný seznam hodinek (pro ukázku na hlavní stránce)
import { json, handle } from '../../server/http.js';
import { productsWithImages, releaseExpired } from '../../server/db.js';
import { productCard } from '../../src/shop/views.mjs';

export const onRequestGet = handle(async ({ env, request }) => {
  const u = new URL(request.url);
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'cs';
  const limit = Math.min(Number(u.searchParams.get('limit')) || 12, 24);
  await releaseExpired(env);
  const where = u.searchParams.get('featured') ? "status IN ('available','reserved','in_progress')" : "status IN ('available','reserved','in_progress','sold')";
  const products = await productsWithImages(env, where, [], "featured DESC, CASE status WHEN 'available' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, sort_order ASC, published_at DESC", limit);
  return json({ count: products.length, html: products.map((p) => productCard(p, lang)).join('') }, 200, { 'Cache-Control': 'public, max-age=60' });
});
