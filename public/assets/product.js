// Galerie a vložení do košíku na stránce hodinek
(() => {
  const g = document.querySelector('[data-gallery]');
  if (g) {
    const main = g.querySelector('[data-main]');
    g.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
      main.src = b.dataset.src; main.alt = b.dataset.alt;
      g.querySelectorAll('.thumbs button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
    }));
  }
  document.querySelectorAll('[data-add-to-cart]').forEach((b) => b.addEventListener('click', () => {
    window.DTCart?.add(b.dataset.addToCart);
    location.href = b.dataset.cartUrl;
  }));
})();
