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
        // Přesný rozměr: výška rámečku, šířka podle formátu videa (bez ořezu i v Safari)
        const h = stage.clientHeight; const ratio = (Number(b.dataset.vw) || 9) / (Number(b.dataset.vh) || 16);
        v.width = Math.round(Math.min(stage.clientWidth, h * ratio)); v.height = Math.round(v.width / ratio);
        v.style.width = `${v.width}px`; v.style.height = `${v.height}px`; v.style.top = `${Math.round((h - v.height) / 2)}px`; v.style.bottom = 'auto';
        main.hidden = true; stage.classList.add('has-video'); stage.appendChild(v); v.play().catch(() => {});
      } else {
        stage.classList.remove('has-video'); main.hidden = false; main.src = b.dataset.src; main.alt = b.dataset.alt;
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
