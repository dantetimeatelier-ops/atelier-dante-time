// Odesílání e-mailů. Bez nastaveného poskytovatele se e-maily jen uloží
// do databáze a majitel je vidí v administraci (nic se neodešle).
import { randomId, now } from './db.js';
import { SITE } from '../src/site.mjs';

// Černozlatý vzhled Dante Time. Tabulky a inline styly kvůli e-mailovým klientům (Gmail, Outlook, Apple Mail),
// šířka max. 600 px, na mobilu přes celou obrazovku.
const wrap = (title, body, lang = 'cs') => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${title}</title>
<style>a{color:#c8a24a}h1,h2{font-family:Georgia,'Times New Roman',serif;font-weight:normal;color:#f2f2f2}
@media (max-width:620px){.dt-card{padding:24px 18px!important}.dt-outer{padding:12px 8px!important}.dt-h1{font-size:24px!important}}</style></head>
<body style="margin:0;padding:0;background:#070707;color:#f2f2f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#070707" style="background:#070707"><tr><td class="dt-outer" align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" style="padding:6px 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:14px;letter-spacing:.38em;color:#c8a24a;text-transform:uppercase">Dante&nbsp;Time</td></tr>
<tr><td class="dt-card" bgcolor="#111111" style="background:#111111;border:1px solid #2a2418;border-top:2px solid #c8a24a;border-radius:18px;padding:34px 32px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#e6e6e6">${body}</td></tr>
<tr><td align="center" style="padding:22px 8px 8px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8c8c8c">${SITE.name}<br><a href="mailto:${SITE.email}" style="color:#c8a24a;text-decoration:none">${SITE.email}</a> · <a href="${SITE.origin}" style="color:#c8a24a;text-decoration:none">${SITE.origin.replace('https://', '')}</a>${SITE.instagram ? ` · <a href="${SITE.instagram}" style="color:#c8a24a;text-decoration:none">Instagram</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;

// Přílohy ze statických souborů webu (např. PDF obchodních podmínek). V Cloudflare Pages je čteme přímo
// z nasazené verze (env.ASSETS); jinak Resend soubor stáhne sám z veřejné adresy.
async function loadAttachments(env, list = []) {
  const out = [];
  for (const a of list) {
    const url = `${SITE.origin}${a.path}`;
    try {
      const res = env.ASSETS ? await env.ASSETS.fetch(new Request(url)) : null;
      if (res?.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        out.push({ filename: a.filename, content: btoa(bin) });
        continue;
      }
    } catch { /* záložní cesta níže */ }
    out.push({ filename: a.filename, path: url });
  }
  return out;
}

/**
 * attachments: [{ filename, path }] – soubory webu (cesta od kořene).
 * fallbackBody: pokud odeslání s přílohami selže, odešle se tento text bez příloh (zákazník e-mail dostane vždy).
 */
export async function sendEmail(env, { to, subject, body, related, replyTo, attachments, fallbackBody, lang }) {
  const mode = env.SHOP_MODE || 'preview';
  const subj = mode === 'test' ? `[TEST] ${subject}` : subject;
  const html = wrap(subj, body, lang);
  const id = randomId();
  const note = attachments?.length ? `<!-- přílohy: ${attachments.map((a) => a.path).join(', ')} -->` : '';
  await env.DB.prepare('INSERT INTO emails (id, to_addr, subject, html, status, related) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, to, subj, html + note, 'queued', related ?? null).run();

  if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await env.DB.prepare("UPDATE emails SET status='stored' WHERE id=?").bind(id).run();
    return { stored: true };
  }
  const post = async (payload) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: subj, reply_to: replyTo || SITE.email, ...payload }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.message || `HTTP ${res.status}`);
    return out;
  };
  try {
    let out;
    try {
      out = await post({ html, ...(attachments?.length ? { attachments: await loadAttachments(env, attachments) } : {}) });
    } catch (e) {
      if (!attachments?.length || !fallbackBody) throw e;
      // Přílohy se nepodařilo připojit → dokumenty přímo v textu e-mailu, aby je zákazník měl vždy
      out = await post({ html: wrap(subj, fallbackBody, lang) });
      await env.DB.prepare('UPDATE emails SET error=? WHERE id=?').bind(`Přílohy nešly připojit (${String(e.message).slice(0, 200)}), odesláno s dokumenty v textu`, id).run();
    }
    await env.DB.prepare("UPDATE emails SET status='sent', provider_id=?, sent_at=? WHERE id=?").bind(out.id || null, now(), id).run();
    return { sent: true };
  } catch (e) {
    await env.DB.prepare("UPDATE emails SET status='failed', error=? WHERE id=?").bind(String(e.message).slice(0, 300), id).run();
    return { failed: true };
  }
}

export const ownerEmail = (env) => env.OWNER_EMAIL || SITE.email;
