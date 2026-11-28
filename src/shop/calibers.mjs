// Kalibry strojků: z toho, co majitel napíše do pole „Kalibr“ (např. „66 prim“), vznikne popis strojku a roky výroby.
// Zdroj údajů PRIM: Skalický, Katalog hodinek PRIM (physics.muni.cz/~skalicky/download/katalog.pdf), ověřeno 28. 11. 2026.
// Neznámý kalibr se nevymýšlí – v pasu zůstane přesně to, co bylo napsáno.
export const PRIM_CALIBERS = {
  50: { jewels: 15, wind: 'ruční nátah', windEn: 'manual winding', years: '1954–1971' },
  52: { jewels: 15, wind: 'ruční nátah', windEn: 'manual winding', years: '1955–1971', date: true },
  64: { jewels: 21, wind: 'ruční nátah', windEn: 'manual winding', years: '1993–1995', date: true },
  66: { jewels: 17, wind: 'ruční nátah', windEn: 'manual winding', years: '1965–1993' },
  68: { jewels: 17, wind: 'ruční nátah', windEn: 'manual winding', years: '1969–1993', date: true },
  96: { jewels: 21, wind: 'automatický nátah', windEn: 'automatic winding', years: '1978–1989', date: true },
};

/** „66 prim“, „Prim 66“, „PRIM kalibr 68“ → { movement, year } ; neznámé → { movement: text, year: null }. */
export function caliberInfo(text) {
  const t = String(text || '').trim();
  if (!t) return { movement: null, year: null, known: false };
  const num = (t.match(/\b0?(\d{2,3})\b/) || [])[1];
  const c = /prim/i.test(t) && num ? PRIM_CALIBERS[Number(num)] : null;
  if (!c) return { movement: t.slice(0, 120), year: null, known: false };
  return {
    movement: `originální strojek PRIM kalibr ${Number(num)}, ${c.wind}, ${c.jewels} kamenů${c.date ? ', datum' : ''}`,
    year: c.years,
    known: true,
  };
}

/** Výchozí originalita: přestavba = nové pouzdro a řemínek, jinak originál; „original“ = kompletně originální hodinky. */
export const PARTS_PRESETS = {
  prestavba: { label: 'Přestavba Dante Time – nové pouzdro a řemínek, jinak vše originální', auth: 'strojek,cifernik,rucicky', original: 'strojek, ciferník a ručičky', replaced: 'nové pouzdro Dante Time, řemínek' },
  original: { label: 'Vše originální', auth: 'strojek,cifernik,rucicky', original: 'kompletně originální hodinky', replaced: null },
  vlastni: { label: 'Vlastní nastavení (zaškrtnu sám)' },
};
