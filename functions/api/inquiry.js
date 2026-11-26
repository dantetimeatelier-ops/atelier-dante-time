// Nezávazné poptávky z webu (kontakt, služby, zájem o hodinky)
import { json, handle, readJson, assertSameOrigin, clientIp, HttpError } from '../../server/http.js';
import { rateLimit, randomId, audit } from '../../server/db.js';
import { str, email as vEmail, oneOf, isBot } from '../../server/validate.js';
import { sendEmail, ownerEmail } from '../../server/email.js';
import { esc } from '../../src/layout.mjs';
import * as CPH from '../../server/commission-photos.js';

// Fotky může zákazník přiložit jen k poptávce servisu, renovace, sestavy, přestavby nebo jiného dotazu
const PHOTO_TYPES = ['servis', 'renovace', 'zakazkova_vyroba', 'prestavba', 'jine'];

const TYPES = ['servis', 'renovace', 'zakazkova_vyroba', 'prestavba', 'jine', 'product', 'general'];

export const onRequestPost = handle(async ({ env, request }) => {
  assertSameOrigin(request);
  // Bez fotek JSON, s fotkami multipart/form-data (telefon je předem zmenší a odstraní GPS)
  let body; let files = [];
  if ((request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
    if (Number(request.headers.get('Content-Length') || 0) > 12e6) throw new HttpError('Fotografie jsou příliš velké', 413);
    const form = await request.formData();
    body = {};
    for (const [k, v] of form.entries()) if (typeof v === 'string') body[k] = v;
    files = form.getAll('photos').filter((f) => f && typeof f !== 'string' && f.size > 0);
  } else body = await readJson(request);
  if (isBot(body)) return json({ ok: true }); // robotům tváříme úspěch
  await rateLimit(env, `inquiry:${clientIp(request)}`, 5, 60);
  if (files.length > CPH.MAX_PER_INQUIRY) throw new HttpError(`Přiložte nejvýše ${CPH.MAX_PER_INQUIRY} fotografií`);
  const d = {
    type: oneOf(body.type, TYPES, 'typ poptávky'),
    productId: str(body.productId, { max: 40 }),
    name: str(body.name, { max: 120, required: true, name: 'jméno' }),
    email: vEmail(body.email),
    phone: str(body.phone, { max: 40 }),
    message: str(body.message, { max: 4000, required: true, name: 'zprávu' }),
    lang: body.lang === 'en' ? 'en' : 'cs',
  };
  const id = randomId();
  await env.DB.prepare('INSERT INTO inquiries (id, type, product_id, name, email, phone, message, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, d.type, d.productId, d.name, d.email, d.phone, d.message, d.lang).run();
  let photos = 0;
  if (files.length && PHOTO_TYPES.includes(d.type)) {
    for (const f of files) {
      try { await CPH.save(env, { inquiryId: id, source: 'zakaznik', large: f }); photos++; } catch (e) { console.error('Foto poptávky:', e?.message); }
    }
  }
  let product = '';
  if (d.productId) {
    const p = await env.DB.prepare('SELECT title, slug FROM products WHERE id=?').bind(d.productId).first();
    if (p) product = `<p>Hodinky: <a href="${new URL(request.url).origin}/hodinky/${p.slug}">${esc(p.title)}</a></p>`;
  }
  await sendEmail(env, {
    to: ownerEmail(env), subject: `Nová poptávka: ${d.name}`, related: `inquiry:${id}`, replyTo: d.email,
    body: `<p><strong>${esc(d.name)}</strong> (${esc(d.email)}${d.phone ? `, ${esc(d.phone)}` : ''}) – ${esc(d.type)}</p>${product}<p style="white-space:pre-wrap">${esc(d.message)}</p>${photos ? `<p>Zákazník přiložil fotografie: ${photos}</p>` : ''}<p><a href="${new URL(request.url).origin}/admin/#/poptavky">Otevřít v administraci</a></p>`,
  });
  await audit(env, 'web', 'poptavka', 'inquiry', id);
  return json({ ok: true, photos }, 201);
});
