// Stránka objednávky pro zákazníka (tajný odkaz z e-mailu)
import { handle } from '../../server/http.js';
import { page } from '../../server/render.js';
import { releaseExpired } from '../../server/db.js';
import { qrSvg } from '../../server/qr.js';
import { spdString, isValidIban } from '../../src/shop/spd.mjs';
import { epcString, formatEur } from '../../src/shop/eu.mjs';
import { OPERATOR, SITE, missing, docBank } from '../../src/site.mjs';
import { formatCzk, ORDER_STATUS, SHIPPING, PAYMENT } from '../../src/shop/format.mjs';
import { hero, esc } from '../../src/layout.mjs';

export const onRequestGet = handle(async ({ env, params }) => {
  await releaseExpired(env);
  const token = String(params.token || '');
  const o = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await env.DB.prepare('SELECT * FROM orders WHERE public_token = ?').bind(token).first() : null;
  if (!o) return page(env, { lang: 'cs', title: 'Objednávka nenalezena', description: '', path: '/objednavka', noindex: true, body: hero({ title: 'Objednávka nenalezena', lead: `Zkontrolujte prosím odkaz z e-mailu nebo napište na ${SITE.email}.` }) }, 404, 'no-store');
  const { results: items } = await env.DB.prepare('SELECT title, price_czk FROM order_items WHERE order_id = ?').bind(o.id).all();
  const invoice = await env.DB.prepare('SELECT number, public_token FROM invoices WHERE order_id = ? AND cancelled_at IS NULL').bind(o.id).first();

  let payment = '';
  if (o.status === 'awaiting_payment' && o.payment_method === 'bank_transfer') {
    const bank = docBank(o); // účet uložený u objednávky
    const iban = bank.iban;
    const eur = o.pay_currency === 'EUR';
    let qr = '';
    try {
      qr = eur
        ? qrSvg(epcString({ bic: bank.bic, name: OPERATOR.accountHolder, iban, cents: o.pay_amount_cents, reference: `VS ${o.variable_symbol} ${o.number}` }), { label: 'SEPA QR' })
        : qrSvg(spdString({ iban, amount: o.total, vs: o.variable_symbol, message: `Objednavka ${o.number}`, recipient: SITE.name }), { label: 'QR platba' });
    } catch { qr = ''; }
    const due = new Date(o.reserved_until).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    payment = `<div class="card"><h2>Platba převodem / Bank transfer</h2>
<div class="pay-grid"><table class="specs"><tbody>
<tr><th>Příjemce / Beneficiary</th><td>${esc(OPERATOR.accountHolder)}</td></tr>
${eur ? `<tr><th>IBAN</th><td>${esc(bank.ibanPretty)}</td></tr><tr><th>BIC / SWIFT</th><td>${esc(bank.bic)}</td></tr>`
    : `<tr><th>Číslo účtu</th><td>${esc(bank.account)}</td></tr><tr><th>IBAN</th><td>${esc(bank.ibanPretty)}</td></tr>`}
<tr><th>Částka / Amount</th><td><strong>${eur ? formatEur(o.pay_amount_cents) : formatCzk(o.total)}</strong>${eur ? `<br><span class="doc-meta">${formatCzk(o.total)}, kurz ${esc(o.eur_rate)} Kč/€</span>` : ''}</td></tr>
<tr><th>${eur ? 'Zpráva pro příjemce / Reference' : 'Variabilní symbol'}</th><td><strong>${eur ? `VS ${esc(o.variable_symbol)} ${esc(o.number)}` : esc(o.variable_symbol)}</strong></td></tr>
<tr><th>Splatnost / Due</th><td>${due}</td></tr>
</tbody></table><div>${qr}<p class="doc-meta" style="text-align:center">${eur ? 'SEPA QR – naskenujte v bankovní aplikaci' : 'Naskenujte v bankovní aplikaci'}</p></div></div>
<p class="doc-meta">Hodinky jsou pro vás rezervovány do data splatnosti. Pokud platba nedorazí, rezervace se zruší. Případné poplatky banky plátce hradí plátce.</p></div>`;
  }
  const rows = items.map((i) => `<tr><th>${esc(i.title)}</th><td>${formatCzk(i.price_czk)}</td></tr>`).join('');
  const body = `${hero({ eyebrow: `Objednávka ${esc(o.number)}`, title: ORDER_STATUS[o.status] || o.status, small: true })}
<section class="section" style="padding-top:8px"><div class="wrap split">
  <div style="display:grid;gap:18px">${payment}
    <div class="card"><h2>Shrnutí</h2><table class="specs"><tbody>${rows}
      <tr><th>Doprava – ${esc(SHIPPING[o.shipping_method]?.cs || o.shipping_method)}${o.pickup_point_name ? `<br><span class="doc-meta">${esc(o.pickup_point_name)}</span>` : ''}</th><td>${formatCzk(o.shipping_price)}</td></tr>
      ${o.cod_fee ? `<tr><th>Dobírka</th><td>${formatCzk(o.cod_fee)}</td></tr>` : ''}
      <tr><th>Platba</th><td>${esc(PAYMENT[o.payment_method]?.cs || o.payment_method)}</td></tr>
      <tr><th><strong>Celkem</strong></th><td><strong>${formatCzk(o.total)}</strong></td></tr>
    </tbody></table>
    ${o.tracking_number ? `<p style="margin-top:14px">Číslo zásilky: <strong>${esc(o.tracking_number)}</strong></p>` : ''}
    ${invoice ? `<p style="margin-top:14px"><a class="btn ghost" href="/faktura/${esc(invoice.public_token)}">Faktura ${esc(invoice.number)}</a></p>` : ''}
    ${o.payment_method === 'cod' && o.status === 'awaiting_payment' ? '<p class="notice" style="margin-top:14px">Platíte dobírkou při převzetí. Hodinky jsou pro vás rezervovány, o odeslání vás budeme informovat.</p>' : ''}</div>
  </div>
  <aside class="card"><h2 style="font-size:24px">Potřebujete pomoc?</h2><p>Napište na <a href="mailto:${SITE.email}">${SITE.email}</a> a uveďte číslo objednávky ${esc(o.number)}.</p>
    <p class="doc-meta">Hotové hodinky můžete jako spotřebitel vrátit do 14 dnů od převzetí.</p>
    <a class="btn ghost block" href="/odstoupeni">Odstoupit od smlouvy</a></aside>
</div></section>`;
  return page(env, { lang: 'cs', title: `Objednávka ${o.number}`, description: 'Stav objednávky', path: `/objednavka/${token}`, noindex: true, body }, 200, 'no-store');
});
