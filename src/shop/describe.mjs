// Automatické generování popisů a SEO z parametrů hodinek.
// Bez umělé inteligence a bez placených služeb: skládá věty z vyplněných údajů.
// Nic nevymýšlí – co majitel nevyplní, v popisu nebude.

const has = (v) => v != null && String(v).trim() !== '';
const join = (parts, sep = ', ') => parts.filter((x) => typeof x === 'string' && x.trim() !== '').join(sep);

import { KIND, METAL, PRECIOUS } from './format.mjs';

const MOVEMENT = {
  manual: { cs: 'ručním nátahem', en: 'manual winding', csAdj: 'ruční nátah', enAdj: 'hand-wound' },
  automatic: { cs: 'automatickým nátahem', en: 'automatic winding', csAdj: 'automatický nátah', enAdj: 'automatic' },
};

export function productName(p) {
  return join([p.brand, p.model], ' ') || p.title || 'Hodinky';
}

export function describe(p) {
  const name = productName(p);
  const mv = MOVEMENT[p.movement_type];
  const cs = [];
  const en = [];

  // Úvodní věta
  cs.push(`${name}${has(p.year) ? ` z roku ${p.year}` : ''} – mechanické hodinky${mv ? ` s ${mv.cs}` : ''}${has(p.movement) ? ` (strojek ${p.movement})` : ''}.`);
  en.push(`${name}${has(p.year) ? ` from ${p.year}` : ''} – a mechanical watch${mv ? ` with ${mv.en}` : ''}${has(p.movement) ? ` (movement ${p.movement})` : ''}.`);

  if (KIND[p.kind] && p.kind !== 'original') { cs.push(KIND[p.kind].note.cs); en.push(KIND[p.kind].note.en); }
  const metal = METAL[p.case_metal];
  if (metal) {
    const extra = PRECIOUS.includes(p.case_metal) && has(p.hallmark) ? `, ${p.hallmark}` : p.case_metal === 'pozlaceno' && has(p.plating) ? `, ${p.plating}` : '';
    cs.push(`Pouzdro: ${metal.cs}${extra}.`); en.push(`Case: ${metal.en}${extra}.`);
  }
  const caseCs = join([has(p.case_material) && `pouzdro ${p.case_material}`, has(p.case_diameter_mm) && `průměr ${p.case_diameter_mm} mm`, has(p.lug_width_mm) && `šířka uchycení ${p.lug_width_mm} mm`]);
  const caseEn = join([has(p.case_material) && `${p.case_material} case`, has(p.case_diameter_mm) && `${p.case_diameter_mm} mm diameter`, has(p.lug_width_mm) && `${p.lug_width_mm} mm lug width`]);
  if (caseCs) { cs.push(`${caseCs[0].toUpperCase()}${caseCs.slice(1)}.`); en.push(`${caseEn[0].toUpperCase()}${caseEn.slice(1)}.`); }

  const lookCs = join([has(p.dial) && `ciferník ${p.dial}`, has(p.crystal) && `sklíčko ${p.crystal}`, has(p.strap) && `řemínek ${p.strap}`]);
  const lookEn = join([has(p.dial) && `${p.dial} dial`, has(p.crystal) && `${p.crystal} crystal`, has(p.strap) && `${p.strap} strap`]);
  if (lookCs) { cs.push(`${lookCs[0].toUpperCase()}${lookCs.slice(1)}.`); en.push(`${lookEn[0].toUpperCase()}${lookEn.slice(1)}.`); }

  if (has(p.service_done)) { cs.push(`Provedené práce v ateliéru: ${p.service_done}.`); en.push(`Work carried out in the atelier: ${p.service_done}.`); }
  if (has(p.condition)) { cs.push(`Stav: ${p.condition}.`); en.push(`Condition: ${p.condition}.`); }
  if (has(p.original_parts)) { cs.push(`Deklarované originální díly: ${p.original_parts}. Na jejich pravost se vztahuje doživotní garance pravosti Atelier Dante Time.`); en.push(`Declared original parts: ${p.original_parts}. Covered by the Atelier Dante Time lifetime authenticity guarantee.`); }
  if (has(p.replaced_parts)) { cs.push(`Vyměněné nebo neoriginální díly: ${p.replaced_parts}.`); en.push(`Replaced or non-original parts: ${p.replaced_parts}.`); }
  if (has(p.water_resistance)) { cs.push(`Vodotěsnost: ${p.water_resistance}.`); en.push(`Water resistance: ${p.water_resistance}.`); }
  else { cs.push('Hodinky nejsou určeny ke kontaktu s vodou.'); en.push('The watch is not intended for contact with water.'); }
  if (has(p.accessories)) { cs.push(`Příslušenství: ${p.accessories}.`); en.push(`Accessories: ${p.accessories}.`); }
  cs.push('Jde o unikátní kus – k dispozici je pouze jednou.');
  en.push('This is a unique piece – only one is available.');

  const kind = mv ? mv.csAdj : 'mechanické';
  const seoTitle = `${name}${has(p.year) ? ` (${p.year})` : ''} – ${kind === 'mechanické' ? 'mechanické hodinky' : `mechanické hodinky, ${kind}`}`.slice(0, 70);
  const seoDescription = `${name}${has(p.year) ? ` z roku ${p.year}` : ''}, ${join([has(p.movement) && `strojek ${p.movement}`, has(p.case_diameter_mm) && `${p.case_diameter_mm} mm`, has(p.case_material) && p.case_material])}. Renovováno v ateliéru Dante Time, unikátní kus s garancí pravosti.`
    .replace(/, \./, '.').replace(/,\s*,/g, ',').slice(0, 160);

  return { description_cs: cs.join(' '), description_en: en.join(' '), seo_title: seoTitle, seo_description: seoDescription };
}

// Strukturovaná data pro Google (Schema.org Product)
export function productJsonLd(p, images, origin, lang = 'cs') {
  const availability = { available: 'InStock', reserved: 'LimitedAvailability', sold: 'SoldOut', in_progress: 'PreOrder' }[p.status] || 'OutOfStock';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName(p),
    description: (lang === 'cs' ? p.description_cs : p.description_en) || p.description_cs || '',
    sku: p.id,
    image: images.map((i) => `${origin}/media/${i.key_large}`),
    itemCondition: 'https://schema.org/UsedCondition',
  };
  if (has(p.brand)) ld.brand = { '@type': 'Brand', name: p.brand };
  if (p.price_czk != null && (p.status === 'available' || p.status === 'reserved')) {
    ld.offers = { '@type': 'Offer', priceCurrency: 'CZK', price: String(p.price_czk), availability: `https://schema.org/${availability}`, url: `${origin}/hodinky/${p.slug}` };
  }
  return ld;
}
