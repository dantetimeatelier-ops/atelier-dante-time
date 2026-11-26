// Katalog a detail hodinek (sdíleno pro CZ i EN adresy)
import { page } from './render.js';
import { productsWithImages, releaseExpired, mode } from './db.js';
import { collectionPage, productPage, notFoundBody, productPath } from '../src/shop/views.mjs';
import { PAGES } from '../src/site.mjs';

export async function renderCollection({ env, request }, lang) {
  await releaseExpired(env);
  const u = new URL(request.url);
  const filter = ['available', 'in_progress', 'sold'].includes(u.searchParams.get('stav')) ? u.searchParams.get('stav') : '';
  const where = filter ? 'status = ?' : "status IN ('available','reserved','in_progress','sold')";
  const products = await productsWithImages(env, where, filter ? [filter] : [], "CASE status WHEN 'available' THEN 0 WHEN 'reserved' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, featured DESC, sort_order ASC, published_at DESC");
  const o = collectionPage({ products, lang, filter, mode: mode(env) });
  const other = lang === 'cs' ? 'en' : 'cs';
  return page(env, { ...o, lang, path: PAGES.collection[lang], alternate: PAGES.collection[other], active: 'collection' });
}

export async function renderProduct({ env, request, params }, lang) {
  await releaseExpired(env);
  const slug = String(params.slug || '');
  const [p] = await productsWithImages(env, "slug = ? AND status <> 'draft'", [slug]);
  if (!p) return page(env, { lang, title: lang === 'cs' ? 'Nenalezeno' : 'Not found', description: '', path: request.url ? new URL(request.url).pathname : '/', noindex: true, body: notFoundBody(lang) }, 404, 'no-store');
  const origin = new URL(request.url).origin;
  const o = productPage({ p, images: p.images, lang, mode: mode(env), origin });
  const other = lang === 'cs' ? 'en' : 'cs';
  return page(env, { ...o, lang, path: productPath(p, lang), alternate: productPath(p, other), active: 'collection', noindex: p.status === 'archived' });
}
