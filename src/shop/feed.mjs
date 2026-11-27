// Produktový feed pro Google Merchant Center (bezplatné zobrazení v Google Nákupech).
// Jen hodinky v prodeji s cenou; formát RSS 2.0 se jmenným prostorem g: podle specifikace Google.
import { productName } from './describe.mjs';

const x = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AVAIL = { available: 'in_stock', reserved: 'out_of_stock' };

export function googleFeed(products, origin, { title = 'Atelier Dante Time' } = {}) {
  const items = products
    .filter((p) => AVAIL[p.status] && p.price_czk != null && (p.images || []).some((i) => i.media !== 'video'))
    .map((p) => {
      const photos = p.images.filter((i) => i.media !== 'video');
      const desc = String(p.description_cs || p.seo_description || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
      return `<item>
<g:id>${x(p.id)}</g:id>
<g:title>${x(productName(p).slice(0, 150))}</g:title>
<g:description>${x(desc)}</g:description>
<g:link>${x(`${origin}/hodinky/${p.slug}`)}</g:link>
<g:image_link>${x(`${origin}/media/${photos[0].key_large}`)}</g:image_link>
${photos.slice(1, 11).map((i) => `<g:additional_image_link>${x(`${origin}/media/${i.key_large}`)}</g:additional_image_link>`).join('\n')}
<g:availability>${AVAIL[p.status]}</g:availability>
<g:price>${Number(p.price_czk).toFixed(2)} CZK</g:price>
<g:condition>used</g:condition>
${p.brand ? `<g:brand>${x(p.brand)}</g:brand>` : ''}
<g:identifier_exists>no</g:identifier_exists>
<g:google_product_category>201</g:google_product_category>
<g:product_type>${x(`Hodinky > ${p.kind === 'prestavba' ? 'Přestavby' : 'Mechanické hodinky'}`)}</g:product_type>
</item>`.replace(/\n\n/g, '\n');
    });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${x(title)}</title>
<link>${x(origin)}</link>
<description>Unikátní mechanické hodinky z ateliéru Dante Time</description>
${items.join('\n')}
</channel>
</rss>
`;
}
