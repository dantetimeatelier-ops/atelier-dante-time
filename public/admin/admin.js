// Administrace Dante Time – jednoduchá aplikace pro iPhone
(() => {
  const app = document.getElementById('app');
  const tabs = document.getElementById('tabs');
  const toastEl = document.getElementById('toast');
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const czk = (n) => (n == null || n === '' ? '–' : `${new Intl.NumberFormat('cs-CZ').format(n)} Kč`);
  const date = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const L = {
    product: { draft: 'Koncept', available: 'Skladem', reserved: 'Rezervováno', sold: 'Prodáno', in_progress: 'V přípravě', archived: 'Archiv' },
    order: { awaiting_payment: 'Čeká na platbu', paid: 'Zaplaceno', shipped: 'Odesláno', completed: 'Dokončeno', cancelled: 'Zrušeno', expired: 'Vypršelo', withdrawn: 'Odstoupeno' },
    ctype: { servis: 'Servis', renovace: 'Renovace', zakazkova_vyroba: 'Zakázková výroba', prestavba: 'Přestavba' },
    cstatus: { poptavka: 'Poptávka', nabidka: 'Nabídka odeslána', prijato: 'Přijato', v_praci: 'V práci', ceka_na_dily: 'Čeká na díly', hotovo: 'Hotovo', predano: 'Předáno', zruseno: 'Zrušeno' },
    inq: { nova: 'Nová', vyrizuje_se: 'Vyřizuje se', vyrizena: 'Vyřízená', spam: 'Spam' },
    itype: { servis: 'Servis', renovace: 'Renovace', zakazkova_vyroba: 'Zakázková sestava', prestavba: 'Přestavba', jine: 'Jiný dotaz', product: 'Zájem o hodinky', general: 'Dotaz' },
    ship: { zasilkovna: 'Zásilkovna', balikovna: 'Balíkovna', osobni: 'Osobně' },
    pay: { bank_transfer: 'Převod', card: 'Karta', cod: 'Dobírka', cash: 'Hotově' },
  };
  const chip = (group, v) => `<span class="chip ${esc(v)}">${esc(L[group][v] || v)}</span>`;
  const toast = (msg, err) => { toastEl.textContent = msg; toastEl.className = `toast${err ? ' err' : ''}`; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.hidden = true; }, err ? 6000 : 2500); };

  async function api(method, path, body) {
    const opts = { method, headers: { 'X-DT-Admin': '1' }, credentials: 'same-origin' };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(`/api/admin/${path}`, opts);
    const out = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith('login') && !path.startsWith('setup')) { showLogin(); throw new Error('Přihlaste se prosím'); }
    if (!res.ok) throw new Error(out.error || `Chyba ${res.status}`);
    return out;
  }
  const run = async (fn) => { try { await fn(); } catch (e) { toast(e.message, true); } };
  const formData = (form) => Object.fromEntries(new FormData(form));

  // --- Přihlášení a první nastavení -----------------------------------------------
  async function showLogin() {
    tabs.hidden = true; document.getElementById('logout').hidden = true;
    const { needed } = await fetch('/api/admin/setup').then((r) => r.json()).catch(() => ({ needed: false }));
    if (needed) return showSetup();
    app.innerHTML = `<h1>Přihlášení</h1><form class="card" id="f">
      <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label>Heslo<input name="password" type="password" autocomplete="current-password" required></label>
      <label>Ověřovací kód (6 číslic)<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>
      <button class="btn primary block">Přihlásit se</button></form>
      <p class="muted small">Kód najdete v aplikaci Hesla (iPhone) nebo v jiné aplikaci pro ověřovací kódy.</p>`;
    app.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('POST', 'login', formData(e.target)); start(); }); });
  }

  function showSetup() {
    app.innerHTML = `<h1>První nastavení</h1><div class="card"><p>Vytvořte si účet do administrace. Budete potřebovat <b>instalační kód</b> (najdete ho v návodu, nastavuje se v Cloudflare).</p>
      <form id="s1"><label>Instalační kód<input name="token" required autocomplete="off"></label><label>Váš e-mail<input name="email" type="email" required autocomplete="username"></label><button class="btn primary block">Pokračovat</button></form></div>`;
    app.querySelector('#s1').addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const d = formData(e.target);
      const { secret, qr } = await api('POST', 'setup/start', d);
      app.innerHTML = `<h1>Dvoufázové ověření</h1><div class="card">
        <p><b>1.</b> Na iPhonu otevřete fotoaparát a naskenujte kód níže, nebo klepněte na „Přidat do Hesel“. Uloží se do aplikace Hesla jako ověřovací kód.</p>
        <div class="qr">${qr}</div>
        <p class="center"><a class="btn ghost" href="otpauth://totp/${encodeURIComponent('Dante Time:' + d.email)}?secret=${secret}&issuer=Dante%20Time">Přidat do Hesel</a></p>
        <p class="small muted">Ruční zadání klíče:</p><p class="code">${esc(secret)}</p></div>
        <form class="card" id="s2"><p><b>2.</b> Zvolte heslo (alespoň 12 znaků) a opište aktuální 6místný kód.</p>
        <label>Heslo<input name="password" type="password" minlength="12" required autocomplete="new-password"></label>
        <label>Ověřovací kód<input name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label>
        <button class="btn primary block">Dokončit</button></form>`;
      app.querySelector('#s2').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => {
        await api('POST', 'setup/finish', { ...d, secret, ...formData(ev.target) }); toast('Hotovo, jste přihlášeni'); start();
      }); });
    }); });
  }

  document.getElementById('logout').addEventListener('click', () => run(async () => { await api('POST', 'logout', {}); showLogin(); }));

  // --- Zmenšení fotografií v telefonu (odstraní i metadata/GPS) ------------------
  async function resize(file, max) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale); const h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.84));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
      return { blob, w, h };
    } finally { URL.revokeObjectURL(url); }
  }

  // --- Obrazovky -----------------------------------------------------------------------
  const views = {};

  views[''] = async () => {
    const d = await api('GET', 'dashboard');
    const p = d.products;
    app.innerHTML = `<h1>Přehled</h1>
      <a class="btn primary block" href="#/hodinky/nove" style="margin-bottom:14px">+ Přidat hodinky</a>
      ${d.warnings.length ? `<div class="card warn"><b>Co je potřeba doplnit</b><ul class="small">${d.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <div class="grid">
        <a class="stat" href="#/objednavky"><b>${d.ordersAwaiting}</b>čeká na platbu</a>
        <a class="stat" href="#/objednavky"><b>${d.ordersToShip}</b>k odeslání</a>
        <a class="stat" href="#/poptavky"><b>${d.inquiriesNew}</b>nových poptávek</a>
        <a class="stat" href="#/zakazky"><b>${d.commissionsActive}</b>zakázek v běhu</a>
        <a class="stat" href="#/hodinky"><b>${p.available || 0}</b>skladem</a>
        <a class="stat" href="#/hodinky"><b>${(p.draft || 0) + (p.in_progress || 0)}</b>v přípravě</a>
      </div>
      ${d.withdrawals ? `<a class="card err" style="display:block;margin-top:12px" href="#/odstoupeni">⚠ ${d.withdrawals} odstoupení od smlouvy za 30 dní</a>` : ''}
      <p class="muted small" style="margin-top:16px">Režim e-shopu: <b>${{ preview: 'náhled (bez nákupu)', test: 'testovací', live: 'ostrý' }[d.mode]}</b></p>`;
  };

  views.hodinky = async (_, q) => {
    const { products } = await api('GET', 'products');
    const f = q.get('f') || 'all';
    const groups = { all: () => true, draft: (x) => x.status === 'draft' || x.status === 'in_progress', available: (x) => x.status === 'available' || x.status === 'reserved', sold: (x) => x.status === 'sold' || x.status === 'archived' };
    const list = products.filter(groups[f] || groups.all);
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Hodinky</h1><a class="btn primary" href="#/hodinky/nove">+ Přidat</a></div>
      <div class="filters">${[['all', 'Vše'], ['draft', 'Rozpracované'], ['available', 'V prodeji'], ['sold', 'Prodané']].map(([k, t]) => `<button data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
      <div class="list">${list.map((x) => `<a class="item" href="#/hodinky/${x.id}">${x.images[0] ? `<img src="/media/${esc(x.images[0].key_small)}" alt="">` : '<span class="ph"></span>'}
        <span class="grow"><span class="t">${esc(x.title)}</span><br>${chip('product', x.status)} <span class="small muted">${czk(x.price_czk)}</span></span></a>`).join('') || '<p class="muted">Zatím žádné hodinky.</p>'}</div>`;
    app.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/hodinky?f=${b.dataset.f}`; }));
  };

  const field = (name, label, p, attrs = '') => `<label>${label}<input name="${name}" value="${esc(p[name])}" ${attrs}></label>`;
  const area = (name, label, p, attrs = '') => `<label>${label}<textarea name="${name}" ${attrs}>${esc(p[name])}</textarea></label>`;

  views['hodinky/nove'] = async () => {
    const { id } = await api('POST', 'products', { status: 'draft' });
    location.replace(`#/hodinky/${id}?nove=1`);
  };

  views['hodinky/:id'] = async ({ id }, q) => {
    const { product: p } = await api('GET', `products/${id}`);
    const pub = `/hodinky/${p.slug}`;
    app.innerHTML = `<p><a href="#/hodinky">← Hodinky</a></p>
      <h1>${esc(p.title)}</h1>
      <div class="row" style="margin-bottom:12px">${chip('product', p.status)} ${p.status !== 'draft' ? `<a class="small" href="${pub}" target="_blank">Zobrazit na webu ↗</a>` : '<span class="small muted">Koncept – na webu není vidět</span>'}</div>
      ${q.get('nove') ? '<div class="card warn small">Začněte fotografiemi, pak vyplňte základní údaje a cenu. Popis a SEO vygenerujete tlačítkem.</div>' : ''}
      <h2>Fotografie</h2>
      <div class="photos" id="photos">${p.images.map((i, n) => `<div class="photo">${n === 0 ? '<span class="first">Hlavní</span>' : ''}<img src="/media/${esc(i.key_small)}" alt="">
        <div class="act"><button data-up="${i.id}" aria-label="Posunout dopředu">◀</button><button data-del="${i.id}" aria-label="Smazat">🗑</button></div></div>`).join('')}
        <label class="upload">+ Přidat fotky<br>(fotoaparát nebo galerie)<input type="file" accept="image/*" multiple id="files"></label></div>
      <p class="small muted" id="upl"></p>
      <form id="pf">
        <details open><summary>Základ</summary>
          <div class="grid">${field('brand', 'Značka', p)}${field('model', 'Model', p)}</div>
          <div class="grid">${field('year', 'Rok výroby', p)}${field('price_czk', 'Cena (Kč)', p, 'inputmode="numeric"')}</div>
          ${field('title', 'Název na webu (vyplní se sám ze značky a modelu)', p)}
          <label>Stav v e-shopu<select name="status">${['draft', 'in_progress', 'available', 'sold', 'archived'].map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${L.product[s]}</option>`).join('')}${p.status === 'reserved' ? '<option value="reserved" selected>Rezervováno (objednávkou)</option>' : ''}</select></label>
          <label>Druh hodinek<select name="kind">${[['original', 'Originální hodinky (po servisu / renovaci)'], ['prestavba', 'Přestavba (upravené, část dílů není původní)'], ['sestava', 'Sestava z ateliéru (z vybraných dílů)']].map(([v, t]) => `<option value="${v}" ${(p.kind || 'original') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''} style="width:22px;min-height:22px"> Zobrazit na hlavní stránce</label>
        </details>
        <details ${['zlato', 'stribro', 'platina', 'pozlaceno'].includes(p.case_metal) ? 'open' : ''}><summary>Pouzdro a punc</summary>
          <label>Materiál pouzdra<select name="case_metal"><option value="">–</option>${[['ocel', 'nerezová ocel'], ['mosaz', 'mosaz'], ['chrom', 'chromovaná mosaz'], ['pozlaceno', 'pozlacené (není drahý kov)'], ['zlato', 'zlato'], ['stribro', 'stříbro'], ['platina', 'platina'], ['titan', 'titan'], ['jine', 'jiné']].map(([v, t]) => `<option value="${v}" ${p.case_metal === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          ${field('hallmark', 'Ryzost a punc (u zlata, stříbra, platiny povinné)', p, 'placeholder="např. Au 585/1000, česká puncovní značka"')}
          ${field('plating', 'Pozlacení (u pozlacených pouzder)', p, 'placeholder="např. pozlaceno 20 µm"')}
        </details>
        <details><summary>Strojek a pouzdro</summary>
          ${field('movement', 'Strojek (kalibr)', p)}
          <label>Nátah<select name="movement_type"><option value="">–</option><option value="manual" ${p.movement_type === 'manual' ? 'selected' : ''}>ruční</option><option value="automatic" ${p.movement_type === 'automatic' ? 'selected' : ''}>automatický</option></select></label>
          <div class="grid">${field('case_diameter_mm', 'Průměr pouzdra (mm)', p, 'inputmode="decimal"')}${field('lug_width_mm', 'Šířka uchycení (mm)', p, 'inputmode="decimal"')}</div>
          ${field('case_material', 'Materiál pouzdra – podrobnosti (nepovinné)', p)}${field('dial', 'Ciferník', p)}${field('crystal', 'Sklíčko', p)}${field('strap', 'Řemínek / tah', p)}${field('water_resistance', 'Vodotěsnost (prázdné = není do vody)', p)}${field('reference', 'Reference', p)}
        </details>
        <details><summary>Stav, práce a originalita</summary>
          ${area('condition', 'Stav hodinek (opotřebení, vzhled)', p)}${area('service_done', 'Provedené práce', p)}
          ${area('original_parts', 'Deklarované originální díly (doživotní garance pravosti!)', p)}${area('authenticity_note', 'Jak byla originalita ověřena (nepovinné)', p)}${field('serial_ref', 'Identifikace hodinek – č. pouzdra / strojku (neveřejné, pro garanci)', p)}${area('replaced_parts', 'Vyměněné / neoriginální díly', p)}${field('accessories', 'Příslušenství', p)}
        </details>
        <details><summary>Popis a SEO</summary>
          <button class="btn block" type="button" id="gen" style="margin-bottom:12px">✨ Vygenerovat popis a SEO z parametrů</button>
          ${area('description_cs', 'Popis (česky)', p, 'style="min-height:160px"')}${area('description_en', 'Popis (anglicky)', p, 'style="min-height:140px"')}
          ${field('seo_title', 'SEO titulek', p, 'maxlength="80"')}${area('seo_description', 'SEO popis', p, 'maxlength="200" style="min-height:80px"')}
        </details>
        <details><summary>Bezpečnost výrobku (GPSR)</summary>
          ${field('manufacturer_info', 'Výrobce (název, adresa) – pokud je znám', p)}${area('safety_info', 'Bezpečnostní upozornění', p)}
        </details>
        <div class="sticky-save"><button class="btn primary block">Uložit</button></div>
      </form>
      ${p.status === 'draft' ? '<button class="btn danger block" id="del" style="margin-top:12px">Smazat koncept</button>' : ''}`;

    const form = app.querySelector('#pf');
    const save = async (extra = {}) => {
      const d = formData(form); d.featured = form.featured.checked; Object.assign(d, extra);
      await api('PUT', `products/${id}`, d); toast('Uloženo');
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await save(); views['hodinky/:id']({ id }, new URLSearchParams()); }); });
    app.querySelector('#gen').addEventListener('click', () => run(async () => {
      await save();
      const g = await api('POST', `products/${id}/describe`);
      for (const k of ['description_cs', 'description_en', 'seo_title', 'seo_description']) form[k].value = g[k] || '';
      toast('Popis vygenerován – zkontrolujte a uložte');
    }));
    app.querySelector('#del')?.addEventListener('click', () => run(async () => { if (!confirm('Opravdu smazat tento koncept?')) return; await api('DELETE', `products/${id}`); location.hash = '#/hodinky'; }));
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat fotografii?')) return; await api('DELETE', `images/${b.dataset.del}`); views['hodinky/:id']({ id }, new URLSearchParams()); })));
    app.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => run(async () => {
      const ids = p.images.map((i) => i.id); const n = ids.indexOf(b.dataset.up); if (n <= 0) return;
      [ids[n - 1], ids[n]] = [ids[n], ids[n - 1]];
      await api('PUT', `products/${id}/images/order`, { ids }); views['hodinky/:id']({ id }, new URLSearchParams());
    })));
    app.querySelector('#files').addEventListener('change', (e) => run(async () => {
      const files = [...e.target.files]; const info = app.querySelector('#upl');
      for (const [n, file] of files.entries()) {
        info.textContent = `Nahrávám ${n + 1} z ${files.length}…`;
        const large = await resize(file, 2000); const small = await resize(file, 800);
        const fd = new FormData();
        const ext = large.blob.type === 'image/webp' ? 'webp' : 'jpg';
        fd.append('large', large.blob, `l.${ext}`); fd.append('small', small.blob, `s.${ext}`);
        fd.append('width', large.w); fd.append('height', large.h);
        await api('POST', `products/${id}/images`, fd);
      }
      info.textContent = ''; toast('Fotografie nahrány'); views['hodinky/:id']({ id }, new URLSearchParams());
    }));
  };

  views.objednavky = async () => {
    const { orders } = await api('GET', 'orders');
    app.innerHTML = `<h1>Objednávky</h1><div class="list">${orders.map((o) => `<a class="item" href="#/objednavky/${o.id}"><span class="grow"><span class="t">${esc(o.number)} · ${esc(o.name)}</span><br>${chip('order', o.status)} ${o.mode === 'test' ? '<span class="chip">test</span>' : ''} <span class="small muted">${czk(o.total)} · ${date(o.created_at)}</span></span></a>`).join('') || '<p class="muted">Zatím žádné objednávky.</p>'}</div>`;
  };

  views['objednavky/:id'] = async ({ id }) => {
    const { order: o, items, withdrawals, invoices } = await api('GET', `orders/${id}`);
    app.innerHTML = `<p><a href="#/objednavky">← Objednávky</a></p><h1>${esc(o.number)}</h1><p>${chip('order', o.status)} ${o.mode === 'test' ? '<span class="chip">test</span>' : ''}</p>
      ${withdrawals.length ? `<div class="card err">⚠ Zákazník odstoupil od smlouvy ${date(withdrawals[0].created_at)}: ${esc(withdrawals[0].statement)}</div>` : ''}
      <div class="card"><table>
        ${items.map((i) => `<tr><th>${i.slug ? `<a href="/hodinky/${esc(i.slug)}" target="_blank">${esc(i.title)}</a>` : esc(i.title)}</th><td>${czk(i.price_czk)}</td></tr>`).join('')}
        <tr><th>Doprava: ${esc(L.ship[o.shipping_method] || o.shipping_method)}</th><td>${czk(o.shipping_price)}</td></tr>
        <tr><th><b>Celkem</b></th><td><b>${czk(o.total)}</b></td></tr>
        <tr><th>Platba</th><td>${esc(L.pay[o.payment_method])} · VS ${esc(o.variable_symbol)}</td></tr>
        ${o.reserved_until && o.status === 'awaiting_payment' ? `<tr><th>Rezervace do</th><td>${date(o.reserved_until)}</td></tr>` : ''}
        ${o.cod_fee ? `<tr><th>Dobírka</th><td>${czk(o.cod_fee)}</td></tr>` : ''}
        ${invoices.map((v) => `<tr><th>Faktura</th><td><a href="/faktura/${esc(v.public_token)}" target="_blank">${esc(v.number)}</a>${v.cancelled_at ? ' (storno)' : ''}</td></tr>`).join('')}
      </table></div>
      <div class="card"><table>
        <tr><th>Zákazník</th><td>${esc(o.name)}${o.company ? `<br>${esc(o.company)} (IČO ${esc(o.company_ico || '')})` : ''}</td></tr>
        <tr><th>Kontakt</th><td><a href="mailto:${esc(o.email)}">${esc(o.email)}</a><br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></td></tr>
        <tr><th>Adresa</th><td>${esc(o.billing_street)}, ${esc(o.billing_zip)} ${esc(o.billing_city)}</td></tr>
        <tr><th>Výdejní místo</th><td>${esc(o.pickup_point_name || '–')}${o.pickup_point_id ? ` (ID ${esc(o.pickup_point_id)})` : ''}</td></tr>
        ${o.customer_note ? `<tr><th>Poznámka</th><td>${esc(o.customer_note)}</td></tr>` : ''}
        <tr><th>Podmínky</th><td class="small">verze ${esc(o.terms_version)}, ${date(o.terms_accepted_at)}</td></tr>
      </table></div>
      <div class="list" id="actions">
        ${(o.status === 'awaiting_payment' && o.payment_method !== 'cod') || o.status === 'expired' ? '<button class="btn primary block" data-a="paid">✓ Platba přijata</button>' : ''}
        ${o.status === 'paid' || (o.status === 'awaiting_payment' && o.payment_method === 'cod') ? `<label>Číslo zásilky (nepovinné)<input id="tracking"></label><button class="btn primary block" data-a="shipped">Odesláno${o.payment_method === 'cod' ? ' na dobírku' : ''} – informovat zákazníka</button>` : ''}
        ${o.status === 'shipped' && o.payment_method === 'cod' ? '<button class="btn primary block" data-a="paid">✓ Dobírka zaplacena – vystavit fakturu</button>' : ''}
        ${o.status === 'shipped' && o.payment_method !== 'cod' ? '<button class="btn block" data-a="completed">Dokončeno (převzato)</button>' : ''}
        ${['paid', 'shipped', 'completed'].includes(o.status) ? '<button class="btn ghost block" data-a="withdrawn">Zákazník odstoupil – vrátit hodinky do prodeje</button>' : ''}
        ${o.status === 'awaiting_payment' ? '<button class="btn danger block" data-a="cancel">Zrušit objednávku a uvolnit hodinky</button>' : ''}
      </div>
      <h2>Interní poznámka</h2><form id="nf"><textarea name="note">${esc(o.internal_note)}</textarea><button class="btn block">Uložit poznámku</button></form>`;
    app.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => run(async () => {
      const a = b.dataset.a;
      if (a === 'cancel' && !confirm('Zrušit objednávku?')) return;
      if (a === 'withdrawn' && !confirm('Označit jako odstoupeno? Hodinky se vrátí do prodeje. Peníze vraťte ručně.')) return;
      if (a === 'paid') await api('POST', `orders/${id}/paid`, {});
      else if (a === 'shipped') await api('POST', `orders/${id}/shipped`, { tracking: app.querySelector('#tracking').value });
      else if (a === 'cancel') await api('POST', `orders/${id}/cancel`, {});
      else await api('POST', `orders/${id}/status`, { status: a });
      toast('Hotovo'); views['objednavky/:id']({ id });
    })));
    app.querySelector('#nf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', `orders/${id}/note`, formData(e.target)); toast('Uloženo'); }); });
  };

  views.zakazky = async () => {
    const { commissions } = await api('GET', 'commissions');
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Zakázky</h1><a class="btn primary" href="#/zakazky/nova">+ Nová</a></div>
      <div class="list">${commissions.map((k) => `<a class="item" href="#/zakazky/${k.id}"><span class="grow"><span class="t">${esc(k.number)} · ${esc(k.customer_name || '')}</span><br>${chip('cstatus', k.status)} <span class="small muted">${esc(L.ctype[k.type])}${k.due_date ? ` · do ${esc(k.due_date)}` : ''}</span><br><span class="small muted">${esc(k.watch || '')}</span></span></a>`).join('') || '<p class="muted">Zatím žádné zakázky.</p>'}</div>`;
  };

  const commissionForm = (k = {}) => `<form id="kf">
    <label>Druh<select name="type">${Object.entries(L.ctype).map(([v, t]) => `<option value="${v}" ${k.type === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label>Stav<select name="status">${Object.entries(L.cstatus).map(([v, t]) => `<option value="${v}" ${(k.status || 'poptavka') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <details open><summary>Zákazník</summary>${field('name', 'Jméno', { name: k.customer_name }, 'required')}${field('email', 'E-mail', { email: k.customer_email }, 'type="email" required')}${field('phone', 'Telefon', { phone: k.customer_phone }, 'type="tel"')}</details>
    <details open><summary>Zakázka</summary>${field('watch', 'Hodinky (značka, model, stav)', k)}${area('description', 'Co se má udělat', k)}
      <div class="grid">${field('estimate_czk', 'Orientační cena (Kč)', k, 'inputmode="numeric"')}${field('deposit_czk', 'Záloha (Kč)', k, 'inputmode="numeric"')}</div>
      <div class="grid">${field('final_price_czk', 'Konečná cena (Kč)', k, 'inputmode="numeric"')}${field('due_date', 'Termín', k, 'type="date"')}</div>
      <div class="grid">${field('received_at', 'Převzato', k, 'type="date"')}${field('returned_at', 'Předáno', k, 'type="date"')}</div>
      ${area('internal_note', 'Interní poznámka', k)}</details>
    <div class="sticky-save"><button class="btn primary block">Uložit</button></div></form>`;

  views['zakazky/nova'] = async (_, q) => {
    const pre = q.get('z') ? JSON.parse(decodeURIComponent(q.get('z'))) : {};
    app.innerHTML = `<p><a href="#/zakazky">← Zakázky</a></p><h1>Nová zakázka</h1>${commissionForm(pre)}`;
    app.querySelector('#kf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const { id } = await api('POST', 'commissions', { ...formData(e.target), inquiry_id: pre.inquiry_id }); toast('Zakázka vytvořena'); location.hash = `#/zakazky/${id}`;
    }); });
  };

  views['zakazky/:id'] = async ({ id }) => {
    const { commissions } = await api('GET', 'commissions');
    const k = commissions.find((x) => x.id === id);
    if (!k) { app.innerHTML = '<p>Zakázka nenalezena.</p>'; return; }
    app.innerHTML = `<p><a href="#/zakazky">← Zakázky</a></p><h1>${esc(k.number)}</h1><p class="small muted">Vytvořeno ${date(k.created_at)}</p>
      <a class="btn block" style="margin-bottom:12px" href="#/faktury/nova?z=${encodeURIComponent(JSON.stringify({ commission_id: k.id, buyer_name: k.customer_name, buyer_email: k.customer_email, items: [{ text: `${L.ctype[k.type]} – ${k.watch || 'hodinky'} (zakázka ${k.number})`, price: k.final_price_czk ?? k.estimate_czk ?? '' }] }))}">Vystavit fakturu</a>
      ${commissionForm(k)}`;
    app.querySelector('#kf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', `commissions/${id}`, formData(e.target)); toast('Uloženo'); }); });
  };

  views.poptavky = async () => {
    const { inquiries } = await api('GET', 'inquiries');
    app.innerHTML = `<h1>Poptávky</h1><div class="list">${inquiries.map((i) => `<div class="card">
      <div class="row" style="justify-content:space-between">${chip('inq', i.status)}<span class="small muted">${date(i.created_at)}</span></div>
      <p style="margin:8px 0 4px"><b>${esc(i.name)}</b> · ${esc(L.itype[i.type] || i.type)}${i.product_title ? ` · <a href="/hodinky/${esc(i.product_slug)}" target="_blank">${esc(i.product_title)}</a>` : ''}</p>
      <p class="small"><a href="mailto:${esc(i.email)}?subject=${encodeURIComponent('Re: poptávka Dante Time')}">${esc(i.email)}</a>${i.phone ? ` · <a href="tel:${esc(i.phone)}">${esc(i.phone)}</a>` : ''}</p>
      <p style="white-space:pre-wrap">${esc(i.message)}</p>
      <div class="row"><select data-s="${i.id}" style="flex:1">${Object.entries(L.inq).map(([v, t]) => `<option value="${v}" ${i.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${['servis', 'renovace', 'zakazkova_vyroba', 'prestavba', 'jine', 'general'].includes(i.type) ? `<a class="btn" href="#/zakazky/nova?z=${encodeURIComponent(JSON.stringify({ type: ['servis', 'renovace', 'zakazkova_vyroba', 'prestavba'].includes(i.type) ? i.type : 'servis', customer_name: i.name, customer_email: i.email, customer_phone: i.phone, description: i.message, inquiry_id: i.id }))}">→ Zakázka</a>` : ''}</div>
    </div>`).join('') || '<p class="muted">Zatím žádné poptávky.</p>'}</div>`;
    app.querySelectorAll('[data-s]').forEach((s) => s.addEventListener('change', () => run(async () => { await api('PUT', `inquiries/${s.dataset.s}`, { status: s.value }); toast('Uloženo'); })));
  };

  views.zakaznici = async (_, q) => {
    const { customers } = await api('GET', `customers?q=${encodeURIComponent(q.get('q') || '')}`);
    app.innerHTML = `<h1>Zákazníci</h1><form id="sf" class="row"><input name="q" placeholder="Hledat jméno, e-mail, telefon" value="${esc(q.get('q') || '')}" style="flex:1"><button class="btn">Hledat</button></form>
      <div class="list" style="margin-top:10px">${customers.map((c) => `<a class="item" href="#/zakaznici/${c.id}"><span class="grow"><span class="t">${esc(c.name || c.email)}</span><br><span class="small muted">${esc(c.email)} · ${c.orders} obj. · ${c.commissions} zak.</span></span></a>`).join('') || '<p class="muted">Nic nenalezeno.</p>'}</div>`;
    app.querySelector('#sf').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/zakaznici?q=${encodeURIComponent(e.target.q.value)}`; });
  };

  views['zakaznici/:id'] = async ({ id }) => {
    const { customer: c, orders, commissions, inquiries } = await api('GET', `customers/${id}`);
    app.innerHTML = `<p><a href="#/zakaznici">← Zákazníci</a></p><h1>${esc(c.name || c.email)}</h1>
      <form id="cf" class="card">${field('name', 'Jméno', c)}${field('phone', 'Telefon', c)}<p class="small"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>${area('note', 'Poznámka', c)}<button class="btn block">Uložit</button></form>
      <h2>Objednávky</h2><div class="list">${orders.map((o) => `<a class="item" href="#/objednavky/${o.id}"><span class="grow">${esc(o.number)} ${chip('order', o.status)} ${czk(o.total)}</span></a>`).join('') || '<p class="muted small">Žádné</p>'}</div>
      <h2>Zakázky</h2><div class="list">${commissions.map((k) => `<a class="item" href="#/zakazky/${k.id}"><span class="grow">${esc(k.number)} ${chip('cstatus', k.status)} ${esc(L.ctype[k.type])}</span></a>`).join('') || '<p class="muted small">Žádné</p>'}</div>
      <h2>Poptávky</h2>${inquiries.map((i) => `<div class="card small">${date(i.created_at)} – ${esc(i.message).slice(0, 200)}</div>`).join('') || '<p class="muted small">Žádné</p>'}`;
    app.querySelector('#cf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', `customers/${id}`, formData(e.target)); toast('Uloženo'); }); });
  };

  views.faktury = async () => {
    const { invoices } = await api('GET', 'invoices');
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Faktury</h1><a class="btn primary" href="#/faktury/nova">+ Nová</a></div>
      <p class="small muted">Faktury k objednávkám se vystavují samy po zaplacení. Zde vystavíte fakturu k zakázce nebo ručně.</p>
      <div class="list">${invoices.map((v) => `<div class="item"><span class="grow"><span class="t">${esc(v.number)} · ${esc(v.buyer_company || v.buyer_name)}</span><br><span class="small muted">${czk(v.total)} · ${date(v.issued_at)} · ${v.cancelled_at ? 'storno' : v.paid_at ? 'uhrazeno' : 'neuhrazeno'}${v.mode === 'test' ? ' · test' : ''}</span></span>
        <span class="row" style="gap:4px"><a class="btn ghost" style="min-height:38px;padding:8px 12px" href="/faktura/${esc(v.public_token)}" target="_blank">Zobrazit</a>
        ${!v.paid_at && !v.cancelled_at ? `<button class="btn ghost" style="min-height:38px;padding:8px 12px" data-paid="${v.id}">Uhrazeno</button>` : ''}
        ${!v.cancelled_at && !v.order_id ? `<button class="btn ghost" style="min-height:38px;padding:8px 12px" data-storno="${v.id}">Storno</button>` : ''}</span></div>`).join('') || '<p class="muted">Zatím žádné faktury.</p>'}</div>`;
    app.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', () => run(async () => { await api('POST', `invoices/${b.dataset.paid}/paid`, {}); views.faktury(); })));
    app.querySelectorAll('[data-storno]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Stornovat fakturu?')) return; await api('POST', `invoices/${b.dataset.storno}/cancel`, {}); views.faktury(); })));
  };

  views['faktury/nova'] = async (_, q) => {
    const pre = q.get('z') ? JSON.parse(decodeURIComponent(q.get('z'))) : {};
    const lines = pre.items?.length ? pre.items : [{ text: '', price: '' }];
    const lineHtml = (l = {}) => `<div class="grid line"><input name="text" placeholder="Položka (např. Servis Omega Seamaster)" value="${esc(l.text)}"><input name="price" inputmode="numeric" placeholder="Cena Kč" value="${esc(l.price)}"></div>`;
    app.innerHTML = `<p><a href="#/faktury">← Faktury</a></p><h1>Nová faktura</h1><form id="if">
      <details open><summary>Odběratel</summary>${field('buyer_name', 'Jméno', pre, 'required')}${field('buyer_email', 'E-mail', pre, 'type="email"')}${field('buyer_street', 'Ulice', pre)}
        <div class="grid">${field('buyer_city', 'Město', pre)}${field('buyer_zip', 'PSČ', pre)}</div>
        <div class="grid">${field('buyer_company', 'Firma', pre)}${field('buyer_ico', 'IČO', pre)}</div></details>
      <details open><summary>Položky</summary><div id="lines" style="display:grid;gap:8px">${lines.map(lineHtml).join('')}</div>
        <button class="btn ghost block" type="button" id="addl" style="margin-top:8px">+ Další položka</button></details>
      <details open><summary>Platba</summary>
        <label>Způsob úhrady<select name="payment_method"><option value="bank_transfer">Bankovní převod</option><option value="cash">Hotově</option><option value="card">Kartou</option><option value="cod">Dobírka</option></select></label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="paid" style="width:22px;min-height:22px"> Již uhrazeno</label>
        <label>Splatnost (dní)<input name="due_days" inputmode="numeric" value="14"></label>
        ${field('note', 'Poznámka na faktuře', pre)}</details>
      <div class="sticky-save"><button class="btn primary block">Vystavit fakturu</button></div></form>`;
    app.querySelector('#addl').addEventListener('click', () => app.querySelector('#lines').insertAdjacentHTML('beforeend', lineHtml()));
    app.querySelector('#if').addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const f = e.target; const d = formData(f);
      d.items = [...f.querySelectorAll('.line')].map((l) => ({ text: l.querySelector('[name=text]').value, price: l.querySelector('[name=price]').value })).filter((i) => i.text.trim());
      d.paid = f.paid.checked; d.commission_id = pre.commission_id;
      const r = await api('POST', 'invoices', d); toast(`Faktura ${r.number} vystavena`); window.open(`/faktura/${r.token}`, '_blank'); location.hash = '#/faktury';
    }); });
  };

  views.odstoupeni = async () => {
    const { withdrawals } = await api('GET', 'withdrawals');
    app.innerHTML = `<h1>Odstoupení od smlouvy</h1>${withdrawals.map((w) => `<div class="card"><p class="small muted">${date(w.created_at)} · potvrzení odesláno ${date(w.confirmation_sent_at) || 'NE'}</p><p><b>${esc(w.name)}</b> · ${esc(w.email)} · obj. ${esc(w.order_number)}${w.order_id ? ` · <a href="#/objednavky/${w.order_id}">otevřít</a>` : ' · <b>objednávka nenalezena</b>'}</p><p>${esc(w.statement)}</p></div>`).join('') || '<p class="muted">Žádná odstoupení.</p>'}`;
  };

  views.nastaveni = async () => {
    const { settings: s, integrations: i } = await api('GET', 'settings');
    const yes = (v) => (v ? '<span class="chip available">aktivní</span>' : '<span class="chip">neaktivní</span>');
    app.innerHTML = `<h1>Nastavení</h1>
      <form id="setf" class="card"><h2 style="margin-top:0">Doprava</h2>
        <label>Zásilkovna – cena (Kč, prázdné = nenabízet)<input name="shipping_zasilkovna_czk" inputmode="numeric" value="${esc(s.shipping_zasilkovna_czk)}"></label>
        <label>Balíkovna – cena (Kč, prázdné = nenabízet)<input name="shipping_balikovna_czk" inputmode="numeric" value="${esc(s.shipping_balikovna_czk)}"></label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="shipping_osobni_enabled" ${s.shipping_osobni_enabled === '1' ? 'checked' : ''} style="width:22px;min-height:22px"> Nabízet osobní převzetí</label>
        <h2>Dobírka</h2>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="cod_enabled" ${s.cod_enabled === '1' ? 'checked' : ''} style="width:22px;min-height:22px"> Nabízet platbu dobírkou</label>
        <label>Příplatek za dobírku (Kč, prázdné = 0)<input name="cod_fee_czk" inputmode="numeric" value="${esc(s.cod_fee_czk)}"></label>
        <h2>Rezervace</h2>
        <div class="grid"><label>Převod – hodin<input name="reservation_hours_bank" inputmode="numeric" value="${esc(s.reservation_hours_bank)}"></label><label>Karta – minut<input name="reservation_minutes_card" inputmode="numeric" value="${esc(s.reservation_minutes_card)}"></label></div>
        <button class="btn primary block">Uložit nastavení</button></form>
      <div class="card"><h2 style="margin-top:0">Stav integrací</h2><table>
        <tr><th>Režim e-shopu</th><td>${esc({ preview: 'náhled', test: 'testovací', live: 'ostrý' }[i.mode])}</td></tr>
        <tr><th>Platba převodem (QR)</th><td>${yes(i.iban)}</td></tr>
        <tr><th>Platba kartou</th><td>${yes(i.card)} ${i.card && !i.cardLive ? '<span class="small muted">(testovací)</span>' : ''}</td></tr>
        <tr><th>Výběr místa Zásilkovny</th><td>${yes(i.packeta)}</td></tr>
        <tr><th>Odesílání e-mailů</th><td>${yes(i.email)}</td></tr>
      </table><p class="small muted">Integrace se zapínají v Cloudflare podle návodu docs/INTEGRATIONS.md. Ostrý režim a ostré platby jen po vašem rozhodnutí.</p></div>`;
    app.querySelector('#setf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const d = formData(e.target); d.shipping_osobni_enabled = e.target.shipping_osobni_enabled.checked; d.cod_enabled = e.target.cod_enabled.checked; await api('PUT', 'settings', d); toast('Uloženo');
    }); });
  };

  views.emaily = async () => {
    const { emails } = await api('GET', 'emails');
    app.innerHTML = `<h1>E-maily</h1><p class="small muted">Stav „uloženo“ = e-mail se neodeslal, protože ještě není nastaven poskytovatel e-mailů.</p><div class="list">${emails.map((m) => `<a class="item" href="#/emaily/${m.id}"><span class="grow"><span class="t">${esc(m.subject)}</span><br><span class="small muted">${esc(m.to_addr)} · ${date(m.created_at)} · ${esc({ stored: 'uloženo', sent: 'odesláno', failed: 'chyba', queued: 've frontě' }[m.status])}</span></span></a>`).join('') || '<p class="muted">Žádné e-maily.</p>'}</div>`;
  };
  views['emaily/:id'] = async ({ id }) => {
    const { email: m } = await api('GET', `emails/${id}`);
    app.innerHTML = `<p><a href="#/emaily">← E-maily</a></p><h1 style="font-size:20px">${esc(m.subject)}</h1><p class="small muted">${esc(m.to_addr)} · ${date(m.created_at)}</p><iframe sandbox="" srcdoc="${esc(m.html)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:12px;background:#fff" title="Náhled e-mailu"></iframe>`;
  };

  views.historie = async () => {
    const { log } = await api('GET', 'audit');
    app.innerHTML = `<h1>Historie změn</h1><div class="card"><table>${log.map((l) => `<tr><td class="small muted">${date(l.at)}</td><td class="small">${esc(l.actor)}<br>${esc(l.action)}${l.details ? `<br><span class="muted">${esc(l.details).slice(0, 160)}</span>` : ''}</td></tr>`).join('')}</table></div>`;
  };

  views.vice = async () => {
    app.innerHTML = `<h1>Více</h1><div class="list">
      <a class="item" href="#/poptavky"><span class="grow">Poptávky</span></a>
      <a class="item" href="#/faktury"><span class="grow">Faktury</span></a>
      <a class="item" href="#/zakaznici"><span class="grow">Zákazníci</span></a>
      <a class="item" href="#/odstoupeni"><span class="grow">Odstoupení od smlouvy</span></a>
      <a class="item" href="#/nastaveni"><span class="grow">Nastavení</span></a>
      <a class="item" href="#/emaily"><span class="grow">E-maily</span></a>
      <a class="item" href="#/historie"><span class="grow">Historie změn</span></a>
      <a class="item" href="/" target="_blank"><span class="grow">Otevřít web ↗</span></a></div>
      <button class="btn ghost block" id="lall" style="margin-top:20px">Odhlásit všechna zařízení</button>`;
    app.querySelector('#lall').addEventListener('click', () => run(async () => { if (!confirm('Odhlásit všechna zařízení včetně tohoto?')) return; await api('POST', 'logout-all', {}); showLogin(); }));
  };

  // --- Směrovač -------------------------------------------------------------------------
  async function router() {
    const [rawPath, qs] = location.hash.replace(/^#\/?/, '').split('?');
    const q = new URLSearchParams(qs || '');
    const parts = rawPath.split('/').filter(Boolean);
    let view = views[parts.join('/')] ? parts.join('/') : null; let params = {};
    if (!view && parts.length === 2 && views[`${parts[0]}/:id`]) { view = `${parts[0]}/:id`; params = { id: parts[1] }; }
    if (!view) view = '';
    const top = parts[0] || '';
    tabs.querySelectorAll('a').forEach((a) => {
      const t = a.getAttribute('href').replace('#/', '');
      a.toggleAttribute('aria-current', t === top || (t === 'vice' && ['poptavky', 'zakaznici', 'nastaveni', 'emaily', 'historie', 'odstoupeni', 'faktury'].includes(top)));
      if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
    });
    window.scrollTo(0, 0);
    await run(() => views[view](params, q));
  }

  async function start() {
    try {
      await api('GET', 'me');
      const d = await api('GET', 'dashboard');
      const m = document.getElementById('mode'); m.textContent = { preview: 'náhled', test: 'TEST', live: 'ostrý' }[d.mode]; m.className = `mode ${d.mode}`;
      tabs.hidden = false; document.getElementById('logout').hidden = false;
      window.onhashchange = router; router();
    } catch { /* showLogin už proběhl */ }
  }
  start();
})();
