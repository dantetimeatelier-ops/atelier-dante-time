// Základní nastavení webu. Firemní údaje, které zatím neznáme, jsou null
// a na webu se zobrazí jako „[DOPLNIT: …]“. Nikdy je nevymýšlet.
export const SITE = {
  origin: 'https://atelier-dante-time.cz',
  name: 'Atelier Dante Time',
  shortName: 'Dante Time',
  email: 'dante.time.atelier@gmail.com',
  instagram: 'https://www.instagram.com/dantetimeatelier/',
  instagramHandle: '@dantetimeatelier',
  tiktok: 'https://www.tiktok.com/@atelierdt',
  tiktokHandle: '@atelierdt',
  brands: ['PRIM', 'Omega', 'Bulova', 'Zaria', 'Doxa'],
};

// Údaje provozovatele. DOPLNÍ MAJITEL (viz docs/LEGAL-REVIEW.md).
export const OPERATOR = {
  name: null,           // jméno a příjmení podnikatele, nebo obchodní firma
  ico: null,            // IČO
  address: null,        // sídlo / místo podnikání
  register: null,       // např. „zapsán v živnostenském rejstříku vedeném …“
  vatPayer: null,       // true = plátce DPH, false = neplátce
  dic: null,            // DIČ, je-li přiděleno
  phone: null,          // telefon (nepovinné)
  bankAccount: null,    // číslo účtu pro platby převodem
  iban: null,           // IBAN (pro QR platbu)
  returnAddress: null,  // adresa pro vracení zboží (pokud se liší od sídla)
};

export const missing = (what) => `<mark class="todo">[DOPLNIT: ${what}]</mark>`;
export const op = (key, label) => OPERATOR[key] ?? missing(label);

export const LANGS = ['cs', 'en'];

// Stránky, které existují v obou jazycích (cesta bez přípony)
export const PAGES = {
  home: { cs: '/', en: '/en/' },
  collection: { cs: '/kolekce', en: '/en/collection' },
  services: { cs: '/services', en: '/en/services' },
  about: { cs: '/about', en: '/en/about' },
  care: { cs: '/care', en: '/en/care' },
  contact: { cs: '/kontakt', en: '/en/contact' },
  cart: { cs: '/kosik', en: '/en/cart' },
};
