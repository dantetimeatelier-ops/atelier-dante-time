// Online odstoupení od smlouvy ve dvou krocích (§ 1830a OZ)
(() => {
  const form = document.querySelector('[data-withdrawal-form]');
  if (!form) return;
  const s1 = form.querySelector('[data-step="1"]');
  const s2 = form.querySelector('[data-step="2"]');
  const status = form.querySelector('[data-status]');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  form.querySelector('[data-next]').addEventListener('click', () => {
    const req = [...s1.querySelectorAll('[required]')];
    if (!req.every((i) => i.checkValidity())) { req.find((i) => !i.checkValidity()).reportValidity(); return; }
    const d = Object.fromEntries(new FormData(form));
    form.querySelector('[data-review]').innerHTML = `<p><strong>Oznamuji, že odstupuji od kupní smlouvy.</strong></p><ul><li>Jméno: ${esc(d.name)}</li><li>E-mail: ${esc(d.email)}</li><li>Číslo objednávky: ${esc(d.orderNumber)}</li><li>Zboží: ${esc(d.items || 'celá objednávka')}</li>${d.account ? `<li>Účet pro vrácení peněz: ${esc(d.account)}</li>` : ''}</ul>`;
    s1.hidden = true; s2.hidden = false;
  });
  form.querySelector('[data-back]').addEventListener('click', () => { s2.hidden = true; s1.hidden = false; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await fetch('/api/withdrawal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Odeslání se nepodařilo');
      s2.hidden = true;
      status.hidden = false; status.className = 'notice ok';
      status.textContent = `Odstoupení od smlouvy jsme přijali ${out.receivedAt}. Potvrzení jsme odeslali na váš e-mail.`;
    } catch (err) {
      status.hidden = false; status.className = 'notice err';
      status.textContent = `${err.message}. Odstoupit můžete také e-mailem na dante.time.atelier@gmail.com.`;
      btn.disabled = false;
    }
  });
})();
