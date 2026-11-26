// Prodej do členských států EU: země, měny a QR platba v eurech
import { isValidIban } from './spd.mjs';

// 27 členských států EU (ISO 3166-1 alfa-2)
export const EU_COUNTRIES = {
  AT: { cs: 'Rakousko', en: 'Austria' }, BE: { cs: 'Belgie', en: 'Belgium' }, BG: { cs: 'Bulharsko', en: 'Bulgaria' },
  HR: { cs: 'Chorvatsko', en: 'Croatia' }, CY: { cs: 'Kypr', en: 'Cyprus' }, CZ: { cs: 'Česko', en: 'Czechia' },
  DK: { cs: 'Dánsko', en: 'Denmark' }, EE: { cs: 'Estonsko', en: 'Estonia' }, FI: { cs: 'Finsko', en: 'Finland' },
  FR: { cs: 'Francie', en: 'France' }, DE: { cs: 'Německo', en: 'Germany' }, GR: { cs: 'Řecko', en: 'Greece' },
  HU: { cs: 'Maďarsko', en: 'Hungary' }, IE: { cs: 'Irsko', en: 'Ireland' }, IT: { cs: 'Itálie', en: 'Italy' },
  LV: { cs: 'Lotyšsko', en: 'Latvia' }, LT: { cs: 'Litva', en: 'Lithuania' }, LU: { cs: 'Lucembursko', en: 'Luxembourg' },
  MT: { cs: 'Malta', en: 'Malta' }, NL: { cs: 'Nizozemsko', en: 'Netherlands' }, PL: { cs: 'Polsko', en: 'Poland' },
  PT: { cs: 'Portugalsko', en: 'Portugal' }, RO: { cs: 'Rumunsko', en: 'Romania' }, SK: { cs: 'Slovensko', en: 'Slovakia' },
  SI: { cs: 'Slovinsko', en: 'Slovenia' }, ES: { cs: 'Španělsko', en: 'Spain' }, SE: { cs: 'Švédsko', en: 'Sweden' },
};
export const countryName = (code, lang = 'cs') => EU_COUNTRIES[code]?.[lang] || code;
export const sortedCountries = (lang = 'cs') => Object.keys(EU_COUNTRIES)
  .sort((a, b) => (a === 'CZ' ? -1 : b === 'CZ' ? 1 : a === 'SK' ? -1 : b === 'SK' ? 1 : countryName(a, lang).localeCompare(countryName(b, lang), lang)));

/** Přepočet CZK → EUR v centech, zaokrouhleno nahoru na celé euro (bez drobných). */
export function czkToEurCents(czk, rate) {
  if (!(rate > 0)) throw new Error('Chybí kurz EUR');
  return Math.ceil(czk / rate) * 100;
}

export const formatEur = (cents, lang = 'cs') =>
  new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cents / 100);

/**
 * QR kód pro platbu v EUR (EPC069-12, „SEPA QR“ / GiroCode), čtou ho bankovní aplikace v EU.
 * @param {{bic:string, name:string, iban:string, cents:number, reference:string}} p
 */
export function epcString({ bic, name, iban, cents, reference }) {
  const acc = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!isValidIban(acc)) throw new Error('Neplatný IBAN');
  if (!Number.isInteger(cents) || cents <= 0 || cents > 99999999999) throw new Error('Neplatná částka');
  const clean = (s, max) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').slice(0, max);
  return ['BCD', '002', '1', 'SCT', clean(bic, 11), clean(name, 70), acc, `EUR${(cents / 100).toFixed(2)}`, '', '', clean(reference, 140)].join('\n');
}
