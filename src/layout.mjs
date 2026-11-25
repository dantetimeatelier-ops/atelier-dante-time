// Sdílený vzhled všech stránek: <head>, hlavička, patička.
// Používá ho generátor statických stránek i serverové funkce (katalog).
import { SITE, PAGES, INDEPENDENCE } from './site.mjs';
import { UI } from './i18n/ui.mjs';
import { ASSET_V } from './asset-version.mjs';
const asset = (u) => (u.startsWith('/assets/') ? `${u}?v=${ASSET_V}` : u);

export const esc = (s) => String(s ?? '')
  .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const LOGO = '/img/logo-160.webp';

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
      <a class="lang" href="${switchHref}" hreflang="${other}" lang="${other}" aria-label="${esc(t.lang_switch_label)}">${other.toUpperCase()}</a>
    </nav>
    <div class="header-actions">
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
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <img src="${LOGO}" width="160" height="160" alt="" loading="lazy">
      <p>${esc(t.footer_tagline)}</p>
      <p class="footer-contact"><a href="mailto:${SITE.email}">${SITE.email}</a></p>
      <p class="footer-social">
        <a href="${SITE.instagram}" rel="noopener noreferrer" target="_blank">Instagram</a>
        <a href="${SITE.tiktok}" rel="noopener noreferrer" target="_blank">TikTok</a>
      </p>
    </div>
    <div>
      <h2>${esc(t.footer_atelier)}</h2>
      <ul>
        <li><a href="${PAGES.collection[lang]}">${esc(t.nav_collection)}</a></li>
        <li><a href="${PAGES.services[lang]}">${esc(t.nav_services)}</a></li>
        <li><a href="${PAGES.about[lang]}">${esc(t.nav_about)}</a></li>
        <li><a href="${PAGES.care[lang]}">${esc(t.footer_care)}</a></li>
        <li><a href="${PAGES.contact[lang]}">${esc(t.nav_contact)}</a></li>
      </ul>
    </div>
    <div>
      <h2>${esc(t.footer_shopping)}</h2>
      <ul>
        <li><a href="${legalHref('/doprava-a-platba')}">${esc(t.footer_shipping)}</a></li>
        <li><a href="${legalHref('/terms')}">${esc(t.footer_terms)}</a></li>
        <li><a href="${legalHref('/returns')}">${esc(t.footer_withdrawal)}</a></li>
        <li><a href="${legalHref('/reklamace')}">${esc(t.footer_claims)}</a></li>
        <li><a href="${legalHref('/warranty')}">${esc(t.footer_warranty)}</a></li>
        <li><a href="${legalHref('/zakazkova-vyroba')}">${esc(t.footer_custom)}</a></li>
      </ul>
    </div>
    <div>
      <h2>${esc(t.footer_legal)}</h2>
      <ul>
        <li><a href="${legalHref('/privacy')}">${esc(t.footer_privacy)}</a></li>
        <li><a href="${legalHref('/cookies')}">${esc(t.footer_cookies)}</a></li>
        <li><a href="${legalHref('/provozovatel')}">${esc(t.footer_operator)}</a></li>
        <li><a href="${legalHref('/reseni-sporu')}">${L('Řešení sporů', 'Dispute resolution')}</a></li>
        <li><a href="${legalHref('/prodej-do-eu')}">${L('Prodej do zemí EU', 'Sales to EU countries')}</a></li>
        <li><button type="button" class="linklike" data-consent-open>${L('Nastavení cookies', 'Cookie settings')}</button></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom">© ${year} ${SITE.name}. ${esc(t.footer_rights)}<br><span class="footer-note">${esc(INDEPENDENCE[lang])}</span></div>
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
