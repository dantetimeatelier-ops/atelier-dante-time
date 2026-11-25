// Košík a objednávka
(async () => {
  const root = document.querySelector('[data-checkout]');
  if (!root) return;
  const cs = root.dataset.lang !== 'en';
  const L = (a, b) => (cs ? a : b);
  const $ = (s) => root.querySelector(s);
  const fmt = (n) => `${new Intl.NumberFormat(cs ? 'cs-CZ' : 'en-GB').format(n)} Kč`;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const form = $('[data-cart-form]');
  const status = $('[data-status]');
  const showStatus = (msg, kind = 'err') => { status.hidden = false; status.className = `notice ${kind}`; status.textContent = msg; };

  let ids = window.DTCart?.read() || [];
  if (!ids.length) { $('[data-cart-empty]').hidden = false; return; }

  let config;
  try { config = await (await fetch('/api/config')).json(); } catch { config = { mode: 'preview' }; }
  if (config.mode === 'preview') { $('[data-cart-disabled]').hidden = false; return; }

  const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, lang: cs ? 'cs' : 'en' }) });
  const cart = await res.json();
  if (cart.unavailable?.length) {
    ids = ids.filter((id) => !cart.unavailable.includes(id));
    window.DTCart.write(ids);
    showStatus(L('Některé hodinky už nejsou k dispozici a byly z košíku odebrány.', 'Some watches are no longer available and were removed from your cart.'), '');
  }
  if (!cart.items?.length) { $('[data-cart-empty]').hidden = false; return; }
  form.hidden = false;

  $('[data-cart-items]').innerHTML = cart.items.map((i) => `<div class="cart-item">
    ${i.image ? `<img src="${esc(i.image)}" alt="" width="84" height="100">` : '<span></span>'}
    <div><a href="${esc(i.url)}"><strong>${esc(i.title)}</strong></a><div class="doc-meta">${L('Unikátní kus', 'Unique piece')}</div></div>
    <div style="text-align:right"><div class="price" style="font-size:18px">${fmt(i.price)}</div><button class="btn ghost" type="button" data-remove="${esc(i.id)}" style="min-height:34px;padding:6px 12px;margin-top:6px">${L('Odebrat', 'Remove')}</button></div>
  </div>`).join('');
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { window.DTCart.remove(b.dataset.remove); location.reload(); }));

  const radio = (name, opts) => opts.map((o, n) => `<label class="choice"><input type="radio" name="${name}" value="${esc(o.id)}" ${n === 0 ? 'checked' : ''} required><span><span class="t">${esc(o.label)}</span>${o.price != null ? `<br><span class="doc-meta">${o.price === 0 ? L('zdarma', 'free') : fmt(o.price)}</span>` : ''}${o.note ? `<br><span class="doc-meta">${esc(o.note)}</span>` : ''}</span></label>`).join('');
  if (!config.shipping?.length || !config.payment?.length) {
    showStatus(L('Objednávky zatím nelze dokončit – doprava nebo platba ještě není nastavena.', 'Orders cannot be completed yet – shipping or payment is not configured.'));
    form.querySelector('button[type=submit]').disabled = true;
  }
  $('[data-shipping]').innerHTML = radio('shipping', config.shipping || []);
  $('[data-payment]').innerHTML = radio('payment', config.payment || []);

  const itemsTotal = cart.items.reduce((s, i) => s + i.price, 0);
  const pickup = $('[data-pickup]');
  const manual = $('[data-pickup-manual]');
  const pickLabel = $('[data-pickup-label]');
  const shippingSel = () => (config.shipping || []).find((s) => s.id === form.shipping?.value);
  const paymentSel = () => (config.payment || []).find((p) => p.id === form.payment?.value);
  const update = () => {
    const s = shippingSel();
    const needsPoint = s && (s.id === 'zasilkovna' || s.id === 'balikovna');
    pickup.hidden = !needsPoint;
    // Zásilkovna: mapa jen s API klíčem Zásilkovny; Balíkovna: oficiální mapa České pošty (bez klíče)
    const widget = (s?.id === 'zasilkovna' && config.packetaKey) || s?.id === 'balikovna';
    $('[data-pick-point]').hidden = !widget;
    $('[data-pick-point]').textContent = s?.id === 'balikovna' ? L('Vybrat Balíkovnu na mapě', 'Choose Balíkovna on the map') : L('Vybrat výdejní místo na mapě', 'Choose pickup point on the map');
    const manualNeeded = needsPoint && !(s?.id === 'zasilkovna' && config.packetaKey);
    manual.hidden = !manualNeeded;
    manual.querySelector('input').required = manualNeeded && !form.pickupPointId.value;
    $('[data-zas-map]').hidden = !(s?.id === 'zasilkovna' && !config.packetaKey);
    const ship = s?.price ?? 0;
    const p = paymentSel();
    const cod = p?.id === 'cod' ? (p.price || 0) : 0;
    $('[data-summary]').innerHTML = `<div><span>${L('Hodinky', 'Watches')}</span><span>${fmt(itemsTotal)}</span></div><div><span>${L('Doprava', 'Shipping')}</span><span>${ship === 0 ? L('zdarma', 'free') : fmt(ship)}</span></div>${p?.id === 'cod' ? `<div><span>${L('Dobírka', 'Cash on delivery')}</span><span>${cod === 0 ? L('zdarma', 'free') : fmt(cod)}</span></div>` : ''}<div class="total"><span>${L('Celkem', 'Total')}</span><strong>${fmt(itemsTotal + ship + cod)}</strong></div>`;
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'shipping') { form.pickupPointId.value = ''; form.pickupPointName.value = ''; pickLabel.textContent = ''; } update(); });
  manual.insertAdjacentHTML('afterend', `<p class="doc-meta" data-zas-map hidden><a href="https://www.zasilkovna.cz/pobocky" target="_blank" rel="noopener noreferrer">${L('Najít výdejní místo Zásilkovny na mapě', 'Find a Packeta pickup point on the map')}</a> ${L('a zkopírujte jeho název a adresu.', 'and copy its name and address.')}</p>`);

  // Balíkovna: oficiální výběr České pošty v okně (iframe), výsledek přijde zprávou postMessage
  const BALIKOVNA_ORIGIN = 'https://b2c.cpost.cz';
  let bkFrame = null;
  const closeBk = () => { document.querySelector('[data-bk-modal]')?.remove(); bkFrame = null; };
  const openBalikovna = () => {
    const url = `${BALIKOVNA_ORIGIN}/locations/?type=BALIKOVNY&skipLocation=false&messageId=pickerResult`;
    document.body.insertAdjacentHTML('beforeend', `<div data-bk-modal role="dialog" aria-modal="true" aria-label="${L('Výběr Balíkovny', 'Choose Balíkovna')}" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.75);display:grid;place-items:center;padding:12px">
      <div style="width:min(960px,100%);height:min(720px,92vh);background:#fff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#111;color:#f2f2f2"><span>${L('Vyberte Balíkovnu', 'Choose Balíkovna')}</span><button type="button" class="btn ghost" data-bk-close style="min-height:36px;padding:6px 14px">${L('Zavřít', 'Close')}</button></div>
        <iframe src="${url}" title="${L('Mapa výdejních míst Balíkovny', 'Balíkovna pickup point map')}" allow="geolocation" style="flex:1;border:0;width:100%"></iframe>
      </div></div>`);
    bkFrame = document.querySelector('[data-bk-modal] iframe');
    document.querySelector('[data-bk-close]').addEventListener('click', closeBk);
  };
  window.addEventListener('message', (event) => {
    if (!bkFrame || event.origin !== BALIKOVNA_ORIGIN || event.source !== bkFrame.contentWindow) return;
    let data = event.data;
    try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
    if (!data || !['pickerResult', 'pickResult'].includes(data.message) || !data.point) return;
    const p = data.point;
    if (!p.id || !p.name) return;
    const city = p.municipality_name || p.city || '';
    form.pickupPointId.value = String(p.id);
    form.pickupPointName.value = [p.name, p.street || p.address, [p.zip, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    pickLabel.textContent = form.pickupPointName.value;
    closeBk(); update();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBk(); });
  update();

  // Výběr výdejního místa Zásilkovny (widget se načte až po kliknutí)
  $('[data-pick-point]').addEventListener('click', async () => {
    if (shippingSel()?.id === 'balikovna') { openBalikovna(); return; }
    if (!window.Packeta) {
      await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://widget.packeta.com/v6/www/js/library.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); })
        .catch(() => { manual.hidden = false; manual.querySelector('input').required = true; });
    }
    window.Packeta?.Widget.pick(config.packetaKey, (point) => {
      if (!point) return;
      form.pickupPointId.value = String(point.id);
      form.pickupPointName.value = `${point.name}, ${point.street || ''} ${point.city || ''}`.trim();
      pickLabel.textContent = form.pickupPointName.value;
    }, { country: 'cz', language: cs ? 'cs' : 'en' });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = shippingSel();
    if (['zasilkovna', 'balikovna'].includes(s?.id) && !form.pickupPointName.value.trim()) { showStatus(L('Vyberte prosím výdejní místo.', 'Please choose a pickup point.')); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      data.items = cart.items.map((i) => i.id);
      data.lang = cs ? 'cs' : 'en';
      data.terms = form.terms.checked;
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (out.unavailable) { out.unavailable.forEach((id) => window.DTCart.remove(id)); }
        throw new Error(out.error || L('Objednávku se nepodařilo odeslat', 'The order could not be sent'));
      }
      window.DTCart.clear();
      location.href = out.redirect;
    } catch (err) {
      showStatus(err.message);
      btn.disabled = false;
    }
  });
})();
