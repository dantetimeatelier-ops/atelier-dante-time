// Sdílený vzhled všech stránek: <head>, hlavička, patička.
// Používá ho generátor statických stránek i serverové funkce (katalog).
import { SITE, PAGES, INDEPENDENCE, OPERATOR } from './site.mjs';
import { UI } from './i18n/ui.mjs';
import { ASSET_V } from './asset-version.mjs';
const asset = (u) => (u.startsWith('/assets/') ? `${u}?v=${ASSET_V}` : u);

export const esc = (s) => String(s ?? '')
  .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const LOGO = '/img/logo-160.webp';

// Ikony sociálních sítí (vlastní SVG, žádné externí skripty ani sledování)
const ICON = {
  instagram: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/></svg>',
  tiktok: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3M13.5 3.5c.4 2.6 2.2 4.3 5 4.6"/></svg>',
  facebook: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M14.5 8.5h2.3V5h-2.6c-2.4 0-3.9 1.6-3.9 4v2.3H8v3.4h2.3V21h3.4v-6.3h2.6l.5-3.4h-3.1V9.6c0-.7.3-1.1.8-1.1Z"/></svg>',
};
export function socialLinks(cls = 'social') {
  return [['instagram', 'Instagram', SITE.instagram], ['tiktok', 'TikTok', SITE.tiktok], ['facebook', 'Facebook', SITE.facebook]]
    .filter(([, , url]) => url)
    .map(([k, label, url]) => `<a class="${cls}-link" href="${url}" rel="noopener noreferrer" target="_blank" aria-label="${label}">${ICON[k]}<span>${label}</span></a>`).join('');
}

function nav(lang, active, shopEnabled) {
  const t = UI[lang];
  const items = [
    ['collection', t.nav_collection],
    ['services', t.nav_services],
    ['about', t.nav_about],
    ['contact', t.nav_contact],
  ];
  const links = items.map(([key, label]) =>
    `<a href="${PAGES[key][lang]}"${active === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const cart = shopEnabled
    ? `<a class="cart-link" href="${PAGES.cart[lang]}" aria-label="${esc(t.nav_cart)}"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 0 1 6 0"/></svg><span class="cart-count" data-cart-count hidden>0</span></a>`
    : '';
  return { links, cart };
}

/**
 * @param {object} o
 * @param {'cs'|'en'} o.lang
 * @param {string} o.title        <title> (bez názvu značky; doplní se)
 * @param {string} o.description  meta description
 * @param {string} o.path         kanonická cesta (např. /about)
 * @param {string} [o.alternate]  cesta v druhém jazyce
 * @param {string} o.body         obsah <main>
 * @param {string} [o.active]     klíč aktivní položky menu
 * @param {string} [o.head]       další značky do <head>
 * @param {string} [o.image]      obrázek pro sdílení
 * @param {boolean} [o.noindex]
 * @param {boolean} [o.shop]      zobrazit košík
 * @param {string[]} [o.scripts]  další skripty (cesty)
 * @param {string} [o.banner]     informační lišta nad hlavičkou
 */
export const tidy = (h) => h.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');

export function layout(o) {
  const lang = o.lang || 'cs';
  const t = UI[lang];
  const other = lang === 'cs' ? 'en' : 'cs';
  const url = SITE.origin + o.path;
  const fullTitle = o.title ? `${o.title} | ${SITE.name}` : `${SITE.name} – ${lang === 'cs' ? 'mechanické hodinky, renovace a zakázkové sestavy' : 'mechanical watches, restoration and custom builds'}`;
  const image = o.image || `${SITE.origin}/img/og-image.jpg`;
  const { links, cart } = nav(lang, o.active, o.shop);
  const altLink = o.alternate
    ? `<link rel="alternate" hreflang="${lang}" href="${url}">\n<link rel="alternate" hreflang="${other}" href="${SITE.origin + o.alternate}">\n<link rel="alternate" hreflang="x-default" href="${lang === 'cs' ? url : SITE.origin + o.alternate}">`
    : '';
  const switchHref = o.alternate || PAGES.home[other];
  const year = new Date().getFullYear();
  const L = (cs, en) => (lang === 'cs' ? cs : en);
  // Cesty právních dokumentů v obou jazycích (shodné se src/legal/cs.mjs a en.mjs)
  const LEGAL = { '/doprava-a-platba': '/en/shipping-payment', '/terms': '/en/terms', '/returns': '/en/withdrawal', '/reklamace': '/en/complaints', '/warranty': '/en/warranty', '/zakazkova-vyroba': '/en/custom-work', '/privacy': '/en/privacy', '/cookies': '/en/cookies', '/provozovatel': '/en/legal-notice', '/reseni-sporu': '/en/dispute-resolution', '/prodej-do-eu': '/en/eu-sales' };
  const legalHref = (p) => (lang === 'en' ? LEGAL[p] : p);

  return tidy(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
${altLink}
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="#070707">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/img/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="stylesheet" href="${asset('/assets/site.css')}">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${esc(o.title || SITE.name)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:locale" content="${lang === 'cs' ? 'cs_CZ' : 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
${o.head || ''}
</head>
<body>
<a class="skip" href="#obsah">${esc(t.skip)}</a>
${o.banner ? `<div class="banner" role="note">${o.banner}</div>` : ''}
<header class="site-header" data-header>
  <div class="wrap header-row">
    <a class="brand" href="${PAGES.home[lang]}" aria-label="${SITE.name}">
      <img src="${LOGO}" width="160" height="160" alt="">
      <span>${SITE.name}</span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="${L('Hlavní navigace', 'Main navigation')}">
      ${links}
      <div class="nav-social">${socialLinks('ns')}</div>
      <a class="lang" href="${switchHref}" hreflang="${other}" lang="${other}" aria-label="${esc(t.lang_switch_label)}">${other.toUpperCase()}</a>
    </nav>
    <div class="header-actions">
      <div class="header-social">${socialLinks('hs')}</div>
      ${cart}
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-btn>
        <span class="menu-icon" aria-hidden="true"></span><span class="sr">${esc(t.menu)}</span>
      </button>
    </div>
  </div>
</header>
<main id="obsah">
${o.body}
</main>
<footer class="site-footer">
  <div class="wrap footer-top">
    <a class="footer-mark" href="${PAGES.home[lang]}" aria-label="${SITE.name}"><img src="${LOGO}" width="160" height="160" alt="" loading="lazy"><span>Dante Time</span></a>
    <p class="footer-motto">${L('Dáváme času nový život', 'Giving time a new life')}</p>
  </div>
  <div class="wrap footer-grid">
    <section aria-labelledby="f-atelier">
      <h2 id="f-atelier">${L('Ateliér', 'Atelier')}</h2>
      <ul>
        <li><a href="${PAGES.collection[lang]}">${esc(t.nav_collection)}</a></li>
        <li><a href="${PAGES.services[lang]}">${esc(t.nav_services)}</a></li>
        <li><a href="${PAGES.about[lang]}">${esc(t.nav_about)}</a></li>
        <li><a href="${PAGES.care[lang]}">${esc(t.footer_care)}</a></li>
        <li><a href="${PAGES.contact[lang]}">${esc(t.nav_contact)}</a> · <a href="mailto:${SITE.email}">${SITE.email}</a></li>
      </ul>
    </section>
    <section aria-labelledby="f-care">
      <h2 id="f-care">${L('Péče o zákazníky', 'Customer care')}</h2>
      <ul>
        <li><a href="${legalHref('/doprava-a-platba')}">${L('Doprava a platba', 'Shipping &amp; payment')}</a></li>
        <li><a href="${legalHref('/returns')}">${L('Vrácení do 14 dnů', '14-day returns')}</a> · <a href="${lang === 'en' ? '/odstoupeni' : '/odstoupeni'}">${L('odstoupit online', 'withdraw online')}</a></li>
        <li><a href="${legalHref('/reklamace')}">${L('Reklamace a záruka 24 měsíců', 'Complaints &amp; 24-month warranty')}</a></li>
        <li><a href="${legalHref('/warranty')}">${L('Doživotní garance pravosti', 'Lifetime authenticity guarantee')}</a></li>
        <li><a href="${legalHref('/zakazkova-vyroba')}">${L('Servis a zakázky na míru – podmínky', 'Service &amp; commissions – terms')}</a></li>
      </ul>
    </section>
    <section aria-labelledby="f-follow">
      <h2 id="f-follow">${L('Sledujte nás', 'Follow us')}</h2>
      <p class="footer-follow-text">${L('Renovace krok za krokem a nové kusy dřív, než se objeví v kolekci.', 'Restorations step by step and new pieces before they reach the collection.')}</p>
      <div class="footer-social">${socialLinks('fs')}</div>
    </section>
  </div>
  <div class="wrap footer-legal">
    <nav aria-label="${L('Právní informace', 'Legal information')}">
      <a href="${legalHref('/terms')}">${esc(t.footer_terms)}</a>
      <a href="${legalHref('/privacy')}">${esc(t.footer_privacy)}</a>
      <a href="${legalHref('/cookies')}">${esc(t.footer_cookies)}</a>
      <button type="button" class="linklike" data-consent-open>${L('Nastavení cookies', 'Cookie settings')}</button>
      <a href="${legalHref('/reseni-sporu')}">${L('Řešení sporů', 'Dispute resolution')}</a>
      <a href="${legalHref('/prodej-do-eu')}">${L('Prodej do EU', 'EU sales')}</a>
      <a href="${legalHref('/provozovatel')}">${esc(t.footer_operator)}</a>
    </nav>
    <p class="footer-id">© ${year} ${SITE.name} · ${OPERATOR.name} · ${L('IČO', 'Company ID')} ${OPERATOR.ico} · ${esc(lang === 'en' ? OPERATOR.addressEn : OPERATOR.address)}</p>
    <p class="footer-note">${esc(INDEPENDENCE[lang])}</p>
  </div>
</footer>
<script src="${asset('/assets/site.js')}" defer></script>
<script src="${asset('/assets/consent.js')}" defer></script>
${(o.scripts || []).map((s) => `<script src="${asset(s)}" defer></script>`).join('\n')}
</body>
</html>
`);
}

// Pomocné bloky pro obsah stránek
export const hero = ({ eyebrow, title, lead, small }) => `
<section class="page-hero${small ? ' small' : ''}">
  <div class="wrap">
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <h1>${title}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}
    <div class="gold-rule" aria-hidden="true"></div>
  </div>
</section>`;
