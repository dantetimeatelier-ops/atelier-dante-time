// Seznam PDF právních dokumentů, které se přikládají k potvrzení objednávky.
// Generuje je scripts/legal-pdf.mjs při každém sestavení webu z platného textu (src/legal/*), takže
// se obsah PDF vždy shoduje s verzí na webu. Název souboru nese verzi dokumentů.
import { LEGAL_VERSION } from './common.mjs';

const DOCS = [
  { key: 'terms', cs: ['obchodni-podminky', 'Obchodní podmínky'], en: ['terms-and-conditions', 'Terms and Conditions'] },
  { key: 'withdrawal', cs: ['odstoupeni-od-smlouvy', 'Poučení o odstoupení a formulář'], en: ['withdrawal-and-form', 'Withdrawal information and form'] },
  { key: 'warranty', cs: ['zarucni-list', 'Záruční list a garance pravosti'], en: ['warranty-card', 'Warranty card and authenticity guarantee'] },
];

export const legalPdfs = (lang = 'cs', version = LEGAL_VERSION) => DOCS.map((d) => {
  const [slug, label] = d[lang === 'en' ? 'en' : 'cs'];
  const file = `${slug}-v${version}.pdf`;
  return { key: d.key, label, filename: `Dante Time – ${label} (v${version}).pdf`, path: `/pravni/${lang === 'en' ? 'en' : 'cs'}/${file}` };
});
