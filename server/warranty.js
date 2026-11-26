// Garanční prohlídky – evidence, připomínky a protokoly (Dante Time OS, etapa E1)
import { HttpError } from './http.js';
import { randomId, now, audit } from './db.js';
import { sendEmail } from './email.js';
import { SITE, OPERATOR } from '../src/site.mjs';
import { TERMS, priceCs, priceEn } from '../src/terms.mjs';
import { onInspection } from './passport.js';
import { schedule, inspectionApplies, warrantyUntilAfter, phase, today } from '../src/shop/warranty.mjs';

const I = TERMS.inspection;
const tr = (r, cs, en) => (r.lang === 'en' ? en : cs);
const d = (r, s) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString(r.lang === 'en' ? 'en-GB' : 'cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague' }) : '');

/** Založí prohlídky po skutečném převzetí hodinek (jen podmínky 1.1+). Opakované volání nic nezdvojí. */
export async function createForOrder(env, order, handover = today()) {
  if (!inspectionApplies(order.terms_version)) return 0;
  const { results: items } = await env.DB.prepare('SELECT product_id, title FROM order_items WHERE order_id = ?').bind(order.id).all();
  const s = schedule(handover);
  let n = 0;
  for (const it of items) {
    const r = await env.DB.prepare(`INSERT OR IGNORE INTO warranty_inspections (id, order_id, product_id, watch_title, customer_name, customer_email, lang, terms_version, handover_date, due_date, window_from, window_to, remind_on, price_czk, warranty_until, liability_until, presumption_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(randomId(), order.id, it.product_id, it.title, order.name, order.email, order.lang || 'cs', order.terms_version, s.handover_date, s.due_date, s.window_from, s.window_to, s.remind_on, I.priceCzk, s.due_date, s.liability_until, s.presumption_until).run();
    n += r.meta?.changes || 0;
  }
  return n;
}

/** Ručně zadaná prohlídka (hodinky prodané mimo e-shop). */
export async function createManual(env, { watch_title, customer_name, customer_email, lang, handover_date, product_id = null }, actor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(handover_date || '')) throw new HttpError('Zadejte datum převzetí');
  const s = schedule(handover_date);
  const id = randomId();
  await env.DB.prepare(`INSERT INTO warranty_inspections (id, product_id, watch_title, customer_name, customer_email, lang, terms_version, handover_date, due_date, window_from, window_to, remind_on, price_czk, warranty_until, liability_until, presumption_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, product_id, watch_title, customer_name, customer_email, lang === 'en' ? 'en' : 'cs', 'rucne', s.handover_date, s.due_date, s.window_from, s.window_to, s.remind_on, I.priceCzk, s.due_date, s.liability_until, s.presumption_until).run();
  await audit(env, actor, 'prohlidka_zalozena', 'warranty_inspection', id, { watch_title });
  return id;
}

/** Změna data převzetí (např. doručení později než odeslání) – přepočítá termíny. */
export async function setHandover(env, id, handover, actor) {
  const s = schedule(handover);
  await env.DB.prepare("UPDATE warranty_inspections SET handover_date=?, due_date=?, window_from=?, window_to=?, remind_on=?, liability_until=?, presumption_until=?, warranty_until=CASE WHEN status='hotova' THEN warranty_until ELSE ? END, updated_at=? WHERE id=?")
    .bind(s.handover_date, s.due_date, s.window_from, s.window_to, s.remind_on, s.liability_until, s.presumption_until, s.due_date, now(), id).run();
  await audit(env, actor, 'prohlidka_prevzeti', 'warranty_inspection', id, { handover });
}

export async function list(env) {
  const { results } = await env.DB.prepare("SELECT * FROM warranty_inspections ORDER BY CASE status WHEN 'hotova' THEN 2 WHEN 'zrusena' THEN 3 ELSE 0 END, due_date LIMIT 500").all();
  const t = today();
  return results.map((r) => ({ ...r, phase: phase(r, t) }));
}

function reminderBody(r) {
  const link = `${SITE.origin}${r.lang === 'en' ? '/en/warranty' : '/warranty'}`;
  return tr(r,
    `<p>Dobrý den, ${r.customer_name},</p>
<p>blíží se rok od chvíle, kdy jste převzal(a) hodinky <strong>${r.watch_title}</strong>. Aby vám záruka za jakost platila i ve druhém roce, čeká hodinky <strong>garanční prohlídka</strong>.</p>
<p><strong>Termín prohlídky:</strong> mezi ${d(r, r.window_from)} a ${d(r, r.window_to)}.<br>
<strong>Co zahrnuje:</strong> kontrolu přesnosti chodu, amplitudy, odchylky kroku a celkového technického stavu, s písemným protokolem.<br>
<strong>Cena:</strong> ${priceCs(I.priceCzk)}. Případnou vadu, na kterou se vztahuje záruka, odstraníme zdarma.</p>
<p>Termín si domluvíte odpovědí na tento e-mail. Prohlídka není povinná; vaše zákonná práva z vadného plnění platí v plném rozsahu i bez ní. Podrobnosti: <a href="${link}">Záruka a garance pravosti</a>.</p>
<p>S úctou<br>${OPERATOR.tradeName}</p>`,
    `<p>Dear ${r.customer_name},</p>
<p>it will soon be a year since you received your <strong>${r.watch_title}</strong>. To keep the quality warranty in its second year, your watch is due for its <strong>warranty inspection</strong>.</p>
<p><strong>Inspection window:</strong> between ${d(r, r.window_from)} and ${d(r, r.window_to)}.<br>
<strong>What it covers:</strong> rate accuracy, amplitude, beat error and the overall technical condition, with a written report.<br>
<strong>Price:</strong> ${priceEn(I.priceCzk)}. Any defect covered by the warranty is remedied free of charge.</p>
<p>Simply reply to this e-mail to arrange a date. The inspection is optional; your statutory rights for defects apply in full without it. Details: <a href="${link}">Warranty and authenticity guarantee</a>.</p>
<p>Kind regards<br>${OPERATOR.tradeName}</p>`);
}

export async function sendReminder(env, id, actor) {
  const r = await env.DB.prepare('SELECT * FROM warranty_inspections WHERE id = ?').bind(id).first();
  if (!r) throw new HttpError('Prohlídka nenalezena', 404);
  if (r.status === 'hotova' || r.status === 'zrusena') throw new HttpError('Prohlídka je uzavřená');
  const res = await sendEmail(env, { to: r.customer_email, subject: tr(r, 'Garanční prohlídka vašich hodinek Dante Time', 'Warranty inspection of your Dante Time watch'), body: reminderBody(r), related: `warranty:${id}`, replyTo: SITE.email });
  if (res?.failed) throw new HttpError('E-mail se nepodařilo odeslat (viz E-maily)', 502);
  await env.DB.prepare('UPDATE warranty_inspections SET reminder_sent_at=?, updated_at=? WHERE id=?').bind(now(), now(), id).run();
  await audit(env, actor, 'prohlidka_pripominka', 'warranty_inspection', id, {});
}

/** Pošle všechny připomínky, které jsou na řadě (automaticky z časovače). Vrací počet odeslaných. */
export async function sendDueReminders(env, actor, { max = 20 } = {}) {
  const t = today();
  const { results } = await env.DB.prepare("SELECT id FROM warranty_inspections WHERE status IN ('planovana','objednana') AND reminder_sent_at IS NULL AND reminder_error IS NULL AND remind_on <= ? AND window_to >= ? ORDER BY remind_on LIMIT ?").bind(t, t, max).all();
  let sent = 0;
  for (const r of results) {
    try { await sendReminder(env, r.id, actor); sent++; } catch (e) {
      await env.DB.prepare('UPDATE warranty_inspections SET reminder_error=? WHERE id=?').bind(String(e.message).slice(0, 300), r.id).run();
    }
  }
  return sent;
}

/** Zapíše výsledek prohlídky, spočítá trvání záruky a pošle zákazníkovi protokol. */
export async function recordProtocol(env, id, p, actor) {
  const r = await env.DB.prepare('SELECT * FROM warranty_inspections WHERE id = ?').bind(id).first();
  if (!r) throw new HttpError('Prohlídka nenalezena', 404);
  const doneOn = /^\d{4}-\d{2}-\d{2}$/.test(p.done_on || '') ? p.done_on : today();
  const until = warrantyUntilAfter(r, doneOn);
  await env.DB.prepare(`UPDATE warranty_inspections SET status='hotova', done_on=?, rate_s_day=?, amplitude_deg=?, beat_error_ms=?, result=?, findings=?, paid=?, warranty_until=?, updated_at=? WHERE id=?`)
    .bind(doneOn, p.rate_s_day, p.amplitude_deg, p.beat_error_ms, p.result, p.findings, p.paid ? 1 : 0, until, now(), id).run();
  await audit(env, actor, 'prohlidka_provedena', 'warranty_inspection', id, { doneOn, until, result: p.result });
  try { await onInspection(env, r, doneOn, p.result); } catch (e) { console.error('Pas: záznam prohlídky selhal', e?.message); }
  const ok = until > r.due_date;
  const row = (l, v) => (v == null || v === '' ? '' : `<tr><td style="padding:4px 12px 4px 0;color:#555">${l}</td><td><strong>${v}</strong></td></tr>`);
  const table = `<table style="border-collapse:collapse">${row(tr(r, 'Hodinky', 'Watch'), r.watch_title)}${row(tr(r, 'Datum prohlídky', 'Inspection date'), d(r, doneOn))}
${row(tr(r, 'Odchylka chodu', 'Rate'), p.rate_s_day != null ? `${p.rate_s_day > 0 ? '+' : ''}${p.rate_s_day} s/${tr(r, 'den', 'day')}` : '')}${row(tr(r, 'Amplituda', 'Amplitude'), p.amplitude_deg != null ? `${p.amplitude_deg}°` : '')}
${row(tr(r, 'Odchylka kroku', 'Beat error'), p.beat_error_ms != null ? `${p.beat_error_ms} ms` : '')}${row(tr(r, 'Výsledek', 'Result'), p.result === 'zavada' ? tr(r, 'zjištěna vada – viz poznámka', 'defect found – see note') : tr(r, 'v pořádku', 'in order'))}
${row(tr(r, 'Poznámka', 'Note'), p.findings)}</table>`;
  await sendEmail(env, {
    to: r.customer_email, related: `warranty:${id}`, replyTo: SITE.email,
    subject: tr(r, `Protokol garanční prohlídky – ${r.watch_title}`, `Warranty inspection report – ${r.watch_title}`),
    body: tr(r, `<p>Dobrý den, ${r.customer_name},</p><p>děkujeme, garanční prohlídka vašich hodinek je hotová.</p>${table}
<p>${ok ? `<strong>Záruka za jakost trvá do ${d(r, until)}.</strong>` : `Prohlídka proběhla mimo stanovené období, smluvní záruka proto skončila ${d(r, r.due_date)}. Vaše zákonná práva z vadného plnění trvají v plném rozsahu.`}</p><p>S úctou<br>${OPERATOR.tradeName}</p>`,
      `<p>Dear ${r.customer_name},</p><p>thank you, the warranty inspection of your watch is complete.</p>${table}
<p>${ok ? `<strong>Your quality warranty continues until ${d(r, until)}.</strong>` : `The inspection took place outside the set window, so the contractual warranty ended on ${d(r, r.due_date)}. Your statutory rights for defects continue in full.`}</p><p>Kind regards<br>${OPERATOR.tradeName}</p>`),
  });
  return { warranty_until: until, extended: ok };
}
