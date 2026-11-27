// Produktový feed pro Google Merchant Center – adresa /feed/google.xml (zadává se v Merchant Center → Zdroje dat)
import { productsWithImages, releaseExpired } from '../../server/db.js';
import { googleFeed } from '../../src/shop/feed.mjs';
import { SITE } from '../../src/site.mjs';

export const onRequestGet = async ({ env }) => {
  let products = [];
  try { await releaseExpired(env); products = await productsWithImages(env, "status IN ('available','reserved')"); } catch { /* bez DB prázdný feed */ }
  return new Response(googleFeed(products, SITE.origin), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
