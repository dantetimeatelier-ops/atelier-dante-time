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
  facebook: 'https://www.facebook.com/share/1535FzNjTSz/',
  brands: ['PRIM', 'Omega', 'Bulova', 'Zaria', 'Doxa'],
};

// Nabídka servisu, renovací a zakázek pro zákazníky (otevřený právní bod L1, docs/LEGAL-REVIEW.md 2e).
// false = web nabízí jen prodej hotových hodinek (pokryto současným živnostenským oprávněním).
// Po zápisu živnosti Hodinářství majitel řekne a agent přepne na true: vrátí se stránka Služby,
// poptávka servisu a podmínky zakázkové výroby (texty zůstávají připravené v kódu).
export const SERVICES_OFFERED = false;

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
  // ⬇ BANKOVNÍ ÚDAJE – jediné místo v celém systému (od 25. 11. 2026 podnikatelský účet).
  //   Používají je objednávky, QR platby (CZK i EUR), e-maily, faktury i obchodní podmínky.
  //   Nové faktury a objednávky si účet uloží; dříve vystavené doklady se změnou nemění.
  bankAccount: '7058919329/0800',
  iban: 'CZ7608000000007058919329',
  bic: 'GIBACZPX',
  get ibanPretty() { return this.iban.replace(/(.{4})/g, '$1 ').trim(); },
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

// Aktuální bankovní spojení (snímek ukládaný k novým objednávkám a fakturám)
export const bankDetails = () => ({ bank_account: OPERATOR.bankAccount, bank_iban: OPERATOR.iban, bank_bic: OPERATOR.bic });
// Bankovní spojení dokladu: uložené u dokladu, jinak aktuální
export const docBank = (doc = {}) => {
  const iban = doc.bank_iban || OPERATOR.iban;
  return { account: doc.bank_account || OPERATOR.bankAccount, iban, ibanPretty: iban.replace(/(.{4})/g, '$1 ').trim(), bic: doc.bank_bic || OPERATOR.bic };
};
