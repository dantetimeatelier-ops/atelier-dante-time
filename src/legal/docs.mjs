// Právní dokumenty Atelier Dante Time
// ⚖️ ÚROVEŇ 3 – změny jen se souhlasem majitele (AGENTS.md).
// Stav: NÁVRH k závěrečné kontrole (docs/LEGAL-REVIEW.md). Chybějící údaje
// se zobrazují jako [DOPLNIT: …] a test webu nepustí zveřejnění, dokud jsou.
import { SITE, OPERATOR, op, missing } from '../site.mjs';

export const LEGAL_VERSION = '2026-12-01-navrh';
const DATE = '1. 12. 2026 (návrh)';
const EFFECTIVE = missing('datum účinnosti');

const email = `<a href="mailto:${SITE.email}">${SITE.email}</a>`;
const seller = () => `${op('name', 'jméno a příjmení / obchodní firma')}, IČO ${op('ico', 'IČO')}, se sídlem ${op('address', 'adresa sídla / místa podnikání')}, ${op('register', 'zápis v živnostenském rejstříku (příslušný úřad)')}`;
const vat = () => (OPERATOR.vatPayer === true ? `Prodávající je plátcem DPH (DIČ ${op('dic', 'DIČ')}). Všechny ceny jsou uvedeny včetně DPH.`
  : OPERATOR.vatPayer === false ? 'Prodávající není plátcem DPH. Uvedené ceny jsou konečné.'
  : missing('je / není plátcem DPH – podle toho věta o DPH v cenách'));
const head = (title, extra = '') => `<p class="doc-meta">Verze: ${DATE} · Účinnost od: ${EFFECTIVE}${extra}</p>`;
const toc = (items) => `<nav class="toc" aria-label="Obsah"><strong>Obsah</strong><ol>${items.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>`;
const coi = `Česká obchodní inspekce, Ústřední inspektorát – oddělení ADR, Gorazdova 1969/24, 120 00 Praha 2, e-mail adr@coi.cz, web <a href="https://adr.coi.cz" rel="noopener noreferrer">adr.coi.cz</a>`;
const returnAddr = () => OPERATOR.returnAddress ?? OPERATOR.address ?? missing('adresa pro vrácení zboží');

// ---------------------------------------------------------------------------
export const terms = {
  path: '/terms',
  title: 'Obchodní podmínky',
  description: 'Obchodní podmínky internetového obchodu Atelier Dante Time pro prodej hotových mechanických hodinek.',
  body: () => `${head()}
${toc([['op1', 'Úvodní ustanovení'], ['op2', 'Hodinky a ceny'], ['op3', 'Objednávka a uzavření smlouvy'], ['op4', 'Platba'], ['op5', 'Dodání a přechod nebezpečí'], ['op6', 'Práva z vadného plnění'], ['op7', 'Garance pravosti'], ['op8', 'Odstoupení od smlouvy'], ['op9', 'Osobní údaje'], ['op10', 'Řešení sporů a dozor'], ['op11', 'Kupující podnikatelé'], ['op12', 'Závěrečná ustanovení']])}
<h2 id="op1">1. Úvodní ustanovení</h2>
<ol>
<li>Tyto obchodní podmínky (dále jen „podmínky“) upravují práva a povinnosti při prodeji hotových mechanických hodinek prostřednictvím internetového obchodu na adrese <strong>${SITE.origin.replace('https://', '')}</strong> (dále jen „e-shop“).</li>
<li>Prodávajícím je ${seller()}, e-mail ${email}${OPERATOR.phone ? `, telefon ${OPERATOR.phone}` : ''} (dále jen „prodávající“).</li>
<li>Kupujícím je spotřebitel nebo podnikatel, který s prodávajícím uzavírá kupní smlouvu (dále jen „kupující“). Spotřebitelem je člověk, který mimo rámec své podnikatelské činnosti nebo mimo rámec samostatného výkonu svého povolání uzavírá smlouvu s podnikatelem (§ 419 občanského zákoníku).</li>
<li>Servis, renovace, přestavby a zakázková výroba hodinek se řídí samostatnými <a href="/zakazkova-vyroba">Podmínkami zakázkové výroby, renovací, servisu a přestaveb</a>. Doprava a platby jsou popsány na stránce <a href="/doprava-a-platba">Doprava a platba</a>. Obě stránky, <a href="/reklamace">Reklamační řád</a>, <a href="/returns">Odstoupení od smlouvy a vrácení zboží</a> a <a href="/warranty">Záruka a garance pravosti</a> jsou součástí těchto podmínek.</li>
<li>Smlouvu lze uzavřít v českém jazyce. Práva a povinnosti se řídí právním řádem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník (dále jen „OZ“), a zákonem č. 634/1992 Sb., o ochraně spotřebitele.</li>
</ol>

<h2 id="op2">2. Hodinky a ceny</h2>
<ol>
<li>V e-shopu se prodávají převážně <strong>použité (vintage) hodinky</strong>, které prošly servisem nebo renovací v ateliéru, a hodinky sestavené v ateliéru. U každého kusu je uveden jeho stav, provedené práce, <strong>deklarované originální díly</strong> a díly vyměněné nebo neoriginální. Tyto údaje jsou součástí popisu zboží a smlouvy.</li>
<li>Každé hodinky jsou <strong>unikátní kus</strong> dostupný pouze jednou. Prezentace hodinek v e-shopu je informativní a není návrhem na uzavření smlouvy podle § 1732 odst. 2 OZ.</li>
<li>Ceny jsou uvedeny v korunách českých a jsou konečné. ${vat()} Náklady na dopravu a případné poplatky za způsob platby jsou uvedeny na stránce <a href="/doprava-a-platba">Doprava a platba</a> a kupujícímu se zobrazí před odesláním objednávky.</li>
<li>Prodávající neposkytuje slevy z ceny ani individuálně přizpůsobené ceny na základě automatizovaného rozhodování.</li>
</ol>

<h2 id="op3">3. Objednávka a uzavření smlouvy</h2>
<ol>
<li>Kupující vloží hodinky do košíku, vyplní údaje, zvolí způsob dopravy a platby a seznámí se s těmito podmínkami. Před odesláním objednávky si může všechny údaje zkontrolovat a opravit.</li>
<li>Objednávku kupující odešle tlačítkem <strong>„Objednávka zavazující k platbě“</strong>. Odesláním objednávky kupující potvrzuje, že se seznámil s podmínkami a souhlasí s nimi.</li>
<li>Po odeslání objednávky e-shop hodinky <strong>pro kupujícího rezervuje</strong>, aby je nemohl současně koupit nikdo jiný. Rezervace trvá po dobu splatnosti zvolené platby (viz čl. 4).</li>
<li>Kupní smlouva je uzavřena okamžikem, kdy prodávající kupujícímu doručí e-mailové <strong>potvrzení objednávky</strong>. Součástí potvrzení je text těchto podmínek ve znění platném v den objednávky.</li>
<li>Prodávající uzavřenou smlouvu archivuje v elektronické podobě. Smlouva není přístupná třetím osobám. Kupujícímu je na vyžádání zpřístupněna.</li>
<li>Pokud by hodinky nebylo možné dodat (např. byly prokazatelně poškozeny před odesláním), prodávající kupujícího bez zbytečného odkladu informuje a případně přijatou platbu vrátí nejpozději do 14 dnů.</li>
<li>Náklady na prostředky komunikace na dálku si kupující hradí sám a neliší se od běžné sazby.</li>
</ol>

<h2 id="op4">4. Platba</h2>
<ol>
<li>Kupní cenu lze uhradit způsoby uvedenými na stránce <a href="/doprava-a-platba">Doprava a platba</a>, zejména <strong>bankovním převodem předem</strong> (s QR platbou) a po zprovoznění platební brány také <strong>platební kartou online</strong>.</li>
<li>Při platbě převodem je cena splatná do ${missing('počet – návrh: 3')} dnů od uzavření smlouvy na účet prodávajícího ${op('bankAccount', 'číslo účtu')} s variabilním symbolem uvedeným v potvrzení objednávky. Při platbě kartou je cena splatná ihned.</li>
<li>Pokud kupující cenu neuhradí ve lhůtě splatnosti, rezervace hodinek skončí a prodávající je oprávněn od smlouvy odstoupit. O tom kupujícího informuje e-mailem.</li>
<li>Prodávající nepožaduje zálohu na hotové hodinky nad rámec ceny. Vlastnické právo přechází na kupujícího zaplacením celé kupní ceny a převzetím hodinek.</li>
<li>Daňový doklad (fakturu) zašle prodávající kupujícímu elektronicky po zaplacení.</li>
</ol>

<h2 id="op5">5. Dodání a přechod nebezpečí</h2>
<ol>
<li>Hodinky prodávající odešle zpravidla do ${missing('počet – návrh: 3')} pracovních dnů od připsání platby, nejpozději však do 30 dnů od uzavření smlouvy, pokud není dohodnuto jinak.</li>
<li>Nebezpečí škody na hodinkách přechází na kupujícího-spotřebitele okamžikem, kdy hodinky převezme.</li>
<li>Při převzetí zkontrolujte neporušenost zásilky. Zjevné poškození zásilky uveďte do záznamu u dopravce a neprodleně nás kontaktujte. Postup je popsán na stránce <a href="/returns#poskozeni">Odstoupení a vrácení</a>.</li>
</ol>

<h2 id="op6">6. Práva z vadného plnění</h2>
<ol>
<li>Prodávající odpovídá kupujícímu, že hodinky při převzetí nemají vady, a spotřebiteli dále za vady, které se projeví v době <strong>24 měsíců od převzetí</strong>. Tuto dobu prodávající dodržuje i u použitého zboží, přestože zákon u něj umožňuje sjednat dobu kratší.</li>
<li>Podrobnosti, včetně toho, co není vadou, lhůt a postupu, upravuje <a href="/reklamace">Reklamační řád</a>.</li>
</ol>

<h2 id="op7">7. Garance pravosti</h2>
<p>Na deklarované originální díly poskytuje prodávající <strong>doživotní garanci pravosti</strong> jako smluvní záruku podle § 2113 a násl. OZ. Podmínky jsou na stránce <a href="/warranty">Záruka a garance pravosti</a>. Garance nemá vliv na zákonná práva z vadného plnění.</p>

<h2 id="op8">8. Odstoupení od smlouvy</h2>
<ol>
<li>Spotřebitel má právo od kupní smlouvy uzavřené prostřednictvím e-shopu odstoupit <strong>bez udání důvodu do 14 dnů</strong> od převzetí hodinek (§ 1829 OZ).</li>
<li>Právo na odstoupení nemá spotřebitel u hodinek vyrobených podle jeho požadavků nebo přizpůsobených jeho osobním potřebám (§ 1837 písm. d) OZ), tedy u zakázkové výroby a přestaveb.</li>
<li>Postup, vzorový formulář a <strong>funkce „Odstoupit od smlouvy“</strong> jsou na stránce <a href="/returns">Odstoupení od smlouvy a vrácení zboží</a>.</li>
</ol>

<h2 id="op9">9. Osobní údaje</h2>
<p>Zpracování osobních údajů popisují <a href="/privacy">Zásady ochrany osobních údajů</a>. Používání cookies popisuje stránka <a href="/cookies">Cookies</a>.</p>

<h2 id="op10">10. Vyřizování stížností, mimosoudní řešení sporů a dozor</h2>
<ol>
<li>Stížnosti vyřizuje prodávající na e-mailu ${email}.</li>
<li>Spotřebitel má právo na mimosoudní řešení spotřebitelského sporu. Příslušným subjektem je ${coi}.</li>
<li>Dozor nad dodržováním povinností na ochranu spotřebitele vykonává Česká obchodní inspekce (<a href="https://www.coi.gov.cz" rel="noopener noreferrer">www.coi.gov.cz</a>), nad dodržováním živnostenských předpisů ${missing('příslušný živnostenský úřad')} a nad ochranou osobních údajů Úřad pro ochranu osobních údajů.</li>
<li>Prodávající v e-shopu nezveřejňuje hodnocení ani recenze zákazníků. Pokud je začne zveřejňovat, doplní informaci o tom, zda a jak ověřuje jejich původ.</li>
</ol>

<h2 id="op11">11. Kupující podnikatelé</h2>
<p>Ustanovení o právech spotřebitele (zejména odstoupení od smlouvy podle čl. 8) se na kupujícího-podnikatele nevztahují. U kupujícího-podnikatele přechází nebezpečí škody předáním hodinek prvnímu dopravci. Práva z vadného plnění se u podnikatele řídí § 2099 a násl. OZ. Prodávající mu navíc poskytuje <strong>záruku za jakost 24 měsíců</strong> od převzetí.</p>

<h2 id="op12">12. Závěrečná ustanovení</h2>
<ol>
<li>Je-li kupujícím spotřebitel s obvyklým bydlištěm v jiném státě EU, nejsou dotčena kogentní ustanovení na ochranu spotřebitele podle práva tohoto státu.</li>
<li>Prodávající může podmínky měnit. Na smlouvy uzavřené před změnou se použije znění platné v den odeslání objednávky.</li>
<li>Tyto podmínky nabývají účinnosti dnem ${EFFECTIVE}.</li>
</ol>`,
};

// ---------------------------------------------------------------------------
export const claims = {
  path: '/reklamace',
  title: 'Reklamační řád',
  description: 'Reklamační řád Atelier Dante Time: lhůty, postup reklamace a práva z vadného plnění u hodinek, zakázkové výroby a servisu.',
  body: () => `${head()}
${toc([['rr1', 'Na co se reklamační řád vztahuje'], ['rr2', 'Doba pro uplatnění vad'], ['rr3', 'Co není vadou'], ['rr4', 'Jak reklamovat'], ['rr5', 'Vaše práva při vadě'], ['rr6', 'Vyřízení reklamace'], ['rr7', 'Náklady']])}
<h2 id="rr1">1. Na co se reklamační řád vztahuje</h2>
<ul>
<li><strong>Hotové hodinky</strong> koupené v e-shopu nebo jinak od prodávajícího (kupní smlouva).</li>
<li><strong>Zakázková výroba</strong> – hodinky sestavené z dílů prodávajícího podle přání zákazníka (kupní smlouva o věci, která má být teprve vyrobena).</li>
<li><strong>Servis, renovace a přestavby</strong> hodinek zákazníka (smlouva o dílo) – reklamuje se provedená práce a nově dodané díly.</li>
</ul>
<p>Provozovatel: ${seller()}, e-mail ${email}.</p>

<h2 id="rr2">2. Doba pro uplatnění vad</h2>
<ol>
<li>U spotřebitele odpovídáme za vady, které se projeví do <strong>24 měsíců od převzetí</strong>. Tuto dobu dodržujeme i u použitých (vintage) hodinek.</li>
<li>Projeví-li se vada do jednoho roku od převzetí, má se za to, že hodinky byly vadné již při převzetí, ledaže to vylučuje povaha věci nebo vady (§ 2161 a násl. OZ).</li>
<li>U servisu, renovace a přestavby odpovídáme za provedenou práci a nově dodané díly <strong>24 měsíců</strong> od předání hodinek.</li>
<li>Vadu je třeba uplatnit bez zbytečného odkladu poté, co ji zjistíte. Doporučujeme nás kontaktovat co nejdříve, aby se vada nezhoršila.</li>
</ol>

<h2 id="rr3">3. Co není vadou</h2>
<ul>
<li>stav a vlastnosti, které jsou uvedeny v popisu konkrétního kusu (např. patina, stopy používání, vyměněné díly), a vady, pro které byla sjednána nižší cena,</li>
<li>u použitých hodinek opotřebení odpovídající míře používání, kterou měly při převzetí,</li>
<li>opotřebení způsobené obvyklým užíváním (např. řemínek, sklíčko, povrch pouzdra),</li>
<li>odchylka přesnosti chodu v rozsahu uvedeném u konkrétního kusu, jinak v rozsahu obvyklém pro daný typ a stáří strojku ${missing('ověřit / případně uvést konkrétní toleranci, např. ±30 s/den u vintage strojků')},</li>
<li>poškození pádem, nárazem, vodou nebo vlhkostí (pokud hodinky nebyly výslovně označeny jako vodotěsné), magnetickým polem, chemikáliemi nebo neodborným zásahem třetí osoby,</li>
<li>poškození vzniklé nedodržením <a href="/care">doporučení k péči o hodinky</a>.</li>
</ul>

<h2 id="rr4">4. Jak reklamovat</h2>
<ol>
<li>Napište na ${email} s předmětem „Reklamace“. Uveďte číslo objednávky nebo zakázky, popis vady, kdy a jak se projevuje, a připojte fotografie nebo krátké video.</li>
<li>Uveďte, jaké právo z vadného plnění uplatňujete (viz čl. 5).</li>
<li>Domluvíme se na předání hodinek. Hodinky zasílejte pojištěné na adresu ${returnAddr()}, ne na dobírku.</li>
<li>Při uplatnění reklamace vám vydáme písemné (e-mailové) potvrzení s datem uplatnění, obsahem reklamace a požadovaným způsobem vyřízení.</li>
</ol>

<h2 id="rr5">5. Vaše práva při vadě</h2>
<ol>
<li>Má-li věc vadu, můžete požadovat její <strong>odstranění opravou</strong>, nebo dodání nové věci bez vady. U unikátních hodinek výměna zpravidla není možná, proto vadu odstraníme opravou, pokud se nedohodneme jinak.</li>
<li>Můžete požadovat přiměřenou <strong>slevu</strong>, nebo od smlouvy <strong>odstoupit</strong>, pokud
  <ul>
  <li>jsme vadu odmítli odstranit nebo ji neodstranili v souladu se zákonem,</li>
  <li>se vada projeví opakovaně,</li>
  <li>je vada podstatným porušením smlouvy, nebo</li>
  <li>je z našeho prohlášení nebo z okolností zřejmé, že vadu neodstraníme v přiměřené době nebo bez značných obtíží pro vás.</li>
  </ul></li>
<li>Od smlouvy nelze odstoupit, je-li vada nevýznamná.</li>
<li>Pokud jste vadu před převzetím věděli nebo ji sami způsobili, práva z vadného plnění vám nenáleží.</li>
<li>U servisu a renovace (smlouva o dílo) se práva z vadného plnění řídí přiměřeně týmiž pravidly.</li>
</ol>

<h2 id="rr6">6. Vyřízení reklamace</h2>
<ol>
<li>Reklamaci vyřídíme a vadu odstraníme <strong>nejpozději do 30 dnů</strong> od jejího uplatnění, pokud se s vámi nedohodneme na delší lhůtě.</li>
<li>O vyřízení vás informujeme e-mailem a vydáme potvrzení o datu a způsobu vyřízení, včetně potvrzení o provedení opravy a době jejího trvání, případně písemné odůvodnění zamítnutí.</li>
<li>Bude-li k posouzení vady potřeba odborné vyjádření, můžeme si jej vyžádat. Je-li reklamace oprávněná, nese jeho náklady prodávající.</li>
</ol>

<h2 id="rr7">7. Náklady</h2>
<p>U oprávněné reklamace vám uhradíme účelně vynaložené náklady (zejména poštovné za zaslání hodinek). Opravené hodinky vám zašleme na naše náklady.</p>
<p>Mimosoudní řešení sporů: ${coi}.</p>`,
};

// ---------------------------------------------------------------------------
export const withdrawal = {
  path: '/returns',
  title: 'Odstoupení od smlouvy a vrácení zboží',
  description: 'Jak vrátit hotové hodinky do 14 dnů: postup, vzorový formulář a online funkce pro odstoupení od smlouvy.',
  body: () => `${head()}
<p class="notice"><strong>Odstoupit od smlouvy můžete i online</strong> – na stránce <a href="/odstoupeni">Odstoupit od smlouvy</a>, nebo e-mailem na ${email}.</p>
${toc([['os1', 'Lhůta 14 dnů'], ['os2', 'Jak odstoupit'], ['os3', 'Vrácení hodinek'], ['os4', 'Vrácení peněz'], ['os5', 'Kdy nelze odstoupit'], ['poskozeni', 'Poškozená zásilka'], ['formular', 'Vzorový formulář']])}
<h2 id="os1">1. Lhůta 14 dnů</h2>
<p>Jako spotřebitel můžete od kupní smlouvy na <strong>hotové hodinky</strong> uzavřené prostřednictvím e-shopu nebo jiných prostředků komunikace na dálku odstoupit <strong>bez udání důvodu do 14 dnů</strong> ode dne, kdy jste hodinky převzali (§ 1829 OZ). Lhůta je zachována, odešlete-li odstoupení před jejím uplynutím.</p>

<h2 id="os2">2. Jak odstoupit</h2>
<ul>
<li><strong>online</strong> pomocí funkce <a href="/odstoupeni">„Odstoupit od smlouvy“</a> – přijetí vám obratem potvrdíme e-mailem,</li>
<li><strong>e-mailem</strong> na ${email},</li>
<li><strong>dopisem</strong> na adresu ${returnAddr()}.</li>
</ul>
<p>Můžete použít <a href="#formular">vzorový formulář</a>, není to však povinné. Stačí jakékoli jednoznačné prohlášení.</p>

<h2 id="os3">3. Vrácení hodinek</h2>
<ol>
<li>Hodinky nám zašlete nebo předejte <strong>nejpozději do 14 dnů od odstoupení</strong> na adresu ${returnAddr()}. Doporučujeme pojištěnou zásilku. Zásilky na dobírku nepřebíráme.</li>
<li><strong>Náklady na vrácení hodinek nesete vy.</strong></li>
<li>Hodinky vraťte kompletní, ideálně s příslušenstvím (krabička, doklady, garance pravosti).</li>
<li>Odpovídáte za snížení hodnoty hodinek, které vzniklo nakládáním s nimi jinak, než je nutné k seznámení se s jejich povahou, vlastnostmi a funkčností (např. poškrábání pouzdra, otevření pouzdra, vniknutí vody).</li>
</ol>

<h2 id="os4">4. Vrácení peněz</h2>
<ol>
<li>Vrátíme vám všechny přijaté peněžní prostředky včetně nákladů na dodání, nejpozději <strong>do 14 dnů od odstoupení</strong>. Pokud jste zvolili jiný než nejlevnější nabízený způsob dodání, vrátíme náklady na dodání ve výši nejlevnějšího nabízeného způsobu.</li>
<li>Peníze vrátíme stejným způsobem, jakým jsme je přijali, pokud nesouhlasíte s jiným způsobem, který pro vás nebude znamenat další náklady.</li>
<li>Peníze nemusíme vrátit dříve, než nám hodinky předáte nebo prokážete, že jste je odeslali.</li>
</ol>

<h2 id="os5">5. Kdy nelze odstoupit</h2>
<ul>
<li><strong>zakázková výroba a přestavby</strong> – hodinky vyrobené nebo upravené podle vašich požadavků (§ 1837 písm. d) OZ),</li>
<li><strong>servis a renovace</strong>, které byly se zahájením se vaším výslovným souhlasem před uplynutím lhůty pro odstoupení <strong>zcela dokončeny</strong> (§ 1837 písm. a) OZ). Podrobnosti v <a href="/zakazkova-vyroba">podmínkách zakázkové výroby a servisu</a>,</li>
<li>kupující podnikatel – zákonné právo na odstoupení se vztahuje jen na spotřebitele. ${missing('rozhodnout: nabídnout 14denní vrácení i podnikatelům? (obchodní závazek „14denní možnost vrácení hotových hodinek“)')}</li>
</ul>
<p>Výměna hodinek za jiný kus je možná po vzájemné dohodě, protože každý kus je unikátní.</p>

<h2 id="poskozeni">6. Poškozená zásilka</h2>
<ol>
<li>Při převzetí zkontrolujte neporušenost obalu.</li>
<li>Je-li zásilka zjevně poškozená, sepište s dopravcem záznam o poškození, případně zásilku nepřebírejte.</li>
<li>Pořiďte fotografie obalu i obsahu a do 2 pracovních dnů nám napište na ${email}.</li>
<li>Pozdější uplatnění nemá vliv na vaše práva z vadného plnění, ale ztěžuje vyřízení u dopravce.</li>
</ol>

<h2 id="formular">7. Vzorový formulář pro odstoupení od smlouvy</h2>
<p class="doc-meta">Podle přílohy nařízení vlády č. 363/2013 Sb. Vyplňte a odešlete tento formulář pouze v případě, že chcete odstoupit od smlouvy.</p>
<div class="card" style="box-shadow:none">
<p><strong>Oznámení o odstoupení od smlouvy</strong></p>
<p>Adresát: ${op('name', 'jméno / obchodní firma')}, ${op('address', 'adresa')}, e-mail ${SITE.email}</p>
<p>Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží: ……………………………</p>
<p>Datum objednání / datum obdržení: ……………………………</p>
<p>Číslo objednávky: ……………………………</p>
<p>Jméno a příjmení spotřebitele: ……………………………</p>
<p>Adresa spotřebitele: ……………………………</p>
<p>Číslo účtu pro vrácení peněz (nepovinné): ……………………………</p>
<p>Podpis spotřebitele (pouze pokud je formulář zasílán v listinné podobě): ……………………………</p>
<p>Datum: ……………………………</p>
</div>`,
};

// ---------------------------------------------------------------------------
export const warranty = {
  path: '/warranty',
  title: 'Záruka a garance pravosti',
  description: 'Práva z vadného plnění 24 měsíců a doživotní garance pravosti deklarovaných originálních dílů hodinek Atelier Dante Time.',
  body: () => `${head()}
<h2>1. Odpovědnost za vady – 24 měsíců</h2>
<p>Za vady hotových hodinek, zakázkové výroby i provedeného servisu odpovídáme <strong>24 měsíců</strong> od převzetí, a to i u použitých (vintage) hodinek. Postup najdete v <a href="/reklamace">Reklamačním řádu</a>. Jde o vaše zákonná práva. Následující garance pravosti je navíc.</p>

<h2>2. Doživotní garance pravosti originálních dílů</h2>
<p><strong>Prohlášení o záruce (smluvní záruka podle § 2113 a násl. OZ)</strong></p>
<ol>
<li><strong>Kdo garanci poskytuje:</strong> ${seller()}, e-mail ${email}.</li>
<li><strong>Co garantujeme:</strong> že díly, které jsou u konkrétních hodinek v popisu, v potvrzení objednávky nebo v certifikátu výslovně označeny jako <strong>originální</strong> (deklarované originální díly), jsou originálními díly daného výrobce odpovídajícími popisu.</li>
<li><strong>Doba trvání:</strong> bez časového omezení – po celou dobu existence hodinek. ${missing('rozhodnout: platí garance jen pro prvního kupujícího, nebo i pro každého dalšího majitele s dokladem o koupi?')}</li>
<li><strong>Co garance nezahrnuje:</strong> díly označené jako vyměněné, neoriginální nebo bez deklarace; díly, které po prodeji vyměnil nebo upravil někdo jiný než ateliér; běžné opotřebení a poškození.</li>
<li><strong>Jak garanci uplatnit:</strong> napište na ${email}, přiložte doklad o koupi a důvod pochybnosti (např. odborné vyjádření). Hodinky posoudíme, případně necháme posoudit nezávislým odborníkem. Náklady na posouzení neseme my, pokud se pochybnost potvrdí.</li>
<li><strong>Co získáte, pokud se ukáže, že deklarovaný díl originální není:</strong> ${missing('zvolit nápravu – návrh: podle vaší volby (a) výměna dílu za originální na naše náklady, je-li dostupný, nebo (b) vrácení celé kupní ceny proti vrácení hodinek')}.</li>
<li><strong>Územní platnost:</strong> garanci lze uplatnit odkudkoli, komunikace probíhá v češtině nebo angličtině.</li>
<li>Garance <strong>nemá vliv na vaše zákonná práva</strong> z vadného plnění, která trvají vedle ní a uplatnění garance je nijak neomezuje.</li>
</ol>

<h2>3. Servis</h2>
<p>Pro zachování správné funkce doporučujeme odborný servis mechanických hodinek přibližně každých 3–5 let. Rádi jej provedeme – viz <a href="/services">Služby</a>.</p>`,
};

// ---------------------------------------------------------------------------
export const custom = {
  path: '/zakazkova-vyroba',
  title: 'Zakázková výroba, renovace, servis a přestavby',
  description: 'Podmínky Atelier Dante Time pro servis, renovace, přestavby a zakázkovou výrobu mechanických hodinek.',
  body: () => `${head()}
${toc([['zv1', 'Rozsah a druhy zakázek'], ['zv2', 'Poptávka, nabídka a uzavření smlouvy'], ['zv3', 'Převzetí hodinek'], ['zv4', 'Cena, záloha a platba'], ['zv5', 'Průběh prací'], ['zv6', 'Termíny a předání'], ['zv7', 'Odstoupení spotřebitele'], ['zv8', 'Odpovědnost za vady'], ['zv9', 'Odpovědnost za svěřené hodinky']])}
<h2 id="zv1">1. Rozsah a druhy zakázek</h2>
<p>Tyto podmínky upravují zakázky, které provádí ${seller()} (dále jen „ateliér“). Rozlišujeme:</p>
<table><thead><tr><th>Druh</th><th>Co to je</th><th>Smluvní typ</th></tr></thead><tbody>
<tr><td><strong>Servis</strong></td><td>údržba hodinek zákazníka (rozebrání, čištění, mazání, seřízení)</td><td>smlouva o dílo (§ 2586 a násl. OZ)</td></tr>
<tr><td><strong>Renovace a opravy</strong></td><td>oprava závad a obnova hodinek zákazníka</td><td>smlouva o dílo</td></tr>
<tr><td><strong>Přestavba</strong></td><td>úprava hodinek zákazníka podle jeho přání (např. jiný ciferník, ručky, pouzdro)</td><td>smlouva o dílo</td></tr>
<tr><td><strong>Zakázková výroba</strong></td><td>sestavení nových hodinek z dílů ateliéru podle přání zákazníka</td><td>kupní smlouva o věci, která má být teprve vyrobena</td></tr>
</tbody></table>
<p>Pokud k zakázkové výrobě dodává podstatnou část materiálu zákazník, jde o smlouvu o dílo. Na prodej hotových hodinek se vztahují <a href="/terms">Obchodní podmínky</a>.</p>

<h2 id="zv2">2. Poptávka, nabídka a uzavření smlouvy</h2>
<ol>
<li>Zákazník pošle poptávku (formulář, e-mail) s popisem a fotografiemi hodinek.</li>
<li>Ateliér pošle nabídku s popisem prací, <strong>orientační cenou</strong> (cenou určenou odhadem) a předpokládaným termínem.</li>
<li>Smlouva je uzavřena, když zákazník nabídku <strong>písemně (e-mailem) přijme</strong>. U zakázkové výroby navíc zaplacením zálohy, je-li sjednána.</li>
</ol>

<h2 id="zv3">3. Převzetí hodinek</h2>
<ol>
<li>Hodinky lze předat osobně po domluvě nebo zaslat pojištěnou zásilkou. Riziko přepravy do ateliéru nese odesílatel. Doporučujeme pojištění na plnou hodnotu.</li>
<li>Při převzetí ateliér pořídí fotodokumentaci a potvrdí e-mailem stav hodinek, viditelné vady a příslušenství (převzetí).</li>
</ol>

<h2 id="zv4">4. Cena, záloha a platba</h2>
<ol>
<li>U servisu a renovace je cena určena <strong>odhadem</strong>. Ukáže-li se, že bude nutné odhad podstatně překročit, ateliér zákazníka bez zbytečného odkladu informuje a <strong>bez jeho souhlasu v pracích nad odhad nepokračuje</strong>. Zákazník může v takovém případě od smlouvy odstoupit a uhradit jen část ceny odpovídající již provedeným pracím.</li>
<li>U zakázkové výroby a přestaveb může ateliér požadovat zálohu ve výši ${missing('výše zálohy, např. 30–50 % ceny')} před objednáním dílů. Záloha se započítává do ceny.</li>
<li>Zbývající cena je splatná před předáním hotových hodinek, převodem nebo jiným dohodnutým způsobem. ${vat()}</li>
</ol>

<h2 id="zv5">5. Průběh prací</h2>
<ol>
<li>U vintage hodinek se mohou při rozebrání ukázat <strong>skryté vady</strong> (únava materiálu, opotřebené nebo dříve neodborně vyměněné díly), které nebyly předem viditelné. Ateliér zákazníka informuje a navrhne další postup.</li>
<li>Náhradní díly ateliér zajišťuje podle dostupnosti. Originální díly nemusí být k historickým hodinkám vždy k dispozici. Použití neoriginálního dílu je možné jen se souhlasem zákazníka a vždy se uvede v popisu provedených prací.</li>
<li>Vyměněné původní díly ateliér na požádání vrátí zákazníkovi.</li>
<li>U vintage hodinek ateliér <strong>nezaručuje vodotěsnost</strong>, pokud nebyla výslovně sjednána a ověřena zkouškou.</li>
</ol>

<h2 id="zv6">6. Termíny a předání</h2>
<ol>
<li>Termín uvedený v nabídce je předpokládaný. Obvyklá délka servisu je 2–3 týdny, u renovací a zakázkové výroby podle rozsahu a dostupnosti dílů. Pevný termín platí, jen je-li výslovně sjednán.</li>
<li>O dokončení ateliér zákazníka informuje. Hotové hodinky předá osobně nebo odešle pojištěnou zásilkou na náklady zákazníka, není-li dohodnuto jinak.</li>
<li>S hodinkami zákazník obdrží popis provedených prací a seznam vyměněných dílů.</li>
<li>Nepřevezme-li zákazník hodinky ani do ${missing('lhůta, např. 6 měsíců')} od oznámení o dokončení, postupuje ateliér podle § 2609 OZ. ${missing('rozhodnout, zda účtovat skladné, a v jaké výši')}</li>
</ol>

<h2 id="zv7">7. Odstoupení od smlouvy u spotřebitele</h2>
<ol>
<li>Je-li smlouva se spotřebitelem uzavřena na dálku (e-mailem, přes web), má spotřebitel právo od ní odstoupit do 14 dnů od jejího uzavření, s výjimkami níže.</li>
<li><strong>Zakázková výroba a přestavby:</strong> právo na odstoupení není, protože jde o plnění podle požadavků spotřebitele (§ 1837 písm. d) OZ).</li>
<li><strong>Servis a renovace:</strong> chce-li spotřebitel, aby ateliér začal pracovat před uplynutím lhůty pro odstoupení, musí o to <strong>výslovně požádat</strong>. Odstoupí-li poté, uhradí poměrnou část ceny za práce provedené do odstoupení. Byly-li práce s jeho souhlasem <strong>zcela dokončeny</strong>, právo na odstoupení zaniká (§ 1837 písm. a) OZ). Ateliér si tento souhlas vyžádá e-mailem při přijetí zakázky.</li>
</ol>

<h2 id="zv8">8. Odpovědnost za vady</h2>
<p>Za provedenou práci a nově dodané díly ateliér odpovídá <strong>24 měsíců</strong> od předání hodinek. Odpovědnost se nevztahuje na díly, na kterých se nepracovalo, a na vady způsobené skrytými vadami původních dílů, na které ateliér zákazníka upozornil. Postup podle <a href="/reklamace">Reklamačního řádu</a>.</p>

<h2 id="zv9">9. Odpovědnost za svěřené hodinky</h2>
<p>Ateliér odpovídá za škodu na hodinkách převzatých od zákazníka po dobu, kdy je má u sebe. ${missing('ověřit: pojištění odpovědnosti za převzaté věci a případný limit; doporučeno sjednat')}</p>`,
};

// ---------------------------------------------------------------------------
export const shipping = {
  path: '/doprava-a-platba',
  title: 'Doprava a platba',
  description: 'Způsoby doručení (Zásilkovna, Balíkovna) a platby (převod s QR platbou, karta) v e-shopu Atelier Dante Time.',
  body: () => `${head()}
<h2>Doprava</h2>
<table><thead><tr><th>Způsob</th><th>Cena</th><th>Doručení</th></tr></thead><tbody>
<tr><td><strong>Zásilkovna</strong> – výdejní místo nebo Z-BOX</td><td>${missing('cena')}</td><td>obvykle 1–2 pracovní dny od odeslání</td></tr>
<tr><td><strong>Balíkovna</strong> – výdejní místo</td><td>${missing('cena')}</td><td>obvykle 1–2 pracovní dny od odeslání</td></tr>
<tr><td><strong>Osobní převzetí</strong> po domluvě</td><td>zdarma</td><td>${missing('místo osobního převzetí, nebo tuto možnost odstranit')}</td></tr>
</tbody></table>
<p>Hodinky odesíláme pečlivě zabalené a pojištěné. ${missing('ověřit limity pojištění zásilek u Zásilkovny a Balíkovny pro hodnotu hodinek; u dražších kusů případně jen osobní převzetí')} Doručujeme v rámci České republiky. ${missing('rozhodnout: doručení na Slovensko / do EU?')}</p>
<p>Hodinky odešleme zpravidla do ${missing('počet')} pracovních dnů od připsání platby. O odeslání vás informujeme e-mailem včetně čísla zásilky.</p>

<h2>Platba</h2>
<table><thead><tr><th>Způsob</th><th>Poplatek</th><th>Poznámka</th></tr></thead><tbody>
<tr><td><strong>Bankovní převod předem</strong> s QR platbou</td><td>zdarma</td><td>Platební údaje a QR kód dostanete v potvrzení objednávky. Hodinky jsou po dobu splatnosti rezervovány.</td></tr>
<tr><td><strong>Platba kartou online</strong></td><td>zdarma</td><td>${missing('k dispozici po aktivaci platební brány – název poskytovatele')}</td></tr>
</tbody></table>
<p>Dobírku nenabízíme. Všechny ceny jsou v Kč. ${vat()} Fakturu zasíláme e-mailem po zaplacení.</p>`,
};

// ---------------------------------------------------------------------------
export const privacy = {
  path: '/privacy',
  title: 'Zásady ochrany osobních údajů',
  description: 'Jak Atelier Dante Time zpracovává osobní údaje zákazníků a návštěvníků webu podle GDPR.',
  body: () => `${head()}
${toc([['gd1', 'Správce'], ['gd2', 'Jaké údaje, proč a jak dlouho'], ['gd3', 'Komu údaje předáváme'], ['gd4', 'Předávání mimo EU'], ['gd5', 'Vaše práva'], ['gd6', 'Zabezpečení']])}
<h2 id="gd1">1. Správce</h2>
<p>Správcem osobních údajů je ${seller()}, e-mail ${email} (dále jen „správce“). Správce nejmenoval pověřence pro ochranu osobních údajů, protože mu to nařízení (EU) 2016/679 (GDPR) neukládá.</p>

<h2 id="gd2">2. Jaké údaje zpracováváme, proč a jak dlouho</h2>
<table><thead><tr><th>Účel</th><th>Údaje</th><th>Právní základ (GDPR)</th><th>Doba uložení</th></tr></thead><tbody>
<tr><td>Vyřízení poptávky a komunikace</td><td>jméno, e-mail, telefon, obsah zprávy, fotografie</td><td>čl. 6 odst. 1 písm. b) – jednání o smlouvě na vaši žádost</td><td>po dobu komunikace a 1 rok poté, nevznikne-li smlouva</td></tr>
<tr><td>Uzavření a plnění kupní smlouvy nebo zakázky</td><td>jméno, e-mail, telefon, fakturační adresa, výdejní místo, objednané zboží, platby; u firem IČO a DIČ</td><td>čl. 6 odst. 1 písm. b) – plnění smlouvy</td><td>po dobu plnění smlouvy</td></tr>
<tr><td>Účetnictví a daně</td><td>údaje na daňových dokladech</td><td>čl. 6 odst. 1 písm. c) – právní povinnost</td><td>po dobu stanovenou daňovými a účetními předpisy ${missing('upřesnit podle režimu: plátce DPH 10 let, jinak podle zákona o daních z příjmů / účetnictví')}</td></tr>
<tr><td>Uplatnění a obrana právních nároků, reklamace, garance pravosti</td><td>údaje o smlouvě a komunikaci</td><td>čl. 6 odst. 1 písm. f) – oprávněný zájem</td><td>4 roky od skončení smlouvy (promlčecí lhůta + 1 rok); u garance pravosti po dobu jejího trvání</td></tr>
<tr><td>Odstoupení od smlouvy podané online</td><td>jméno, e-mail, číslo objednávky, obsah prohlášení</td><td>čl. 6 odst. 1 písm. c) – právní povinnost</td><td>4 roky od odstoupení</td></tr>
<tr><td>Zabezpečení webu a administrace</td><td>IP adresa, čas požadavku</td><td>čl. 6 odst. 1 písm. f) – oprávněný zájem na bezpečnosti</td><td>nejvýše 30 dnů</td></tr>
</tbody></table>
<p>Uvedení údajů nutných k uzavření smlouvy je smluvním požadavkem. Bez nich nelze objednávku nebo zakázku vyřídit. Nezasíláme obchodní sdělení, neprovádíme profilování ani automatizované rozhodování.</p>

<h2 id="gd3">3. Komu údaje předáváme</h2>
<ul>
<li><strong>Cloudflare, Inc.</strong> – hosting webu, databáze a úložiště fotografií (zpracovatel),</li>
<li><strong>Google Ireland Ltd. / Google LLC</strong> – e-mailová schránka Gmail (zpracovatel),</li>
<li><strong>GitHub, Inc.</strong> – hosting současné verze webu do přechodu na Cloudflare (technické záznamy o přístupech),</li>
<li><strong>Zásilkovna s.r.o.</strong> nebo <strong>Česká pošta, s.p.</strong> – doručení zásilky (jméno, e-mail, telefon, výdejní místo),</li>
<li>poskytovatel platební brány ${missing('název – po aktivaci')} – zpracování platby kartou,</li>
<li>poskytovatel odesílání e-mailů ${missing('název – po aktivaci (např. Resend)')},</li>
<li>${missing('účetní / fakturační služba (např. Fakturoid), pokud ji budete používat')},</li>
<li>orgány veřejné moci, pokud to ukládá zákon.</li>
</ul>

<h2 id="gd4">4. Předávání mimo EU</h2>
<p>Někteří zpracovatelé (Cloudflare, Google, GitHub) mohou údaje zpracovávat v USA. Předání je založeno na rozhodnutí Evropské komise o odpovídající ochraně (EU–US Data Privacy Framework), u něhož jsou tyto společnosti certifikovány, případně na standardních smluvních doložkách. ${missing('ověřit aktuální certifikace v seznamu dataprivacyframework.gov')}</p>

<h2 id="gd5">5. Vaše práva</h2>
<p>Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést námitku proti zpracování na základě oprávněného zájmu. Svá práva uplatníte na ${email}. Odpovíme do jednoho měsíce.</p>
<p>Máte také právo podat stížnost u dozorového úřadu: <strong>Úřad pro ochranu osobních údajů</strong>, Pplk. Sochora 27, 170 00 Praha 7, <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a>.</p>

<h2 id="gd6">6. Zabezpečení</h2>
<p>Web používá šifrované spojení (HTTPS). Administrace je chráněna heslem a dvoufázovým ověřením. Fotografie hodinek se při nahrávání zbavují metadat (včetně polohy GPS). Zákaznické údaje nejsou uloženy ve veřejném zdrojovém kódu webu.</p>`,
};

// ---------------------------------------------------------------------------
export const cookies = {
  path: '/cookies',
  title: 'Cookies a ukládání dat v prohlížeči',
  description: 'Jaké cookies a technická úložiště používá web Atelier Dante Time. Nepoužíváme analytické ani reklamní cookies.',
  body: () => `${head()}
<p><strong>Nepoužíváme analytické, marketingové ani reklamní cookies</strong> a nesledujeme vás napříč weby. Proto po vás nežádáme souhlas a na webu není cookie lišta.</p>
<p>Používáme pouze technická úložiště nezbytná pro fungování služeb, o které výslovně žádáte. K jejich použití není podle § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích, souhlas potřeba.</p>
<table><thead><tr><th>Název</th><th>Typ</th><th>Účel</th><th>Doba uložení</th></tr></thead><tbody>
<tr><td><code>dt_cart</code></td><td>localStorage</td><td>obsah nákupního košíku (seznam vybraných hodinek)</td><td>do vyprázdnění košíku nebo smazání v prohlížeči</td></tr>
<tr><td><code>__Host-dt_admin</code></td><td>cookie</td><td>přihlášení do administrace (jen pro provozovatele)</td><td>30 dnů nebo do odhlášení</td></tr>
</tbody></table>
<h2>Služby třetích stran</h2>
<ul>
<li><strong>Výběr výdejního místa Zásilkovny</strong> se načte ze serveru Zásilkovny až ve chvíli, kdy na něj v košíku kliknete. Zásilkovna může při tom použít vlastní technická úložiště podle svých zásad.</li>
<li><strong>Platba kartou</strong> probíhá na stránce poskytovatele platební brány, který používá vlastní cookies nezbytné pro bezpečnost platby.</li>
<li>Odkazy na Instagram a TikTok jsou obyčejné odkazy. Tyto služby se na našem webu nenačítají.</li>
</ul>
<p>Pokud bychom v budoucnu chtěli používat měření návštěvnosti nebo jiné nepovinné cookies, vyžádáme si předem váš souhlas a tuto stránku aktualizujeme.</p>`,
};

// ---------------------------------------------------------------------------
export const operator = {
  path: '/provozovatel',
  title: 'Informace o provozovateli',
  description: 'Povinné informace o provozovateli webu a e-shopu Atelier Dante Time: identifikace, kontakt, dozor a řešení sporů.',
  body: () => `${head()}
<table><tbody>
<tr><th>Provozovatel</th><td>${op('name', 'jméno a příjmení / obchodní firma')}</td></tr>
<tr><th>IČO</th><td>${op('ico', 'IČO')}</td></tr>
<tr><th>DIČ / DPH</th><td>${OPERATOR.vatPayer === true ? `plátce DPH, DIČ ${op('dic', 'DIČ')}` : OPERATOR.vatPayer === false ? 'není plátcem DPH' : missing('plátce / neplátce DPH')}</td></tr>
<tr><th>Sídlo / místo podnikání</th><td>${op('address', 'adresa')}</td></tr>
<tr><th>Zápis</th><td>${op('register', 'zápis v živnostenském rejstříku (příslušný úřad)')}</td></tr>
<tr><th>E-mail</th><td>${email}</td></tr>
${OPERATOR.phone ? `<tr><th>Telefon</th><td>${OPERATOR.phone}</td></tr>` : ''}
<tr><th>Obchodní značka</th><td>${SITE.name}</td></tr>
</tbody></table>
<h2>Dozor a řešení sporů</h2>
<ul>
<li>Ochrana spotřebitele: Česká obchodní inspekce, <a href="https://www.coi.gov.cz" rel="noopener noreferrer">www.coi.gov.cz</a></li>
<li>Mimosoudní řešení spotřebitelských sporů: ${coi}</li>
<li>Živnostenské podnikání: ${missing('příslušný živnostenský úřad')}</li>
<li>Ochrana osobních údajů: Úřad pro ochranu osobních údajů, <a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a></li>
</ul>
<h2>Dokumenty</h2>
<ul>
<li><a href="/terms">Obchodní podmínky</a> · <a href="/reklamace">Reklamační řád</a> · <a href="/returns">Odstoupení od smlouvy</a> · <a href="/warranty">Záruka a garance pravosti</a></li>
<li><a href="/zakazkova-vyroba">Podmínky zakázkové výroby a servisu</a> · <a href="/doprava-a-platba">Doprava a platba</a></li>
<li><a href="/privacy">Ochrana osobních údajů</a> · <a href="/cookies">Cookies</a></li>
</ul>`,
};

export const ALL_LEGAL = [terms, claims, withdrawal, warranty, custom, shipping, privacy, cookies, operator];
