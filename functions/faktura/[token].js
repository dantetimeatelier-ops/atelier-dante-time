// Faktura k zaplacené objednávce (tisk / uložení do PDF z prohlížeče)
import { handle, html } from '../../server/http.js';
import { OPERATOR, SITE, missing } from '../../src/site.mjs';
import { formatCzk } from '../../src/shop/format.mjs';
import { esc } from '../../src/layout.mjs';

const d = (iso) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : '');

export const onRequestGet = handle(async ({ env, params }) => {
  const token = String(params.token || '');
  const o = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await env.DB.prepare('SELECT * FROM orders WHERE public_token = ? AND invoice_number IS NOT NULL').bind(token).first() : null;
  if (!o) return html('<p>Faktura nenalezena.</p>', 404, { 'Cache-Control': 'no-store' });
  const { results: items } = await env.DB.prepare('SELECT title, price_czk FROM order_items WHERE order_id = ?').bind(o.id).all();
  const v = (key, label) => esc(OPERATOR[key]) || missing(label);
  const vatLine = OPERATOR.vatPayer === true ? `DIČ: ${v('dic', 'DIČ')}` : OPERATOR.vatPayer === false ? 'Neplátce DPH' : missing('plátce / neplátce DPH');
  const page = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Faktura ${esc(o.invoice_number)}</title><link rel="stylesheet" href="/assets/invoice.css"></head><body>
<main class="inv">
<header><div><h1>Faktura ${o.mode === 'test' ? '(TEST – neplatný doklad)' : ''}</h1><p>č. ${esc(o.invoice_number)}</p></div><div class="brand">${SITE.name}</div></header>
<section class="parties">
<div><h2>Dodavatel</h2><p><strong>${v('name', 'jméno / firma')}</strong><br>${v('address', 'adresa')}<br>IČO: ${v('ico', 'IČO')}<br>${vatLine}<br>${v('register', 'zápis v rejstříku')}</p></div>
<div><h2>Odběratel</h2><p><strong>${esc(o.company || o.name)}</strong><br>${o.company ? `${esc(o.name)}<br>` : ''}${esc(o.billing_street)}<br>${esc(o.billing_zip)} ${esc(o.billing_city)}${o.company_ico ? `<br>IČO: ${esc(o.company_ico)}` : ''}${o.company_dic ? `<br>DIČ: ${esc(o.company_dic)}` : ''}</p></div>
</section>
<table class="meta"><tbody>
<tr><th>Datum vystavení</th><td>${d(o.invoice_issued_at)}</td><th>Objednávka</th><td>${esc(o.number)}</td></tr>
<tr><th>Datum uskutečnění plnění</th><td>${d(o.paid_at)}</td><th>Variabilní symbol</th><td>${esc(o.variable_symbol)}</td></tr>
<tr><th>Forma úhrady</th><td>${o.payment_method === 'card' ? 'platební karta' : 'bankovní převod'}</td><th>Stav</th><td>Uhrazeno</td></tr>
</tbody></table>
<table class="items"><thead><tr><th>Položka</th><th>Cena</th></tr></thead><tbody>
${items.map((i) => `<tr><td>${esc(i.title)}</td><td>${formatCzk(i.price_czk)}</td></tr>`).join('')}
<tr><td>Doprava</td><td>${formatCzk(o.shipping_price)}</td></tr>
</tbody><tfoot><tr><th>Celkem k úhradě</th><th>${formatCzk(o.total)}</th></tr><tr><td colspan="2">Uhrazeno – neplaťte.</td></tr></tfoot></table>
${OPERATOR.vatPayer === true ? `<p class="note">${missing('rozpis DPH (základ, sazba, daň) – u plátce DPH povinný; doplnit podle režimu')}</p>` : ''}
<p class="print">Fakturu uložíte do PDF přes Sdílet → Tisk (iPhone) nebo Ctrl+P (počítač).</p>
</main></body></html>`;
  return html(page, 200, { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
});
