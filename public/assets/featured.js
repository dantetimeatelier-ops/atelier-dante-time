// Ukázka aktuální kolekce na hlavní stránce (načte se z API, při chybě se sekce nezobrazí)
(async () => {
  const sec = document.querySelector('[data-featured]');
  if (!sec) return;
  try {
    const lang = sec.dataset.lang || 'cs';
    const res = await fetch(`/api/products?featured=1&limit=3&lang=${lang}`);
    if (!res.ok) return;
    const { html } = await res.json();
    if (!html) return;
    sec.querySelector('[data-featured-list]').innerHTML = html;
    sec.hidden = false;
  } catch { /* bez katalogu se sekce nezobrazí */ }
})();
