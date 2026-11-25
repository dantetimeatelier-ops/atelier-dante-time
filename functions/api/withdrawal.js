// Online odstoupení od smlouvy (§ 1830a OZ): přijme prohlášení a bez
// zbytečného odkladu potvrdí jeho přijetí e-mailem.
import { json, handle, readJson, assertSameOrigin, clientIp } from '../../server/http.js';
import { rateLimit, randomId, now, audit } from '../../server/db.js';
import { str, email as vEmail, isBot } from '../../server/validate.js';
import { sendEmail, ownerEmail } from '../../server/email.js';
import { esc } from '../../src/layout.mjs';

export const onRequestPost = handle(async ({ env, request }) => {
  assertSameOrigin(request);
  const body = await readJson(request);
  if (isBot(body)) return json({ ok: true, receivedAt: '' });
  await rateLimit(env, `withdrawal:${clientIp(request)}`, 5, 60);
  const d = {
    name: str(body.name, { max: 120, required: true, name: 'jméno' }),
    email: vEmail(body.email),
    orderNumber: str(body.orderNumber, { max: 20, required: true, name: 'číslo objednávky' }),
    items: str(body.items, { max: 500 }),
    account: str(body.account, { max: 50 }),
  };
  // Prohlášení přijímáme vždy – i když číslo objednávky nesedí, posoudí to majitel.
  const order = await env.DB.prepare('SELECT id FROM orders WHERE number = ? AND email = ? COLLATE NOCASE').bind(d.orderNumber, d.email).first();
  const id = randomId();
  const t = now();
  const statement = `Oznamuji, že odstupuji od kupní smlouvy č. ${d.orderNumber}${d.items ? ` (zboží: ${d.items})` : ' (celá objednávka)'}.${d.account ? ` Účet pro vrácení peněz: ${d.account}.` : ''}`;
  await env.DB.prepare('INSERT INTO withdrawals (id, order_id, order_number, name, email, items, statement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, order?.id ?? null, d.orderNumber, d.name, d.email, d.items, statement, t).run();
  const when = new Date(t).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
  await sendEmail(env, {
    to: d.email, subject: `Potvrzení přijetí odstoupení od smlouvy ${d.orderNumber}`, related: `withdrawal:${id}`,
    body: `<p>Dobrý den, ${esc(d.name)},</p><p>potvrzujeme, že jsme <strong>${when}</strong> přijali vaše odstoupení od smlouvy:</p><blockquote>${esc(statement)}</blockquote>
<p>Hodinky nám prosím zašlete do 14 dnů. Peníze vrátíme do 14 dnů od odstoupení, nejdříve však po obdržení hodinek nebo dokladu o jejich odeslání. Podrobnosti: <a href="${new URL(request.url).origin}/returns">Odstoupení od smlouvy a vrácení zboží</a>.</p>`,
  });
  await env.DB.prepare('UPDATE withdrawals SET confirmation_sent_at=? WHERE id=?').bind(now(), id).run();
  await sendEmail(env, { to: ownerEmail(env), subject: `Odstoupení od smlouvy ${d.orderNumber}`, related: `withdrawal:${id}`, body: `<p>${esc(d.name)} (${esc(d.email)})${order ? '' : ' – <strong>objednávka s tímto číslem a e-mailem nenalezena, ověřte ručně</strong>'}</p><p>${esc(statement)}</p>` });
  await audit(env, 'zakaznik', 'odstoupeni', 'withdrawal', id, { order: d.orderNumber });
  return json({ ok: true, receivedAt: when }, 201);
});
