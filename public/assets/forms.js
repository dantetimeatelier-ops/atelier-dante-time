// Odesílání poptávek (kontakt, služby, detail hodinek)
// Fotografie: zmenší se v prohlížeči (max. 1600 px, WebP/JPEG) – tím zmizí i metadata (GPS) a odeslání je rychlé.
const MAX_PHOTOS = 5;
async function shrink(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

document.querySelectorAll('[data-inquiry-form]').forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const cs = form.dataset.lang !== 'en';
  const show = (msg, kind) => { status.hidden = false; status.className = `notice ${kind || ''}`; status.textContent = msg; };
  const picker = form.querySelector('[data-photos]');
  const typeSel = form.querySelector('select[name=type]');
  picker?.addEventListener('change', () => {
    if (picker.files.length > MAX_PHOTOS) show(cs ? `Odešle se prvních ${MAX_PHOTOS} fotografií.` : `The first ${MAX_PHOTOS} photos will be sent.`);
    else status.hidden = true;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const fields = Object.fromEntries([...new FormData(form)].filter(([, v]) => typeof v === 'string'));
      fields.lang = cs ? 'cs' : 'en';
      const files = picker ? [...picker.files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)).slice(0, MAX_PHOTOS) : [];
      let res;
      if (files.length && typeSel?.value !== 'general') {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.append(k, v);
        for (const [n, f] of files.entries()) {
          show(cs ? `Připravuji fotografie ${n + 1} z ${files.length}…` : `Preparing photos ${n + 1} of ${files.length}…`);
          const blob = await shrink(f).catch(() => null); // nečitelný formát přeskočíme
          if (blob) fd.append('photos', blob, `foto${n + 1}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
        }
        show(cs ? 'Odesílám…' : 'Sending…');
        res = await fetch('/api/inquiry', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'error');
      form.reset();
      const extra = out.photos ? (cs ? ` Přiložené fotografie: ${out.photos}.` : ` Photos attached: ${out.photos}.`) : '';
      show((cs ? 'Děkuji, poptávka byla odeslána. Ozvu se vám e-mailem.' : 'Thank you, your enquiry has been sent. I will reply by e-mail.') + extra, 'ok');
    } catch (err) {
      show(cs ? `Odeslání se nepodařilo (${err.message}). Napište prosím na dante.time.atelier@gmail.com.` : `Sending failed (${err.message}). Please e-mail dante.time.atelier@gmail.com.`, 'err');
    } finally { btn.disabled = false; }
  });
});
