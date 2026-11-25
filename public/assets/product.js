// Galerie a vložení do košíku na stránce hodinek
(() => {
  const g = document.querySelector('[data-gallery]');
  if (g) {
    const stage = g.querySelector('[data-stage]');
    const main = g.querySelector('[data-main]');
    g.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      const old = stage.querySelector('video'); if (old) old.remove();
      if (b.dataset.video) {
        // Video hodinek v pohybu: bez zvuku, smyčka, přehrává se přímo v galerii (i na iPhonu)
        const v = document.createElement('video');
        Object.assign(v, { src: b.dataset.video, poster: b.dataset.src, muted: true, loop: true, playsInline: true, autoplay: true, controls: true });
        v.setAttribute('playsinline', ''); v.setAttribute('aria-label', b.dataset.alt);
        main.hidden = true; stage.appendChild(v); v.play().catch(() => {});
      } else {
        main.hidden = false; main.src = b.dataset.src; main.alt = b.dataset.alt;
      }
      g.querySelectorAll('.thumbs button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
    }));
  }
  document.querySelectorAll('[data-add-to-cart]').forEach((b) => b.addEventListener('click', () => {
    window.DTCart?.add(b.dataset.addToCart);
    location.href = b.dataset.cartUrl;
  }));
})();
