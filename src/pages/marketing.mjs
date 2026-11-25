// Prezentační stránky (CZ + EN). Texty vycházejí z původního webu.
import { SITE, PAGES } from '../site.mjs';
import { hero, esc } from '../layout.mjs';

const T = (lang, cs, en) => (lang === 'cs' ? cs : en);
const brands = SITE.brands.map((b) => `<strong>${b}</strong>`).join(', ');

export function home(lang) {
  const L = (cs, en) => T(lang, cs, en);
  return {
    key: 'home',
    title: '',
    description: L(
      'Atelier Dante Time – český hodinářský ateliér. Unikátní renovované mechanické hodinky, servis, renovace a zakázkové sestavy s doživotní garancí pravosti originálních dílů.',
      'Atelier Dante Time – Czech watch atelier. Unique restored mechanical watches, service, restoration and custom builds with a lifetime authenticity guarantee on original parts.'),
    head: `<link rel="preload" as="image" href="/img/hero-800.webp" media="(max-width: 880px)">
<link rel="preload" as="image" href="/img/hero-1536.webp" media="(min-width: 881px)">
<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, url: SITE.origin + '/',
      logo: SITE.origin + '/img/logo-160.webp', image: SITE.origin + '/img/og-image.jpg', email: 'mailto:' + SITE.email,
      description: 'Český hodinářský atelier zaměřený na renovaci, servis a zakázkové sestavy mechanických hodinek.',
      sameAs: [SITE.instagram, SITE.tiktok],
    })}</script>`,
    scripts: ['/assets/featured.js'],
    body: `
<section class="home-hero">
  <div class="wrap">
    <img class="mark" src="/img/logo-160.webp" width="160" height="160" alt="">
    <h1>Atelier Dante Time</h1>
    <p class="subtitle">${L('Český hodinářský ateliér', 'Czech Watch Atelier')}</p>
    <p class="tagline">${L('Druhý život pro čas. Renovace a zakázkové sestavy mechanických hodinek s důrazem na řemeslo a detail.', 'A second life for time. Restoration and custom builds of mechanical watches with craftsmanship and attention to detail.')}</p>
    <div class="cta-row">
      <a class="btn solid" href="${PAGES.collection[lang]}">${L('Prohlédnout kolekci', 'View the collection')}</a>
      <a class="btn" href="${PAGES.services[lang]}#poptavka">${L('Servis a zakázka na míru', 'Service &amp; custom commission')}</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap trust">
    <div><strong>${L('Unikátní kusy', 'Unique pieces')}</strong><span>${L('Každé hodinky existují jen jednou.', 'Every watch exists only once.')}</span></div>
    <div><strong>${L('Ruční práce', 'Handcrafted')}</strong><span>${L('Rozebrány, vyčištěny, namazány a seřízeny v ateliéru.', 'Disassembled, cleaned, lubricated and regulated in the atelier.')}</span></div>
    <div><strong>${L('Garance pravosti', 'Authenticity guarantee')}</strong><span>${L('Doživotní garance pravosti deklarovaných originálních dílů.', 'Lifetime guarantee on declared original parts.')}</span></div>
    <div><strong>${L('Osobní přístup', 'Personal approach')}</strong><span>${L('Komunikujete přímo s hodinářem.', 'You talk directly to the watchmaker.')}</span></div>
  </div>
</section>

<section class="section" id="kolekce-nahled" hidden data-featured data-lang="${lang}">
  <div class="wrap">
    <div class="section-head">
      <div><p class="eyebrow">${L('Kolekce', 'Collection')}</p><h2>${L('Aktuálně v ateliéru', 'Currently in the atelier')}</h2></div>
      <a class="btn ghost" href="${PAGES.collection[lang]}">${L('Celá kolekce', 'Full collection')}</a>
    </div>
    <div class="products" data-featured-list></div>
  </div>
</section>

<section class="section">
  <div class="wrap split">
    <div class="card">
      <p class="eyebrow">${L('O ateliéru', 'About the atelier')}</p>
      <h2>${L('Řemeslo s respektem k historii', 'Craft with respect for history')}</h2>
      <p>${L('Každé hodinky mají svůj příběh. Vracíme mechanickým hodinkám život: citlivou renovací, servisem a zakázkovými sestavami, které respektují původní charakter každého kusu.', 'Every watch has a story. We bring mechanical watches back to life through careful restoration, service and custom builds that respect the original character of each piece.')}</p>
      <ul class="list-dots">
        <li>${L('Mechanické hodinky a vintage renovace', 'Mechanical watches and vintage restoration')}</li>
        <li>${L('Čištění, mazání, regulace chodu', 'Cleaning, lubrication, regulation')}</li>
        <li>${L('Zakázkové sestavy (limitované kusy)', 'Custom builds (limited pieces)')}</li>
        <li>${L('Dokončovací práce a prezentace', 'Finishing and presentation')}</li>
      </ul>
      <p style="margin-top:20px"><a class="btn ghost" href="${PAGES.about[lang]}">${L('Přečíst příběh', 'Read the story')}</a></p>
    </div>
    <div class="card">
      <p class="eyebrow">${L('Nezávazná konzultace', 'Free consultation')}</p>
      <h2>${L('Máte hodinky, které si zaslouží druhý život?', 'Have a watch that deserves a second life?')}</h2>
      <p>${L('Pošlete fotografie a krátký popis stavu. Připravím návrh postupu a orientační cenu.', 'Send photos and a short description of its condition. I will suggest the next steps and an estimated price.')}</p>
      <div class="cta-row" style="justify-content:flex-start">
        <a class="btn solid" href="${PAGES.services[lang]}#poptavka">${L('Poptat servis', 'Request a service')}</a>
        <a class="btn ghost" href="${SITE.instagram}" rel="noopener noreferrer" target="_blank">Instagram</a>
      </div>
    </div>
  </div>
</section>`,
  };
}

export function about(lang) {
  const L = (cs, en) => T(lang, cs, en);
  return {
    key: 'about',
    title: L('O nás', 'About'),
    description: L('Příběh Atelier Dante Time – českého hodinářského ateliéru zaměřeného na renovaci a zakázkové sestavy mechanických hodinek.', 'The story of Atelier Dante Time – a Czech atelier focused on restoration and custom builds of mechanical watches.'),
    body: `${hero({ eyebrow: 'Atelier Dante Time', title: L('O nás', 'About'), lead: L('Druhý život pro čas.', 'A second life for time.') })}
<section class="section"><div class="wrap split">
  <div class="card prose">
    <p>${L('Každé hodinky mají svůj příběh. Některé ale skončí odložené, zastavené, zapomenuté. Právě takové mě zajímají.', 'Every watch has its story. Some, however, end up put aside, stopped, forgotten. Those are the ones that interest me.')}</p>
    <p>${L('<strong>Dante Time</strong> vzniklo z úcty k hodinářskému řemeslu a z přesvědčení, že i zdánlivě odepsané věci si zaslouží péči.', '<strong>Dante Time</strong> was born out of respect for watchmaking and the belief that even seemingly lost things deserve care.')}</p>
    <p>${L('Každý kus prochází trpělivou renovací, kde se spojuje technická přesnost s citem pro detail. Nejde jen o opravu. Jde o návrat života.', 'Each piece goes through a patient restoration that combines technical precision with a sense for detail. It is not just a repair. It is a return to life.')}</p>
    <p>${L('Výsledkem nejsou jen opravené hodinky. Jsou to hodinky, které znovu žijí.', 'The result is not just a repaired watch. It is a watch that lives again.')}</p>
    <p>${L('Značka nese jméno <strong>Dante</strong> — zachráněného kocoura, který dostal druhou šanci. Stejně jako on dostávají i hodinky v tomto ateliéru nový začátek.', 'The brand is named after <strong>Dante</strong> — a rescued cat who got a second chance. Just like him, the watches in this atelier get a new beginning.')}</p>
    <p class="quote">${L('„Druhý život pro čas.“', '“A second life for time.”')}</p>
  </div>
  <figure style="margin:0">
    <div class="frame"><img src="/img/dante-754.webp" srcset="/img/dante-400.webp 400w, /img/dante-754.webp 754w" sizes="(max-width: 900px) 100vw, 440px" width="754" height="863" loading="lazy" decoding="async" alt="${L('Dante — maskot Atelier Dante Time', 'Dante — the mascot of Atelier Dante Time')}"></div>
    <figcaption class="caption">${L('Dante • symbol druhé šance', 'Dante • a symbol of second chances')}</figcaption>
  </figure>
</div></section>`,
  };
}

export function services(lang) {
  const L = (cs, en) => T(lang, cs, en);
  const svc = (num, title, items) => `<div class="card feature"><div class="num">${num}</div><h2 class="h3">${title}</h2><ul class="list-dots">${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
  return {
    key: 'services',
    title: L('Služby a zakázky', 'Services &amp; commissions'),
    description: L('Servis, renovace a zakázkové sestavy mechanických hodinek. Nezávazná poptávka s orientační cenou. Atelier Dante Time.', 'Service, restoration and custom builds of mechanical watches. Free enquiry with an estimated price. Atelier Dante Time.'),
    scripts: ['/assets/forms.js'],
    body: `${hero({ eyebrow: L('Služby', 'Services'), title: L('Servis, renovace a zakázky', 'Service, restoration &amp; commissions'), lead: L('Servis a citlivá renovace mechanických hodinek s respektem k původnímu řemeslu a charakteru každého kusu. Každou zakázku řeším individuálně.', 'Service and careful restoration of mechanical watches with respect for the original craft and character of each piece. Every commission is handled individually.') })}
<section class="section"><div class="wrap grid-3">
  ${svc('I', L('Servis mechanických hodinek', 'Mechanical watch service'), [L('Kompletní rozebrání, čištění, mazání a opětovné sestavení', 'Complete disassembly, cleaning, lubrication and reassembly'), L('Kontrola opotřebení a doporučení případných výměn dílů', 'Wear inspection and recommended part replacements'), L('Regulace chodu a závěrečné testování', 'Regulation and final testing')])}
  ${svc('II', L('Renovace a opravy (vintage)', 'Restoration &amp; repairs (vintage)'), [L('Citlivé opravy a záchrana starších modelů', 'Careful repairs and rescue of older models'), L('Řešení závad po pádu či neodborném zásahu', 'Fixing damage after a fall or improper intervention'), L('Možnost doplnění dílů dle dostupnosti', 'Replacement parts subject to availability')])}
  ${svc('III', L('Zakázkové sestavy a přestavby', 'Custom builds &amp; conversions'), [L('Sestavení hodinek na míru dle dohody', 'Watches built to your brief'), L('Výběr strojku, ciferníku, pouzdra a řemínku', 'Choice of movement, dial, case and strap'), L('Důraz na detail a finální prezentaci', 'Focus on detail and final presentation')])}
</div></section>
<section class="section"><div class="wrap split">
  <div class="card">
    <h2>${L('Jak spolupráce probíhá', 'How it works')}</h2>
    <ol class="prose" style="padding-left:1.2em">
      <li>${L('Pošlete fotografie hodinek a popis stavu nebo představu o zakázce.', 'Send photos of the watch and a description, or your idea for a commission.')}</li>
      <li>${L('Připravím návrh postupu, orientační cenu a termín.', 'I will prepare a proposal, an estimated price and a timeline.')}</li>
      <li>${L('Po vašem písemném souhlasu převezmu hodinky (osobně po domluvě nebo pojištěnou zásilkou).', 'After your written approval I take over the watch (in person by arrangement or by insured parcel).')}</li>
      <li>${L('Před překročením orientační ceny se vás vždy zeptám.', 'I will always ask you before exceeding the estimate.')}</li>
      <li>${L('Hotové hodinky předám s popisem provedených prací.', 'The finished watch is returned with a description of the work done.')}</li>
    </ol>
    <p>${L('Zaměření především na značky', 'Focus mainly on')}: ${brands} ${L('a další vintage modely.', 'and other vintage models.')}</p>
    <p><a href="/zakazkova-vyroba" style="color:var(--gold-2)">${L('Podmínky zakázkové výroby, renovací a servisu', 'Terms for custom work, restoration and service (CZ)')}</a></p>
  </div>
  <figure style="margin:0">
    <div class="frame"><img src="/img/watch-box-720.webp" srcset="/img/watch-box-400.webp 400w, /img/watch-box-720.webp 720w" sizes="(max-width: 900px) 100vw, 440px" width="720" height="1280" loading="lazy" decoding="async" alt="${L('Ukázka dokončeného kusu Atelier Dante Time', 'A finished piece by Atelier Dante Time')}"></div>
    <figcaption class="caption">${L('Ukázka finální prezentace hotového kusu.', 'Final presentation of a finished piece.')}</figcaption>
  </figure>
</div></section>
<section class="section" id="poptavka"><div class="wrap"><div class="card">
  <h2>${L('Nezávazná poptávka', 'Free enquiry')}</h2>
  <p>${L('Odpovím co nejdříve e-mailem. Fotografie hodinek pak můžete poslat v odpovědi.', 'I will reply by e-mail as soon as possible. You can then send photos of the watch in your reply.')}</p>
  ${inquiryForm(lang, 'service')}
</div></div></section>`,
  };
}

export function inquiryForm(lang, type, productId = '') {
  const L = (cs, en) => T(lang, cs, en);
  const typeSelect = type === 'service' ? `
  <label>${L('O co máte zájem', 'What are you interested in')}
    <select name="type">
      <option value="servis">${L('Servis', 'Service')}</option>
      <option value="renovace">${L('Renovace / oprava', 'Restoration / repair')}</option>
      <option value="zakazkova_vyroba">${L('Zakázková sestava', 'Custom build')}</option>
      <option value="prestavba">${L('Přestavba', 'Conversion')}</option>
      <option value="jine">${L('Jiný dotaz', 'Other')}</option>
    </select>
  </label>` : `<input type="hidden" name="type" value="${esc(type)}">`;
  return `<form class="form" data-inquiry-form data-lang="${lang}" novalidate>
  ${typeSelect}
  <input type="hidden" name="productId" value="${esc(productId)}">
  <div class="row">
    <label>${L('Jméno', 'Name')}<input type="text" name="name" autocomplete="name" required maxlength="120"></label>
    <label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
  </div>
  <label>${L('Telefon (nepovinné)', 'Phone (optional)')}<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
  <label>${L('Zpráva', 'Message')}<textarea name="message" required maxlength="4000" placeholder="${L('Značka, model, stav, co od hodinek očekáváte…', 'Brand, model, condition, what you expect…')}"></textarea></label>
  <label class="hp" aria-hidden="true">Web<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
  <p class="doc-meta">${L('Údaje použiji jen k vyřízení vaší poptávky. Více v <a href="/privacy" style="color:var(--gold-2)">ochraně osobních údajů</a>.', 'I will only use your details to handle your enquiry. See the <a href="/privacy" style="color:var(--gold-2)">privacy policy (CZ)</a>.')}</p>
  <button class="btn solid" type="submit">${L('Odeslat poptávku', 'Send enquiry')}</button>
  <div class="notice" data-form-status hidden role="status" aria-live="polite"></div>
</form>`;
}

export function care(lang) {
  const L = (cs, en) => T(lang, cs, en);
  return {
    key: 'care',
    title: L('Péče o hodinky', 'Watch care'),
    description: L('Praktické rady k péči o mechanické hodinky: nastavení času, šroubovací korunka, natahování, ochrana a pravidelný servis.', 'Practical advice on caring for mechanical watches: setting the time, screw-down crowns, winding, protection and regular service.'),
    body: `${hero({ eyebrow: L('Rady', 'Advice'), title: L('Péče o hodinky', 'Watch care'), lead: L('Doporučení pro správné používání, nastavování a dlouhodobou péči o mechanické hodinky.', 'Recommendations for correct use, setting and long-term care of mechanical watches.') })}
<section class="section"><div class="wrap"><div class="card prose">
<h2>${L('1. Základní péče', '1. Basic care')}</h2>
<p>${L('Mechanické hodinky vyžadují šetrné zacházení a pravidelnou péči. Dodržováním těchto doporučení pomůžete zachovat správnou funkci strojku a dlouhou životnost hodinek.', 'Mechanical watches require gentle handling and regular care. Following these recommendations helps keep the movement working properly and the watch lasting long.')}</p>
<p>${L('Po převzetí hodinek doporučujeme nechat hodinky několik hodin v klidu při běžné pokojové teplotě, aby se stabilizovaly po přepravě.', 'After receiving the watch, let it rest for a few hours at room temperature so it can stabilise after transport.')}</p>
<p>${L('Pokud hodinky během noci nenosíte, doporučujeme je uložit vodorovně, ciferníkem nahoru.', 'If you do not wear the watch overnight, store it flat, dial up.')}</p>
<h2>${L('2. Nastavení času', '2. Setting the time')}</h2>
<p>${L('Při nastavování času otáčejte ručičky vždy pouze ve směru hodinových ručiček. Otáčení proti směru může u některých historických strojků způsobit jejich poškození.', 'Always move the hands clockwise only. Turning them anticlockwise may damage some historical movements.')}</p>
<h2>${L('3. Šroubovací korunka', '3. Screw-down crown')}</h2>
<p>${L('Některé modely používají šroubovací korunku. Při manipulaci postupujte pomalu a bez použití síly.', 'Some models use a screw-down crown. Handle it slowly and without force.')}</p>
<h3>${L('Vyšroubování', 'Unscrewing')}</h3>
<ul><li>${L('otočte korunku proti směru hodinových ručiček, dokud se zcela neuvolní,', 'turn the crown anticlockwise until it is fully released,')}</li><li>${L('po uvolnění je korunka připravena k natahování nebo nastavení času.', 'once released, the crown is ready for winding or setting the time.')}</li></ul>
<h3>${L('Natahování', 'Winding')}</h3>
<ul><li>${L('korunku otáčejte přibližně 10–15× ve směru hodinových ručiček,', 'turn the crown clockwise about 10–15 times,')}</li><li>${L('jedna otočka znamená pouze půl otáčky (180°), nikoli celých 360°,', 'one turn means half a rotation (180°), not a full 360°,')}</li><li>${L('otáčejte pomalu a plynule a ponechte prostor pro následné zašroubování korunky.', 'turn slowly and smoothly and leave room for screwing the crown back in.')}</li></ul>
<h3>${L('Upozornění', 'Caution')}</h3>
<p>${L('Korunku při natahování nedotahujte zbytečně silou. Při jejím zašroubování dochází ještě k dalšímu částečnému dotažení strojku.', 'Do not force the crown when winding. Screwing it back in winds the movement a little further.')}</p>
<h3>${L('Zašroubování', 'Screwing in')}</h3>
<ul><li>${L('jemně zatlačte korunku směrem k pouzdru a zašroubujte ji ve směru hodinových ručiček,', 'gently push the crown towards the case and screw it in clockwise,')}</li><li>${L('zašroubování obvykle odpovídá přibližně 5–6 půlotáčkám.', 'this usually takes about 5–6 half-turns.')}</li></ul>
<h2>${L('4. Ochrana hodinek', '4. Protection')}</h2>
<ul><li>${L('chraňte hodinky před nárazy, pády, silnými vibracemi a otřesy,', 'protect the watch from impacts, drops, strong vibrations and shocks,')}</li><li>${L('nevystavujte je magnetickému poli ani náhlým změnám teplot,', 'keep it away from magnetic fields and sudden temperature changes,')}</li><li>${L('nevystavujte je vlhkosti nebo vodě, pokud nejsou výslovně označeny jako vodotěsné,', 'keep it away from moisture and water unless explicitly marked as water-resistant,')}</li><li>${L('vyhněte se kontaktu s chemikáliemi.', 'avoid contact with chemicals.')}</li></ul>
<h2>${L('5. Servis', '5. Service')}</h2>
<p>${L('Doporučujeme odborný servis přibližně každých 3–5 let, aby byla zachována správná funkčnost strojku.', 'We recommend a professional service roughly every 3–5 years to keep the movement working properly.')}</p>
<p><a href="${PAGES.services[lang]}#poptavka">${L('Objednat servis', 'Book a service')}</a></p>
</div></div></section>`,
  };
}

export function contact(lang) {
  const L = (cs, en) => T(lang, cs, en);
  return {
    key: 'contact',
    title: L('Kontakt', 'Contact'),
    description: L('Kontakt na Atelier Dante Time: e-mail, Instagram, TikTok a formulář pro nezávaznou poptávku.', 'Contact Atelier Dante Time: e-mail, Instagram, TikTok and an enquiry form.'),
    scripts: ['/assets/forms.js'],
    body: `${hero({ eyebrow: L('Kontakt', 'Contact'), title: L('Napište mi', 'Get in touch'), lead: L('Rád zodpovím dotazy ke kolekci, servisu i zakázkám na míru.', 'Happy to answer questions about the collection, service or commissions.') })}
<section class="section"><div class="wrap split">
  <div class="card">
    <h2>${L('Zpráva', 'Message')}</h2>
    ${inquiryForm(lang, 'general')}
  </div>
  <div class="card">
    <h2>${L('Spojení', 'Details')}</h2>
    <ul class="list-dots">
      <li>E-mail: <a href="mailto:${SITE.email}">${SITE.email}</a></li>
      <li>Instagram: <a href="${SITE.instagram}" rel="noopener noreferrer" target="_blank">${SITE.instagramHandle}</a></li>
      <li>TikTok: <a href="${SITE.tiktok}" rel="noopener noreferrer" target="_blank">${SITE.tiktokHandle}</a></li>
    </ul>
    <p style="margin-top:18px">${L('Pro nezávaznou konzultaci pošlete fotografie hodinek a stručný popis jejich stavu. Připravím návrh postupu a orientační cenový odhad.', 'For a free consultation, send photos of the watch and a short description of its condition. I will suggest next steps and an estimated price.')}</p>
    <p><a href="/provozovatel" style="color:var(--gold-2)">${L('Údaje o provozovateli', 'Operator details (CZ)')}</a></p>
  </div>
</div></section>`,
  };
}
