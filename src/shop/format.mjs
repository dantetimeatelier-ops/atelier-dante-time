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
};

export const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'hodinky';
