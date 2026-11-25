// Odesílání poptávek (kontakt, služby, detail hodinek)
document.querySelectorAll('[data-inquiry-form]').forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const cs = form.dataset.lang !== 'en';
  const show = (msg, kind) => { status.hidden = false; status.className = `notice ${kind || ''}`; status.textContent = msg; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      data.lang = cs ? 'cs' : 'en';
      const res = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'error');
      form.reset();
      show(cs ? 'Děkuji, poptávka byla odeslána. Ozvu se vám e-mailem.' : 'Thank you, your enquiry has been sent. I will reply by e-mail.', 'ok');
    } catch (err) {
      show(cs ? `Odeslání se nepodařilo (${err.message}). Napište prosím na dante.time.atelier@gmail.com.` : `Sending failed (${err.message}). Please e-mail dante.time.atelier@gmail.com.`, 'err');
    } finally { btn.disabled = false; }
  });
});
