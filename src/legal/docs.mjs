// Právní dokumenty – vstupní bod (CZ i EN). Obsah: src/legal/cs.mjs a src/legal/en.mjs.
// ⚖️ ÚROVEŇ 3 – obsah schvaluje majitel (AGENTS.md, docs/LEGAL-REVIEW.md).
import { DOCS_CS } from './cs.mjs';
import { DOCS_EN } from './en.mjs';
export { LEGAL_VERSION, EFFECTIVE_DATE } from './common.mjs';

export const ALL_LEGAL = [...DOCS_CS, ...DOCS_EN];
export const legalDoc = (key, lang = 'cs') => (lang === 'en' ? DOCS_EN : DOCS_CS).find((d) => d.key === key);
// Cesta dokumentu v daném jazyce a v jazyce opačném (pro přepínač jazyka a hreflang)
export const legalPath = (key, lang = 'cs') => legalDoc(key, lang)?.path;
export const terms = legalDoc('terms', 'cs');
export const withdrawal = legalDoc('withdrawal', 'cs');
