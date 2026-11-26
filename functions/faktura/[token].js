// Faktura (tisk / uložení do PDF z prohlížeče). Odkaz je tajný, stránka se neindexuje.
import { handle, html } from '../../server/http.js';
import { OPERATOR, SITE, missing, verify, docBank } from '../../src/site.mjs';
import { formatCzk } from '../../src/shop/format.mjs';
import { formatEur } from '../../src/shop/eu.mjs';
import { esc } from '../../src/layout.mjs';
import { spdString } from '../../src/shop/spd.mjs';
import { qrSvg } from '../../server/qr.js';

const d = (iso) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : '');
const PAY = { bank_transfer: 'bankovní převod', card: 'platební karta', cod: 'dobírka', cash: 'hotově' };

export const onRequestGet = handle(async ({ env, params }) => {
  const token = String(params.token || '');
  const inv = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await env.DB.prepare('SELECT * FROM invoices WHERE public_token = ?').bind(token).first() : null;
  if (!inv) return html('<p>Faktura nenalezena.</p>', 404, { 'Cache-Control': 'no-store' });
  const items = JSON.parse(inv.items || '[]');
  const v = (key, label) => esc(OPERATOR[key]) || missing(label);
  const vatLine = OPERATOR.vatPayer === true ? `DIČ: ${v('dic', 'DIČ')}` : OPERATOR.vatPayer === false ? 'Není plátcem DPH.' : verify('plátce / neplátce DPH');
  const bank = docBank(inv); // účet uložený u faktury – pozdější změna účtu ji neovlivní
  // QR platba jen u nezaplacené faktury v Kč převodem
  let qr = '';
  if (!inv.paid_at && !inv.cancelled_at && inv.payment_method === 'bank_transfer' && inv.pay_currency !== 'EUR' && /^\d{1,10}$/.test(String(inv.variable_symbol || ''))) {
    try { qr = qrSvg(spdString({ iban: bank.iban, amount: inv.total, vs: inv.variable_symbol, message: `Faktura ${inv.number}`, recipient: SITE.name }), { label: 'QR platba' }); } catch { qr = ''; }
  }
  const title = inv.cancelled_at ? 'Faktura – STORNOVÁNA' : inv.mode === 'test' ? 'Faktura (TEST – neplatný doklad)' : 'Faktura';
  const page = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Faktura ${esc(inv.number)}</title><link rel="stylesheet" href="/assets/invoice.css"></head><body>
<main class="inv">
<header><div><h1>${title}</h1><p>č. ${esc(inv.number)}</p></div><div class="brand">${SITE.name}</div></header>
<section class="parties">
<div><h2>Dodavatel</h2><p><strong>${v('name', 'jméno / firma')}</strong> – ${esc(OPERATOR.tradeName || '')}<br>${v('address', 'adresa')}<br>IČO: ${v('ico', 'IČO')}<br>${vatLine}<br>${OPERATOR.register ? esc(OPERATOR.register.cs) : verify('zápis v živnostenském rejstříku')}</p></div>
<div><h2>Odběratel</h2><p><strong>${esc(inv.buyer_company || inv.buyer_name)}</strong><br>${inv.buyer_company ? `${esc(inv.buyer_name)}<br>` : ''}${inv.buyer_street ? `${esc(inv.buyer_street)}<br>` : ''}${esc(inv.buyer_zip || '')} ${esc(inv.buyer_city || '')}${inv.buyer_ico ? `<br>IČO: ${esc(inv.buyer_ico)}` : ''}${inv.buyer_dic ? `<br>DIČ: ${esc(inv.buyer_dic)}` : ''}</p></div>
</section>
<table class="meta"><tbody>
<tr><th>Datum vystavení</th><td>${d(inv.issued_at)}</td><th>Variabilní symbol</th><td>${esc(inv.variable_symbol || '')}</td></tr>
<tr><th>Datum uskutečnění plnění</th><td>${d(inv.taxable_date)}</td><th>Forma úhrady</th><td>${esc(PAY[inv.payment_method] || inv.payment_method)}</td></tr>
<tr><th>${inv.paid_at ? 'Uhrazeno dne' : 'Splatnost'}</th><td>${d(inv.paid_at || inv.due_date)}</td><th>Bankovní účet</th><td>${esc(bank.account)}<br>IBAN ${esc(bank.ibanPretty)}, BIC ${esc(bank.bic)}</td></tr>
</tbody></table>
<table class="items"><thead><tr><th>Položka</th><th>Cena</th></tr></thead><tbody>
${items.map((i) => `<tr><td>${esc(i.text)}</td><td>${formatCzk(i.price)}</td></tr>`).join('')}
</tbody><tfoot><tr><th>Celkem${OPERATOR.vatPayer === true ? ' včetně DPH' : ''}</th><th>${formatCzk(inv.total)}</th></tr>
${inv.pay_currency === 'EUR' && inv.pay_amount_cents ? `<tr><td>Uhrazeno v EUR (kurz ${esc(inv.eur_rate)} Kč/€)</td><td>${formatEur(inv.pay_amount_cents)}</td></tr>` : ''}
<tr><td colspan="2">${inv.paid_at ? 'Uhrazeno – neplaťte.' : 'K úhradě.'}</td></tr></tfoot></table>
${qr ? `<div class="qr-pay">${qr}<p>QR platba – naskenujte v bankovní aplikaci (účet ${esc(bank.account)}, VS ${esc(inv.variable_symbol)})</p></div>` : ''}
${inv.note ? `<p class="note">${esc(inv.note)}</p>` : ''}
${OPERATOR.vatPayer === true ? `<p class="note">${missing('rozpis DPH (základ, sazba, daň) – u plátce DPH povinný')}</p>` : ''}
<p class="print">Fakturu uložíte do PDF přes Sdílet → Tisk (iPhone) nebo Ctrl+P (počítač).</p>
</main></body></html>`;
  return html(page, 200, { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
});
