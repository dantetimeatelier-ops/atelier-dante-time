// Odesílání e-mailů. Bez nastaveného poskytovatele se e-maily jen uloží
// do databáze a majitel je vidí v administraci (nic se neodešle).
import { randomId, now } from './db.js';
import { SITE } from '../src/site.mjs';

const wrap = (title, body) => `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#1a1a1a">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="text-align:center;letter-spacing:.2em;text-transform:uppercase;font-size:13px;color:#8a6d2a;margin-bottom:16px">${SITE.name}</div>
<div style="background:#fff;border-radius:12px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6">${body}</div>
<p style="font-size:12px;color:#777;text-align:center;margin-top:16px">${SITE.name} · <a href="mailto:${SITE.email}" style="color:#8a6d2a">${SITE.email}</a> · <a href="${SITE.origin}" style="color:#8a6d2a">${SITE.origin.replace('https://', '')}</a></p>
</div></body></html>`;

export async function sendEmail(env, { to, subject, body, related, replyTo }) {
  const mode = env.SHOP_MODE || 'preview';
  const subj = mode === 'test' ? `[TEST] ${subject}` : subject;
  const html = wrap(subj, body);
  const id = randomId();
  await env.DB.prepare('INSERT INTO emails (id, to_addr, subject, html, status, related) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, to, subj, html, 'queued', related ?? null).run();

  if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await env.DB.prepare("UPDATE emails SET status='stored' WHERE id=?").bind(id).run();
    return { stored: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: subj, html, reply_to: replyTo || SITE.email }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.message || `HTTP ${res.status}`);
    await env.DB.prepare("UPDATE emails SET status='sent', provider_id=?, sent_at=? WHERE id=?").bind(out.id || null, now(), id).run();
    return { sent: true };
  } catch (e) {
    await env.DB.prepare("UPDATE emails SET status='failed', error=? WHERE id=?").bind(String(e.message).slice(0, 300), id).run();
    return { failed: true };
  }
}

export const ownerEmail = (env) => env.OWNER_EMAIL || SITE.email;
