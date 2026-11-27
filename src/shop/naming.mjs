// Jednotný systém pojmenování hodinek Dante Time (rozhodnutí majitele R26, 27. 11. 2026).
//
//   DT – ZNAČKA <název modelu a jeho označení>
//   např. „DT – PRIM Classic Soleil LTD.01“, „DT – OMEGA Genève“, „DT – ROLEX Cellini 0-05“
//
// Značka se píše VELKÝMI písmeny, název modelu a evidenční označení zůstávají přesně tak, jak je zadal majitel.
// Funkce je idempotentní: už pojmenované hodinky nechá beze změny, starý název („Prim Classic Soleil LTD.01“)
// převede na nový tvar a nikdy nemění samotné jméno ani číslo kusu.

export const DT_PREFIX = 'DT – ';

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Název hodinek v jednotném tvaru „DT – ZNAČKA model označení“. */
export function dtName({ brand, title, model } = {}) {
  let rest = clean(title) || clean(model);
  rest = rest.replace(/^DT\s*[–—:-]\s*/i, ''); // starší zápisy „DT - “, „DT: “, „DT–“
  const b = clean(brand);
  if (b) {
    rest = rest.replace(new RegExp(`^${escRe(b)}(?![\\p{L}\\p{N}])\\s*[–—-]?\\s*`, 'iu'), ''); // značka na začátku názvu se nepíše dvakrát
    return `${DT_PREFIX}${b.toLocaleUpperCase('cs')}${rest ? ` ${rest}` : ''}`;
  }
  return rest ? `${DT_PREFIX}${rest}` : '';
}

/** Má název už jednotný tvar? (kontrola katalogu a systémová kontrola) */
export const isDtName = (p) => clean(p.title) === dtName(p);
