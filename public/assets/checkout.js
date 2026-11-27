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
    // Nabídka dopravy se počítá na serveru podle hodinek v košíku (hodnota, materiál pouzdra) a země
    try { return await (await fetch(`/api/config?lang=${cs ? 'cs' : 'en'}&country=${encodeURIComponent(country)}&total=${total}&items=${encodeURIComponent(ids.join(','))}`)).json(); }
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
  manual.insertAdjacentHTML('beforebegin', `<div data-zas-map hidden><a class="btn ghost" href="https://www.zasilkovna.cz/pobocky" target="_blank" rel="noopener noreferrer">${L('Vybrat Zásilkovnu na mapě', 'Choose Packeta point on the map')}</a><p class="doc-meta" style="margin-top:8px">${L('Mapa se otevře v novém okně. Název a adresu vybraného místa vložte do pole níže.', 'The map opens in a new window. Enter the chosen point name and address below.')}</p></div>`);

  // Decentní textová označení platebních metod (jen u skutečně dostupných možností)
  const BADGE = { visa: 'Visa', mastercard: 'Mastercard', applepay: 'Apple Pay', googlepay: 'Google Pay', qr: L('QR platba', 'QR payment'), cod: L('Při převzetí', 'On delivery') };
  const badges = (o) => (o.badges?.length ? `<span class="pay-badges">${o.badges.map((b) => `<span class="pay-badge pay-${esc(b)}">${esc(BADGE[b] || b)}</span>`).join('')}</span>` : '');
  const radio = (name, opts, selected) => opts.map((o, n) => `<label class="choice"><input type="radio" name="${name}" value="${esc(o.id)}" ${(selected ? o.id === selected : n === 0) ? 'checked' : ''} required><span class="choice-body"><span class="choice-head"><span class="t">${esc(o.label)}</span>${o.price != null ? `<span class="choice-price">${o.price === 0 ? L('zdarma', 'free') : fmt(o.price)}</span>` : ''}</span>${badges(o)}${o.note ? `<span class="doc-meta">${esc(o.note)}</span>` : ''}</span></label>`).join('');

  const shippingSel = () => (config.shipping || []).find((s) => s.id === form.shipping?.value);
  const paymentSel = () => (config.payment || []).find((p) => p.id === form.payment?.value);

  function renderOptions() {
    const prevShip = form.shipping?.value; const prevPay = form.payment?.value;
    $('[data-shipping]').innerHTML = radio('shipping', config.shipping || [], (config.shipping || []).some((s) => s.id === prevShip) ? prevShip : null);
    $('[data-no-shipping]').hidden = !config.noCarrier;
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
    const opts = (config.payment || []).filter((p) => (!p.onlyWith || p.onlyWith.includes(ship?.id)) && (p.currencies || ['CZK']).includes(eur ? 'EUR' : 'CZK'))
      .map((p) => (p.fees ? { ...p, price: p.fees[ship?.id] ?? p.price } : p)); // dobírka: příplatek podle dopravce
    $('[data-payment]').innerHTML = radio('payment', opts, opts.some((p) => p.id === (prevPay || form.payment?.value)) ? (prevPay || form.payment?.value) : null);
    update();
  }
  function update() {
    const s = shippingSel();
    const needsPoint = s?.pickup;
    pickup.hidden = !needsPoint;
    const widget = (s?.id === 'zasilkovna' && config.packetaKey) || s?.id === 'balikovna';
    $('[data-pick-point]').hidden = !widget;
    $('[data-pick-point]').textContent = s?.id === 'balikovna' ? L('Vybrat Balíkovnu na mapě', 'Choose Balíkovna on the map') : L('Vybrat Zásilkovnu na mapě', 'Choose Packeta point on the map');
    // Ruční pole jen u Zásilkovny bez mapy v okně (bez klíče API); Balíkovna se vybírá výhradně na mapě
    const manualNeeded = needsPoint && s?.id === 'zasilkovna' && !config.packetaKey;
    manual.hidden = !manualNeeded;
    manual.querySelector('input').required = Boolean(manualNeeded) && !form.pickupPointId.value;
    $('[data-zas-map]').hidden = !(s?.id === 'zasilkovna' && !config.packetaKey);
    // Doručení na adresu: adresní pole slouží jako doručovací adresa
    $('[data-address-legend]').textContent = s?.address ? L('Kontaktní údaje a doručovací adresa', 'Contact details and delivery address') : L('Kontaktní a fakturační údaje', 'Contact & billing details');
    const ship = s?.price ?? 0;
    const p = paymentSel();
    const cod = p?.id === 'cod' ? (p.fees?.[s?.id] ?? p.price ?? 0) : 0;
    const total = itemsTotal + ship + cod;
    // Karta se vždy strhává v Kč (bez poplatku za převod měny), částku v eurech přepočte banka zákazníka
    const cardCzk = p?.chargeCurrency === 'CZK' && form.currency.value === 'EUR';
    const eur = form.currency.value === 'EUR' && config.eurRate && !cardCzk;
    $('[data-summary]').innerHTML = `<div><span>${L('Hodinky', 'Watches')}</span><span>${fmt(itemsTotal)}</span></div><div><span>${L('Doprava', 'Shipping')}</span><span>${s ? (ship === 0 ? L('zdarma', 'free') : fmt(ship)) : '–'}</span></div>${p?.id === 'cod' ? `<div><span>${L('Dobírka', 'Cash on delivery')}</span><span>${cod === 0 ? L('zdarma', 'free') : fmt(cod)}</span></div>` : ''}<div class="total"><span>${L('Celkem', 'Total')}</span><strong>${fmt(total)}</strong></div>${eur ? `<div><span>${L('K úhradě v eurech', 'To pay in euros')}</span><strong>${fmtEur(Math.ceil(total / config.eurRate) * 100)}</strong></div><p class="doc-meta">${L('Kurz', 'Rate')} ${config.eurRate} Kč/€</p>` : ''}${cardCzk ? `<p class="doc-meta">${L('Platba kartou proběhne v Kč, přepočet provede vaše banka.', 'The card is charged in CZK; your bank converts the amount.')}</p>` : ''}`;
    submitBtn.disabled = !s || !p;
    const bar = $('[data-mobile-total]');
    if (bar) bar.textContent = eur ? `${fmtEur(Math.ceil(total / config.eurRate) * 100)}` : fmt(total);
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
  root.querySelector('[data-mobile-go]')?.addEventListener('click', () => root.querySelector('.buybox')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  // Výběr výdejního místa: oficiální mapa dopravce v okně přes celou obrazovku (iframe), výsledek přijde zprávou postMessage.
  // Balíkovna = Česká pošta (b2c.cpost.cz), Zásilkovna = widget.packeta.com (vlastní okno místo jejich knihovny –
  // ta na iPhonu přepisuje nastavení zobrazení stránky a okno zamrzne).
  const BALIKOVNA_ORIGIN = 'https://b2c.cpost.cz';
  const PACKETA_ORIGIN = 'https://widget.packeta.com';
  let picker = null; // { frame, carrier }
  const closePicker = () => { document.querySelector('[data-pick-modal]')?.remove(); picker = null; document.documentElement.style.overflow = ''; };
  const openPicker = (carrier, url, title, hint) => {
    closePicker();
    document.body.insertAdjacentHTML('beforeend', `<div data-pick-modal role="dialog" aria-modal="true" aria-label="${esc(title)}" style="position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center">
      <div style="width:min(960px,100%);height:100%;max-height:min(760px,100dvh);background:#fff;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top));background:#111;color:#f2f2f2"><span>${esc(hint)}</span><button type="button" class="btn ghost" data-pick-close style="min-height:36px;padding:6px 14px">${L('Zavřít', 'Close')}</button></div>
        <iframe src="${esc(url)}" title="${esc(title)}" allow="geolocation" style="flex:1;border:0;width:100%;min-height:0"></iframe>
      </div></div>`);
    document.documentElement.style.overflow = 'hidden';
    picker = { frame: document.querySelector('[data-pick-modal] iframe'), carrier };
    document.querySelector('[data-pick-close]').addEventListener('click', closePicker);
  };
  const choose = (id, label) => {
    form.pickupPointId.value = String(id);
    form.pickupPointName.value = label.slice(0, 200);
    pickLabel.textContent = `${L('Vybráno:', 'Selected:')} ${form.pickupPointName.value}`;
    closePicker(); update();
  };
  window.addEventListener('message', (event) => {
    if (!picker) return;
    let data = event.data;
    try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
    if (!data || typeof data !== 'object') return;
    if (picker.carrier === 'balikovna' && /^https:\/\/([a-z0-9-]+\.)*cpost\.cz$/.test(event.origin)) {
      // Zpráva může přijít i z vnořeného okna mapy, proto se ověřuje jen původ
      const p = data.point || (data.message === 'pickerResult' ? data : null);
      if (!p || typeof p !== 'object' || p.id == null) return;
      const label = [p.name || p.nazev, p.street || p.address || p.adresa, [p.zip || p.psc, p.municipality_name || p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      if (label) choose(p.id, label);
    } else if (picker.carrier === 'zasilkovna' && /^https:\/\/([a-z0-9-]+\.)*packeta\.com$/.test(event.origin)) {
      if (!data.packetaWidgetMessage) return;
      const p = data.packetaPoint;
      if (!p) { closePicker(); return; } // zákazník mapu zavřel bez výběru
      const label = p.formatedValue || [p.name, p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      // Výdejní místo partnerského dopravce v zahraničí: ID dopravce + ID jeho místa
      const id = p.carrierId && p.carrierPickupPointId ? `c${p.carrierId}:${p.carrierPickupPointId}` : p.id;
      if (id != null && label) choose(id, label);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

  $('[data-pick-point]').addEventListener('click', () => {
    if (shippingSel()?.id === 'balikovna') {
      openPicker('balikovna', `${BALIKOVNA_ORIGIN}/locations/?type=BALIKOVNY&skipLocation=false&messageId=pickerResult`, L('Mapa výdejních míst Balíkovny', 'Balíkovna pickup point map'),
        L('Klepněte na místo, sjeďte v mapě dolů pod otevírací dobu a potvrďte tlačítkem výběru', 'Tap a point, scroll down below the opening hours and confirm with the select button'));
      return;
    }
    if (!config.packetaKey) return;
    const q = new URLSearchParams({ apiKey: config.packetaKey, language: cs ? 'cs' : 'en', country: String(form.country.value || 'CZ').toLowerCase(), appIdentity: 'atelier-dante-time' });
    openPicker('zasilkovna', `${PACKETA_ORIGIN}/v6/#/?${q.toString()}`, L('Mapa výdejních míst Zásilkovny', 'Packeta pickup point map'),
      L('Vyberte výdejní místo Zásilkovny a potvrďte ho tlačítkem Vybrat', 'Choose a Packeta pickup point and confirm it with the select button'));
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
