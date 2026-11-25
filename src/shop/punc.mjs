// Puncovní zákon č. 539/1992 Sb. – pojistky v administraci.
// § 40: u předmětů z obecného kovu (i pozlacených) se nesmí používat označení, které by mohlo
// uvádět v omyl, že jde o drahý kov (slova zlato, stříbro, platina, odvozené výrazy a překlady).
// Puncovní úřad toleruje zavedené výrazy „pozlacené“, „postříbřené“ a popis barvy se slovem „barva“.
// § 35: obchod se zbožím z drahých kovů (i na e-shopu) je nutné předem oznámit Puncovnímu úřadu.
// § 39: doklad při prodeji uvádí druh, cenu, hmotnost a ryzost.
import { PRECIOUS } from './format.mjs';

// Veřejné textové údaje hodinek, které se kontrolují
export const PUBLIC_TEXT_FIELDS = ['title', 'model', 'dial', 'strap', 'case_material', 'crystal', 'condition', 'service_done',
  'original_parts', 'replaced_parts', 'accessories', 'plating', 'description_cs', 'description_en', 'seo_title', 'seo_description'];

// Povolené (pravdivé) obraty, které se před kontrolou odstraní
const ALLOWED = [
  /po?zlacen\w*|zlacen\w*|postříbřen\w*|platinov\w* barv\w*/giu,
  /v barvě (zlata|stříbra|platiny)|barv\w* (zlata|stříbra|platiny)|zlatav\w*|stříbřit\w*/giu,
  /gold[- ]plated|silver[- ]plated|gold[- ]tone|silver[- ]tone|gold colou?r\w*|silver colou?r\w*|gilt|gilded/giu,
  /not (a )?(solid gold|precious metal)|není z drahého kovu|base metal/giu,
];
// Slova, která u obecného kovu mohou klamat
const RISKY = /(?<![\p{L}])(zlat\p{L}*|zlato|stříbr\p{L}*|platin\p{L}*|gold\p{L}*|silver\p{L}*|platinum|solid|\d{1,2}\s?(k|kt|ct)(?![\p{L}])|au\s?\d{3}|ag\s?\d{3}|\d{3}\s?\/\s?1000)/giu;

export function misleadingWords(p) {
  if (PRECIOUS.includes(p.case_metal)) return [];
  const found = new Set();
  for (const f of PUBLIC_TEXT_FIELDS) {
    let t = String(p[f] ?? '');
    for (const a of ALLOWED) t = t.replace(a, ' ');
    for (const m of t.matchAll(RISKY)) found.add(m[0].toLowerCase());
  }
  return [...found];
}

// Kontrola před zveřejněním. Vrací text chyby, nebo null.
export function puncCheck(p, settings = {}) {
  if (!['available', 'in_progress', 'reserved'].includes(p.status)) return null;
  if (PRECIOUS.includes(p.case_metal)) {
    if (!p.hallmark) return 'U pouzdra z drahého kovu vyplňte ryzost a puncovní značku (např. „Au 585/1000, česká puncovní značka“). Bez puncu nelze prodávat.';
    if (p.precious_weight_g == null) return 'U pouzdra z drahého kovu vyplňte hmotnost drahého kovu v gramech – musí být na dokladu o prodeji (§ 39 puncovního zákona).';
    if (settings.punc_notified !== '1') return 'Hodinky z drahého kovu lze zveřejnit až po oznámení Puncovnímu úřadu (obchod s drahými kovy do 15 dnů od zahájení, e-shop nejméně 3 dny předem). Po podání to potvrďte v Nastavení.';
    return null;
  }
  const words = misleadingWords(p);
  if (words.length) return `Pouzdro není z drahého kovu, ale v textu je výraz, který může klamat (puncovní zákon § 40): ${words.join(', ')}. Použijte např. „pozlacené“, „v barvě zlata“ nebo „gold-plated“.`;
  return null;
}
