// Společné údaje a pomocné bloky právních dokumentů (CZ i EN)
// ⚖️ ÚROVEŇ 3 – obsah schvaluje majitel (AGENTS.md, docs/LEGAL-REVIEW.md).
import { SITE, OPERATOR, missing, verify } from '../site.mjs';

export const LEGAL_VERSION = '1.0';
// Datum účinnosti = den ostrého spuštění e-shopu (schváleno majitelem 26. 11. 2026, verze 1.0).
export const EFFECTIVE_DATE = '26. 11. 2026';

export const effective = (lang) => EFFECTIVE_DATE ?? missing(lang === 'cs' ? 'datum účinnosti = den ostrého spuštění e-shopu' : 'effective date = e-shop launch date');
export const head = (lang) => `<p class="doc-meta">${lang === 'cs' ? 'Verze' : 'Version'}: ${LEGAL_VERSION} · ${lang === 'cs' ? 'Účinnost od' : 'Effective from'}: ${effective(lang)}</p>`;
export const toc = (lang, items) => `<nav class="toc" aria-label="${lang === 'cs' ? 'Obsah' : 'Contents'}"><strong>${lang === 'cs' ? 'Obsah' : 'Contents'}</strong><ol>${items.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>`;
export const email = `<a href="mailto:${SITE.email}">${SITE.email}</a>`;

export const registerText = (lang) => OPERATOR.register?.[lang]
  ?? verify(lang === 'cs' ? 'zápis v živnostenském rejstříku a příslušný živnostenský úřad' : 'entry in the Trade Register and competent trade licensing office');

export const vatText = (lang) => {
  if (OPERATOR.vatPayer === true) return lang === 'cs' ? `Prodávající je plátcem DPH (DIČ ${OPERATOR.dic ?? missing('DIČ')}). Ceny jsou uvedeny včetně DPH.` : `The seller is VAT registered (VAT ID ${OPERATOR.dic ?? missing('VAT ID')}). Prices include VAT.`;
  if (OPERATOR.vatPayer === false) return lang === 'cs' ? 'Prodávající není plátcem DPH. Uvedené ceny jsou konečné.' : 'The seller is not registered for VAT. Prices are final.';
  return verify(lang === 'cs' ? 'plátce / neplátce DPH – podle toho věta o DPH v cenách' : 'VAT registration status – determines the VAT sentence');
};

export const seller = (lang) => (lang === 'cs'
  ? `<strong>${OPERATOR.name}</strong>, ${OPERATOR.legalForm}, podnikající pod obchodní značkou ${OPERATOR.tradeName}, IČO ${OPERATOR.ico}, se sídlem ${OPERATOR.address}, ${registerText('cs')}`
  : `<strong>${OPERATOR.name}</strong>, ${OPERATOR.legalFormEn}, trading as ${OPERATOR.tradeName}, company ID (IČO) ${OPERATOR.ico}, registered address ${OPERATOR.addressEn}, ${registerText('en')}`);

export const returnAddress = (lang) => OPERATOR.returnAddress ?? (lang === 'cs' ? OPERATOR.address : OPERATOR.addressEn);

export const coi = (lang) => (lang === 'cs'
  ? 'Česká obchodní inspekce, Ústřední inspektorát – oddělení ADR, Gorazdova 1969/24, 120 00 Praha 2, e-mail adr@coi.cz, web <a href="https://adr.coi.cz" rel="noopener noreferrer">adr.coi.cz</a>'
  : 'Czech Trade Inspection Authority (Česká obchodní inspekce), Central Inspectorate – ADR Department, Gorazdova 1969/24, 120 00 Prague 2, Czech Republic, e-mail adr@coi.cz, web <a href="https://adr.coi.cz" rel="noopener noreferrer">adr.coi.cz</a>');

export const ecc = (lang) => (lang === 'cs'
  ? 'Evropské spotřebitelské centrum ČR (síť ECC-Net), <a href="https://www.evropskyspotrebitel.cz" rel="noopener noreferrer">evropskyspotrebitel.cz</a>'
  : 'European Consumer Centre Czech Republic (ECC-Net), <a href="https://www.evropskyspotrebitel.cz" rel="noopener noreferrer">evropskyspotrebitel.cz</a>');

export const tradeOffice = (lang) => OPERATOR.tradeOffice?.[lang]
  ?? verify(lang === 'cs' ? 'příslušný živnostenský úřad (pravděpodobně Magistrát města Kladna)' : 'competent trade licensing office (probably Kladno City Council)');
