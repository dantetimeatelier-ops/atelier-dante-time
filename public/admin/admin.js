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
    wphase: { pripomenout: 'Poslat připomínku', v_okne: 'V termínu prohlídky', planovana: 'Naplánováno', zmeskana: 'Termín propásnut', hotova: 'Hotovo', zrusena: 'Zrušeno' },
    itype: { servis: 'Servis', renovace: 'Renovace', zakazkova_vyroba: 'Zakázková sestava', prestavba: 'Přestavba', jine: 'Jiný dotaz', product: 'Zájem o hodinky', general: 'Dotaz' },
    ship: { zasilkovna: 'Zásilkovna', balikovna: 'Balíkovna', osobni: 'Osobně' },
    pay: { bank_transfer: 'Převod', card: 'Karta', cod: 'Dobírka', cash: 'Hotově' },
  };
  const EU = [['AT', 'Rakousko'], ['BE', 'Belgie'], ['BG', 'Bulharsko'], ['HR', 'Chorvatsko'], ['CY', 'Kypr'], ['CZ', 'Česko'], ['DK', 'Dánsko'], ['EE', 'Estonsko'], ['FI', 'Finsko'], ['FR', 'Francie'], ['DE', 'Německo'], ['GR', 'Řecko'], ['HU', 'Maďarsko'], ['IE', 'Irsko'], ['IT', 'Itálie'], ['LV', 'Lotyšsko'], ['LT', 'Litva'], ['LU', 'Lucembursko'], ['MT', 'Malta'], ['NL', 'Nizozemsko'], ['PL', 'Polsko'], ['PT', 'Portugalsko'], ['RO', 'Rumunsko'], ['SK', 'Slovensko'], ['SI', 'Slovinsko'], ['ES', 'Španělsko'], ['SE', 'Švédsko']];
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
        <a class="stat" href="#/prohlidky"><b>${d.warranty?.remind || 0}</b>připomenout prohlídku</a>
        <a class="stat" href="#/prohlidky"><b>${d.warranty?.window || 0}</b>prohlídek v termínu</a>
      </div>
      <div class="card" style="margin-top:12px"><b>Limity DPH (neplátce)</b><p class="small" style="margin:6px 0 0">Obrat letos (vystavené faktury): <b>${d.turnover.toLocaleString('cs-CZ')} Kč</b> z 2 000 000 Kč<br>Prodej spotřebitelům do jiných zemí EU: <b>${d.euSales.toLocaleString('cs-CZ')} Kč</b> z ${d.euLimitCzk.toLocaleString('cs-CZ')} Kč (10 000 €)</p><p class="small muted" style="margin:6px 0 0">Orientační přehled. Rozhodující je evidence vaší účetní.</p></div>
      <a class="card" style="display:block;margin-top:12px" href="#/system"><b>Dante Time OS</b><br><span class="small muted">Role, kontroly DT Guardian, schvalování a zálohy</span></a>
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
      <div class="row" style="margin-bottom:12px">${chip('product', p.status)} ${p.status !== 'draft' ? `<a class="small" href="${pub}" target="_blank">Zobrazit na webu ↗</a>` : '<span class="small muted">Koncept – na webu není vidět</span>'} <a class="btn" href="#/marze/${p.id}">Náklady a marže</a> <button class="btn" type="button" id="mkpas">Pas hodinek</button></div>
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
          ${field('precious_weight_g', 'Hmotnost drahého kovu v gramech (u zlata, stříbra, platiny)', p, 'inputmode="decimal"')}
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
          <fieldset style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:10px"><legend class="small">Doživotní garance pravosti – které součásti jsou deklarované originální</legend>
            ${[['strojek', 'Strojek'], ['cifernik', 'Ciferník'], ['rucicky', 'Ručičky']].map(([v, t]) => `<label style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="authenticity_parts" value="${v}" ${(p.authenticity_parts || '').split(',').includes(v) ? 'checked' : ''} style="width:22px;min-height:22px"> ${t}</label>`).join('')}
          </fieldset>
          ${area('original_parts', 'Původní originální součásti (popis)', p)}${area('authenticity_note', 'Jak byla originalita ověřena (nepovinné)', p)}${field('serial_ref', 'Identifikace hodinek – č. pouzdra / strojku (neveřejné, pro garanci)', p)}${area('replaced_parts', 'Nové součásti použité při přestavbě Dante Time / vyměněné díly', p)}${field('accessories', 'Příslušenství', p)}
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
      const d = formData(form); d.featured = form.featured.checked; d.authenticity_parts = [...form.querySelectorAll('[name=authenticity_parts]:checked')].map((x) => x.value); Object.assign(d, extra);
      await api('PUT', `products/${id}`, d); toast('Uloženo');
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await save(); views['hodinky/:id']({ id }, new URLSearchParams()); }); });
    app.querySelector('#mkpas')?.addEventListener('click', () => run(async () => { const r = await api('POST', 'passports', { product_id: id }); location.hash = `#/pasy/${r.id}`; }));
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
        ${o.status === 'shipped' && o.payment_method !== 'cod' ? `<label>Datum převzetí zákazníkem<input id="delivered" type="date" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}"></label><button class="btn block" data-a="delivered">Převzato zákazníkem – dokončit</button>` : ''}
        ${o.status === 'completed' ? `<p class="small muted">Převzato: ${o.delivered_on ? new Date(o.delivered_on + 'T12:00:00Z').toLocaleDateString('cs-CZ') : '–'} (od tohoto dne běží záruka a zákonná práva)</p>` : ''}
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
      else if (a === 'delivered') await api('POST', `orders/${id}/delivered`, { delivered_on: app.querySelector('#delivered').value });
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

  // --- Ekonomika (E2) ---------------------------------------------------------------------
  const CC = { nakup: 'Nákup hodinek', dil: 'Díly', material: 'Materiál', prace: 'Práce', doprava: 'Doprava', poplatky: 'Poplatky', reklama: 'Reklama', provoz: 'Provoz', jine: 'Jiné' };
  const PK = { strojek: 'Strojek', cifernik: 'Ciferník', rucicky: 'Ručičky', pouzdro: 'Pouzdro', sklo: 'Sklo', remen: 'Řemínek', naramek: 'Náramek', korunka: 'Korunka', krabicka: 'Krabička', jine: 'Jiné' };
  const sel = (name, label, map, v) => `<label>${label}<select name="${name}">${Object.entries(map).map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const today = () => new Date().toISOString().slice(0, 10);
  const costForm = (pre = {}) => `<form id="cf">${sel('category', 'Druh', CC, pre.category || 'dil')}${field('description', 'Popis', pre, 'required')}
    <div class="grid">${field('amount_czk', 'Částka (Kč)', pre, 'inputmode="numeric"')}${field('hours', 'Hodiny práce', pre, 'inputmode="decimal"')}</div>
    <div class="grid">${field('cost_date', 'Datum', { cost_date: today() }, 'type="date"')}${field('supplier', 'Dodavatel', pre)}</div>${field('document_ref', 'Číslo dokladu', pre)}
    <label>Fotka nebo PDF dokladu (nepovinné)<input type="file" name="file" accept="image/*,application/pdf"></label>
    <button class="btn primary block">Přidat náklad</button></form>`;
  // Doklad: fotka se v telefonu zmenší a zbaví metadat (GPS), PDF se nahraje beze změny
  async function uploadDoc(file, costId, extra = {}) {
    const fd = new FormData();
    if (file.type === 'application/pdf') fd.append('file', file, file.name);
    else { const { blob } = await resize(file, 2000); fd.append('file', blob, (file.name || 'doklad').replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.jpg')); }
    if (costId) fd.append('cost_id', costId);
    for (const [k, v] of Object.entries(extra)) if (v) fd.append(k, v);
    return api('POST', 'documents', fd);
  }
  // Uloží náklad z formuláře a případně k němu nahraje doklad
  async function saveCost(form, extra = {}) {
    const d = formData(form); delete d.file;
    const { id } = await api('POST', 'costs', { ...d, ...extra });
    const f = form.file?.files?.[0];
    if (f) { try { await uploadDoc(f, id); } catch (e) { toast(`Náklad uložen, doklad ne: ${e.message}`, true); return; } }
    toast(f ? 'Přidáno i s dokladem' : 'Přidáno');
  }
  const docTag = (c) => (c.docs ? ' · <a href="#/doklady">doklad</a>' : '');

  views.ekonomika = async (_, q) => {
    const y = q.get('y') || String(new Date().getFullYear());
    const d = await api('GET', `finance/overview?year=${y}`);
    const pct = Math.min(100, d.goalPct);
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Ekonomika ${esc(d.year)}</h1><span><a href="#/ekonomika?y=${+y - 1}">‹ ${+y - 1}</a> · <a href="#/ekonomika?y=${+y + 1}">${+y + 1} ›</a></span></div>
      <div class="grid"><div class="stat"><b>${czk(d.revenue)}</b>tržby</div><div class="stat"><b>${czk(d.costs)}</b>náklady</div><div class="stat"><b>${czk(d.profit)}</b>zisk</div><div class="stat"><b>${czk(d.stockValue)}</b>hodnota skladu (náklady)</div></div>
      <div class="card" style="margin-top:12px"><b>Cíl ${czk(d.goal)}</b><div style="height:10px;background:var(--line);border-radius:6px;margin:8px 0;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div><span class="small">${d.goalPct} % splněno</span></div>
      <div class="card" style="margin-top:12px;overflow-x:auto"><b>Po měsících</b><table><tr><th>Měsíc</th><td><b>Tržby</b></td><td><b>Náklady</b></td><td><b>Zisk</b></td></tr>
        ${d.months.filter((m) => m.revenue || m.costs).map((m) => `<tr><th>${m.month.slice(5)}/${m.month.slice(0, 4)}</th><td>${czk(m.revenue)}</td><td>${czk(m.costs)}</td><td>${czk(m.profit)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Zatím žádné údaje.</td></tr>'}</table>
        <p class="small muted">Tržby = vystavené faktury (ostrý provoz). Náklady = zapsané náklady včetně nákupu hodinek a dílů${d.rate ? ` a práce (${czk(d.rate)}/h)` : ''}. Orientační přehled, rozhodující je účetnictví.</p></div>
      <div class="card" style="margin-top:12px"><b>Marže hodinek</b>${d.pieces.length ? `<div class="list" style="margin-top:8px">${d.pieces.map((x) => `<a class="item" href="#/marze/${x.id}"><span class="grow"><span class="t">${esc(x.title)}</span><br><span class="small muted">${x.sold ? 'prodáno' : 'skladem'} · náklady ${czk(x.cost)} · cena ${czk(x.price)} · marže <b>${czk(x.margin)}</b>${x.marginPct != null ? ` (${x.marginPct} %)` : ''}${x.hasPurchase ? '' : ' · ⚠ chybí nákupní cena'}</span></span></a>`).join('')}</div>` : '<p class="small muted">Zapište u hodinek nákupní cenu a náklady (Hodinky → detail → Náklady a marže).</p>'}</div>
      <div class="card" style="margin-top:12px"><b>Podklady pro účetní (CSV pro Excel)</b>
        <div class="grid">${field('from', 'Od', { from: `${y}-01-01` }, 'type="date" id="ef"')}${field('to', 'Do', { to: `${y}-12-31` }, 'type="date" id="et"')}</div>
        <div class="row"><button class="btn" data-x="naklady">Náklady</button><button class="btn" data-x="faktury">Vydané faktury</button></div></div>
      <details style="margin-top:12px"><summary>Hodinová sazba práce</summary><form id="rf">${field('labor_rate_czk', 'Kč za hodinu (pro výpočet nákladů na vlastní práci)', { labor_rate_czk: d.rate || '' }, 'inputmode="numeric"')}<button class="btn block">Uložit</button></form></details>`;
    app.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { location.href = `/api/admin/finance/export?kind=${b.dataset.x}&from=${app.querySelector('[name=from]').value}&to=${app.querySelector('[name=to]').value}`; }));
    app.querySelector('#rf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', 'finance/settings', formData(e.target)); toast('Uloženo'); views.ekonomika(_, q); }); });
  };

  views['marze/:id'] = async ({ id }) => {
    const [{ product: p }, e] = await Promise.all([api('GET', `products/${id}`), api('GET', `finance/products/${id}`)]);
    app.innerHTML = `<p><a href="#/hodinky/${esc(id)}">← ${esc(p.title)}</a></p><h1 style="font-size:22px">Náklady a marže</h1><p class="small muted">Interní údaje – na webu se nikdy nezobrazují.</p>
      <div class="grid"><div class="stat"><b>${czk(e.total)}</b>náklady celkem</div><div class="stat"><b>${czk(e.expected)}</b>${e.sold ? `prodáno (${esc(e.saleOrder)})` : 'prodejní cena'}</div><div class="stat"><b>${czk(e.margin)}</b>marže${e.marginPct != null ? ` ${e.marginPct} %` : ''}</div></div>
      ${e.hasPurchase ? '' : '<div class="card warn small" style="margin-top:12px">Chybí nákupní cena hodinek – přidejte náklad druhu „Nákup hodinek“.</div>'}
      <div class="card" style="margin-top:12px"><table>${Object.entries(e.byCat).map(([k, v]) => `<tr><th>${esc(CC[k] || k)}</th><td>${czk(v)}</td></tr>`).join('')}
        ${e.partsCost ? `<tr><th>Díly ze skladu</th><td>${czk(e.partsCost)}</td></tr>` : ''}${e.hours ? `<tr><th>Práce ${e.hours} h${e.rate ? ` × ${czk(e.rate)}` : ''}</th><td>${e.rate ? czk(e.laborCost) : '<span class="small muted">nastavte sazbu v Ekonomice</span>'}</td></tr>` : ''}</table></div>
      <h2 style="margin-top:16px">Zapsané náklady</h2><div class="list">${e.costs.map((c) => `<div class="item"><span class="grow"><span class="t">${esc(c.description)}</span><br><span class="small muted">${esc(CC[c.category])} · ${esc(c.cost_date)}${c.supplier ? ` · ${esc(c.supplier)}` : ''}${docTag(c)}</span></span><b>${c.amount_czk ? czk(c.amount_czk) : `${c.hours} h`}</b><button class="btn" data-del="${c.id}" aria-label="Smazat">✕</button></div>`).join('') || '<p class="muted">Zatím nic.</p>'}</div>
      ${e.parts.length ? `<h2 style="margin-top:16px">Použité díly</h2><div class="list">${e.parts.map((x) => `<div class="item"><span class="grow">${esc(x.title)} <span class="small muted">${esc(PK[x.kind])}${x.original ? ' · originál' : ''}</span></span><b>${czk((x.unit_cost_czk || 0) * (x.qty || 1))}</b></div>`).join('')}</div>` : ''}
      <details open style="margin-top:16px"><summary>Přidat náklad</summary>${costForm({ category: e.hasPurchase ? 'dil' : 'nakup' })}</details>`;
    app.querySelector('#cf').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => { await saveCost(ev.target, { product_id: id }); views['marze/:id']({ id }); }); });
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat náklad?')) return; await api('DELETE', `costs/${b.dataset.del}`); views['marze/:id']({ id }); })));
  };

  views.naklady = async () => {
    const { costs } = await api('GET', 'costs');
    app.innerHTML = `<h1>Náklady</h1><p class="small muted">Společné provozní náklady (krabičky, nářadí, reklama, hosting…). Náklady konkrétních hodinek zapisujte u hodinek. <a href="#/doklady">Doklady</a></p>
      <details><summary>Přidat provozní náklad</summary>${costForm({ category: 'provoz' })}</details>
      <div class="list" style="margin-top:12px">${costs.map((c) => `<div class="item"><span class="grow"><span class="t">${esc(c.description)}</span><br><span class="small muted">${esc(CC[c.category])} · ${esc(c.cost_date)}${c.product_title ? ` · ${esc(c.product_title)}` : ' · provoz'}${docTag(c)}</span></span><b>${c.amount_czk ? czk(c.amount_czk) : `${c.hours} h`}</b><button class="btn" data-del="${c.id}" aria-label="Smazat">✕</button></div>`).join('') || '<p class="muted">Zatím žádné náklady.</p>'}</div>`;
    app.querySelector('#cf').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => { await saveCost(ev.target); views.naklady(); }); });
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat náklad?')) return; await api('DELETE', `costs/${b.dataset.del}`); views.naklady(); })));
  };

  // --- Nákupy a prodeje (E3b v2): nahrát → AI vyčte → kontrola jen u nejistých údajů ----------------
  const CURR = ['CZK', 'EUR', 'USD', 'PLN', 'GBP', 'CHF', 'CNY', 'HUF', 'JPY'];
  const opt = (map, v, empty) => `${empty != null ? `<option value="">${empty}</option>` : ''}${Object.entries(map).map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}`;
  const curSel = (v) => `<label>Měna<select name="currency">${CURR.map((c) => `<option ${c === (v || 'CZK') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>`;
  const moneyFields = (x, czkKey) => `<div class="grid">${curSel(x.currency)}${field('amount_orig', 'Zaplaceno v měně (vč. dopravy)', { amount_orig: x.amount_orig ?? '' }, 'inputmode="decimal"')}</div>
    <div class="grid">${field('fx_rate', 'Kurz ČNB (Kč)', { fx_rate: x.fx_rate && x.currency !== 'CZK' ? x.fx_rate : '' }, 'inputmode="decimal" placeholder="automaticky"')}${field(czkKey, 'Částka v Kč', { [czkKey]: x[czkKey] || '' }, 'inputmode="numeric" placeholder="dopočítá se"')}</div>`;
  const purchaseForm = (x, products, ctx) => {
    const target = x.product_id ? 'hodinky' : x.part_id ? 'sklad' : x.category === 'dil' ? 'sklad' : x.category === 'nakup' ? 'hodinky' : 'provoz';
    return `<form class="card pform" data-id="${x.id || ''}">
      ${x.check_note ? `<p class="small warn" style="padding:8px;border-radius:8px">${esc(x.check_note)}</p>` : ''}
      ${x.doc_id ? `<p class="small"><a href="/api/admin/documents/${esc(x.doc_id)}/file" target="_blank" rel="noopener">Zobrazit původní doklad ↗</a>${ctx.ai?.ready && x.id ? ` · <button class="btn" type="button" data-reai="${esc(x.doc_id)}">Přečíst znovu pomocí AI</button>` : ''}</p>` : ''}
      ${field('description', 'Co jste koupil', x, 'required maxlength="300"')}
      <div class="grid"><label>Platforma<select name="platform">${opt(ctx.platforms, x.platform, '–')}</select></label>${field('cost_date', 'Datum', { cost_date: x.cost_date || today() }, 'type="date"')}</div>
      ${moneyFields(x, 'amount_czk')}
      <div class="grid">${field('shipping_czk', 'Z toho doprava (Kč)', { shipping_czk: x.shipping_czk ?? '' }, 'inputmode="numeric"')}${field('order_ref', 'Číslo objednávky / aukce', x)}</div>
      ${field('supplier', 'Prodávající', x)}
      <div class="grid"><label>Druh<select name="category">${opt(ctx.categories, x.category || 'nakup')}</select></label>
        <label>Patří k<select name="target"><option value="hodinky" ${target === 'hodinky' ? 'selected' : ''}>hodinkám</option><option value="sklad" ${target === 'sklad' ? 'selected' : ''}>skladu dílů</option><option value="provoz" ${target === 'provoz' ? 'selected' : ''}>provozu</option></select></label></div>
      <label data-t="hodinky">Hodinky<select name="product_id"><option value="">– zatím bez karty hodinek –</option>${products.map((p) => `<option value="${p.id}" ${p.id === x.product_id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
      <div class="grid" data-t="sklad"><label>Druh dílu<select name="part_kind">${opt(PK, 'jine')}</select></label>${field('qty', 'Počet kusů', { qty: 1 }, 'inputmode="numeric"')}</div>
      <div class="row"><button class="btn primary">${x.id ? 'Potvrdit' : 'Uložit nákup'}</button>${x.id ? `<button class="btn ghost" type="button" data-delcost="${x.id}">Smazat</button>` : ''}</div></form>`;
  };
  const saleForm = (x, products, ctx) => `<form class="card sform" data-id="${x.id || ''}">
      ${x.check_note ? `<p class="small warn" style="padding:8px;border-radius:8px">${esc(x.check_note)}</p>` : ''}
      ${x.doc_id ? `<p class="small"><a href="/api/admin/documents/${esc(x.doc_id)}/file" target="_blank" rel="noopener">Zobrazit fakturu ↗</a>${ctx.ai?.ready && x.id ? ` · <button class="btn" type="button" data-reai="${esc(x.doc_id)}">Přečíst znovu pomocí AI</button>` : ''}</p>` : ''}
      <div class="grid">${field('number', 'Číslo faktury', x)}${field('issued_on', 'Datum', { issued_on: x.issued_on || today() }, 'type="date"')}</div>
      ${field('items', 'Co bylo prodáno', x, 'required maxlength="500"')}
      <div class="grid">${field('watch_model', 'Model hodinek', x, 'maxlength="200"')}${field('serial_ref', 'Výrobní číslo', x, 'maxlength="120"')}</div>
      ${moneyFields(x, 'total_czk')}
      <div class="grid">${field('buyer_name', 'Zákazník', x)}${field('buyer_email', 'E-mail zákazníka', x, 'type="email"')}</div>
      ${field('buyer_address', 'Adresa', x)}
      <div class="grid"><label>Platba<select name="payment_method">${opt(ctx.pay, x.payment_method, '–')}</select></label>
        <label>Hodinky<select name="product_id"><option value="">–</option>${products.map((p) => `<option value="${p.id}" ${p.id === x.product_id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label></div>
      <div class="row"><button class="btn primary">${x.id ? 'Potvrdit' : 'Uložit prodej'}</button>${x.id ? `<button class="btn ghost" type="button" data-delsale="${x.id}">Smazat</button>` : ''}</div></form>`;
  function bindMoney(form) {
    const g = (n) => form.querySelector(`[name=${n}]`);
    const czk = g('amount_czk') || g('total_czk');
    const recalc = () => { const o = parseFloat(String(g('amount_orig').value).replace(',', '.')); const r = parseFloat(String(g('fx_rate').value).replace(',', '.')); if (g('currency').value === 'CZK' && !Number.isNaN(o)) czk.value = Math.round(o); else if (!Number.isNaN(o) && !Number.isNaN(r)) czk.value = Math.round(o * r); };
    g('amount_orig').addEventListener('input', recalc); g('fx_rate').addEventListener('input', recalc);
    g('currency').addEventListener('change', () => { g('fx_rate').value = ''; if (g('currency').value !== 'CZK') czk.value = ''; recalc(); });
    const t = form.querySelector('[name=target]');
    if (t) { const sync = () => form.querySelectorAll('[data-t]').forEach((el) => { el.hidden = el.dataset.t !== t.value; }); t.addEventListener('change', sync); sync(); }
  }
  const prepFile = async (file) => (file.type === 'application/pdf' ? { blob: file, name: file.name } : { blob: (await resize(file, 1600)).blob, name: file.name });

  views.doklady = async () => {
    const [d, { products }] = await Promise.all([api('GET', 'inbox'), api('GET', 'products')]);
    const ai = d.ai;
    app.innerHTML = `<h1>Nákupy a prodeje</h1>
      <div class="card ${ai.ready ? '' : 'warn'} small">${ai.ready ? `AI zapnutá · ${esc(ai.modelName)} · tento měsíc ${ai.budget.spent} / ${ai.budget.limit} Kč` : esc(ai.reason)}
        <details style="margin-top:6px"><summary>Nastavení AI</summary>
        <p>AI přečte screenshot, PDF nebo fotku a vyplní datum, platformu, položky, měnu, cenu a dopravu. Co nepřečte spolehlivě, dá vám ke kontrole. Bez AI vše funguje ručně.</p>
        ${ai.enabled ? '' : '<p><b>Zapnutí (jednorázově):</b> 1) účet na console.anthropic.com, nabít kredit (např. 5 USD) a nastavit limit útraty; 2) vytvořit API klíč; 3) Cloudflare → Workers &amp; Pages → projekt → Settings → Variables and Secrets → přidat <b>Secret</b> s názvem <code>ANTHROPIC_API_KEY</code>. Klíč nikam jinam neposílejte.</p>'}
        <form id="mf"><label>Model<select name="ai_model">${Object.entries(ai.models).map(([k, m]) => `<option value="${k}" ${k === ai.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label><button class="btn block">Uložit model</button></form></details></div>
      <div class="grid" style="margin-top:12px">
        <label class="btn primary block filebtn">Nahrát nákupy<input type="file" id="up-nakup" accept="image/*,application/pdf" multiple></label>
        <label class="btn block filebtn">Importovat vydané faktury<input type="file" id="up-prodej" accept="image/*,application/pdf" multiple></label></div>
      <p class="small muted">Screenshoty objednávek (Aukro, AliExpress, eBay…), fotky, PDF i faktury. Můžete vybrat více souborů najednou.</p>
      <div id="prog" class="list"></div>
      ${d.review.length || d.saleReview.length ? `<h2 style="margin-top:16px">Ke kontrole (${d.review.length + d.saleReview.length})</h2>
        ${d.review.map((x) => purchaseForm({ ...x, amount_czk: x.amount_czk || '' }, products, d)).join('')}${d.saleReview.map((x) => saleForm({ ...x, total_czk: x.total_czk || '' }, products, d)).join('')}` : ''}
      <details style="margin-top:16px"><summary>Zadat nákup ručně (i bez dokladu)</summary>${purchaseForm({}, products, d)}</details>
      <details style="margin-top:8px"><summary>Zadat prodej ručně</summary>${saleForm({}, products, d)}</details>
      <h2 style="margin-top:16px">Poslední nákupy</h2><div class="list">${d.purchases.map((c) => `<div class="item"><span class="grow"><span class="t">${esc(c.description)}</span><br><span class="small muted">${esc(c.cost_date)}${c.platform ? ` · ${esc(d.platforms[c.platform] || c.platform)}` : ''}${c.currency && c.currency !== 'CZK' && c.amount_orig != null ? ` · ${c.amount_orig} ${esc(c.currency)}` : ''} · ${esc(CC[c.category] || '')}${c.product_title ? ` · ${esc(c.product_title)}` : ''}${c.part_id ? ' · sklad dílů' : ''}${c.doc_id ? ` · <a href="/api/admin/documents/${esc(c.doc_id)}/file" target="_blank" rel="noopener">doklad</a>` : ''}</span></span><b>${c.part_id ? '' : czk(c.amount_czk)}</b></div>`).join('') || '<p class="muted">Zatím nic.</p>'}</div>
      <h2 style="margin-top:16px">Poslední prodeje</h2><div class="list">${d.sales.map((s) => `<div class="item"><span class="grow"><span class="t">${esc(s.number || 'bez čísla')} · ${esc(s.watch_model || s.buyer_name || '')}</span><br><span class="small muted">${esc(s.day)} · ${s.kind === 'faktura' ? 'faktura z Dante Time OS' : 'import / mimo e-shop'}${s.items ? ` · ${esc(s.items).slice(0, 60)}` : ''}${s.doc_id ? ` · <a href="/api/admin/documents/${esc(s.doc_id)}/file" target="_blank" rel="noopener">faktura</a>` : ''}</span></span><b>${czk(s.total)}</b></div>`).join('') || '<p class="muted">Zatím nic.</p>'}</div>`;
    app.querySelectorAll('form.pform, form.sform').forEach(bindMoney);
    app.querySelector('#mf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', 'finance/ai-model', formData(e.target)); toast('Uloženo'); views.doklady(); }); });
    app.querySelectorAll('form.pform').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const b = formData(f); if (f.dataset.id) await api('PUT', `purchases/${f.dataset.id}`, b); else await api('POST', 'purchases', b);
      toast('Nákup uložen'); views.doklady();
    }); }));
    app.querySelectorAll('form.sform').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      const b = formData(f); if (f.dataset.id) await api('PUT', `sales/${f.dataset.id}`, b); else await api('POST', 'sales', b);
      toast('Prodej uložen'); views.doklady();
    }); }));
    app.querySelectorAll('[data-reai]').forEach((b) => b.addEventListener('click', () => run(async () => {
      b.disabled = true; b.textContent = 'AI čte doklad…';
      const r = await api('POST', `inbox/${b.dataset.reai}/extract`, {});
      toast(r.status === 'confirmed' ? 'Rozpoznáno a uloženo' : r.status === 'review' ? 'Přečteno – zkontrolujte prosím' : (r.reason || 'AI doklad nepřečetla'), r.status === 'manual');
      views.doklady();
    })));
    app.querySelectorAll('[data-delcost]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat tento nákup? Doklad zůstane uložený.')) return; await api('DELETE', `costs/${b.dataset.delcost}`); views.doklady(); })));
    app.querySelectorAll('[data-delsale]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat tento prodej? Faktura zůstane uložená.')) return; await api('DELETE', `sales/${b.dataset.delsale}`); views.doklady(); })));
    for (const purpose of ['nakup', 'prodej']) {
      app.querySelector(`#up-${purpose}`).addEventListener('change', (e) => run(async () => {
        const files = [...e.target.files]; const prog = app.querySelector('#prog');
        const stats = { ok: 0, review: 0, dup: 0, err: 0 };
        for (const [i, file] of files.entries()) {
          const row = document.createElement('div'); row.className = 'item small'; row.textContent = `${i + 1}/${files.length} ${file.name} – nahrávám…`; prog.append(row);
          try {
            const { blob, name } = await prepFile(file);
            const fd = new FormData(); fd.append('file', blob, name); fd.append('purpose', purpose);
            const up = await api('POST', 'inbox/upload', fd);
            if (up.duplicate) { stats.dup++; row.textContent = `${file.name} – už nahráno dříve, přeskočeno`; continue; }
            if (!ai.ready) { stats.review++; row.textContent = `${file.name} – uloženo, doplňte údaje`; continue; }
            row.textContent = `${i + 1}/${files.length} ${file.name} – AI čte doklad…`;
            const r = await api('POST', `inbox/${up.id}/extract`, {});
            if (r.status === 'confirmed') { stats.ok++; row.textContent = `${file.name} – rozpoznáno a uloženo`; } else { stats.review++; row.textContent = `${file.name} – ke kontrole${r.note ? `: ${r.note}` : r.reason ? `: ${r.reason}` : ''}`; }
          } catch (err) { stats.err++; row.textContent = `${file.name} – chyba: ${err.message}`; }
        }
        toast(`Hotovo: ${stats.ok} uloženo, ${stats.review} ke kontrole${stats.dup ? `, ${stats.dup} duplicit` : ''}${stats.err ? `, ${stats.err} chyb` : ''}`, stats.err > 0);
        setTimeout(() => views.doklady(), stats.err || stats.review ? 6000 : 2000);
      }));
    }
  };

  const partForm = (x = {}, products = []) => `<form id="pf">${sel('kind', 'Druh', PK, x.kind || 'strojek')}${field('title', 'Název (např. PRIM kalibr 66)', x, 'required')}
    <div class="grid">${field('brand', 'Značka', x)}${field('caliber', 'Kalibr', x)}</div>
    <label class="check"><input type="checkbox" name="original" ${x.original ? 'checked' : ''}> Originální díl značky</label>${field('condition', 'Stav', x)}
    <div class="grid">${field('qty', 'Počet', { qty: x.qty ?? 1 }, 'inputmode="numeric"')}${field('unit_cost_czk', 'Cena za kus (Kč)', x, 'inputmode="numeric"')}</div>
    <div class="grid">${field('purchase_date', 'Datum nákupu', x, 'type="date"')}${field('supplier', 'Dodavatel', x)}</div>
    ${sel('status', 'Stav na skladě', { skladem: 'Skladem', pouzito: 'Použito v hodinkách', prodano: 'Prodáno samostatně', vyrazeno: 'Vyřazeno' }, x.status || 'skladem')}
    <label>Použito v hodinkách<select name="product_id"><option value="">–</option>${products.map((p) => `<option value="${esc(p.id)}" ${x.product_id === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
    ${area('note', 'Poznámka', x)}<button class="btn primary block">Uložit</button></form>`;
  views.dily = async (_, q) => {
    const [{ parts }, { products }] = await Promise.all([api('GET', 'parts'), api('GET', 'products')]);
    const edit = parts.find((x) => x.id === q.get('e'));
    const stock = parts.filter((x) => x.status === 'skladem');
    const value = stock.reduce((a, x) => a + (x.unit_cost_czk || 0) * (x.qty || 0), 0);
    app.innerHTML = `<h1>Sklad dílů</h1><p class="small muted">Skladem ${stock.length} položek v hodnotě ${czk(value)}.</p>
      <details ${edit ? 'open' : ''}><summary>${edit ? `Upravit: ${esc(edit.title)}` : 'Přidat díl'}</summary>${partForm(edit, products)}</details>
      <div class="list" style="margin-top:12px">${parts.map((x) => `<a class="item" href="#/dily?e=${x.id}"><span class="grow"><span class="t">${esc(x.title)}</span><br><span class="small muted">${esc(PK[x.kind])}${x.original ? ' · originál' : ''} · ${x.qty} ks · ${czk(x.unit_cost_czk)}/ks · ${esc({ skladem: 'skladem', pouzito: 'použito', prodano: 'prodáno', vyrazeno: 'vyřazeno' }[x.status])}${x.product_title ? ` · ${esc(x.product_title)}` : ''}</span></span></a>`).join('') || '<p class="muted">Zatím žádné díly.</p>'}</div>`;
    app.querySelector('#pf').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => {
      const d = formData(ev.target); d.original = ev.target.original.checked;
      if (edit) await api('PUT', `parts/${edit.id}`, d); else await api('POST', 'parts', d);
      toast('Uloženo'); location.hash = '#/dily';
    }); });
  };

  // --- Digitální pas hodinek a certifikát pravosti (E3) ---------------------------------
  const AP = { strojek: 'strojek', cifernik: 'ciferník', rucicky: 'ručičky' };
  views.pasy = async () => {
    const { passports } = await api('GET', 'passports');
    app.innerHTML = `<h1>Pasy hodinek</h1><p class="small muted">Každé hodinky dostanou digitální pas s QR kódem: zákazník i každý další majitel si ověří pravost a historii. Pas neobsahuje jméno ani cenu. Pas se založí sám při zápisu převzetí, nebo tlačítkem „Pas hodinek“ u hodinek.</p>
      <div class="list" style="margin-top:12px">${passports.map((x) => `<a class="item" href="#/pasy/${x.id}"><span class="grow"><span class="t">${esc(x.title)}</span><br><span class="small muted">${esc(x.code)} · vystaven ${esc(x.issued_on)} · záznamů ${x.events}${x.status === 'zruseny' ? ' · ZRUŠEN' : ''}</span></span></a>`).join('') || '<p class="muted">Zatím žádné pasy.</p>'}</div>
      <details style="margin-top:16px"><summary>Založit pas ručně (hodinky mimo katalog)</summary><form class="card" id="nf">
        <label>Název hodinek<input name="title" required maxlength="200"></label>
        <div class="grid"><label>Značka<input name="brand" maxlength="80"></label><label>Model<input name="model" maxlength="120"></label></div>
        <div class="grid"><label>Reference<input name="reference" maxlength="80"></label><label>Rok<input name="year" maxlength="20"></label></div>
        <label>Strojek<input name="movement" maxlength="120"></label>
        <label>Identifikace (číslo pouzdra / strojku)<input name="serial_ref" maxlength="120"></label>
        <label>Datum vystavení<input name="issued_on" type="date"></label>
        <button class="btn primary block">Založit pas</button></form></details>`;
    app.querySelector('#nf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { const r = await api('POST', 'passports', formData(e.target)); location.hash = `#/pasy/${r.id}`; }); });
  };
  views['pasy/:id'] = async ({ id }) => {
    const { passport: p, events, url, url_en, qr, kinds } = await api('GET', `passports/${id}`);
    const ap = String(p.authenticity_parts || '').split(',');
    const f = (n, l, max = 200) => `<label>${l}<input name="${n}" value="${esc(p[n])}" maxlength="${max}"></label>`;
    app.innerHTML = `<p><a href="#/pasy">← Pasy hodinek</a></p><h1 style="font-size:22px">${esc(p.title)}</h1>
      ${p.status === 'zruseny' ? '<div class="card warn small">Pas je zrušený – stránka pasu ukazuje, že neplatí.</div>' : ''}
      <div class="card center"><div class="qr">${qr}</div><p class="code">${esc(p.code)}</p>
        <p><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Otevřít pas ↗</a> <a class="btn" href="${esc(url_en)}" target="_blank" rel="noopener">EN ↗</a> <a class="btn primary" href="/api/admin/passports/${esc(id)}/certificate" target="_blank" rel="noopener">Certifikát k tisku</a></p>
        <p class="small muted">QR kód vytiskněte na certifikát nebo kartičku do krabičky. Na stránce pasu je výrobní číslo jen zkráceně.</p></div>
      <h2 style="margin-top:16px">Historie</h2><div class="list">${events.map((e) => `<div class="item"><span class="grow"><span class="t">${esc(kinds[e.kind])} · ${esc(e.event_date)}</span><br><span class="small muted">${esc(e.text_cs)}${e.public ? '' : ' · jen interně'}</span></span><button class="btn" data-del="${e.id}" aria-label="Smazat záznam">✕</button></div>`).join('') || '<p class="muted">Zatím žádné záznamy.</p>'}</div>
      <details style="margin-top:12px"><summary>Přidat záznam do historie</summary><form class="card" id="ef">
        <div class="grid"><label>Druh<select name="kind">${Object.entries(kinds).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label><label>Datum<input name="event_date" type="date"></label></div>
        <label>Popis (česky)<textarea name="text_cs" rows="2" maxlength="1000" required></textarea></label>
        <label>Popis anglicky (nepovinné)<textarea name="text_en" rows="2" maxlength="1000"></textarea></label>
        <label class="row"><input type="checkbox" name="public" checked> Zobrazit na stránce pasu</label>
        <button class="btn primary block">Přidat</button></form></details>
      <details style="margin-top:12px"><summary>Upravit údaje pasu</summary><form class="card" id="pf">
        ${f('title', 'Název hodinek')}<div class="grid">${f('brand', 'Značka', 80)}${f('model', 'Model', 120)}</div><div class="grid">${f('reference', 'Reference', 80)}${f('year', 'Rok', 20)}</div>
        ${f('movement', 'Strojek', 120)}${f('case_material', 'Pouzdro', 120)}${f('hallmark', 'Punc a ryzost')}${f('serial_ref', 'Identifikace (číslo pouzdra / strojku)', 120)}
        <fieldset><legend class="small">Součásti s doživotní garancí pravosti</legend>${Object.entries(AP).map(([k, v]) => `<label class="row"><input type="checkbox" name="ap" value="${k}"${ap.includes(k) ? ' checked' : ''}> ${v}</label>`).join('')}</fieldset>
        <label>Originální díly – popis<textarea name="original_parts" rows="2" maxlength="1000">${esc(p.original_parts)}</textarea></label>
        <label>Vyměněné díly<textarea name="replaced_parts" rows="2" maxlength="1000">${esc(p.replaced_parts)}</textarea></label>
        <label>Datum vystavení<input name="issued_on" type="date" value="${esc(p.issued_on)}"></label>
        <button class="btn primary block">Uložit</button></form></details>
      <button class="btn ghost block" id="st" style="margin-top:16px">${p.status === 'zruseny' ? 'Obnovit platnost pasu' : 'Zrušit pas (např. ztráta, podvrh)'}</button>`;
    app.querySelector('#ef').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => { const d = formData(ev.target); d.public = ev.target.public.checked; await api('POST', `passports/${id}/events`, d); toast('Přidáno'); views['pasy/:id']({ id }); }); });
    app.querySelector('#pf').addEventListener('submit', (ev) => { ev.preventDefault(); run(async () => {
      const d = formData(ev.target); delete d.ap; d.authenticity_parts = [...ev.target.querySelectorAll('[name=ap]:checked')].map((x) => x.value);
      await api('PUT', `passports/${id}`, d); toast('Uloženo'); views['pasy/:id']({ id });
    }); });
    app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Smazat záznam z historie?')) return; await api('DELETE', `passports/${id}/events/${b.dataset.del}`); views['pasy/:id']({ id }); })));
    app.querySelector('#st').addEventListener('click', () => run(async () => {
      const cancel = p.status !== 'zruseny';
      if (!confirm(cancel ? 'Zrušit pas? Stránka pasu pak ukáže, že neplatí.' : 'Obnovit platnost pasu?')) return;
      await api('PUT', `passports/${id}`, { status: cancel ? 'zruseny' : 'platny' }); views['pasy/:id']({ id });
    }));
  };

  // --- Dante Time OS: centrální přehled rolí ---------------------------------------------
  const sev = { critical: '🔴', warning: '🟡', info: '⚪' };
  const rstat = { ok: 'v pořádku', warning: 'upozornění', error: 'chyba', skipped: 'přeskočeno', running: 'běží' };
  views.system = async () => {
    const d = await api('GET', 'system');
    const waiting = d.approvals.filter((a) => a.status === 'ceka');
    app.innerHTML = `<h1>Dante Time OS</h1>
      <p class="small muted">Časovač: ${d.cron ? 'nastaven' : '<b>zatím není</b> – kontroly se spouštějí při otevření administrace'} · poslední běh ${d.lastTick ? date(d.lastTick) : '–'}</p>
      <div class="row" style="margin-bottom:12px"><button class="btn" id="run">Spustit kontroly teď</button><button class="btn" id="dir">Poslat souhrn e-mailem</button></div>
      <div class="card"><b>DT Guardian – otevřené nálezy (${d.findings.length})</b>
        ${d.findings.length ? `<div class="list" style="margin-top:8px">${d.findings.map((f) => `<div class="item"><span class="grow">${sev[f.severity] || ''} ${esc(f.title)}${f.detail ? `<br><span class="small muted">${esc(f.detail)}</span>` : ''}<br><span class="small muted">od ${date(f.created_at)}</span></span><button class="btn" data-res="${f.id}">Vyřešeno</button></div>`).join('')}</div>` : '<p class="small muted" style="margin:6px 0 0">Vše v pořádku.</p>'}</div>
      <div class="card" style="margin-top:12px"><b>Ke schválení (${waiting.length})</b>
        ${waiting.length ? waiting.map((a) => `<div style="margin-top:8px"><b>${esc(a.title)}</b> <span class="small muted">· ${esc(a.role_id)}</span><p class="small" style="white-space:pre-wrap">${esc(a.detail || '')}</p><div class="row"><button class="btn primary" data-ap="${a.id}" data-d="schvaleno">Schválit</button><button class="btn" data-ap="${a.id}" data-d="zamitnuto">Zamítnout</button></div></div>`).join('') : '<p class="small muted" style="margin:6px 0 0">Nic nečeká.</p>'}</div>
      <div class="card" style="margin-top:12px"><b>Náklady AI tento měsíc</b><p class="small" style="margin:6px 0 0">${d.budget.spent.toLocaleString('cs-CZ')} Kč z limitu ${d.budget.limit.toLocaleString('cs-CZ')} Kč${d.budget.blocked ? ' – <b>limit vyčerpán, AI stojí (e-shop běží dál)</b>' : ''}</p><p class="small muted" style="margin:4px 0 0">Etapa E1 AI nepoužívá (0 Kč). Navýšení limitu jen s vaším souhlasem.</p></div>
      <h2 style="margin-top:18px">Role</h2>
      <div class="list">${d.roles.map((r) => `<div class="card"><div class="row" style="justify-content:space-between"><b>${esc(r.name)}</b><span class="chip ${r.paused ? 'zmeskana' : r.active ? 'v_okne' : 'planovana'}">${r.paused ? 'pozastaveno' : r.active ? 'aktivní' : 'připravuje se'}</span></div>
        <p class="small" style="margin:6px 0">${esc(r.purpose)}</p><p class="small muted" style="margin:0">Spouštění: ${esc(r.schedule || '–')}</p>
        <details><summary class="small">Oprávnění</summary><p class="small"><b>Samostatně:</b> ${esc((r.permissions.samostatne || []).join(', '))}<br><b>Jen se schválením:</b> ${esc((r.permissions.se_schvalenim || []).join(', '))}</p></details>
        ${r.last_run_at ? `<p class="small" style="margin:6px 0 0">Poslední běh ${date(r.last_run_at)} · ${esc(rstat[r.last_status] || r.last_status)}${r.last_summary ? ` – ${esc(r.last_summary)}` : ''}</p>` : ''}
        ${r.paused ? `<p class="small" style="margin:6px 0 0">Pozastavil ${esc(r.paused_by)}: ${esc(r.paused_reason || '')}</p>` : ''}
        ${r.active ? `<div class="row" style="margin-top:8px">${r.paused ? `<button class="btn primary" data-resume="${r.id}">Obnovit</button>` : `<button class="btn" data-pause="${r.id}">Pozastavit</button>`}</div>` : ''}</div>`).join('')}</div>
      <h2 style="margin-top:18px">Poslední činnost</h2>
      <div class="list">${d.runs.slice(0, 25).map((x) => `<div class="item"><span class="grow"><span class="t">${esc(x.role_id)} · ${esc(x.task)}</span><br><span class="small muted">${date(x.started_at)} · ${esc(rstat[x.status] || x.status)}${x.summary ? ` – ${esc(x.summary)}` : ''}</span></span></div>`).join('') || '<p class="muted">Zatím žádná činnost.</p>'}</div>
      <h2 style="margin-top:18px">Zálohy databáze</h2><p class="small muted">Každý den, uchovávají se 30 dní v soukromém úložišti. Obnovu provádí agent podle docs/DANTE-TIME-OS.md.</p>
      <div class="list">${d.backups.map((b) => `<a class="item" href="/api/admin/system/backups/${b.id}"><span class="grow"><span class="t">${date(b.created_at)}</span><br><span class="small muted">${b.rows} řádků · ${Math.round(b.bytes / 1024)} kB · stáhnout</span></span></a>`).join('') || '<p class="muted">Zatím žádná záloha.</p>'}</div>`;
    const re = () => views.system();
    app.querySelector('#run').addEventListener('click', () => run(async () => { await api('POST', 'system/run', {}); toast('Kontroly proběhly'); re(); }));
    app.querySelector('#dir').addEventListener('click', () => run(async () => { await api('POST', 'system/director', {}); toast('Souhrn odeslán na váš e-mail'); re(); }));
    app.querySelectorAll('[data-res]').forEach((b) => b.addEventListener('click', () => run(async () => { await api('POST', `system/findings/${b.dataset.res}/resolve`, {}); re(); })));
    app.querySelectorAll('[data-ap]').forEach((b) => b.addEventListener('click', () => run(async () => { await api('POST', `system/approvals/${b.dataset.ap}`, { decision: b.dataset.d }); toast('Uloženo'); re(); })));
    app.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', () => run(async () => { const reason = prompt('Důvod pozastavení (nepovinné):') || ''; await api('POST', `system/roles/${b.dataset.pause}/pause`, { reason }); toast('Role pozastavena'); re(); })));
    app.querySelectorAll('[data-resume]').forEach((b) => b.addEventListener('click', () => run(async () => { if (!confirm('Obnovit roli? Ujistěte se, že důvod pozastavení je vyřešen.')) return; await api('POST', `system/roles/${b.dataset.resume}/resume`, {}); toast('Role obnovena'); re(); })));
  };

  // --- Garanční prohlídky ------------------------------------------------------------
  const dd = (s) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString('cs-CZ') : '–');
  views.prohlidky = async (_, q) => {
    const { inspections } = await api('GET', 'warranty');
    const f = q.get('f') || 'open';
    const groups = { open: (x) => !['hotova', 'zrusena'].includes(x.phase), done: (x) => x.phase === 'hotova', all: () => true };
    const list = inspections.filter(groups[f] || groups.open);
    const due = inspections.filter((x) => x.phase === 'pripomenout').length;
    app.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Garanční prohlídky</h1><a class="btn" href="#/prohlidky/nova">+ Ručně</a></div>
      <p class="small muted">Po 12 měsících od skutečného převzetí (±30 dnů). Vznikají samy, když u objednávky zapíšete převzetí. Připomínky posílá DT Logistics automaticky 2 týdny před otevřením termínu.</p>
      ${due ? `<button class="btn block" id="rall" style="margin-bottom:12px">Poslat ${due} ${due === 1 ? 'připomínku' : 'připomínky'} hned</button>` : ''}
      <div class="filters">${[['open', 'Otevřené'], ['done', 'Hotové'], ['all', 'Vše']].map(([k, t]) => `<button data-f="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
      <div class="list">${list.map((x) => `<a class="item" href="#/prohlidky/${x.id}"><span class="grow"><span class="t">${esc(x.watch_title)}</span><br>
        <span class="chip ${esc(x.phase)}">${esc(L.wphase[x.phase] || x.phase)}</span> <span class="small muted">${esc(x.customer_name)} · termín ${dd(x.window_from)} – ${dd(x.window_to)}</span></span></a>`).join('') || '<p class="muted">Zatím žádné prohlídky. Vzniknou samy, jakmile u objednávky zapíšete převzetí zákazníkem.</p>'}</div>`;
    app.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/prohlidky?f=${b.dataset.f}`; }));
    app.querySelector('#rall')?.addEventListener('click', () => run(async () => { if (!confirm(`Odeslat ${due} připomínek e-mailem?`)) return; const r = await api('POST', 'warranty/remind-due', {}); toast(`Odesláno: ${r.sent}`); views.prohlidky(_, q); }));
  };
  views['prohlidky/nova'] = async () => {
    app.innerHTML = `<p><a href="#/prohlidky">← Prohlídky</a></p><h1>Nová prohlídka</h1><p class="small muted">Pro hodinky prodané mimo e-shop (osobně, na Instagramu…).</p>
      <form id="wf">${field('watch_title', 'Hodinky', {}, 'required')}${field('customer_name', 'Zákazník', {}, 'required')}${field('customer_email', 'E-mail', {}, 'type="email" required')}
      ${field('handover_date', 'Datum převzetí hodinek', {}, 'type="date" required')}<label>Jazyk e-mailů<select name="lang"><option value="cs">čeština</option><option value="en">angličtina</option></select></label>
      <div class="sticky-save"><button class="btn primary block">Uložit</button></div></form>`;
    app.querySelector('#wf').addEventListener('submit', (e) => { e.preventDefault(); run(async () => { const { id } = await api('POST', 'warranty', formData(e.target)); toast('Uloženo'); location.hash = `#/prohlidky/${id}`; }); });
  };
  views['prohlidky/:id'] = async ({ id }) => {
    const { inspections } = await api('GET', 'warranty');
    const x = inspections.find((i) => i.id === id);
    if (!x) { app.innerHTML = '<p>Prohlídka nenalezena.</p>'; return; }
    const done = x.status === 'hotova';
    app.innerHTML = `<p><a href="#/prohlidky">← Prohlídky</a></p><h1 style="font-size:22px">${esc(x.watch_title)}</h1>
      <p><span class="chip ${esc(x.phase)}">${esc(L.wphase[x.phase])}</span></p>
      <div class="card"><table class="kv">
        <tr><th>Zákazník</th><td>${esc(x.customer_name)}<br><a href="mailto:${esc(x.customer_email)}">${esc(x.customer_email)}</a></td></tr>
        <tr><th>Převzetí</th><td>${dd(x.handover_date)}</td></tr>
        <tr><th>Termín prohlídky</th><td>${dd(x.window_from)} – ${dd(x.window_to)}<br><span class="small muted">(12 měsíců: ${dd(x.due_date)})</span></td></tr>
        <tr><th>Připomínka</th><td>${x.reminder_sent_at ? `odeslána ${date(x.reminder_sent_at)}` : `naplánována na ${dd(x.remind_on)}`}</td></tr>
        <tr><th>Cena</th><td>${czk(x.price_czk)}</td></tr>
        <tr><th>Dobrovolná záruka do</th><td>${dd(x.warranty_until)}${done ? '' : ' <span class="small muted">(po prohlídce v termínu prodloužena)</span>'}</td></tr>
        <tr><th>Zákonná práva do</th><td>${dd(x.liability_until)} <span class="small muted">(nezávisle na záruce; domněnka vady do ${dd(x.presumption_until)})</span></td></tr>
        ${done ? `<tr><th>Provedeno</th><td>${dd(x.done_on)} · ${x.result === 'zavada' ? 'zjištěna vada' : 'v pořádku'}</td></tr>
          <tr><th>Měření</th><td>${x.rate_s_day ?? '–'} s/den · ${x.amplitude_deg ?? '–'}° · ${x.beat_error_ms ?? '–'} ms</td></tr>` : ''}
      </table>${x.order_id ? `<p class="small"><a href="#/objednavky/${esc(x.order_id)}">Objednávka</a></p>` : ''}</div>
      ${done ? '' : `<div class="row" style="margin:12px 0"><button class="btn" id="rem">${x.reminder_sent_at ? 'Poslat připomínku znovu' : 'Poslat připomínku'}</button></div>
      <details><summary>Upravit termín / stav</summary><form id="ef">${field('handover_date', 'Datum převzetí (přepočítá termíny)', x, 'type="date"')}
        <label>Stav<select name="status">${[['planovana', 'Naplánováno'], ['objednana', 'Termín domluven'], ['zrusena', 'Zrušeno']].map(([v, t]) => `<option value="${v}" ${x.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        ${field('booked_for', 'Domluvený termín', x, 'type="date"')}${area('note', 'Poznámka', x)}<button class="btn block">Uložit</button></form></details>
      <details open><summary>Zapsat protokol prohlídky</summary><form id="pf">
        ${field('done_on', 'Datum prohlídky', { done_on: new Date().toISOString().slice(0, 10) }, 'type="date" required')}
        <div class="grid">${field('rate_s_day', 'Odchylka chodu (s/den)', {}, 'inputmode="decimal"')}${field('amplitude_deg', 'Amplituda (°)', {}, 'inputmode="numeric"')}</div>
        ${field('beat_error_ms', 'Odchylka kroku (ms)', {}, 'inputmode="decimal"')}
        <label>Výsledek<select name="result"><option value="ok">V pořádku</option><option value="zavada">Zjištěna vada</option></select></label>
        ${area('findings', 'Zjištění a provedené úkony (uvidí zákazník)', {})}
        <label class="check"><input type="checkbox" name="paid"> Zaplaceno (${czk(x.price_czk)})</label>
        <div class="sticky-save"><button class="btn primary block">Uložit protokol a poslat zákazníkovi</button></div></form></details>`}`;
    app.querySelector('#rem')?.addEventListener('click', () => run(async () => { if (!confirm('Poslat zákazníkovi připomínku e-mailem?')) return; await api('POST', `warranty/${id}/remind`, {}); toast('Připomínka odeslána'); views['prohlidky/:id']({ id }); }));
    app.querySelector('#ef')?.addEventListener('submit', (e) => { e.preventDefault(); run(async () => { await api('PUT', `warranty/${id}`, formData(e.target)); toast('Uloženo'); views['prohlidky/:id']({ id }); }); });
    app.querySelector('#pf')?.addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
      if (!confirm('Uložit protokol a poslat ho zákazníkovi?')) return;
      const d = formData(e.target); d.paid = e.target.paid.checked;
      const r = await api('POST', `warranty/${id}/protocol`, d); toast(r.extended ? 'Hotovo – záruka prodloužena' : 'Hotovo – mimo termín, záruka neprodloužena'); views['prohlidky/:id']({ id });
    }); });
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
    let eu = {}; try { eu = JSON.parse(s.shipping_eu_json || '{}'); } catch { eu = {}; }
    let euIns = {}; try { euIns = JSON.parse(s.shipping_eu_insured_json || '{}'); } catch { euIns = {}; }
    const yes = (v) => (v ? '<span class="chip available">aktivní</span>' : '<span class="chip">neaktivní</span>');
    app.innerHTML = `<h1>Nastavení</h1>
      <form id="setf" class="card"><h2 style="margin-top:0">Doprava</h2>
        <label>Zásilkovna – cena (Kč, prázdné = nenabízet)<input name="shipping_zasilkovna_czk" inputmode="numeric" value="${esc(s.shipping_zasilkovna_czk)}"></label>
        <label>Balíkovna – cena (Kč, prázdné = nenabízet)<input name="shipping_balikovna_czk" inputmode="numeric" value="${esc(s.shipping_balikovna_czk)}"></label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="shipping_osobni_enabled" ${s.shipping_osobni_enabled === '1' ? 'checked' : ''} style="width:22px;min-height:22px"> Nabízet osobní převzetí</label>
        <h2>Dobírka</h2>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="cod_enabled" ${s.cod_enabled === '1' ? 'checked' : ''} style="width:22px;min-height:22px"> Nabízet platbu dobírkou</label>
        <label>Příplatek za dobírku (Kč, prázdné = 0)<input name="cod_fee_czk" inputmode="numeric" value="${esc(s.cod_fee_czk)}"></label>
        <h2>Pojištěná přeprava</h2>
        <label>Od ceny hodinek (Kč) nabízet jen pojištěnou přepravu / osobní předání<input name="insured_threshold_czk" inputmode="numeric" value="${esc(s.insured_threshold_czk)}"></label>
        <div class="grid"><label>Cena pojištěné přepravy v ČR (Kč)<input name="insured_price_czk" inputmode="numeric" value="${esc(s.insured_price_czk)}"></label><label>Cena pojištěné přepravy do EU (Kč)<input name="insured_eu_price_czk" inputmode="numeric" value="${esc(s.insured_eu_price_czk)}"></label></div>
        <h2>Platby v eurech</h2>
        <label>Kurz CZK za 1 EUR (prázdné = platba v EUR se nenabízí)<input name="eur_rate" inputmode="decimal" value="${esc(s.eur_rate)}"></label>
        <details><summary>Doprava do zemí EU – cena v Kč (prázdné = do země běžně nedoručujeme)</summary>
          <p class="small muted">Běžná = doprava na adresu. Pojištěná = pro hodinky nad hranicí výše; prázdné = použije se společná cena pojištěné přepravy do EU.</p>
          <table class="small" style="margin-top:6px"><tr><th>Země</th><th>Běžná</th><th>Pojištěná</th></tr>${EU.filter((c) => c[0] !== 'CZ').map(([c, n]) => `<tr><td>${n}</td><td><input aria-label="${n} – běžná doprava" data-eu="${c}" inputmode="numeric" value="${esc(eu[c] ?? '')}"></td><td><input aria-label="${n} – pojištěná přeprava" data-eu-ins="${c}" inputmode="numeric" value="${esc(euIns[c] ?? '')}"></td></tr>`).join('')}</table>
        </details>
        <h2>Puncovní úřad</h2>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="punc_notified" ${s.punc_notified === '1' ? 'checked' : ''} style="width:22px;min-height:22px"> Obchod s hodinkami z drahých kovů a e-shop jsem oznámil Puncovnímu úřadu</label>
        <p class="small muted">Nutné jen pro pouzdra ze zlata, stříbra nebo platiny. Nerezová a pozlacená pouzdra oznámení nevyžadují. Bez zaškrtnutí nelze hodinky z drahého kovu zveřejnit.</p>
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
      const d = formData(e.target); d.shipping_osobni_enabled = e.target.shipping_osobni_enabled.checked; d.cod_enabled = e.target.cod_enabled.checked; d.punc_notified = e.target.punc_notified.checked;
      d.shipping_eu_insured_json = Object.fromEntries([...e.target.querySelectorAll('[data-eu-ins]')].map((x) => [x.dataset.euIns, x.value.trim()]));
      d.shipping_eu_json = Object.fromEntries([...e.target.querySelectorAll('[data-eu]')].map((x) => [x.dataset.eu, x.value.trim()]));
      await api('PUT', 'settings', d); toast('Uloženo');
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

  views.zabezpeceni = async () => {
    const me = await api('GET', 'me');
    app.innerHTML = `<p><a href="#/vice">← Více</a></p><h1>Zabezpečení účtu</h1>
      <div class="card"><h2 style="margin-top:0">Nový klíč pro ověřovací kódy</h2>
      <p class="small">Použijte, když byl klíč nebo QR kód někde vidět, nebo měníte telefon. Starý kód v aplikaci Hesla po výměně přestane platit.</p>
      <button class="btn primary block" id="tstart">Vytvořit nový klíč</button></div><div id="tbox"></div>`;
    app.querySelector('#tstart').addEventListener('click', () => run(async () => {
      const { secret, qr } = await api('POST', 'security/totp/start', {});
      app.querySelector('#tstart').disabled = true;
      app.querySelector('#tbox').innerHTML = `<div class="card">
        <p><b>1.</b> Klepněte na „Přidat do Hesel“ a vyberte svou položku pro tento web (nahradí starý kód). Snímek obrazovky nedělejte.</p>
        <p class="center"><a class="btn ghost" href="otpauth://totp/${encodeURIComponent('Dante Time:' + me.email)}?secret=${secret}&issuer=Dante%20Time">Přidat do Hesel</a></p>
        <details><summary class="small muted">QR kód a ruční zadání</summary><div class="qr">${qr}</div><p class="code">${esc(secret)}</p></details></div>
        <form class="card" id="tfin"><p><b>2.</b> Zadejte heslo a nový 6místný kód.</p>
        <label>Heslo<input name="password" type="password" required autocomplete="current-password"></label>
        <label>Nový ověřovací kód<input name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label>
        <button class="btn primary block">Potvrdit výměnu</button></form>`;
      app.querySelector('#tfin').addEventListener('submit', (e) => { e.preventDefault(); run(async () => {
        await api('POST', 'security/totp/finish', { secret, ...formData(e.target) });
        toast('Klíč vyměněn – od teď platí nový kód');
        location.hash = '#/vice';
      }); });
    }));
  };

  views.vice = async () => {
    app.innerHTML = `<h1>Více</h1><div class="list">
      <a class="item" href="#/ekonomika"><span class="grow">Ekonomika – tržby, náklady, zisk, export pro účetní</span></a>
      <a class="item" href="#/naklady"><span class="grow">Náklady a provozní výdaje</span></a>
      <a class="item" href="#/doklady"><span class="grow">Nákupy a prodeje (nahrát doklady, import faktur)</span></a>
      <a class="item" href="#/dily"><span class="grow">Sklad dílů</span></a>
      <a class="item" href="#/system"><span class="grow">Systém Dante Time OS (role, kontroly, zálohy)</span></a>
      <a class="item" href="#/prohlidky"><span class="grow">Garanční prohlídky</span></a>
      <a class="item" href="#/pasy"><span class="grow">Pasy hodinek a certifikáty pravosti</span></a>
      <a class="item" href="#/poptavky"><span class="grow">Poptávky</span></a>
      <a class="item" href="#/faktury"><span class="grow">Faktury</span></a>
      <a class="item" href="#/zakaznici"><span class="grow">Zákazníci</span></a>
      <a class="item" href="#/odstoupeni"><span class="grow">Odstoupení od smlouvy</span></a>
      <a class="item" href="#/nastaveni"><span class="grow">Nastavení</span></a>
      <a class="item" href="#/emaily"><span class="grow">E-maily</span></a>
      <a class="item" href="#/zabezpeceni"><span class="grow">Zabezpečení účtu</span></a>
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
