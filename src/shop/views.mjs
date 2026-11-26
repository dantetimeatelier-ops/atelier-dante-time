// Vykreslení katalogu a detailu hodinek (používají serverové funkce)
import { esc, hero } from '../layout.mjs';
import { PAGES, SITE } from '../site.mjs';
import { formatCzk, STATUS, KIND, METAL, PRECIOUS } from './format.mjs';
import { productName, productJsonLd, authenticityParts, AUTH_PARTS, describe } from './describe.mjs';
import { INDEPENDENCE } from '../site.mjs';
import { TERMS } from '../terms.mjs';
import { warrantyShortCs } from '../legal/cs.mjs';
import { warrantyShortEn } from '../legal/en.mjs';
import { inquiryForm } from '../pages/marketing.mjs';

const T = (lang, cs, en) => (lang === 'cs' ? cs : en);
export const productPath = (p, lang) => (lang === 'cs' ? `/hodinky/${p.slug}` : `/en/watches/${p.slug}`);
const img = (key) => `/media/${key}`;

export function productCard(p, lang) {
  const first = p.images?.find((i) => i.media !== 'video') || p.images?.[0];
  const st = STATUS[p.status]?.[lang] || '';
  const price = p.status === 'sold' ? '' : (p.price_czk != null ? `<span class="price">${formatCzk(p.price_czk, lang)}</span>` : '');
  return `<a class="product-card" href="${productPath(p, lang)}">
  <div class="ph">${first ? `<img src="${img(first.key_small)}" width="${first.width || 800}" height="${first.height || 1000}" alt="${esc(first.alt || productName(p))}" loading="lazy" decoding="async">` : ''}</div>
  <div class="meta">
    <span class="status ${p.status}">${esc(st)}</span>
    <h3 style="margin-top:10px">${esc(productName(p))}</h3>
    <div class="sub">${esc([p.kind && p.kind !== 'original' ? KIND[p.kind]?.[lang] : null, p.year, p.movement, p.case_diameter_mm && `${p.case_diameter_mm} mm`].filter(Boolean).join(' · '))}</div>
    ${p.case_metal === 'pozlaceno' || PRECIOUS.includes(p.case_metal) ? `<div class="sub metal">${esc(METAL[p.case_metal][lang])}</div>` : ''}
    <div style="margin-top:10px">${price}</div>
  </div>
</a>`;
}

export function collectionPage({ products, lang, filter, mode }) {
  const L = (cs, en) => T(lang, cs, en);
  const base = PAGES.collection[lang];
  const f = (key, label) => `<a href="${base}${key ? `?stav=${key}` : ''}"${(filter || '') === key ? ' aria-current="true"' : ''}>${label}</a>`;
  const list = products.length
    ? `<div class="products">${products.map((p) => productCard(p, lang)).join('')}</div>`
    : `<div class="empty"><p>${L('Momentálně připravujeme nové kusy. Sledujte nás na Instagramu nebo si nechte poslat zprávu, až budou k dispozici.', 'New pieces are being prepared. Follow us on Instagram or ask to be notified when they are available.')}</p><a class="btn" href="${PAGES.contact[lang]}">${L('Mám zájem o upozornění', 'Notify me')}</a></div>`;
  return {
    title: L('Kolekce mechanických hodinek', 'Mechanical watch collection'),
    description: L('Unikátní renovované mechanické hodinky z ateliéru Dante Time. Každý kus existuje jen jednou, s doživotní garancí pravosti deklarovaných originálních dílů.', 'Unique restored mechanical watches from Atelier Dante Time. Each piece exists only once, with a lifetime authenticity guarantee on declared original parts.'),
    body: `${hero({ eyebrow: L('Kolekce', 'Collection'), title: L('Hodinky z ateliéru', 'Watches from the atelier'), lead: L('Každý kus prošel kompletním servisem nebo renovací v ateliéru. Unikátní – každé hodinky existují jen jednou.', 'Every piece has been fully serviced or restored in the atelier. Unique – each watch exists only once.') })}
<section class="section" style="padding-top:12px"><div class="wrap">
  <nav class="filters" aria-label="${L('Filtr', 'Filter')}">
    ${f('', L('Vše', 'All'))}${f('available', L('Skladem', 'Available'))}${f('in_progress', L('V přípravě', 'In preparation'))}${f('sold', L('Prodané', 'Sold'))}
  </nav>
  ${list}
  ${mode === 'preview' ? `<p class="notice" style="margin-top:24px">${L('E-shop spouštíme. Do té doby můžete o kterýkoli kus projevit nezávazný zájem a domluvíme se osobně.', 'Our online shop is launching soon. Until then you can enquire about any piece and we will arrange the details personally.')}</p>` : ''}
</div></section>`,
  };
}

const row = (label, value) => (value != null && String(value).trim() !== '' ? `<tr><th scope="row">${label}</th><td>${esc(value)}</td></tr>` : '');

export function productPage({ p, images, lang, mode, origin }) {
  const L = (cs, en) => T(lang, cs, en);
  const name = productName(p);
  const desc = (lang === 'en' ? p.description_en : p.description_cs) || p.description_cs || '';
  const main = images.find((i) => i.media !== 'video') || images[0];
  const photos = images.filter((i) => i.media !== 'video');
  const isVideo = (i) => i.media === 'video' && i.key_video;
  const gallery = images.length ? `<div class="gallery" data-gallery>
  <div class="main" data-stage><img data-main src="${img(main.key_large)}" width="${main.width || 1600}" height="${main.height || 2000}" alt="${esc(main.alt || name)}" fetchpriority="high"></div>
  ${images.length > 1 ? `<div class="thumbs">${images.map((i, n) => `<button type="button" data-src="${img(i.key_large)}" data-alt="${esc(i.alt || name)}"${isVideo(i) ? ` data-video="${img(i.key_video)}" data-vw="${i.width || 1080}" data-vh="${i.height || 1920}" class="is-video"` : ''}${i === main ? ' aria-current="true"' : ''}><img src="${img(i.key_small)}" alt="" loading="lazy"><span class="sr">${isVideo(i) ? L('Video', 'Video') : L('Fotografie', 'Photo')} ${n + 1}</span></button>`).join('')}</div>` : ''}
</div>` : `<div class="gallery"><div class="main"></div></div>`;

  const canBuy = p.status === 'available' && p.price_czk != null && mode !== 'preview';
  let action;
  if (canBuy) {
    action = `<button class="btn solid block" type="button" data-add-to-cart="${esc(p.id)}" data-cart-url="${PAGES.cart[lang]}">${L('Vložit do košíku', 'Add to cart')}</button>`;
  } else if (p.status === 'available' || p.status === 'in_progress') {
    action = `<a class="btn solid block" href="#zajem">${L('Mám zájem o tyto hodinky', 'I am interested in this watch')}</a>`;
  } else if (p.status === 'reserved') {
    action = `<p class="notice">${L('Tento kus je právě rezervován. Pokud rezervace vyprší, bude znovu k dispozici.', 'This piece is currently reserved. If the reservation expires it will become available again.')}</p><a class="btn block" href="#zajem">${L('Upozornit mě', 'Notify me')}</a>`;
  } else {
    action = `<p class="notice">${L('Tento kus už našel nového majitele. Rád vám pomohu najít podobné hodinky.', 'This piece has found a new owner. I will gladly help you find something similar.')}</p><a class="btn block" href="#zajem">${L('Hledám podobné hodinky', 'Looking for something similar')}</a>`;
  }

  const ld = productJsonLd(p, photos, origin, lang);
  return {
    title: p.seo_title || name,
    // Bez ručně vyplněného popisu se použije automatický popis z parametrů (meta description nesmí chybět)
    description: p.seo_description || desc.slice(0, 155) || (lang === 'cs' ? describe(p).seo_description : describe(p).description_en.slice(0, 155)),
    image: main ? `${origin}/media/${main.key_large}` : undefined,
    ogType: 'product',
    head: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    scripts: ['/assets/product.js', '/assets/forms.js'],
    body: `<section class="section"><div class="wrap">
  <p class="doc-meta"><a href="${PAGES.collection[lang]}">← ${L('Kolekce', 'Collection')}</a></p>
  <div class="product">
    ${gallery}
    <div class="buybox card">
      <span class="status ${p.status}">${esc(STATUS[p.status]?.[lang] || '')}</span> <span class="status">${esc(KIND[p.kind || 'original']?.[lang] || '')}</span>
      <h1 style="font-size:clamp(30px,4vw,44px);margin-top:12px">${esc(name)}</h1>
      ${p.year ? `<p class="doc-meta">${esc(p.year)}</p>` : ''}
      ${p.status !== 'sold' && p.price_czk != null ? `<p class="price" style="font-size:30px;margin:10px 0 2px">${formatCzk(p.price_czk, lang)}</p><p class="doc-meta">${L('Konečná cena', 'Final price')}${mode === 'preview' ? '' : `, ${L('doprava podle zvoleného způsobu', 'shipping depends on the chosen method')}`}</p>` : ''}
      <div style="margin:18px 0">${action}</div>
      <ul class="list-dots" style="font-size:14px">
        <li>${L('Unikátní kus – existuje jen jednou', 'Unique piece – exists only once')}</li>
        <li>${L('Doživotní garance pravosti deklarovaných originálních strojků, ciferníků a ručiček', 'Lifetime authenticity guarantee on declared original movements, dials and hands')} (<a href="${lang === 'cs' ? '/warranty' : '/en/warranty'}">${L('podmínky', 'terms')}</a>)</li>
        <li>${L(`${warrantyShortCs().replace(/^z/, 'Z')} (<a href="/warranty">podmínky</a>) a ${TERMS.withdrawalDays} dní na odstoupení od smlouvy u nákupu na dálku`, `${warrantyShortEn()} (<a href="/en/warranty">terms</a>) and ${TERMS.withdrawalDays}-day right of withdrawal for distance purchases`)}</li>
        <li>${L('Doručení do celé EU, platba v CZK nebo EUR', 'Delivery across the EU, payment in CZK or EUR')}</li>
      </ul>
    </div>
  </div>
  <div class="split" style="margin-top:28px">
    <div class="card prose">
      <h2>${L('Popis', 'Description')}</h2>
      ${desc.split(/\n\s*\n/).map((t) => `<p>${esc(t.trim())}</p>`).join("")}
    </div>
    <div class="card">
      <h2>${L('Parametry', 'Specifications')}</h2>
      <table class="specs"><tbody>
        ${row(L('Značka', 'Brand'), p.brand)}${row('Model', p.model)}${row(L('Reference', 'Reference'), p.reference)}${row(L('Rok výroby', 'Year'), p.year)}
        ${row(L('Strojek', 'Movement'), p.movement)}${row(L('Nátah', 'Winding'), p.movement_type === 'manual' ? L('ruční', 'manual') : p.movement_type === 'automatic' ? L('automatický', 'automatic') : '')}
        ${row(L('Druh', 'Type'), KIND[p.kind || 'original']?.[lang])}${row(L('Pouzdro', 'Case'), METAL[p.case_metal]?.[lang])}${row(L('Ryzost a punc', 'Fineness & hallmark'), p.hallmark)}${row(L('Pozlacení', 'Plating'), p.plating)}${row(L('Materiál pouzdra – detail', 'Case material – detail'), p.case_material)}${row(L('Průměr pouzdra', 'Case diameter'), p.case_diameter_mm && `${p.case_diameter_mm} mm`)}${row(L('Šířka uchycení', 'Lug width'), p.lug_width_mm && `${p.lug_width_mm} mm`)}
        ${row(L('Ciferník', 'Dial'), p.dial)}${row(L('Sklíčko', 'Crystal'), p.crystal)}${row(L('Řemínek', 'Strap'), p.strap)}${row(L('Vodotěsnost', 'Water resistance'), p.water_resistance || L('není určeno do vody', 'not intended for water'))}
        ${row(L('Stav', 'Condition'), p.condition)}${row(L('Provedené práce', 'Work carried out'), p.service_done)}
        ${row(L('Původní originální součásti', 'Original components'), p.original_parts)}${row(L('Doživotní garance pravosti', 'Lifetime authenticity guarantee'), authenticityParts(p).map((x) => AUTH_PARTS[x][lang]).join(', '))}${row(L('Ověření originality', 'Authenticity check'), p.authenticity_note)}${row(L('Nové součásti z přestavby Dante Time / vyměněné díly', 'New components from the Dante Time rebuild / replaced parts'), p.replaced_parts)}${row(L('Hmotnost drahého kovu', 'Precious metal weight'), p.precious_weight_g && `${p.precious_weight_g} g`)}${row(L('Příslušenství', 'Accessories'), p.accessories)}
      </tbody></table>
      ${p.manufacturer_info || p.safety_info ? `<h3 style="margin-top:20px">${L('Informace o výrobku', 'Product information')}</h3>${p.manufacturer_info ? `<p style="font-size:14px">${L('Výrobce', 'Manufacturer')}: ${esc(p.manufacturer_info)}</p>` : ''}${p.safety_info ? `<p style="font-size:14px">${esc(p.safety_info)}</p>` : ''}` : ''}
    </div>
  </div>
  <p class="doc-meta" style="margin-top:18px">${INDEPENDENCE[lang]}</p>
  <div class="card" id="zajem" style="margin-top:28px">
    <h2>${L('Dotaz k těmto hodinkám', 'Ask about this watch')}</h2>
    ${inquiryForm(lang, 'product', p.id)}
  </div>
</div></section>`,
  };
}

export const notFoundBody = (lang) => `${hero({ eyebrow: '404', title: T(lang, 'Tato stránka se zastavila v čase', 'This page has stopped in time'), lead: T(lang, 'Stránku, kterou hledáte, se nepodařilo najít.', 'The page you are looking for could not be found.') })}
<section class="section"><div class="wrap cta-row" style="justify-content:flex-start"><a class="btn solid" href="${PAGES.home[lang]}">${T(lang, 'Hlavní stránka', 'Home')}</a><a class="btn ghost" href="${PAGES.collection[lang]}">${T(lang, 'Kolekce', 'Collection')}</a></div></section>`;

export const SHOP_BANNER = {
  preview: '',
  test: '<strong>TESTOVACÍ PROVOZ</strong> – objednávky nejsou závazné a platby neprobíhají doopravdy.',
  live: '',
};
export const siteEmail = SITE.email;
