// Právní dokumenty – ČESKÁ VERZE (návrh 3)
// ⚖️ ÚROVEŇ 3 – změny jen se souhlasem majitele. Nejasnosti: docs/LEGAL-REVIEW.md
import { SITE, OPERATOR, INDEPENDENCE, SERVICES_OFFERED as SVC } from '../site.mjs';
import { head, toc, email, seller, vatText, returnAddress, coi, ecc, tradeOffice, registerText, LEGAL_VERSION } from './common.mjs';
import { TERMS as T, priceCs } from '../terms.mjs';

// Krátká věta o záruce pro všechna místa, kde se záruka zmiňuje (reklama musí obsahovat podmínky, § 2113 odst. 2 OZ)
export const warrantyShortCs = () => `záruka za jakost až ${T.warrantyMonths} měsíců${T.inspection.enabled ? ` (ve druhém roce po garanční prohlídce)` : ''}`;
const insp = T.inspection;

const L = 'cs';
const doc = (key, path, title, description, body) => ({ key, lang: L, path, title, description, body });

// ---------------------------------------------------------------------------
export const terms = doc('terms', '/terms', 'Všeobecné obchodní podmínky',
  'Všeobecné obchodní podmínky e-shopu Atelier Dante Time pro prodej hotových mechanických hodinek v ČR a EU.',
  () => `${head(L)}
${toc(L, [['op1', 'Úvodní ustanovení'], ['op2', 'Hodinky, součásti a materiály'], ['op3', 'Ceny a měny'], ['op4', 'Objednávka a uzavření smlouvy'], ['op5', 'Platba'], ['op6', 'Dodání'], ['op7', 'Záruka a práva z vadného plnění'], ['op8', 'Doživotní garance pravosti'], ['op9', 'Odstoupení od smlouvy'], ['op10', 'Prodej do zemí EU'], ['op11', 'Osobní údaje a cookies'], ['op12', 'Stížnosti, mimosoudní řešení sporů a dozor'], ['op13', 'Kupující podnikatelé'], ['op14', 'Závěrečná ustanovení']])}
<h2 id="op1">1. Úvodní ustanovení</h2>
<ol>
<li>Tyto všeobecné obchodní podmínky (dále jen „podmínky“) upravují prodej hotových mechanických hodinek prostřednictvím internetového obchodu na adrese <strong>${SITE.origin.replace('https://', '')}</strong> (dále jen „e-shop“).</li>
<li>Prodávajícím je ${seller(L)}, e-mail ${email} (dále jen „prodávající“ nebo „ateliér“).</li>
<li>Kupujícím je spotřebitel nebo podnikatel, který s prodávajícím uzavírá kupní smlouvu (dále jen „kupující“). Spotřebitelem je člověk, který mimo rámec své podnikatelské činnosti nebo samostatného výkonu povolání uzavírá smlouvu s podnikatelem (§ 419 zákona č. 89/2012 Sb., občanský zákoník, dále jen „OZ“).</li>
<li>${INDEPENDENCE.cs}</li>
<li>Součástí podmínek jsou: <a href="/reklamace">Reklamační řád</a>, <a href="/returns">Odstoupení od smlouvy a vrácení zboží</a> (včetně formuláře), <a href="/warranty">Záruka a doživotní garance pravosti</a>, <a href="/doprava-a-platba">Doprava a platba</a> a <a href="/prodej-do-eu">Prodej do zemí EU</a>.${SVC ? ' Servis, renovace, přestavby a zakázková výroba se řídí <a href="/zakazkova-vyroba">Podmínkami zakázkové výroby a servisu</a>.' : ''}</li>
<li>Smlouvu lze uzavřít v českém nebo anglickém jazyce. Obě jazykové verze podmínek mají stejný obsah.</li>
</ol>

<h2 id="op2">2. Hodinky, součásti a materiály</h2>
<ol>
<li>E-shop nabízí hotové mechanické hodinky těchto druhů, uvedených u každého kusu:
  <ul>
  <li><strong>Originální hodinky</strong> – použité (vintage) hodinky po servisu nebo renovaci v ateliéru,</li>
  <li><strong>Ateliérové přestavby Dante Time</strong> – hodinky upravené v ateliéru, u nichž byly některé součásti nahrazeny novými,</li>
  <li><strong>Sestavy z ateliéru</strong> – hodinky sestavené v ateliéru z vybraných součástí.</li>
  </ul></li>
<li>U každého kusu prodávající jasně odlišuje <strong>původní originální součásti</strong> hodinek a <strong>nové součásti použité při přestavbě Dante Time</strong> nebo jinak vyměněné díly. Popis stavu, provedených prací a součástí je součástí smlouvy.</li>
<li>Každé hodinky jsou <strong>unikátní kus</strong> dostupný jen jednou. Prezentace v e-shopu je informativní a není návrhem na uzavření smlouvy (§ 1732 odst. 2 OZ).</li>
<li><strong>Drahé kovy.</strong> Pouzdra ze zlata, stříbra nebo platiny prodávající nabízí jen s uvedenou ryzostí a platnou puncovní značkou podle zákona č. 539/1992 Sb., o puncovnictví a zkoušení drahých kovů. Na dokladu o prodeji je uveden druh drahého kovu, ryzost a hmotnost.</li>
<li><strong>Pozlacená pouzdra</strong> (případně postříbřená) nejsou z drahého kovu a jsou tak vždy výslovně označena.</li>
</ol>

<h2 id="op3">3. Ceny a měny</h2>
<ol>
<li>Ceny hodinek jsou stanoveny v korunách českých (Kč) a jsou konečné. ${vatText(L)}</li>
<li>Kupující může platit v Kč nebo v eurech (EUR). Při platbě v EUR se celková cena přepočte kurzem ateliéru platným v okamžiku objednávky a zaokrouhlí nahoru na celé euro. Částka v EUR je uvedena před odesláním objednávky a v jejím potvrzení.</li>
<li>Cena dopravy a případný příplatek za dobírku se zobrazí podle zvolené země a způsobu dopravy <strong>před odesláním objednávky</strong>. Kupující tak vždy zná konečnou cenu.</li>
<li>Prodávající nepoužívá individuálně přizpůsobené ceny na základě automatizovaného rozhodování. Pokud by uvedl slevu, uvede i nejnižší cenu za posledních 30 dní.</li>
</ol>

<h2 id="op4">4. Objednávka a uzavření smlouvy</h2>
<ol>
<li>Kupující vloží hodinky do košíku, zvolí zemi doručení, měnu, dopravu a platbu a vyplní údaje. Před odesláním může vše zkontrolovat a opravit.</li>
<li>Objednávku odešle tlačítkem <strong>„Objednávka zavazující k platbě“</strong> po vyjádření souhlasu s podmínkami.</li>
<li>Po odeslání objednávky e-shop hodinky <strong>rezervuje</strong>, aby je nemohl současně koupit nikdo jiný: při platbě převodem do konce splatnosti, při dobírce do odeslání.</li>
<li>Kupní smlouva je uzavřena doručením e-mailového <strong>potvrzení objednávky</strong>. Jeho součástí je text podmínek a poučení o odstoupení ve znění platném v den objednávky.</li>
<li>Prodávající smlouvu archivuje v elektronické podobě a na požádání ji kupujícímu zpřístupní. Třetím osobám není přístupná.</li>
<li>Nebude-li možné hodinky dodat (např. byly prokazatelně poškozeny před odesláním), prodávající kupujícího bez zbytečného odkladu informuje a přijatou platbu vrátí nejpozději do 14 dnů.</li>
</ol>

<h2 id="op5">5. Platba</h2>
<ol>
<li>Způsoby platby: <strong>bankovní převod předem</strong> (v Kč s QR platbou, v EUR s QR kódem SEPA), <strong>dobírka</strong> (jen v ČR a jen s výdejním místem) a po aktivaci platební brány <strong>platba kartou</strong>. Zahraniční objednávky se hradí předem.</li>
<li>Platba převodem je splatná do <strong>${T.paymentDueDays} dnů</strong> od uzavření smlouvy na účet ${OPERATOR.bankAccount} (IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}, majitel ${OPERATOR.accountHolder}) s variabilním symbolem nebo zprávou uvedenou v potvrzení objednávky.</li>
<li>Neuhradí-li kupující cenu ve lhůtě splatnosti, rezervace skončí a prodávající může od smlouvy odstoupit. Kupujícího o tom informuje e-mailem.</li>
<li>Při dobírce je cena splatná při převzetí zásilky.</li>
<li>Vlastnické právo přechází na kupujícího zaplacením celé ceny a převzetím hodinek. Doklad o prodeji (fakturu) zašle prodávající elektronicky po zaplacení. Obsahuje identifikaci hodinek, která slouží i pro garanci pravosti.</li>
</ol>

<h2 id="op6">6. Dodání</h2>
<ol>
<li>Prodávající doručuje do všech členských států Evropské unie. Způsoby a ceny dopravy uvádí stránka <a href="/doprava-a-platba">Doprava a platba</a>.</li>
<li>Dostupné hodinky prodávající odešle do <strong>${T.dispatchWorkingDays} pracovních dnů</strong> od připsání platby, u dobírky od potvrzení objednávky, nejpozději však do 30 dnů od uzavření smlouvy, nebylo-li dohodnuto jinak.</li>
<li>Hodinky vyšší hodnoty odesílá prodávající jen <strong>pojištěnou přepravou</strong> odpovídající jejich hodnotě, nebo je po předchozí individuální domluvě předá osobně. Prodávající nemá kamennou prodejnu.</li>
<li>Nebezpečí škody na hodinkách přechází na kupujícího-spotřebitele převzetím hodinek.</li>
<li>Nepřevezme-li kupující zásilku na dobírku bez vážného důvodu, je prodávající oprávněn od smlouvy odstoupit a požadovat náhradu <strong>skutečně vynaložených nákladů</strong> na odeslání a vrácení zásilky jako náhradu škody. Žádnou smluvní pokutu prodávající neúčtuje.</li>
<li>Při převzetí zkontrolujte neporušenost zásilky. Postup při poškození je na stránce <a href="/returns#poskozeni">Odstoupení a vrácení</a>.</li>
</ol>

<h2 id="op7">7. Záruka a práva z vadného plnění</h2>
<ol>
<li>Na prodávané hodinky poskytuje prodávající dobrovolnou <strong>záruku za jakost až ${T.warrantyMonths} měsíců</strong>${insp.enabled ? '. Podmínkou jejího pokračování ve druhém roce je absolvování garanční prohlídky' : ''}. Podrobné podmínky naleznete na stránce <a href="/warranty">Záruka a garance pravosti</a>. Zákonná práva spotřebitele z vadného plnění tím nejsou dotčena. Postup při reklamaci upravuje <a href="/reklamace">Reklamační řád</a>.</li>
</ol>

<h2 id="op8">8. Doživotní garance pravosti</h2>
<p>Na <strong>strojky, ciferníky a ručičky deklarované jako originální</strong> poskytuje prodávající doživotní garanci pravosti, a to i pro každého dalšího majitele hodinek. Podmínky jsou na stránce <a href="/warranty">Záruka a garance pravosti</a>. Garance neomezuje zákonná práva kupujícího.</p>

<h2 id="op9">9. Odstoupení od smlouvy</h2>
<ol>
<li>Spotřebitel může od smlouvy na hotové hodinky uzavřené na dálku odstoupit <strong>bez udání důvodu do ${T.withdrawalDays} dnů</strong> od převzetí (§ 1829 OZ). Postup, vzorový formulář a funkce „Odstoupit od smlouvy“ jsou na stránce <a href="/returns">Odstoupení od smlouvy a vrácení zboží</a>.</li>
<li>Právo na odstoupení nemá spotřebitel u hodinek vyrobených nebo upravených <strong>podle jeho zadání</strong> (§ 1837 písm. d) OZ). Přestavby a sestavy nabízené v e-shopu jako hotové kusy lze vrátit.</li>
</ol>

<h2 id="op10">10. Prodej do zemí EU</h2>
<p>Zákazníkům ze všech států EU nabízí prodávající stejné ceny a podmínky. Pravidla přeshraničního prodeje (právo, jazyk, doprava, vrácení zboží ze zahraničí) jsou na stránce <a href="/prodej-do-eu">Prodej do zemí EU</a>.</p>

<h2 id="op11">11. Osobní údaje a cookies</h2>
<p>Zpracování osobních údajů popisují <a href="/privacy">Zásady ochrany osobních údajů</a>, používání cookies stránka <a href="/cookies">Cookies</a>.</p>

<h2 id="op12">12. Stížnosti, mimosoudní řešení sporů a dozor</h2>
<ol>
<li>Stížnosti vyřizuje prodávající na e-mailu ${email}.</li>
<li>Spotřebitel má právo na mimosoudní řešení sporu. Příslušným subjektem je ${coi(L)}. Podrobnosti na stránce <a href="/reseni-sporu">Řešení sporů</a>.</li>
<li>Dozor vykonává Česká obchodní inspekce (ochrana spotřebitele), ${tradeOffice(L)} (živnostenské podnikání), Úřad pro ochranu osobních údajů a Puncovní úřad (výrobky z drahých kovů).</li>
<li>Prodávající na webu nezveřejňuje recenze zákazníků. Pokud je začne zveřejňovat, doplní informaci, zda a jak ověřuje jejich původ.</li>
</ol>

<h2 id="op13">13. Kupující podnikatelé</h2>
<p>Na kupujícího-podnikatele se nevztahují ustanovení na ochranu spotřebitele, s výjimkou smluvní možnosti vrácení hotových hodinek do ${T.withdrawalDays} dnů, kterou mu prodávající poskytuje za stejných podmínek jako spotřebiteli. Nebezpečí škody přechází předáním hodinek prvnímu dopravci. Záruka podle čl. 7 platí i pro podnikatele, včetně podmínky garanční prohlídky.</p>

<h2 id="op14">14. Závěrečná ustanovení</h2>
<ol>
<li>Smlouva se řídí právem České republiky. Je-li kupujícím spotřebitel s obvyklým bydlištěm v jiném státě EU, nejsou tím dotčena kogentní ustanovení na ochranu spotřebitele podle práva tohoto státu (čl. 6 nařízení Řím I).</li>
<li>Prodávající může podmínky měnit. Na uzavřené smlouvy se použije znění platné v den odeslání objednávky.</li>
<li>Verze ${LEGAL_VERSION}.</li>
</ol>`);

// ---------------------------------------------------------------------------
export const claims = doc('claims', '/reklamace', 'Reklamační řád',
  `Reklamační řád Atelier Dante Time: záruka za jakost, lhůty a postup reklamace hodinek${SVC ? ', zakázek a servisu' : ''}.`,
  () => `${head(L)}
<h2>1. Na co se reklamační řád vztahuje</h2>
<ul>
<li><strong>hotové hodinky</strong> koupené od prodávajícího (kupní smlouva),</li>
${SVC ? `<li><strong>zakázková výroba</strong> – hodinky sestavené z dílů ateliéru podle přání zákazníka,</li>
<li><strong>servis, renovace a přestavby</strong> hodinek zákazníka (smlouva o dílo) – provedená práce a nově dodané součásti.</li>` : ''}
</ul>
<p>Provozovatel: ${seller(L)}, e-mail ${email}.</p>

<h2>2. Záruční doba a odpovědnost za vady</h2>
<ol>
<li>Na prodávané hodinky poskytujeme dobrovolnou <strong>záruku za jakost až ${T.warrantyMonths} měsíců</strong>${insp.enabled ? '. Podmínkou jejího pokračování ve druhém roce je absolvování garanční prohlídky' : ''}. Podrobné podmínky naleznete na stránce <a href="/warranty">Záruka a garance pravosti</a>. Zákonná práva spotřebitele z vadného plnění tím nejsou dotčena.</li>
${SVC ? `<li>U servisu, renovace a přestavby odpovídáme za provedenou práci a nově dodané součásti ${T.liabilityMonths} měsíců od předání.</li>` : ''}
</ol>

<h2>3. Co není vadou</h2>
<ul>
<li>stav a vlastnosti uvedené v popisu kusu (patina, stopy používání, vyměněné nebo nové součásti) a vady, pro které byla sjednána nižší cena,</li>
<li>u použitých hodinek opotřebení odpovídající míře používání při převzetí,</li>
<li>běžné opotřebení užíváním (řemínek, sklíčko, povrch pouzdra, postupné opotřebení pozlacení),</li>
<li>odchylka přesnosti chodu v orientační toleranci <strong>${T.accuracyVintage}</strong> u vintage mechanických hodinek, s ohledem na konkrétní kalibr, technický stav a stáří strojku (je-li u kusu uvedena jiná tolerance, platí ta),</li>
<li>poškození pádem, nárazem, vodou nebo vlhkostí (nejsou-li hodinky výslovně označeny jako vodotěsné), magnetickým polem, chemikáliemi nebo neodborným zásahem třetí osoby,</li>
<li>poškození vzniklé nedodržením <a href="/care">doporučení k péči o hodinky</a>.</li>
</ul>

<h2>4. Jak reklamovat</h2>
<ol>
<li>Napište na ${email} s předmětem „Reklamace“: číslo objednávky nebo zakázky, popis vady, kdy se projevuje, fotografie nebo video a jaké právo uplatňujete.</li>
<li>Hodinky zasílejte pojištěné na adresu ${returnAddress(L)}, ne na dobírku. Předem se domluvíme.</li>
<li>Uplatnění reklamace vám potvrdíme e-mailem (datum, obsah, požadovaný způsob vyřízení).</li>
</ol>

<h2>5. Vaše práva při vadě</h2>
<ol>
<li>Můžete požadovat <strong>opravu</strong>, nebo dodání nové věci. U unikátních hodinek výměna zpravidla není možná, proto vadu odstraníme opravou, nedohodneme-li se jinak.</li>
<li>Přiměřenou <strong>slevu</strong> nebo <strong>odstoupení od smlouvy</strong> můžete požadovat, jestliže jsme vadu odmítli odstranit nebo ji neodstranili v souladu se zákonem, vada se projeví opakovaně, je podstatným porušením smlouvy, nebo je zřejmé, že ji neodstraníme v přiměřené době nebo bez značných obtíží pro vás. Pro nevýznamnou vadu nelze od smlouvy odstoupit.</li>
</ol>

<h2>6. Vyřízení a náklady</h2>
<ol>
<li>Reklamaci vyřídíme a vadu odstraníme <strong>do ${T.claimDays} dnů</strong> od jejího uplatnění.</li>
<li><strong>Historické hodinky a originální díly.</strong> Pracujeme s historickými mechanickými hodinkami (např. PRIM, OMEGA nebo ROLEX). Originální náhradní díly k nim bývají vzácné a některé je nutné vyhledat a objednat v zahraničí. Na kvalitě opravy nechceme slevit, proto dáváme přednost originálním dílům. Pokud by oprava v této lhůtě nebyla možná, <strong>bez zbytečného odkladu vás informujeme</strong>, vysvětlíme důvod a navrhneme přiměřeně delší lhůtu.</li>
<li>Delší lhůta platí <strong>jen po vzájemné dohodě</strong>, kterou s vámi potvrdíme e-mailem. Nikdy ji neprodlužujeme jednostranně ani automaticky. Pokud s prodloužením nesouhlasíte, platí lhůta ${T.claimDays} dnů; nevyřídíme-li reklamaci včas, máte stejná práva, jako by šlo o podstatné porušení smlouvy (zejména právo odstoupit od smlouvy nebo požadovat přiměřenou slevu).</li>
<li>O vyřízení vás informujeme e-mailem s potvrzením o datu a způsobu vyřízení, případně s odůvodněním zamítnutí.</li>
<li>U oprávněné reklamace uhradíme účelně vynaložené náklady (zejména poštovné) a opravené hodinky zašleme na naše náklady.</li>
</ol>
<p>Mimosoudní řešení sporů: <a href="/reseni-sporu">Řešení sporů</a>.</p>`);

// ---------------------------------------------------------------------------
export const withdrawal = doc('withdrawal', '/returns', 'Odstoupení od smlouvy a vrácení zboží',
  'Jak vrátit hotové hodinky do 14 dnů: postup, vzorový formulář a online funkce pro odstoupení od smlouvy.',
  () => `${head(L)}
<p class="notice"><strong>Odstoupit od smlouvy můžete i online</strong> na stránce <a href="/odstoupeni">Odstoupit od smlouvy</a>, nebo e-mailem na ${email}.</p>
<h2>1. Lhůta ${T.withdrawalDays} dnů</h2>
<p>Jako spotřebitel můžete od kupní smlouvy na <strong>hotové hodinky</strong> uzavřené na dálku odstoupit <strong>bez udání důvodu do ${T.withdrawalDays} dnů</strong> od převzetí (§ 1829 OZ). Lhůta je zachována, odešlete-li odstoupení před jejím uplynutím. Stejnou možnost smluvně poskytujeme i nákupům na firmu.</p>
<h2>2. Jak odstoupit</h2>
<ul>
<li>online pomocí funkce <a href="/odstoupeni">„Odstoupit od smlouvy“</a> (přijetí potvrdíme e-mailem),</li>
<li>e-mailem na ${email},</li>
<li>dopisem na adresu ${returnAddress(L)}.</li>
</ul>
<p>Můžete použít <a href="#formular">vzorový formulář</a>, není to povinné.</p>
<h2>3. Vrácení hodinek</h2>
<ol>
<li>Hodinky zašlete do ${T.withdrawalDays} dnů od odstoupení na adresu ${returnAddress(L)}, pojištěné a ne na dobírku. Osobní předání je možné po předchozí domluvě.</li>
<li><strong>Náklady na vrácení nesete vy.</strong> Při vrácení ze zahraničí mohou být vyšší.</li>
<li>Odpovídáte za snížení hodnoty hodinek vzniklé nakládáním nad rámec nutného seznámení s nimi (např. otevření pouzdra, poškrábání, vniknutí vody).</li>
</ol>
<h2>4. Vrácení peněz</h2>
<ol>
<li>Vrátíme všechny přijaté platby včetně nákladů na dodání (v rozsahu nejlevnějšího nabízeného způsobu) do ${T.refundDays} dnů od odstoupení, ve stejné měně a stejným způsobem, jakým jsme je přijali, nedohodneme-li se jinak.</li>
<li>Platbu nemusíme vrátit dříve, než nám hodinky předáte nebo prokážete jejich odeslání.</li>
</ol>
<h2>5. Kdy nelze odstoupit</h2>
<ul>
<li><strong>zakázková výroba a přestavby podle vašeho zadání</strong> (§ 1837 písm. d) OZ). Přestavby a sestavy z e-shopu jako hotové kusy vrátit lze${SVC ? ',' : '.'}</li>
${SVC ? '<li><strong>servis a renovace</strong> zcela dokončené s vaším výslovným souhlasem před uplynutím lhůty (§ 1837 písm. a) OZ). Viz <a href="/zakazkova-vyroba">Zakázková výroba a servis</a>.</li>' : ''}
</ul>
<h2 id="poskozeni">6. Poškozená zásilka</h2>
<p>Zjevně poškozenou zásilku sepište s dopravcem, případně ji nepřebírejte. Pořiďte fotografie a do 2 pracovních dnů nám napište. Pozdější uplatnění nemá vliv na vaše práva z vadného plnění.</p>
<h2 id="formular">7. Vzorový formulář pro odstoupení od smlouvy</h2>
<p class="doc-meta">Podle přílohy nařízení vlády č. 363/2013 Sb. Vyplňte a odešlete jen tehdy, chcete-li odstoupit od smlouvy.</p>
<div class="card" style="box-shadow:none">
<p><strong>Oznámení o odstoupení od smlouvy</strong></p>
<p>Adresát: ${OPERATOR.name} (${OPERATOR.tradeName}), ${OPERATOR.address}, IČO ${OPERATOR.ico}, e-mail ${SITE.email}</p>
<p>Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží: ……………………………</p>
<p>Datum objednání / datum obdržení: ……………………………</p>
<p>Číslo objednávky: ……………………………</p>
<p>Jméno a příjmení spotřebitele: ……………………………</p>
<p>Adresa spotřebitele: ……………………………</p>
<p>Číslo účtu / IBAN pro vrácení peněz: ……………………………</p>
<p>Podpis spotřebitele (jen při listinné podobě): ……………………………</p>
<p>Datum: ……………………………</p>
</div>`);

// ---------------------------------------------------------------------------
export const warranty = doc('warranty', '/warranty', 'Záruka a doživotní garance pravosti',
  'Záruka za jakost až 24 měsíců s garanční prohlídkou a doživotní garance pravosti originálních strojků, ciferníků a ručiček Atelier Dante Time.',
  () => `${head(L)}
<h2>1. Záruka za jakost až ${T.warrantyMonths} měsíců</h2>
<p><strong>Ze zákona máte vůči prodávajícímu právo na bezplatnou nápravu vady, která se projeví do ${T.liabilityMonths} měsíců od převzetí, a to i u použitých hodinek. Projeví-li se vada do ${T.presumptionMonths} měsíců, má se za to, že hodinky byly vadné již při převzetí. Tato práva nejsou zárukou ani garanční prohlídkou nijak dotčena.</strong></p>
<ol>
<li>Nad rámec zákonných práv poskytuje ${OPERATOR.name} (${OPERATOR.tradeName}) na prodávané hodinky dobrovolnou <strong>záruku za jakost až ${T.warrantyMonths} měsíců</strong> od převzetí (§ 2113 a násl. OZ). Záruka se vztahuje na funkčnost strojku a provedené práce.</li>
${insp.enabled ? `<li><strong>Garanční prohlídka.</strong> V prvním roce platí záruka bez dalších podmínek. Ve druhém roce trvá záruka, pokud hodinky absolvují garanční prohlídku <strong>po ${insp.afterMonths} měsících od převzetí</strong>, a to v období ${insp.toleranceDays} dnů před tímto dnem nebo po něm. Prohlídka zahrnuje kontrolu přesnosti chodu, amplitudy, odchylky kroku a základního technického stavu hodinek; o výsledku obdržíte písemný protokol. Cena prohlídky je <strong>${priceCs(insp.priceCzk)}</strong>. Dopravu hodinek do ateliéru a zpět hradíte vy, nedohodneme-li se jinak. Vadu, na kterou se vztahuje záruka nebo vaše zákonná práva, při prohlídce odstraníme bezplatně.</li>
<li>Pokud garanční prohlídku neabsolvujete, dobrovolná záruka skončí uplynutím ${insp.afterMonths} měsíců od převzetí. Vaše zákonná práva z vadného plnění trvají dál v plném rozsahu.</li>
<li>Podmínka garanční prohlídky platí pro hodinky zakoupené od účinnosti verze ${insp.fromVersion} těchto podmínek. Na dříve zakoupené hodinky se nevztahuje.</li>` : ''}
<li>Záruka se nevztahuje na: běžné opotřebení, řemínky a tahy, sklíčka, opotřebení pozlacení, odchylku chodu v orientační toleranci ${T.accuracyVintage} u vintage hodinek (s ohledem na kalibr, stav a stáří), poškození pádem, nárazem, vodou, magnetismem či neodborným zásahem a vady uvedené v popisu kusu.</li>
<li>Záruku uplatníte stejně jako reklamaci, viz <a href="/reklamace">Reklamační řád</a>. Prohlášení o záruce (záruční list) obdržíte v textové podobě s potvrzením objednávky a znovu s hodinkami.</li>
</ol>
<h2>2. Doživotní garance pravosti</h2>
<p><strong>Prohlášení o záruce (smluvní záruka podle § 2113 a násl. OZ)</strong></p>
<ol>
<li><strong>Poskytovatel:</strong> ${seller(L)}, e-mail ${email} (dále jen „ateliér“).</li>
<li><strong>Rozsah:</strong> garance se vztahuje na <strong>strojky, ciferníky a ručičky</strong>, které jsou u konkrétních hodinek v popisu, v potvrzení objednávky nebo na faktuře výslovně <strong>deklarované jako originální</strong>. Ateliér garantuje, že jde o originální součásti daného výrobce hodinek odpovídající popisu.</li>
<li><strong>Pro koho:</strong> pro kupujícího i pro <strong>každého dalšího majitele</strong> hodinek.</li>
<li><strong>Doba:</strong> bez časového omezení, po celou dobu existence hodinek.</li>
<li><strong>Podmínky:</strong> identifikace hodinek podle údajů ateliéru (např. číslo pouzdra nebo strojku a fotodokumentace) a ověření ateliérem, že dotčené součásti nebyly po prodeji vyměněny ani upraveny jinou osobou než ateliérem.</li>
<li><strong>Nezahrnuje:</strong> součásti neoznačené jako originální, nové součásti použité při přestavbě Dante Time, součásti vyměněné nebo upravené po prodeji jinou osobou, běžné opotřebení a poškození.</li>
<li><strong>Uplatnění:</strong> e-mailem na ${email} s identifikací hodinek a důvodem pochybnosti. Ateliér hodinky posoudí, případně nechá posoudit nezávislým odborníkem. Náklady posouzení a dopravy nese ateliér, potvrdí-li se pochybnost.</li>
<li><strong>Náprava při prokázané nepravosti</strong> podle volby oprávněné osoby: <strong>výměna</strong> za originální součást na náklady ateliéru, je-li dostupná, nebo <strong>vrácení kupní ceny</strong> zaplacené ateliéru proti vrácení hodinek. Není-li originální součást dostupná, náleží vrácení kupní ceny.</li>
<li><strong>Zákonná práva:</strong> garance <strong>neomezuje</strong> zákonná práva z vadného plnění. Spotřebitel je může vždy uplatnit místo garance.</li>
<li><strong>Nezávislost:</strong> garance pravosti trvá bez ohledu na záruku za jakost a na garanční prohlídky.</li>
</ol>
${SVC ? `<h2>3. Hodinky zákazníků (servis, renovace, přestavby)</h2>
<p>U zakázek se garance pravosti vztahuje na strojky, ciferníky a ručičky dodané ateliérem a v popisu prací výslovně označené jako originální. Původní součásti hodinek zákazníka ateliér neověřuje, nebylo-li to sjednáno.</p>` : ''}
<p class="doc-meta">${INDEPENDENCE.cs}</p>`);

// ---------------------------------------------------------------------------
export const custom = doc('custom', '/zakazkova-vyroba', 'Zakázková výroba, servis a renovace',
  'Podmínky Atelier Dante Time pro zakázkovou výrobu, servis, renovace a přestavby mechanických hodinek.',
  () => `${head(L)}
<h2>1. Druhy zakázek</h2>
<table><thead><tr><th>Druh</th><th>Co to je</th><th>Smluvní typ</th></tr></thead><tbody>
<tr><td><strong>Servis</strong></td><td>údržba hodinek zákazníka</td><td>smlouva o dílo (§ 2586 a násl. OZ)</td></tr>
<tr><td><strong>Renovace a opravy</strong></td><td>oprava závad a obnova hodinek zákazníka</td><td>smlouva o dílo</td></tr>
<tr><td><strong>Přestavba</strong></td><td>úprava hodinek zákazníka podle jeho zadání</td><td>smlouva o dílo</td></tr>
<tr><td><strong>Zakázková výroba</strong></td><td>sestavení hodinek z dílů ateliéru podle zadání zákazníka</td><td>kupní smlouva o věci, která má být vyrobena</td></tr>
</tbody></table>
<p>Zakázky provádí ${seller(L)} (dále jen „ateliér“).</p>
<h2>2. Cena a schválení prací</h2>
<ol>
<li>Ateliér pošle nabídku s popisem prací, cenou a orientačním termínem. Smlouva vzniká písemným (e-mailovým) přijetím nabídky.</li>
<li><strong>Potvrzením nabídky se zakázka stává závaznou</strong>, při zachování zákonných práv spotřebitele (čl. 6).</li>
<li><strong>Zákazník musí předem schválit cenu zakázky i případné dodatečné práce.</strong> Bez jeho souhlasu ateliér práce nad rámec schválené nabídky neprovede.</li>
<li><strong>Záloha se nevyžaduje automaticky.</strong> Je-li u konkrétní zakázky potřebná (např. na nákup dílů), sjedná se individuálně, zpravidla ve výši ${T.deposit.typical} sjednané ceny. U specifických nebo finančně náročných zakázek lze individuálně sjednat i jinou výši. Záloha se v plné výši započítává do konečné ceny.</li>
<li>Výši případné zálohy, její splatnost a splatnost zbývající ceny uvádí nabídka, takže platební podmínky znáte vždy před zahájením prací. Není-li v nabídce uvedeno jinak, je cena splatná před předáním hotových hodinek.</li>
<li>${vatText(L)}</li>
</ol>
<h2>3. Termín</h2>
<p>Termín dokončení se stanovuje <strong>individuálně</strong> podle náročnosti prací a dostupnosti součástek. Pevný termín platí, jen je-li výslovně sjednán. O případném zdržení ateliér zákazníka informuje.</p>
<h2>4. Průběh prací a součásti</h2>
<ol>
<li>U vintage hodinek se mohou při rozebrání ukázat skryté vady. Ateliér zákazníka informuje a další postup provede jen s jeho souhlasem.</li>
<li>Ateliér vždy rozlišuje <strong>původní originální součásti</strong> a <strong>nové součásti použité při přestavbě Dante Time</strong>. Seznam vyměněných a nových součástí obdrží zákazník s hotovými hodinkami. Vyměněné původní součásti ateliér na požádání vrátí.</li>
<li>Pouzdra z drahých kovů: ateliér při převzetí zaznamená ryzost a puncovní značku, je-li přítomna. Pozlacená pouzdra ateliér nebrousí způsobem, který by poškodil pozlacení, bez souhlasu zákazníka.</li>
<li>Vodotěsnost vintage hodinek ateliér nezaručuje, nebyla-li sjednána a ověřena zkouškou. Přesnost chodu vintage hodinek je orientačně ${T.accuracyVintage} s ohledem na kalibr, stav a stáří.</li>
</ol>
<h2>5. Převzetí hodinek zákazníka a předání hotové zakázky</h2>
<ol>
<li>Hodinky lze předat osobně <strong>po předchozí domluvě</strong> (ateliér nemá kamennou prodejnu) nebo zaslat pojištěnou zásilkou. Při převzetí ateliér pořídí fotodokumentaci a potvrdí stav e-mailem.</li>
<li>Hotovou zakázku si zákazník převezme do <strong>${T.pickupDays} dnů</strong> od oznámení o dokončení. <strong>Skladné se neúčtuje.</strong> Po uplynutí lhůty ateliér zákazníka znovu vyzve. Nepřevezme-li hodinky ani v dodatečné přiměřené lhůtě, postupuje ateliér podle § 2609 OZ.</li>
</ol>
<h2>6. Odstoupení u spotřebitele</h2>
<ol>
<li>Zakázkovou výrobu a přestavbu podle zadání spotřebitele nelze vrátit (§ 1837 písm. d) OZ).</li>
<li>U servisu a renovace sjednaných na dálku může spotřebitel odstoupit do ${T.withdrawalDays} dnů od uzavření smlouvy. Zaplacenou zálohu mu v takovém případě vrátíme, s odečtením poměrné části ceny za práce již provedené na jeho žádost. Chce-li, aby práce začaly dříve, musí o to výslovně požádat. Při odstoupení uhradí poměrnou část ceny. Po úplném dokončení prací s jeho souhlasem právo na odstoupení zaniká (§ 1837 písm. a) OZ).</li>
</ol>
<h2>7. Odpovědnost</h2>
<p>Za provedenou práci a nové součásti ateliér odpovídá ${T.liabilityMonths} měsíců od předání (viz <a href="/reklamace">Reklamační řád</a>). Za hodinky převzaté od zákazníka odpovídá ateliér po dobu, kdy je má u sebe, podle občanského zákoníku.</p>`);

// ---------------------------------------------------------------------------
export const shipping = doc('shipping', '/doprava-a-platba', 'Doprava a platba',
  'Doprava v ČR i do celé EU, platba převodem (CZK, EUR), dobírkou v ČR. Atelier Dante Time.',
  () => `${head(L)}
<h2>Doprava v České republice</h2>
<table><thead><tr><th>Způsob</th><th>Cena</th></tr></thead><tbody>
<tr><td><strong>Zásilkovna</strong> – výdejní místo nebo Z-BOX (výběr na mapě)</td><td>${priceCs(T.defaultPrices.zasilkovna)}</td></tr>
<tr><td><strong>Balíkovna</strong> – výdejní místo (výběr na mapě České pošty)</td><td>${priceCs(T.defaultPrices.balikovna)}</td></tr>
<tr><td><strong>Pojištěná přeprava</strong> – u hodinek vyšší hodnoty</td><td>cena se zobrazí v košíku před objednáním</td></tr>
<tr><td><strong>Osobní předání</strong> – pouze po předchozí individuální domluvě (nemáme kamennou prodejnu)</td><td>zdarma</td></tr>
</tbody></table>
<h2>Doprava do zemí EU</h2>
<p>Doručujeme do všech 27 členských států EU včetně Slovenska. Cena dopravy se řídí cílovou zemí a dostupným dopravcem a <strong>zobrazí se v košíku po výběru země, ještě před odesláním objednávky</strong>. Do země, pro kterou cenu zatím nemáme, vám rádi připravíme nabídku.</p>
<h2>Odeslání</h2>
<p>Dostupné hodinky odesíláme do <strong>${T.dispatchWorkingDays} pracovních dnů</strong> od přijetí platby, u dobírky od potvrzení objednávky. O odeslání vás informujeme e-mailem s číslem zásilky. Hodinky vyšší hodnoty posíláme jen pojištěnou přepravou odpovídající jejich hodnotě, nebo je předáme osobně po domluvě.</p>
<h2>Platba</h2>
<table><thead><tr><th>Způsob</th><th>Poplatek</th><th>Poznámka</th></tr></thead><tbody>
<tr><td><strong>Bankovní převod v Kč</strong> s QR platbou</td><td>zdarma</td><td>splatnost ${T.paymentDueDays} dny, údaje a QR kód hned po objednávce</td></tr>
<tr><td><strong>Bankovní převod v EUR</strong> s QR kódem SEPA</td><td>zdarma ze strany ateliéru</td><td>IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}. Částka v EUR podle kurzu ateliéru, zaokrouhlená nahoru na celé euro</td></tr>
<tr><td><strong>Dobírka</strong> (jen ČR, Zásilkovna a Balíkovna)</td><td>${priceCs(T.defaultPrices.cod)}</td><td>hodinky jsou rezervovány do odeslání</td></tr>
<tr><td><strong>Platba kartou</strong></td><td>–</td><td>bude k dispozici po aktivaci platební brány</td></tr>
</tbody></table>
<p>Zahraniční objednávky se hradí předem. ${vatText(L)} Fakturu zasíláme e-mailem po zaplacení.</p>
<p>Majitel účtu: ${OPERATOR.accountHolder}, ${OPERATOR.bankName}, číslo účtu ${OPERATOR.bankAccount}.</p>`);

// ---------------------------------------------------------------------------
export const privacy = doc('privacy', '/privacy', 'Zásady ochrany osobních údajů',
  'Jak Atelier Dante Time zpracovává osobní údaje zákazníků a návštěvníků webu podle GDPR.',
  () => `${head(L)}
<h2>1. Správce</h2>
<p>Správcem osobních údajů je ${seller(L)}, e-mail ${email} (dále jen „správce“). Pověřenec pro ochranu osobních údajů nebyl jmenován, protože to nařízení (EU) 2016/679 (GDPR) správci neukládá.</p>
<h2>2. Účely, právní základy a doby uložení</h2>
<table><thead><tr><th>Účel</th><th>Údaje</th><th>Právní základ</th><th>Doba uložení</th></tr></thead><tbody>
<tr><td>Poptávky a komunikace</td><td>jméno, e-mail, telefon, zpráva, fotografie</td><td>čl. 6 odst. 1 písm. b) GDPR</td><td>po dobu komunikace a 1 rok poté, nevznikne-li smlouva</td></tr>
<tr><td>Uzavření a plnění smlouvy (objednávky, zakázky)</td><td>jméno, e-mail, telefon, adresa, země, výdejní místo, platby; u firem IČO a DIČ</td><td>čl. 6 odst. 1 písm. b)</td><td>po dobu plnění smlouvy</td></tr>
<tr><td>Účetnictví a daně</td><td>údaje na dokladech</td><td>čl. 6 odst. 1 písm. c)</td><td>po dobu stanovenou daňovými a účetními předpisy (zpravidla 10 let)</td></tr>
<tr><td>Evidence prodejů a nákupů (včetně dokladů od dodavatelů a soukromých prodávajících)</td><td>údaje na fakturách a dokladech: jméno, adresa, e-mail, položky, částky</td><td>čl. 6 odst. 1 písm. c) a f)</td><td>po dobu archivace účetních dokladů</td></tr>
<tr><td>Reklamace, nároky, garance pravosti</td><td>údaje o smlouvě, identifikace hodinek</td><td>čl. 6 odst. 1 písm. f) – oprávněný zájem</td><td>4 roky od skončení smlouvy; identifikace hodinek po dobu trvání garance pravosti</td></tr>
<tr><td>Odstoupení od smlouvy online</td><td>jméno, e-mail, číslo objednávky, prohlášení</td><td>čl. 6 odst. 1 písm. c)</td><td>4 roky</td></tr>
<tr><td>Zabezpečení webu a administrace</td><td>IP adresa, čas požadavku</td><td>čl. 6 odst. 1 písm. f)</td><td>nejvýše 30 dnů</td></tr>
</tbody></table>
<p>Neprovádíme profilování ani automatizované rozhodování a nezasíláme obchodní sdělení.</p>
<h2>3. Příjemci a zpracovatelé</h2>
<ul>
<li><strong>Cloudflare, Inc.</strong> – hosting, databáze (uložená v EU) a fotografie,</li>
<li><strong>Google</strong> – e-mailová schránka Gmail,</li>
<li><strong>Resend</strong> – odesílání e-mailů z webu (potvrzení objednávek, faktury, odpovědi na poptávky),</li>
<li><strong>Anthropic PBC</strong> (USA) – zpracování dokladů pomocí umělé inteligence při vedení evidence prodejů a nákupů a příprava návrhů odpovědí na poptávky (text poptávky bez kontaktních údajů; odpověď vždy kontroluje a odesílá provozovatel),</li>
<li><strong>Zásilkovna s.r.o.</strong>, <strong>Česká pošta, s.p.</strong> a další dopravci podle cílové země – doručení zásilky,</li>
<li><strong>Česká spořitelna, a.s.</strong> – příjem plateb (jako samostatný správce),</li>
<li>poskytovatel platební brány – až po její aktivaci (doplníme sem jeho název),</li>
<li>orgány veřejné moci, ukládá-li to zákon.</li>
</ul>
<h2>4. Předání mimo EU</h2>
<p>Cloudflare, Google a Resend mohou údaje zpracovávat v USA na základě rozhodnutí Komise o odpovídající ochraně (EU–US Data Privacy Framework) nebo standardních smluvních doložek.</p>
<p>Anthropic PBC zpracovává doklady a text poptávek v USA na základě standardních smluvních doložek. Údaje nejsou využívány k trénování modelů.</p>
<h2>5. Vaše práva</h2>
<p>Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a námitku proti zpracování na základě oprávněného zájmu. Uplatněte je na ${email}, odpovíme do měsíce. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (Pplk. Sochora 27, 170 00 Praha 7, <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a>) nebo u dozorového úřadu ve státě vašeho bydliště.</p>
<h2>6. Zabezpečení</h2>
<p>Web používá šifrované spojení (HTTPS). Administrace je chráněna heslem a dvoufázovým ověřením. Fotografie hodinek se při nahrání zbavují metadat včetně polohy. Zákaznické údaje nejsou ve veřejném zdrojovém kódu. Databázi pravidelně zálohujeme; zálohy jsou šifrované a uchovávají se nejvýše 30 dní.</p>`);

// ---------------------------------------------------------------------------
export const cookies = doc('cookies', '/cookies', 'Zásady používání cookies',
  'Jaké cookies a technická úložiště používá web Atelier Dante Time a jak spravovat souhlas.',
  () => `${head(L)}
<p><strong>Nepoužíváme analytické, marketingové ani reklamní cookies.</strong> Používáme jen technická úložiště nezbytná pro služby, o které výslovně žádáte. Ta nevyžadují souhlas (§ 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích).</p>
<p><button type="button" class="btn ghost" data-consent-open>Nastavení cookies</button></p>
<table><thead><tr><th>Název</th><th>Kategorie</th><th>Účel</th><th>Doba</th></tr></thead><tbody>
<tr><td><code>dt_cart</code></td><td>nezbytné</td><td>obsah košíku</td><td>do vyprázdnění košíku</td></tr>
<tr><td><code>dt_consent</code></td><td>nezbytné</td><td>uložení vaší volby v nastavení cookies</td><td>12 měsíců</td></tr>
<tr><td><code>__Host-dt_admin</code></td><td>nezbytné</td><td>přihlášení do administrace (jen provozovatel)</td><td>30 dnů</td></tr>
</tbody></table>
<h2>Služby třetích stran</h2>
<ul>
<li><strong>Mapa výdejních míst</strong> Zásilkovny nebo Balíkovny se načte až po vašem kliknutí v košíku. Dopravce může použít vlastní technická úložiště. Polohu mapa použije jen s vaším souhlasem v prohlížeči.</li>
<li><strong>Platba kartou</strong> (po aktivaci) probíhá na stránce platební brány s jejími nezbytnými cookies.</li>
<li>Instagram, TikTok a Facebook jsou jen odkazy, na našem webu se nenačítají.</li>
</ul>
<h2>Správa souhlasů</h2>
<p>V <strong>Nastavení cookies</strong> (odkaz v patičce každé stránky) můžete kdykoli udělit nebo odvolat souhlas s nepovinnými kategoriemi (analytické, marketingové). Dokud je nepoužíváme, zůstávají vypnuté. Pokud bychom je v budoucnu zavedli, nespustí se bez vašeho souhlasu.</p>`);

// ---------------------------------------------------------------------------
export const adr = doc('adr', '/reseni-sporu', 'Mimosoudní řešení spotřebitelských sporů',
  'Jak řešit spor s Atelier Dante Time: stížnost, ADR u České obchodní inspekce a přeshraniční pomoc.',
  () => `${head(L)}
<ol>
<li><strong>Nejdřív nám napište.</strong> Stížnosti a reklamace vyřizujeme na ${email}.</li>
<li><strong>Mimosoudní řešení (ADR).</strong> Nedohodneme-li se, může spotřebitel podat návrh na mimosoudní řešení sporu. Příslušným subjektem je ${coi(L)}. Návrh lze podat nejpozději do 1 roku ode dne, kdy spotřebitel uplatnil své právo u prodávajícího poprvé. Řízení je pro spotřebitele bezplatné.</li>
<li><strong>Přeshraniční spory.</strong> Spotřebitelům z jiných států EU pomáhá ${ecc(L)}.</li>
<li>Evropská platforma pro řešení sporů online (ODR) byla zrušena k 20. 7. 2025 (nařízení (EU) 2024/3228), proto na ni neodkazujeme.</li>
<li>Právo obrátit se na soud tím není dotčeno.</li>
</ol>`);

// ---------------------------------------------------------------------------
export const eu = doc('eu', '/prodej-do-eu', 'Prodej do zemí EU',
  'Pravidla přeshraničního prodeje Atelier Dante Time: doručení do 27 států EU, platby v EUR, vaše práva.',
  () => `${head(L)}
<ol>
<li><strong>Kam doručujeme:</strong> do všech 27 členských států Evropské unie. Cena dopravy se zobrazí podle země před odesláním objednávky.</li>
<li><strong>Stejné podmínky pro celou EU:</strong> v souladu s nařízením (EU) 2018/302 (geoblocking) nabízíme zákazníkům ze všech států EU stejné ceny a obchodní podmínky bez ohledu na jejich státní příslušnost nebo bydliště.</li>
<li><strong>Platba:</strong> zahraniční objednávky se hradí předem bankovním převodem v EUR (QR kód SEPA) nebo v Kč, po aktivaci i kartou. Dobírku do zahraničí nenabízíme.</li>
<li><strong>Daně a clo:</strong> ${vatText(L)} V rámci EU se neplatí clo.</li>
<li><strong>Vaše práva:</strong> ${warrantyShortCs()}, zákonná práva z vadného plnění (${T.liabilityMonths} měsíců), ${T.withdrawalDays} dní na odstoupení u hotových hodinek a doživotní garance pravosti platí stejně pro celou EU. Smlouva se řídí českým právem, ale spotřebitel neztrácí ochranu, kterou mu poskytují kogentní předpisy státu jeho bydliště (čl. 6 nařízení Řím I).</li>
<li><strong>Vrácení ze zahraničí:</strong> náklady na vrácení hodinek nese spotřebitel a mohou být vyšší než v ČR. Doporučujeme pojištěnou zásilku.</li>
<li><strong>Jazyk:</strong> komunikujeme česky a anglicky. Smlouvu lze uzavřít v obou jazycích.</li>
<li><strong>Spory:</strong> viz <a href="/reseni-sporu">Řešení sporů</a>, včetně Evropského spotřebitelského centra.</li>
</ol>`);

// ---------------------------------------------------------------------------
export const operator = doc('operator', '/provozovatel', 'Informace o provozovateli',
  'Povinné informace o provozovateli e-shopu Atelier Dante Time: identifikace, kontakt, dozor a řešení sporů.',
  () => `${head(L)}
<table><tbody>
<tr><th>Provozovatel</th><td>${OPERATOR.name}</td></tr>
<tr><th>Obchodní značka</th><td>${OPERATOR.tradeName} (Atelier Dante Time)</td></tr>
<tr><th>Právní forma</th><td>${OPERATOR.legalForm}</td></tr>
<tr><th>IČO</th><td>${OPERATOR.ico}</td></tr>
<tr><th>DPH</th><td>${vatText(L)}</td></tr>
<tr><th>Sídlo</th><td>${OPERATOR.address}</td></tr>
<tr><th>Zápis</th><td>${registerText(L)}</td></tr>
<tr><th>Podnikání od</th><td>${OPERATOR.businessSince}</td></tr>
<tr><th>E-mail</th><td>${email}</td></tr>
<tr><th>Bankovní spojení</th><td>${OPERATOR.bankAccount}, IBAN ${OPERATOR.ibanPretty}, BIC ${OPERATOR.bic}</td></tr>
</tbody></table>
<p>${INDEPENDENCE.cs}</p>
<h2>Dozor</h2>
<ul>
<li>Česká obchodní inspekce – <a href="https://www.coi.gov.cz" rel="noopener noreferrer">coi.gov.cz</a></li>
<li>Živnostenské podnikání: ${tradeOffice(L)}</li>
<li>Výrobky z drahých kovů: Puncovní úřad – <a href="https://www.puncovniurad.cz" rel="noopener noreferrer">puncovniurad.cz</a></li>
<li>Osobní údaje: Úřad pro ochranu osobních údajů – <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a></li>
</ul>
<p>Mimosoudní řešení sporů: <a href="/reseni-sporu">Řešení sporů</a>.</p>`);

export const DOCS_CS = [terms, claims, withdrawal, warranty, ...(SVC ? [custom] : []), shipping, privacy, cookies, adr, eu, operator];
