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
  facebook: null,        // doplnit odkaz na Facebook – dokud chybí, ikona se nezobrazuje
  brands: ['PRIM', 'Omega', 'Bulova', 'Zaria', 'Doxa'],
};

// Údaje provozovatele (sdělil majitel 25. 11. 2026).
// Hodnota null = zatím neověřeno → na webu „[DOPLNIT/OVĚŘIT: …]“ a ostrý režim nejde sestavit.
export const OPERATOR = {
  name: 'Patrik Hužička',
  tradeName: 'Dante Time',
  legalForm: 'fyzická osoba podnikající (OSVČ)',
  legalFormEn: 'sole trader (natural person engaged in business)',
  ico: '24020885',
  address: 'Buková 1561, 273 51 Unhošť, Česká republika',
  addressEn: 'Buková 1561, 273 51 Unhošť, Czech Republic',
  businessSince: '2. 12. 2025',
  // Ověřeno v živnostenském rejstříku (ARES/RŽP) 25. 11. 2026: živnost volná od 2. 12. 2025, úřad Magistrát města Kladna
  register: { cs: 'zapsaný v živnostenském rejstříku (živnostenský úřad Magistrát města Kladna)', en: 'registered in the Czech Trade Register (trade licensing office: Kladno City Council)' },
  tradeOffice: { cs: 'Magistrát města Kladna, živnostenský úřad', en: 'Kladno City Council, Trade Licensing Office' },
  vatPayer: false,      // potvrdil majitel 25. 11. 2026 (ARES: v registru DPH nezapsán)
  dic: null,            // DIČ, je-li přiděleno
  phone: null,          // telefon (nepovinné, na webu zatím není)
  bankName: 'Česká spořitelna, a.s.',
  accountHolder: 'Patrik Hužička',
  bankAccount: '2854824133/0800',
  iban: 'CZ6308000000002854824133',
  ibanPretty: 'CZ63 0800 0000 0028 5482 4133',
  bic: 'GIBACZPX',
  returnAddress: null,  // potvrzeno majitelem: vrácení na adresu sídla v Unhošti (null = sídlo)
};

// Nezávislost ateliéru – uvádí se na webu, v obchodních podmínkách i u hodinek
export const INDEPENDENCE = {
  cs: 'Atelier Dante Time je nezávislý hodinářský ateliér. Není autorizovaným prodejcem ani servisem a nezastupuje značky PRIM, OMEGA, ROLEX ani jiné výrobce, jejichž hodinky nabízí nebo opravuje. Názvy značek slouží jen k popisu hodinek.',
  en: 'Atelier Dante Time is an independent watch atelier. It is not an authorised dealer or service centre of, and does not represent, PRIM, OMEGA, ROLEX or any other manufacturer whose watches it offers or repairs. Brand names are used only to describe the watches.',
};

export const missing = (what) => `<mark class="todo">[DOPLNIT: ${what}]</mark>`;
export const verify = (what) => `<mark class="todo">[OVĚŘIT: ${what}]</mark>`;
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
