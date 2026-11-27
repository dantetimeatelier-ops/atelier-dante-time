// Statické stránky e-shopu: košík s objednávkou a online odstoupení od smlouvy
import { hero } from '../layout.mjs';
import { PAGES } from '../site.mjs';
import { TERMS } from '../terms.mjs';
import { sortedCountries, countryName } from '../shop/eu.mjs';

const T = (lang, cs, en) => (lang === 'cs' ? cs : en);

export function cart(lang) {
  const L = (cs, en) => T(lang, cs, en);
  return {
    key: 'cart',
    title: L('Košík a objednávka', 'Cart &amp; checkout'),
    description: L('Nákupní košík Atelier Dante Time.', 'Atelier Dante Time shopping cart.'),
    noindex: true,
    scripts: ['/assets/checkout.js'],
    body: `${hero({ eyebrow: L('Nákup', 'Shopping'), title: L('Košík', 'Cart'), small: true })}
<section class="section" style="padding-top:8px"><div class="wrap" data-checkout data-lang="${lang}">
  <div data-cart-empty hidden class="empty"><p>${L('Košík je prázdný.', 'Your cart is empty.')}</p><a class="btn" href="${PAGES.collection[lang]}">${L('Prohlédnout kolekci', 'View the collection')}</a></div>
  <div data-cart-disabled hidden class="notice">${L('Nákup v e-shopu zatím není spuštěn. O hodinky můžete projevit zájem na stránce konkrétního kusu.', 'Online purchasing is not open yet. You can enquire on the page of each piece.')}</div>
  <form data-cart-form hidden class="split" novalidate>
    <div class="form">
      <div class="cart-items" data-cart-items></div>
      <fieldset><legend>${L('Země doručení a měna', 'Delivery country and currency')}</legend>
        <div class="row">
          <label>${L('Země doručení', 'Delivery country')}<select name="country" data-country autocomplete="country">${sortedCountries(lang).map((c) => `<option value="${c}"${c === 'CZ' ? ' selected' : ''}>${countryName(c, lang)}</option>`).join('')}</select></label>
          <label>${L('Měna platby', 'Payment currency')}<select name="currency" data-currency><option value="CZK">CZK (Kč)</option></select></label>
        </div>
        <p class="doc-meta" data-eu-note hidden>${L('Zahraniční objednávky hradíte předem. Ceny hodinek jsou stanoveny v Kč, v eurech se přepočtou aktuálním kurzem ateliéru a zaokrouhlí nahoru na celé euro.', 'International orders are paid in advance. Prices are set in CZK; in euros they are converted at the atelier rate and rounded up to a whole euro.')}</p>
      </fieldset>
      <fieldset><legend>${L('Doprava', 'Shipping')}</legend><div data-shipping></div>
        <p class="notice" data-insured-note hidden style="margin-top:10px">${L('Hodinky vyšší hodnoty posíláme pouze pojištěnou přepravou na plnou hodnotu, případně je předáme osobně po domluvě.', 'Higher-value watches are sent only by fully insured shipment, or handed over personally by arrangement.')}</p>
        <p class="notice" data-no-shipping hidden style="margin-top:10px">${L('Pro tuto zemi nebo hodnotu hodinek vám zásilku připravíme individuálně – napište nám, nebo zvolte osobní předání.', 'For this country or watch value we arrange shipping individually – contact us, or choose personal handover.')} <a href="${'/kontakt'}">${L('Kontakt', 'Contact')}</a></p>
        <div data-pickup hidden style="margin-top:12px">
          <button class="btn ghost" type="button" data-pick-point>${L('Vybrat výdejní místo', 'Choose pickup point')}</button>
          <p class="doc-meta" data-pickup-label style="margin-top:8px"></p>
          <label data-pickup-manual hidden>${L('Výdejní místo (název a adresa)', 'Pickup point (name and address)')}<input type="text" name="pickupPointName" maxlength="200"></label>
          <input type="hidden" name="pickupPointId">
        </div>
      </fieldset>
      <fieldset><legend>${L('Platba', 'Payment')}</legend><div data-payment></div></fieldset>
      <fieldset><legend data-address-legend>${L('Kontaktní a fakturační údaje', 'Contact &amp; billing details')}</legend>
        <div class="form">
          <div class="row"><label>${L('Jméno a příjmení', 'Full name')}<input type="text" name="name" autocomplete="name" required maxlength="120"></label>
          <label>E-mail<input name="email" type="email" inputmode="email" autocomplete="email" spellcheck="false" required maxlength="200"></label></div>
          <label>${L('Telefon (pro dopravce)', 'Phone (for the carrier)')}<input name="phone" type="tel" autocomplete="tel" required maxlength="40"></label>
          <label>${L('Ulice a číslo', 'Street')}<input type="text" name="street" autocomplete="address-line1" required maxlength="200"></label>
          <div class="row"><label>${L('Město', 'City')}<input type="text" name="city" autocomplete="address-level2" required maxlength="120"></label>
          <label>${L('PSČ', 'Postcode')}<input type="text" name="zip" autocomplete="postal-code" autocapitalize="characters" required maxlength="12"></label></div>
          <details><summary class="doc-meta">${L('Nakupuji na firmu', 'Buying as a company')}</summary>
            <div class="row" style="margin-top:10px"><label>${L('Firma', 'Company')}<input type="text" name="company" maxlength="200"></label><label>IČO<input type="text" name="ico" maxlength="20"></label></div>
            <label>DIČ<input type="text" name="dic" maxlength="20"></label>
          </details>
          <label>${L('Poznámka (nepovinné)', 'Note (optional)')}<textarea name="note" maxlength="1000" style="min-height:80px"></textarea></label>
          <label class="hp" aria-hidden="true">Web<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>
      </fieldset>
    </div>
    <aside class="card buybox">
      <h2 style="font-size:26px">${L('Souhrn', 'Summary')}</h2>
      <div class="summary" data-summary></div>
      <label class="check" style="margin-top:16px"><input type="checkbox" name="terms" required> <span>${L('Souhlasím s <a href="/terms" target="_blank" style="color:var(--gold-2)">obchodními podmínkami</a> a beru na vědomí <a href="/privacy" target="_blank" style="color:var(--gold-2)">zásady ochrany osobních údajů</a>.', 'I agree to the <a href="/en/terms" target="_blank" style="color:var(--gold-2)">terms and conditions</a> and acknowledge the <a href="/en/privacy" target="_blank" style="color:var(--gold-2)">privacy policy</a>.')}</span></label>
      <p class="doc-meta" style="margin-top:10px">${L(`Hotové hodinky můžete jako spotřebitel vrátit do ${TERMS.withdrawalDays} dnů od převzetí. <a href="/returns" style="color:var(--gold-2)">Podmínky</a>`, `As a consumer you can return finished watches within ${TERMS.withdrawalDays} days of receipt. <a href="/en/withdrawal" style="color:var(--gold-2)">Details</a>`)}</p>
      <button class="btn solid block" type="submit" style="margin-top:12px">${L('Objednávka zavazující k platbě', 'Order with obligation to pay')}</button>
      <div class="notice" data-status hidden role="alert" style="margin-top:12px"></div>
      <p class="secure-note">${L('Zabezpečené spojení · Platební údaje karty zadáváte jen u platební brány, k nám se nedostanou.', 'Secure connection · Card details are entered only at the payment gateway and never reach us.')}</p>
    </aside>
    <div class="mobile-total" aria-hidden="true"><span><span class="doc-meta">${L('Celkem', 'Total')}</span><strong data-mobile-total>–</strong></span><button class="btn solid" type="button" data-mobile-go tabindex="-1">${L('K dokončení', 'Checkout')}</button></div>
  </form>
</div></section>`,
  };
}

export function withdrawalForm() {
  return {
    key: 'withdrawal',
    title: 'Odstoupit od smlouvy',
    description: 'Online funkce pro odstoupení od kupní smlouvy uzavřené v e-shopu Atelier Dante Time.',
    scripts: ['/assets/withdrawal.js'],
    body: `${hero({ eyebrow: 'Odstoupení od smlouvy', title: 'Odstoupit od smlouvy', lead: 'Zde můžete od kupní smlouvy uzavřené v našem e-shopu odstoupit online. Přijetí odstoupení vám obratem potvrdíme e-mailem.', small: true })}
<section class="section" style="padding-top:8px"><div class="wrap"><div class="card" style="max-width:720px">
  <form class="form" data-withdrawal-form novalidate>
    <div data-step="1">
      <div class="row"><label>Jméno a příjmení<input type="text" name="name" autocomplete="name" required maxlength="120"></label>
      <label>E-mail použitý při objednávce<input name="email" type="email" inputmode="email" autocomplete="email" spellcheck="false" required maxlength="200"></label></div>
      <label style="margin-top:14px">Číslo objednávky<input type="text" name="orderNumber" required maxlength="20" placeholder="např. 2026-0001"></label>
      <label style="margin-top:14px">Zboží, kterého se odstoupení týká (nepovinné, jinak celá objednávka)<input type="text" name="items" maxlength="500"></label>
      <label style="margin-top:14px">Číslo účtu pro vrácení peněz (nepovinné)<input type="text" name="account" maxlength="50"></label>
      <label class="hp" aria-hidden="true">Web<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn solid" type="button" data-next style="margin-top:16px">Odstoupit od smlouvy</button>
    </div>
    <div data-step="2" hidden>
      <p class="notice">Zkontrolujte prosím údaje. Odesláním potvrdíte, že <strong>odstupujete od kupní smlouvy</strong>.</p>
      <div data-review class="prose"></div>
      <div class="cta-row" style="justify-content:flex-start">
        <button class="btn solid" type="submit">Potvrdit odstoupení od smlouvy</button>
        <button class="btn ghost" type="button" data-back>Upravit údaje</button>
      </div>
    </div>
    <div class="notice" data-status hidden role="status" aria-live="polite"></div>
  </form>
  <p class="doc-meta" style="margin-top:20px">Odstoupit můžete i e-mailem nebo dopisem. Podrobnosti a vzorový formulář: <a href="/returns" style="color:var(--gold-2)">Odstoupení od smlouvy a vrácení zboží</a>.</p>
</div></div></section>`,
  };
}
