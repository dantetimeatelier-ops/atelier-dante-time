// Vzhled faktury / zálohy / dobropisu (veřejná stránka dokladu i náhled před vystavením v administraci).
// Vzhled podle vzoru majitele: bílé pozadí, zlaté logo, minimalistický styl, poděkování a slogan.
import { OPERATOR, SITE, missing, verify, docBank } from '../src/site.mjs';
import { formatCzk } from '../src/shop/format.mjs';
import { formatEur } from '../src/shop/eu.mjs';
import { esc } from '../src/layout.mjs';
import { spdString } from '../src/shop/spd.mjs';
import { invoiceTotals } from '../src/shop/invoice.mjs';
import { qrSvg } from './qr.js';

const d = (iso) => (iso ? new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' }) : '');
const PAY = { bank_transfer: 'bankovní převod', card: 'platební karta', cod: 'dobírka', cash: 'hotově' };
const TITLE = { faktura: 'Faktura', zalohova: 'Zálohová faktura', dobropis: 'Opravný doklad' };


export const INVOICE_CSP = "default-src 'self'; style-src 'self'; img-src 'self' data:; script-src 'none'; frame-ancestors 'none'; base-uri 'none'";

/** HTML dokladu. paid = součet přijatých plateb, related = { number } navázaného dokladu, preview = náhled před vystavením. */
export function renderInvoicePage(inv, { paid = 0, related = null, preview = false } = {}) {
  const kind = inv.kind || 'faktura';
  const { items, total } = invoiceTotals(JSON.parse(inv.items || '[]'));
  const advance = inv.advance_deducted || 0;
  const due = total - advance;
  // Přijaté platby (i částečné) – zbývá uhradit jen rozdíl
  const left = kind === 'dobropis' ? 0 : Math.max(0, due - paid);
  const v = (key, label) => esc(OPERATOR[key]) || missing(label);
  const bank = docBank(inv); // účet uložený u faktury – pozdější změna účtu ji neovlivní
  const isTransfer = inv.payment_method === 'bank_transfer';
  // QR platba jen u neuhrazeného dokladu v Kč placeného převodem
  let qr = '';
  if (!preview && !inv.paid_at && !inv.cancelled_at && kind !== 'dobropis' && isTransfer && left > 0 && inv.pay_currency !== 'EUR' && /^\d{1,10}$/.test(String(inv.variable_symbol || ''))) {
    try { qr = qrSvg(spdString({ iban: bank.iban, amount: left, vs: inv.variable_symbol, message: `${TITLE[kind]} ${inv.number}`, recipient: SITE.name }), { label: 'QR platba' }); } catch { qr = ''; }
  }
  const title = `${preview ? 'Náhled – ' : ''}${TITLE[kind] || 'Faktura'}${inv.cancelled_at ? ' – STORNOVÁNO' : ''}${inv.mode === 'test' ? ' (TEST – neplatný doklad)' : ''}`;
  const status = inv.cancelled_at ? `Stornováno${inv.cancel_reason ? ` (${esc(inv.cancel_reason)})` : ''}` : kind === 'dobropis' ? (inv.paid_at ? 'Vráceno' : 'K vrácení') : inv.paid_at ? (paid > due ? `Uhrazeno (přeplatek ${formatCzk(paid - due)})` : 'Uhrazeno') : paid > 0 ? `Částečně uhrazeno – uhrazeno ${formatCzk(paid)}, zbývá ${formatCzk(left)}` : 'Neuhrazeno';
  const metaRow = (l, val) => (val ? `<tr><th>${l}</th><td>${val}</td></tr>` : '');
  const page = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(TITLE[kind] || 'Faktura')} ${esc(inv.number)}</title><link rel="stylesheet" href="/assets/invoice.css"></head><body>
<main class="inv${inv.cancelled_at ? ' void' : ''}">${preview ? '<p class="preview-note">NÁHLED – doklad ještě není vystavený. Číslo, variabilní symbol a QR platba se doplní při vystavení.</p>' : ''}
<header class="top"><div class="logo"><img src="/img/logo-faktura.webp" width="72" height="106" alt="Dante Time"><span>${esc(SITE.name)}</span></div>
<div class="doc"><h1>${esc(title)}</h1><p>č. ${esc(inv.number)}</p></div></header>
<section class="parties">
<div class="from"><h2>Dodavatel</h2><p><strong>${esc(SITE.name)}</strong><br>${v('name', 'jméno')}<br>${v('address', 'adresa').replace(', Česká republika', '').replace(/, /, '<br>')}<br>IČO: ${v('ico', 'IČO')}<br><!--email_off-->${esc(SITE.email)}<!--/email_off--><br><b>${OPERATOR.vatPayer === false ? 'Neplátce DPH – DPH není účtováno' : OPERATOR.vatPayer === true ? `DIČ: ${v('dic', 'DIČ')}` : verify('plátce / neplátce DPH')}</b><br><small>${OPERATOR.register ? esc(OPERATOR.register.cs) : verify('zápis v živnostenském rejstříku')}</small></p></div>
<div class="to"><h2>Odběratel</h2><p><strong>${esc(inv.buyer_company || inv.buyer_name)}</strong><br>${inv.buyer_company ? `${esc(inv.buyer_name)}<br>` : ''}${inv.buyer_street ? `${esc(inv.buyer_street)}<br>` : ''}${esc(inv.buyer_zip || '')} ${esc(inv.buyer_city || '')}${inv.buyer_ico ? `<br>IČO: ${esc(inv.buyer_ico)}` : ''}${inv.buyer_dic ? `<br>DIČ: ${esc(inv.buyer_dic)}` : ''}</p>
<p class="ids">${inv.watch_model ? `Model: ${esc(inv.watch_model)}<br>` : ''}${inv.serial_ref ? `Serial no: ${esc(inv.serial_ref)}<br>` : ''}Číslo ${kind === 'dobropis' ? 'dokladu' : 'faktury'}: ${esc(inv.number)}${related ? `<br>${kind === 'dobropis' ? 'Opravuje fakturu' : 'Vyúčtování zálohy'}: ${esc(related.number)}` : ''}</p></div>
</section>
<table class="items"><thead><tr><th>Popis</th><th>Množství</th><th>Cena</th></tr></thead><tbody>
${items.map((i) => `<tr><td>${esc(i.text)}</td><td>${i.qty}</td><td>${formatCzk(i.qty * i.price)}</td></tr>`).join('')}
</tbody></table>
<table class="sum"><tbody>
<tr><th>Mezisoučet</th><td>${formatCzk(total)}</td></tr>
${advance ? `<tr><th>Uhrazená záloha${related ? ` (${esc(related.number)})` : ''}</th><td>−${formatCzk(advance)}</td></tr>` : ''}
<tr class="grand"><th>${kind === 'dobropis' ? 'Celkem k vrácení' : advance ? 'Zbývá uhradit' : 'Celkem'}</th><td>${formatCzk(kind === 'dobropis' ? -total : due)}</td></tr>
${inv.pay_currency === 'EUR' && inv.pay_amount_cents ? `<tr><th>Uhrazeno v EUR (kurz ${esc(inv.eur_rate)} Kč/€)</th><td>${formatEur(inv.pay_amount_cents)}</td></tr>` : ''}
</tbody></table>
<section class="meta"><p class="state">Stav platby : <b>${status}</b></p><table><tbody>
${metaRow('Datum vystavení', d(inv.issued_at))}${OPERATOR.vatPayer && kind !== 'zalohova' ? metaRow('Datum uskutečnění plnění', d(inv.taxable_date)) : '' /* neplátce DPH: DUZP se na dokladu neuvádí */}
${metaRow(inv.paid_at ? 'Uhrazeno dne' : 'Datum splatnosti', d(inv.paid_at || inv.due_date))}${metaRow('Forma úhrady', esc(PAY[inv.payment_method] || inv.payment_method))}
${isTransfer ? `${metaRow('Variabilní symbol', esc(inv.variable_symbol || ''))}${metaRow('Bankovní účet', `${esc(bank.account)}<br>IBAN ${esc(bank.ibanPretty)}, BIC ${esc(bank.bic)}`)}` : ''}
</tbody></table></section>
${qr ? `<div class="qr-pay">${qr}<p>QR platba – naskenujte v bankovní aplikaci<br>(účet ${esc(bank.account)}, VS ${esc(inv.variable_symbol)}, ${formatCzk(left)})</p></div>` : ''}
${kind === 'zalohova' ? '<p class="note">Zálohová faktura je výzvou k platbě zálohy. Po zaplacení celé ceny vystavíme fakturu, ve které bude záloha odečtena.</p>' : ''}
${inv.note ? `<p class="note">${esc(inv.note)}</p>` : ''}
<footer class="thanks"><p>Děkujeme za nákup a projevenou důvěru.<br>Na konci roku bude část zisku z produkce Dante Time věnována na podporu útulku pro zvířata.<br>Přejeme vám, aby vám hodinky dělaly radost po dlouhá léta a staly se součástí vašeho času.</p>
<p>S úctou,</p><p class="slogan">Dante Time – druhý život času</p></footer>
${preview ? '' : '<p class="print">Uložení do PDF: Sdílet → Tisk → Uložit do Souborů (iPhone) nebo Ctrl+P → Uložit jako PDF (počítač).</p>'}
</main></body></html>`;
  return page;
}
