// Mapa webu včetně všech zveřejněných hodinek
import { SITE, PAGES, SERVICES_OFFERED } from '../src/site.mjs';
import { ALL_LEGAL } from '../src/legal/docs.mjs';

export const onRequestGet = async ({ env }) => {
  const urls = [];
  for (const key of ['home', 'collection', ...(SERVICES_OFFERED ? ['services'] : []), 'about', 'care', 'contact']) {
    urls.push({ loc: PAGES[key].cs, alt: PAGES[key].en }, { loc: PAGES[key].en, alt: PAGES[key].cs });
  }
  for (const d of ALL_LEGAL) urls.push({ loc: d.path });
  let products = [];
  try { ({ results: products } = await env.DB.prepare("SELECT slug, updated_at FROM products WHERE status IN ('available','reserved','in_progress','sold')").all()); } catch { /* bez DB jen statické stránky */ }
  for (const p of products) {
    urls.push({ loc: `/hodinky/${p.slug}`, alt: `/en/watches/${p.slug}`, mod: p.updated_at }, { loc: `/en/watches/${p.slug}`, alt: `/hodinky/${p.slug}`, mod: p.updated_at });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${SITE.origin}${u.loc}</loc>${u.mod ? `<lastmod>${u.mod.slice(0, 10)}</lastmod>` : ''}${u.alt ? `<xhtml:link rel="alternate" hreflang="${u.loc.startsWith('/en') ? 'cs' : 'en'}" href="${SITE.origin}${u.alt}"/>` : ''}</url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
