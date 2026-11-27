// DT Logistics: stav zásilek Balíkovny (Česká pošta) přes veřejné rozhraní sledování zásilek – bez klíče.
// Kódy převádíme na stejnou stupnici jako u Zásilkovny (5 = k vyzvednutí, 7 = doručeno, 10 = vráceno…).
import { HttpError } from './http.js';

const API = 'https://b2c.cpost.cz/services/ParcelHistory/getDataAsJson';

// „DR 1234 5678 9E“ → „DR12345678 9E“ bez mezer; podací čísla mají 2 písmena + 8–10 číslic + 0–2 písmena
export function parcelId(tracking) {
  const t = String(tracking || '').toUpperCase().replace(/[\s-]+/g, '');
  return /^[A-Z]{2}\d{8,10}[A-Z]{0,2}$/.test(t) ? t : null;
}

// Poslední událost → stav (podle textu, kódy České pošty nejsou veřejně zdokumentované)
export function classify(text, id) {
  const t = String(text || '').toLowerCase();
  if (id === '-3' || /není v evidenci/.test(t)) return 1;
  if (/vrác|vrat|zpět odesílateli|nevyzvednut/.test(t)) return /vrácena odesílateli|dodání.*odesílatel/.test(t) ? 10 : 9;
  if (/připravena k vyzvednutí|uložena|k vyzvednutí/.test(t)) return 5;
  if (/dodán|doručen|vyzvednut|převzal/.test(t)) return 7;
  if (/podán|přijat|převzetí zásilky od odesílatele|elektronicky/.test(t)) return 2;
  return 4;
}

export async function cpostStatus(tracking, { fetcher = fetch } = {}) {
  const id = parcelId(tracking);
  if (!id) throw new HttpError('Číslo zásilky není ve tvaru České pošty (např. DR1234567890E)');
  const res = await fetcher(`${API}?idParcel=${encodeURIComponent(id)}&language=cz`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new HttpError(`Česká pošta: chyba ${res.status}`, 502);
  const data = await res.json().catch(() => null);
  const states = data?.[0]?.states?.state;
  const list = Array.isArray(states) ? states : states ? [states] : [];
  if (!list.length) throw new HttpError('Česká pošta nevrátila stav zásilky', 502);
  const last = list[list.length - 1];
  const code = classify(last.text, String(last.id));
  return { code, text: code === 1 ? 'Česká pošta zatím zásilku neeviduje' : String(last.text || '').trim(), at: /^\d{4}-\d{2}-\d{2}/.test(last.date || '') ? `${last.date.slice(0, 10)}T12:00:00` : null };
}
