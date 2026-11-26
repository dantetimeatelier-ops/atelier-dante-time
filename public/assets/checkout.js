// Košík a objednávka: země doručení, měna, doprava, platba, výdejní místa
(async () => {
  const root = document.querySelector('[data-checkout]');
  if (!root) return;
  const cs = root.dataset.lang !== 'en';
  const L = (a, b) => (cs ? a : b);
  const $ = (s) => root.querySelector(s);
  const fmt = (n) => `${new Intl.NumberFormat(cs ? 'cs-CZ' : 'en-GB').format(n)} Kč`;
  const fmtEur = (cents) => new Intl.NumberFormat(cs ? 'cs-CZ' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const form = $('[data-cart-form]');
  const status = $('[data-status]');
  const showStatus = (msg, kind = 'err') => { status.hidden = false; status.className = `notice ${kind}`; status.textContent = msg; };

  let ids = window.DTCart?.read() || [];
  if (!ids.length) { $('[data-cart-empty]').hidden = false; return; }

  const getConfig = async (country = 'CZ', total = 0) => {
    try { return await (await fetch(`/api/config?lang=${cs ? 'cs' : 'en'}&country=${encodeURIComponent(country)}&total=${total}`)).json(); }
    catch { return { mode: 'preview' }; }
  };
  let config = await getConfig();
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
  const itemsTotal = cart.items.reduce((s, i) => s + i.price, 0);

  $('[data-cart-items]').innerHTML = cart.items.map((i) => `<div class="cart-item">
    ${i.image ? `<img src="${esc(i.image)}" alt="" width="84" height="100">` : '<span></span>'}
    <div><a href="${esc(i.url)}"><strong>${esc(i.title)}</strong></a><div class="doc-meta">${L('Unikátní kus', 'Unique piece')}</div></div>
    <div style="text-align:right"><div class="price" style="font-size:18px">${fmt(i.price)}</div><button class="btn ghost" type="button" data-remove="${esc(i.id)}" style="min-height:34px;padding:6px 12px;margin-top:6px">${L('Odebrat', 'Remove')}</button></div>
  </div>`).join('');
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { window.DTCart.remove(b.dataset.remove); location.reload(); }));

  const pickup = $('[data-pickup]');
  const manual = $('[data-pickup-manual]');
  const pickLabel = $('[data-pickup-label]');
  const submitBtn = form.querySelector('button[type=submit]');
  manual.insertAdjacentHTML('afterend', `<p class="doc-meta" data-zas-map hidden><a href="https://www.zasilkovna.cz/pobocky" target="_blank" rel="noopener noreferrer">${L('Otevřít mapu Zásilkovny', 'Open the Packeta map')}</a> ${L('(v novém okně). Mapa výběr sama nepřenese – opište prosím název a adresu výdejního místa do pole výše.', '(new window). The map cannot send the choice back – please type the pickup point name and address into the field above.')}</p>`);

  const radio = (name, opts, selected) => opts.map((o, n) => `<label class="choice"><input type="radio" name="${name}" value="${esc(o.id)}" ${(selected ? o.id === selected : n === 0) ? 'checked' : ''} required><span><span class="t">${esc(o.label)}</span>${o.price != null ? `<br><span class="doc-meta">${o.price === 0 ? L('zdarma', 'free') : fmt(o.price)}</span>` : ''}${o.note ? `<br><span class="doc-meta">${esc(o.note)}</span>` : ''}</span></label>`).join('');

  const shippingSel = () => (config.shipping || []).find((s) => s.id === form.shipping?.value);
  const paymentSel = () => (config.payment || []).find((p) => p.id === form.payment?.value);

  function renderOptions() {
    const prevShip = form.shipping?.value; const prevPay = form.payment?.value;
    $('[data-shipping]').innerHTML = radio('shipping', config.shipping || [], (config.shipping || []).some((s) => s.id === prevShip) ? prevShip : null);
    $('[data-no-shipping]').hidden = (config.shipping || []).length > 0;
    $('[data-insured-note]').hidden = !config.insuredOnly;
    const cur = $('[data-currency]'); const prevCur = cur.value;
    cur.innerHTML = (config.currencies || ['CZK']).map((c) => `<option value="${c}">${c === 'CZK' ? 'CZK (Kč)' : 'EUR (€)'}</option>`).join('');
    cur.value = (config.currencies || []).includes(prevCur) && form.country.value === 'CZ' ? prevCur : (config.currencies || []).includes('EUR') && form.country.value !== 'CZ' ? 'EUR' : 'CZK';
    $('[data-eu-note]').hidden = form.country.value === 'CZ' && cur.value === 'CZK';
    renderPayments(prevPay);
  }
  function renderPayments(prevPay) {
    const ship = shippingSel();
    const eur = form.currency.value === 'EUR';
    const opts = (config.payment || []).filter((p) => (!p.onlyWith || p.onlyWith.includes(ship?.id)) && (!eur || p.id === 'bank_transfer'));
    $('[data-payment]').innerHTML = radio('payment', opts, opts.some((p) => p.id === (prevPay || form.payment?.value)) ? (prevPay || form.payment?.value) : null);
    update();
  }
  function update() {
    const s = shippingSel();
    const needsPoint = s?.pickup;
    pickup.hidden = !needsPoint;
    const widget = (s?.id === 'zasilkovna' && config.packetaKey) || s?.id === 'balikovna';
    $('[data-pick-point]').hidden = !widget;
    $('[data-pick-point]').textContent = s?.id === 'balikovna' ? L('Vybrat Balíkovnu na mapě', 'Choose Balíkovna on the map') : L('Vybrat výdejní místo na mapě', 'Choose pickup point on the map');
    const manualNeeded = needsPoint && !(s?.id === 'zasilkovna' && config.packetaKey);
    manual.hidden = !manualNeeded;
    manual.querySelector('input').required = Boolean(manualNeeded) && !form.pickupPointId.value;
    $('[data-zas-map]').hidden = !(s?.id === 'zasilkovna' && !config.packetaKey);
    const ship = s?.price ?? 0;
    const p = paymentSel();
    const cod = p?.id === 'cod' ? (p.price || 0) : 0;
    const total = itemsTotal + ship + cod;
    const eur = form.currency.value === 'EUR' && config.eurRate;
    $('[data-summary]').innerHTML = `<div><span>${L('Hodinky', 'Watches')}</span><span>${fmt(itemsTotal)}</span></div><div><span>${L('Doprava', 'Shipping')}</span><span>${s ? (ship === 0 ? L('zdarma', 'free') : fmt(ship)) : '–'}</span></div>${p?.id === 'cod' ? `<div><span>${L('Dobírka', 'Cash on delivery')}</span><span>${cod === 0 ? L('zdarma', 'free') : fmt(cod)}</span></div>` : ''}<div class="total"><span>${L('Celkem', 'Total')}</span><strong>${fmt(total)}</strong></div>${eur ? `<div><span>${L('K úhradě v eurech', 'To pay in euros')}</span><strong>${fmtEur(Math.ceil(total / config.eurRate) * 100)}</strong></div><p class="doc-meta">${L('Kurz', 'Rate')} ${config.eurRate} Kč/€</p>` : ''}`;
    submitBtn.disabled = !s || !p;
  }

  form.addEventListener('change', async (e) => {
    if (e.target.name === 'country') {
      config = await getConfig(form.country.value, itemsTotal);
      form.pickupPointId.value = ''; form.pickupPointName.value = ''; pickLabel.textContent = '';
      renderOptions(); return;
    }
    if (e.target.name === 'shipping') { form.pickupPointId.value = ''; form.pickupPointName.value = ''; pickLabel.textContent = ''; renderPayments(); return; }
    if (e.target.name === 'currency') { $('[data-eu-note]').hidden = form.country.value === 'CZ' && form.currency.value === 'CZK'; renderPayments(); return; }
    update();
  });
  config = await getConfig(form.country.value, itemsTotal);
  renderOptions();

  // Balíkovna: oficiální výběr České pošty v okně (iframe), výsledek přijde zprávou postMessage
  const BALIKOVNA_ORIGIN = 'https://b2c.cpost.cz';
  let bkFrame = null;
  const closeBk = () => { document.querySelector('[data-bk-modal]')?.remove(); bkFrame = null; document.documentElement.style.overflow = ''; };
  const openBalikovna = () => {
    const url = `${BALIKOVNA_ORIGIN}/locations/?type=BALIKOVNY&skipLocation=false&messageId=pickerResult`;
    // Na celou obrazovku (na iPhonu jinak lišta prohlížeče zakryje tlačítko pro potvrzení výběru dole v mapě)
    document.body.insertAdjacentHTML('beforeend', `<div data-bk-modal role="dialog" aria-modal="true" aria-label="${L('Výběr Balíkovny', 'Choose Balíkovna')}" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center">
      <div style="width:min(960px,100%);height:100%;max-height:min(760px,100dvh);background:#fff;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top));background:#111;color:#f2f2f2"><span>${L('Vyberte Balíkovnu a potvrďte ji v mapě', 'Choose Balíkovna and confirm it in the map')}</span><button type="button" class="btn ghost" data-bk-close style="min-height:36px;padding:6px 14px">${L('Zavřít', 'Close')}</button></div>
        <iframe src="${url}" title="${L('Mapa výdejních míst Balíkovny', 'Balíkovna pickup point map')}" allow="geolocation" style="flex:1;border:0;width:100%;min-height:0"></iframe>
      </div></div>`);
    document.documentElement.style.overflow = 'hidden';
    bkFrame = document.querySelector('[data-bk-modal] iframe');
    document.querySelector('[data-bk-close]').addEventListener('click', closeBk);
  };
  // Výsledek z mapy České pošty. Zpráva může přijít i z vnořeného okna mapy, proto se ověřuje jen původ (b2c.cpost.cz).
  window.addEventListener('message', (event) => {
    if (!bkFrame || !/^https:\/\/([a-z0-9-]+\.)*cpost\.cz$/.test(event.origin)) return;
    let data = event.data;
    try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
    const p = data && typeof data === 'object' ? (data.point || (data.message === 'pickerResult' ? data : null)) : null;
    if (!p || typeof p !== 'object' || p.id == null) return;
    const city = p.municipality_name || p.city || '';
    const label = [p.name || p.nazev, p.street || p.address || p.adresa, [p.zip || p.psc, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    if (!label) return;
    form.pickupPointId.value = String(p.id);
    form.pickupPointName.value = label.slice(0, 200);
    pickLabel.textContent = `${L('Vybráno:', 'Selected:')} ${form.pickupPointName.value}`;
    closeBk(); update();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBk(); });

  // Zásilkovna (widget se načte až po kliknutí, jen s API klíčem Zásilkovny)
  $('[data-pick-point]').addEventListener('click', async () => {
    if (shippingSel()?.id === 'balikovna') { openBalikovna(); return; }
    if (!window.Packeta) {
      await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://widget.packeta.com/v6/www/js/library.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); })
        .catch(() => { manual.hidden = false; manual.querySelector('input').required = true; });
    }
    window.Packeta?.Widget.pick(config.packetaKey, (point) => {
      if (!point) return;
      form.pickupPointId.value = String(point.id);
      form.pickupPointName.value = (point.formatedValue || [point.name, point.street, [point.zip, point.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')).slice(0, 200);
      pickLabel.textContent = `${L('Vybráno:', 'Selected:')} ${form.pickupPointName.value}`;
      update();
    }, { country: 'cz', language: cs ? 'cs' : 'en' });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = shippingSel();
    if (s?.pickup && !form.pickupPointName.value.trim()) { showStatus(L('Vyberte prosím výdejní místo.', 'Please choose a pickup point.')); return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    submitBtn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      data.items = cart.items.map((i) => i.id);
      data.lang = cs ? 'cs' : 'en';
      data.terms = form.terms.checked;
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (out.unavailable) out.unavailable.forEach((id) => window.DTCart.remove(id));
        throw new Error(out.error || L('Objednávku se nepodařilo odeslat', 'The order could not be sent'));
      }
      window.DTCart.clear();
      location.href = out.redirect;
    } catch (err) {
      showStatus(err.message);
      submitBtn.disabled = false;
    }
  });
})();
