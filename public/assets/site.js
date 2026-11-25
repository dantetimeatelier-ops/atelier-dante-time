// Atelier Dante Time – společné skripty (menu, košík)
(() => {
  const btn = document.querySelector('[data-menu-btn]');
  const nav = document.getElementById('main-nav');
  if (btn && nav) {
    const set = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  }

  // Košík: unikátní kusy, proto jen seznam ID hodinek
  const KEY = 'dt_cart';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((x) => typeof x === 'string'); } catch { return []; } };
  const write = (items) => { try { localStorage.setItem(KEY, JSON.stringify([...new Set(items)])); } catch { /* soukromý režim */ } update(); };
  const update = () => {
    const n = read().length;
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(n); el.hidden = n === 0; });
  };
  window.DTCart = { read, write, add: (id) => write([...read(), id]), remove: (id) => write(read().filter((x) => x !== id)), clear: () => write([]) };
  update();
  window.addEventListener('storage', update);
})();
