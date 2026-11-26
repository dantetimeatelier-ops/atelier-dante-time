// Galerie a vložení do košíku na stránce hodinek
(() => {
  const g = document.querySelector('[data-gallery]');
  if (g) {
    const stage = g.querySelector('[data-stage]');
    const main = g.querySelector('[data-main]');
    g.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.video) { openVideo(b); return; }
      main.src = b.dataset.src; main.alt = b.dataset.alt;
      g.querySelectorAll('.thumbs button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
    }));
  }

  // Video hodinek v pohybu: otevře se přes celou obrazovku. Velikost určuje jen obrazovka
  // (max-width / max-height), takže se video nikdy neořízne – ani v Safari na iPhonu.
  function openVideo(b) {
    const box = document.createElement('div');
    box.className = 'vbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', b.dataset.alt || 'Video');
    box.innerHTML = '<button type="button" class="vbox-close" aria-label="Zavřít">×</button>';
    const v = document.createElement('video');
    v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('loop', ''); v.setAttribute('controls', ''); v.setAttribute('autoplay', '');
    v.muted = true; v.poster = b.dataset.src; v.src = b.dataset.video;
    box.appendChild(v);
    const close = () => { v.pause(); box.remove(); document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; b.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('vbox-close')) close(); });
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(box);
    box.querySelector('.vbox-close').focus();
    v.play().catch(() => {});
  }
  document.querySelectorAll('[data-add-to-cart]').forEach((b) => b.addEventListener('click', () => {
    window.DTCart?.add(b.dataset.addToCart);
    location.href = b.dataset.cartUrl;
  }));
})();
