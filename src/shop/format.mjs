// Formátování a popisky pro e-shop
export const formatCzk = (n, lang = 'cs') =>
  n == null ? '' : new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', { maximumFractionDigits: 0 }).format(n).replace(/ /g, ' ') + ' Kč';

export const formatDate = (iso, lang = 'cs') =>
  iso ? new Date(iso).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-GB', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const STATUS = {
  draft: { cs: 'Koncept', en: 'Draft' },
  available: { cs: 'Skladem', en: 'Available' },
  reserved: { cs: 'Rezervováno', en: 'Reserved' },
  sold: { cs: 'Prodáno', en: 'Sold' },
  in_progress: { cs: 'V přípravě', en: 'In preparation' },
  archived: { cs: 'Archiv', en: 'Archive' },
};

export const ORDER_STATUS = {
  awaiting_payment: 'Čeká na platbu',
  paid: 'Zaplaceno',
  shipped: 'Odesláno',
  completed: 'Dokončeno',
  cancelled: 'Zrušeno',
  expired: 'Rezervace vypršela',
  withdrawn: 'Odstoupeno od smlouvy',
};

export const COMMISSION_TYPES = { servis: 'Servis', renovace: 'Renovace', zakazkova_vyroba: 'Zakázková výroba', prestavba: 'Přestavba' };
export const COMMISSION_STATUS = {
  poptavka: 'Poptávka', nabidka: 'Nabídka odeslána', prijato: 'Přijato', v_praci: 'V práci',
  ceka_na_dily: 'Čeká na díly', hotovo: 'Hotovo', predano: 'Předáno', zruseno: 'Zrušeno',
};

export const SHIPPING = {
  zasilkovna: { cs: 'Zásilkovna – výdejní místo', en: 'Packeta – pickup point' },
  balikovna: { cs: 'Balíkovna – výdejní místo', en: 'Balíkovna – pickup point' },
  osobni: { cs: 'Osobní převzetí po domluvě', en: 'Personal pickup by arrangement' },
};
export const PAYMENT = {
  bank_transfer: { cs: 'Bankovní převod (QR platba)', en: 'Bank transfer (QR payment)' },
  card: { cs: 'Platba kartou online', en: 'Card payment online' },
  cod: { cs: 'Dobírka (platba při převzetí)', en: 'Cash on delivery' },
};

// Druh kusu – rozhoduje o popisu i o právním režimu (viz právní dokumenty)
export const KIND = {
  original: { cs: 'Originální hodinky', en: 'Original watch', note: { cs: 'Původní hodinky po servisu nebo renovaci v ateliéru.', en: 'Original watch, serviced or restored in the atelier.' } },
  prestavba: { cs: 'Přestavba', en: 'Custom rebuild', note: { cs: 'Hodinky upravené v ateliéru – některé díly nejsou původní (viz parametry).', en: 'Watch modified in the atelier – some parts are not original (see specifications).' } },
  sestava: { cs: 'Sestava z ateliéru', en: 'Atelier build', note: { cs: 'Hodinky sestavené v ateliéru z vybraných dílů.', en: 'Watch assembled in the atelier from selected parts.' } },
};

// Materiál pouzdra (zákon č. 19/1993 Sb., o puncovnictví)
export const METAL = {
  ocel: { cs: 'nerezová ocel', en: 'stainless steel' },
  mosaz: { cs: 'mosaz', en: 'brass' },
  chrom: { cs: 'chromovaná mosaz', en: 'chrome-plated brass' },
  pozlaceno: { cs: 'pozlacené (není z drahého kovu)', en: 'gold-plated (not solid gold)' },
  zlato: { cs: 'zlato', en: 'solid gold' },
  stribro: { cs: 'stříbro', en: 'silver' },
  platina: { cs: 'platina', en: 'platinum' },
  titan: { cs: 'titan', en: 'titanium' },
  jine: { cs: 'jiný materiál', en: 'other material' },
};
export const PRECIOUS = ['zlato', 'stribro', 'platina'];

export const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'hodinky';
