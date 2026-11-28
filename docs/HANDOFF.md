# Předávací poznámky mezi agenty

Nejnovější záznam je nahoře. Formát je popsán v `AGENTS.md`, sekce 5.

---

## 2026-11-28 – Claude – claude/karta-pasu
**Hotovo:** karta digitálního pasu k laserovému gravírování. Admin: Pasy → detail → „Karta k gravírování“ (i z detailu
hodinek), náhled, inverze, SVG / PNG 600 DPI (pHYs) / PDF ve skutečné velikosti, kontrola QR (obsah = adresa pasu,
modul 0,59 mm, klidová zóna 4 moduly, BarcodeDetector v prohlížeči), hromadný ZIP v seznamu pasů.
Statická grafika (logo vektorizované z `logo-faktura.webp`, texty Crimson Text + Inter převedené na křivky, ozubená kola)
je vygenerovaná `scripts/card-art.py` → `server/passport-card-art.js` (needitovat ručně). Kód pasu z glyfů, QR obrysem modulů
(úroveň Q). Tvary se nepřekrývají → inverze = evenodd negativ. Žádná nová data ani identifikátory, žádné knihovny.
**Pozor na:** při změně designu spusť `python3 scripts/card-art.py` (potřebuje fontTools, cv2, rsvg-convert). Test čtení QR
v `tests/unit/karta-pasu.test.mjs` se bez OpenCV přeskočí.

## 2026-11-28 13:30 – Claude – Stripe naostro
**Hotovo:** příčina skryté platby kartou: v `STRIPE_SECRET_KEY` byl publishable key. Majitel vytvořil omezený klíč
„Full access – except sensitive operations“ (`rk_live_`, 136 oprávnění) a vložil ho; nasazení (napotřetí – Cloudflare API
krátce vracelo chybu 8000000). Integrace: klíč ostrý, webhook ok, PAYMENTS_LIVE true, zákazníci vidí: ano.
**Další krok:** po první ostré platbě zkontrolovat zápis poplatku Stripe (vč. Radar) do nákladů hodinek.
**Pozor na:** worker `os-cron` se při nasazení nenasazuje (token nemá „Workers Scripts: Edit“) – kontroly běží při otevření administrace.

## 2026-11-28 – Claude – claude/platby-diagnostika
**Hotovo:** platba kartou se po ostrém přepnutí v anonymním okně nezobrazuje. `PAYMENTS_LIVE` se nově čte tolerantně
(mezery, velká písmena – v Cloudflare je to Secret, protože textové proměnné spravuje wrangler.toml);
`cardDiagnostics()` + Administrace → Nastavení → Integrace ukazuje druh klíče, webhook, PAYMENTS_LIVE a důvod (bez hodnot).
Opravena chyba: administrace vždy psala „(testovací)“, protože API neposílalo `cardLive`.
**Další krok:** po sloučení si majitel otevře Integrace a podle důvodu opraví Secret v Cloudflare; pak nové nasazení.

## 2026-11-28 – Claude – claude/centralni-dokumentace (R28)
**Hotovo:** centrální dokumentace v kořeni: `CLAUDE.md` (instrukce + postup před/po úkolu), `AGENTS.md` (sekce 5 –
role a koordinace, odkazy), `PROJECT_STATE.md` (ověřený stav), `TASKS.md` (čeká na majitele, plánováno, hotovo),
`ROADMAP.md` (etapy A–D), `DECISIONS.md` (přesun z docs/, R28, doplnění Balíkovny), `CHANGELOG.md` (ze všech PR).
`docs/STAV.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md` jsou odkazy; původní obsah v `docs/*-archiv.md`.
Ostrý Stripe nasazen (rerun CI na main 28. 11.), čeká na ověření majitelem v anonymním okně.
**Další krok:** položky TASKS → Plánováno (poplatky Stripe po první platbě, e-mail „(ostrá)“ u testu).
**Pozor na:** ostatní konverzace projektu agent neviděl – v dokumentaci je jen to, co bylo zapsané v repozitáři.

## 2026-11-27 – Claude – večerní samostatná práce (R27)
**Hotovo:** trvalý pokyn R27 + `docs/STAV.md`; feed Google Nákupů `/feed/google.xml` (#67); stabilita e2e (#66); nástroje z Dependabot #4 přes #68 (html-validate zakazuje `autocapitalize` u `type=email`).
**Další krok:** komplexní kontrola – objednávky, faktury, pasy, mobil; DT Innovation.
**Pozor na:** `docs/STAV.md` je hlavní seznam „Čeká na majitele“ – udržuj ho.

## 2026-11-27 – Claude – claude/nazvy-dt
**Hotovo:** jednotné názvy hodinek „DT – ZNAČKA model označení“ (R26). Pravidlo `src/shop/naming.mjs` (`dtName`,
idempotentní), použito v `productName` (web, košík, JSON-LD, popisy), při uložení hodinek v administraci, v katalogu
(`scripts/catalog.mjs` převede title i SEO titulek), v pasech a ukázkových datech. Migrace 0032 převedla názvy, SEO
titulky, popisky fotek a pasy v databázi (faktury, objednávky a prohlídky beze změny). Přestavby: `REBUILD_NOTE`
v generátoru popisu, v katalogu, při uložení v administraci i v migraci. Pravidlo zapsáno v AGENTS.md 6a, DECISIONS R26,
katalog/README.md, DANTE-TIME-OS.md.
**Další krok:** –
**Pozor na:** šablony příspěvků na sociální sítě v repozitáři zatím nejsou – pravidlo je v AGENTS.md / DANTE-TIME-OS.md.

## 2026-11-27 – Claude – claude/nahled-faktury
**Hotovo:** náhled faktury před vystavením (tlačítko „Náhled“ ve formuláři; `POST invoices/preview` → `issueManual(..., { preview: true })`
projde stejné výpočty a kontroly, ale nic neuloží ani nepřidělí číslo). Vzhled dokladu přesunut do `server/invoice-page.js`
(`renderInvoicePage`), používá ho veřejná stránka faktury i náhled. E-mail dodavatele zabalen do `<!--email_off-->`,
protože Cloudflare Email Obfuscation ho nahrazoval textem „[email protected]“ (dekódovací skript je na faktuře zakázaný CSP).
**Další krok:** –
**Pozor na:** náhled se zobrazuje v `iframe srcdoc` (sandbox bez skriptů), QR platba v náhledu není (VS ještě neexistuje).

## 2026-11-27 – Claude – claude/faktura-bez-duzp
**Hotovo:** na faktuře se u neplátce DPH (`OPERATOR.vatPayer = false`) netiskne „Datum uskutečnění plnění“ (pokyn majitele;
`taxable_date` se dál ukládá pro evidenci). Položka faktury ze zakázky = pole „Hodinky“ (+ kalibr), bez druhu zakázky a čísla.
**Další krok:** –
**Pozor na:** po registraci k DPH se DUZP zase zobrazí samo (přepnutím `vatPayer`).

## 2026-11-27 – Claude – claude/zakazky-kalibr-faktura
**Hotovo:** u zakázky nové pole „Kalibr“ (migrace 0031 `commissions.caliber`, hledá se i podle něj).
Faktura k zakázce se předvyplňuje z aktuálně uložené zakázky (`GET invoices/form` vrací `commission.buyer`,
druh, hodinky, kalibr a cenu) – dřív se brala data z odkazu sestaveného při otevření zakázky, takže adresa
doplněná a uložená až potom do faktury nepřešla. U konceptu se doplní jen prázdné údaje odběratele.
**Další krok:** –
**Pozor na:** odkaz „Vystavit fakturu“ nese už jen `commission_id` (a `kind`), vše ostatní dotahuje formulář faktury.

## 2026-11-27 – Claude – claude/oprava-vydejni-mista
**Hotovo:** Výběr Zásilkovny na mapě se nepropsal do pokladny → okno mapy dostává stejné parametry jako oficiální knihovna Packeta (`referrer`, `version`, `loader`, `currentVersion`). Balíkovna zpět i pro hodinky do 20 000 Kč (migrace 0029, výslovný pokyn majitele).
**Pozor na:** Poštovní podmínky Balíkovny (cennosti nad 5 000 Kč) – majitel o riziku ví; limit lze změnit v administraci → Dopravci.

## 2026-11-27 – Claude – claude/platby-doprava-eu (R25 zjednodušení dopravy)
**Hotovo:** migrace 0028 (Cenná zásilka aktivní 190 Kč + 14 Kč/10 000 Kč nad 30 000, bez dobírky; PPL a Balíkovna
na adresu vypnuté), administrace → Dopravci skrývá vypnuté pod „Nepoužívané“, text Doprava a platba (CZ/EN) bez PPL,
`docs/DOPRAVCI.md` přepsán na jednoduchý přehled (žádné e-maily dopravcům ani Dohoda), R25 v DECISIONS.
**Rozpracováno:** nic.
**Další krok:** majitel sloučí PR #47, případně upraví cenu Cenné zásilky v administraci.
**Pozor na:** Balíkovna zůstává do 5 000 Kč (podmínky ČP, cennosti bez Cenného obsahu); dražší hodinky do zahraničí
nemají dopravce bez smlouvy → jen po domluvě.

## 2026-11-27 – Claude – claude/platby-doprava-eu (R24 dopravci)
**Hotovo:** správa dopravců (migrace 0026 `shipping_methods`, `server/shipping.js` quote/offer/preview/saveMethod), administrace
→ Dopravci (seznam, editor, náhled „co uvidí zákazník“), pokladna filtruje podle země, hodnoty košíku a materiálu pouzder
(`cartFacts`, `/api/config?items=`), dobírka podle dopravce (`fees`, `cod_max`), náklad dopravy `orders.shipping_cost_czk` →
náklad „doprava“ u hodinek při odeslání (`recordShippingCost`, oprava `PUT orders/:id/shipping-cost`), tržba hodinek
včetně zaplacené dopravy (`productEconomics`), automatický štítek Zásilkovny po zaplacení (`autoLabel`, nastavení `auto_label`,
výchozí vypnuto), sledování podle dopravce (`PACKETA_/CPOST_/PPL_METHODS`). E-maily dopravcům a postup Dohody: `docs/DOPRAVCI.md`.
**Další krok:** odpovědi dopravců → úprava limitů/výluk → zapnutí připravených způsobů (jen se souhlasem majitele).
**Pozor na:** staré klíče nastavení dopravy (shipping_*_czk, cover_*, packeta json) se už nepoužívají – převzala je migrace 0026.

---

## 2026-11-27 – Claude – claude/platby-doprava-eu (R23)
**Hotovo:** schválené úpravy majitele (R23, `docs/PLATBY-A-DOPRAVA.md`):
- Stripe jen `payment_method_types=card`, vždy v Kč (`chargeCurrency`), bez placených doplňků; poplatek z balance transaction
  → náklad „poplatky“ u hodinek (`server/payment-events.js` `recordCardFee`, hodinově `recordMissingCardFees`), `orders.card_fee_czk`.
- Pojištění na plnou hodnotu: `cover_*` nastavení (migrace 0025), `shopConfig` nenabídne dopravce, který hodnotu nekryje.
- Odesláno až při předání dopravci: `handoverCheck` v `server/os.js` (každou hodinu), štítek už neodesílá e-mail.
- Dobírka i na `zasilkovna_adresa`; právní dokumenty 1.2 (CZ+EN): dobírka, Stripe v zásadách, pojištění, tabulka Doprava a platba.
- Dvojí prodej mimo e-shop: `issueManual` zabírá kus atomicky, záloha = osobní rezervace, `inbox` sale confirm a PUT hodinek s podmínkou stavu.
**Další krok:** majitel založí Stripe a vloží klíče; po testu ostrý provoz. Limit Balíkovny ověřit u České pošty.
**Pozor na:** úroveň 3 – PR slučuje jen majitel. Datum účinnosti podmínek 1.2 = 27. 11. 2026 (upravit, pokud se PR sloučí později).

---

## 2026-11-27 – Claude – claude/platby-doprava-eu
**Hotovo:** rozšíření objednávek podle zadání majitele (podklady a ceny: `docs/PLATBY-A-DOPRAVA.md`).
- Platby: `server/payments.js` = jedno rozhraní pro **Stripe** (Checkout přes REST, bez knihovny) i Comgate; karta v CZK i EUR;
  Apple Pay / Google Pay řídí nastavení brány. Pojistka: ostrý klíč bez `PAYMENTS_LIVE` se nezobrazí. Oznámení
  `functions/api/payments/stripe.js` (ověření podpisu HMAC) a `comgate.js` → `server/payment-events.js` (ověření částky a měny
  u brány, konflikt s prodaným kusem → e-mail majiteli „Vrátit platbu“). Opakování platby `functions/api/pay.js` + `public/assets/order.js`.
- Doprava: `zasilkovna` i mimo ČR (mapa podle země, partnerská místa `c<carrier>:<id>`), nová `zasilkovna_adresa` (ČR, SR, EU;
  dopravce z feedu Packeta, nastavení nebo výchozí CZ 106 / SK 131). Migrace 0024 (jen nová nastavení). Dobírka dál jen s výdejním
  místem (podle obchodních podmínek).
- Automatizace: po založení zásilky se objednávka označí odesláno a zákazník dostane číslo s odkazem (`trackingUrl`), nastavení `ship_autonotify`.
- Pokladna: textová označení Visa / Mastercard / Apple Pay / Google Pay, mobilní lišta s celkovou cenou, doručovací adresa.
- Testy `tests/unit/platby-doprava.test.mjs` (celý nákup kartou v EUR, dvojí prodej, nabídka podle země, štítky).
**Další krok:** po schválení majitele: účet Stripe (nejdřív test), doplnění Zásad ochrany osobních údajů o platební bránu, tabulka „Doprava a platba“.
**Pozor na:** úroveň 3 (platby) – PR slučuje jen majitel. Limit hodnoty zásilky Zásilkovny ověřit v klientské sekci.
## 2026-11-27 – Claude – claude/storno-oprava-odberatele
**Hotovo:** tlačítko Storno v seznamu faktur posílalo storno bez důvodu (chyba „Vyplňte prosím důvod storna“) → dotaz na
důvod (předvyplněno „Vystaveno omylem dvakrát“). Storno dokladu s aktivním dobropisem je blokované (nejdřív storno
dobropisu). Nově `PUT invoices/:id/buyer` = oprava odběratele (jméno, firma, IČO, DIČ, adresa, e-mail) a splatnosti na
vystaveném dokladu; číslo, položky a částky se nemění; historie „z → na“ (`odberatel_upraven`).

---

## 2026-11-27 – Claude – claude/sprava-vydaju
**Hotovo:** jednotná správa výdajů v celé administraci (zadání majitele 27. 11.). Migrace 0027: `costs.note`,
`costs.updated_at`, index `documents(sale_id)`.
- Detail výdaje `#/naklady/:id` (z Výdajů, zakázky, hodinek i Nákupů – všude stejný řádek `costRow`): úprava všech
  údajů (popis, druh, upřesnění, částka, datum, dodavatel, číslo dokladu, poznámka, odhad), přílohy (více dokladů,
  náhled, celá obrazovka / PDF, stažení originálu, nahrazení, odstranění, připojení nahraného dokladu bez výdaje),
  přiřazení (provoz / hodinky / zakázka; `PUT costs/:id` s oběma klíči = přesun), odebrání ze zakázky, historie změn
  (audit `cost`, „z → na“), trvalé smazání (doklady se odpojí, nebo smažou s `?doklady=1`).
- `FIN.updateCost` rozšířen (vrací `changed`), `FIN.getCost`, `FIN.deleteCost`. Nákup naskladněný jako díl: částku nelze
  změnit u výdaje (počítá se u dílu) → bez dvojího započtení. Vše se přepočítává za běhu (žádné uložené součty).
- Výdaje (seznam): hledání, období, druh, přiřazení, „jen bez dokladu“, součet; doklady bez výdaje.
- Doklady: `?download=1` (originál), `?preview=1` (miniatura bez záznamu do historie), `PUT documents/:id` kind/note.
- Detail prodeje mimo systém `#/prodeje/:id` (úprava, doklad, smazání). Smazání poptávky (ne převedené na zakázku) i s fotkami.
**Kontrola modulů:** viz popis PR (co jde otevřít / upravit / smazat).
**Pozor na:** vystavené faktury se dál neupravují ani nemažou (storno / dobropis) – záměr kvůli číselné řadě.

---

## 2026-11-27 – Claude – claude/fakturace-platby-audit
**Hotovo:** audit administrace (zadání majitele 27. 11.).
- **Evidence plateb** (migrace 0025, `server/invoice-payments.js`): tabulka `invoice_payments` = zdroj pravdy pro „přijato“
  a pohledávky. Záloha, částečná platba, doplatek, přeplatek, vrácení (záporná částka). Oprava platby = zrušení s důvodem
  (zůstává v historii). `invoices.paid_at` je odvozené (`syncPaid`). Migrace převedla dosavadní úhrady na platby v plné výši.
  Pozor: `server/payments.js` jsou platby KARTOU v e-shopu – jiný modul.
- **Storno** jen s důvodem (`cancel_reason`, `cancelled_by`), ne při zaznamenaných platbách (pak dobropis / oprava platby),
  ne u vyúčtované zálohy. Vystavené doklady se nemažou (číselná řada).
- **Ochrana proti duplicitě** (409 `code: duplicate`): stejný odběratel + částka do 30 dnů, nebo druhá faktura k zakázce;
  administrace se zeptá a pošle `allow_duplicate`.
- **Detail dokladu** `#/faktury/:id`: stav (neuhrazeno/částečně/uhrazeno/přeplaceno), platby, „Zapsat platbu“, „Opravit“,
  odeslání, kopie do konceptu, dobropis, storno, související doklady, položky, historie. API: GET invoices/:id,
  POST invoices/:id/payments, POST invoice-payments/:id/cancel, POST invoices/:id/copy.
- `finance.js`: přijato po měsících z plateb (paid_on), pohledávky = zbývající částky, ekonomika zakázky z plateb.
- Veřejná faktura: částečně uhrazeno / zbývá, QR na zbývající částku, důvod storna.
- Zakázky: vyhledávání a filtry (rozpracované / hotové / archiv / vše), smazání jen bez dokladů a nákladů, historie změn.
  Díl: smazání jen nepoužitého. Zákazník: faktury v detailu, smazání jen bez objednávek, zakázek a dokladů.
- Nasazení: před migracemi se do logu zapíše bod obnovy D1 Time Travel.
- Upravené testy druhého agenta (`zakazky.test.mjs`): úhrady přes evidenci plateb, záměrné duplicity s `allow_duplicate`.
**Další krok:** upomínky zákazníkům (jen se souhlasem majitele), párování plateb z banky (vyžaduje napojení banky – 💰?).
**Pozor na:** „přijato“ a pohledávky počítej vždy z `invoice_payments`, ne z `paid_at`.

---

## 2026-11-27 – Claude – claude/koncepty-faktur
**Hotovo:** koncepty faktur a adresa u zakázky (přání majitele). Migrace 0024: tabulka `invoice_drafts` (bez čísla –
číslo se přidělí až při vystavení), `commissions.contact_street/city/zip`. API `invoice-drafts` (GET seznam, GET/:id,
POST upsert, DELETE); `POST invoices` s `draft_id` koncept po vystavení smaže. Administrace: „Uložit koncept“ ve
formuláři faktury, sekce Koncepty ve Fakturách, v zakázce „Pokračovat v konceptu faktury“; faktura ze zakázky se
předvyplní jménem, e-mailem, adresou a cenou. `invoice_drafts` je v zálohách. Ověřeno v e2e.

---

## 2026-11-27 – Claude – claude/bez-vlastni-prace
**Hotovo:** majitel nepoužívá hodinovou sazbu → z administrace odstraněno zadávání vlastní práce (typ nákladu, hodiny,
nastavení sazby, řádky „zisk po ocenění práce“). Backend (`own_work`, `hours`, `labor_rate_czk`) zůstává kvůli starším
záznamům; ty se zobrazí jen tam, kde existují, a do zaplacených nákladů se nepočítají.
**Další krok:** –
**Pozor na:** –

---

## 2026-11-27 – Claude – claude/dily-ze-skladu-v-zakazce
**Hotovo:** díly ze skladu lze použít v zakázce. Migrace 0023: `parts.commission_id`. `FIN.usePartInCommission`
(při použití části zásoby se položka rozdělí, zbytek zůstane skladem), `returnPartFromCommission`; cena použitých dílů
je součástí zaplacených nákladů zakázky (`partsCost`). Měsíční náklady dál počítají nákup dílu k datu nákupu → bez
dvojího započtení. Díl patří k hodinkám NEBO k zakázce (PUT parts/:id při `product_id` nebo stavu skladem zakázku smaže).
**Další krok:** –
**Pozor na:** –

---

## 2026-11-27 – Claude – claude/zakazky-ekonomika-faktury-fotky
**Hotovo:** zakázky propojené s ekonomikou a fakturací (zadání majitele 27. 11.). Migrace 0022 (jen přidává sloupce):
`costs.estimate` (odhad – nepočítá se), `costs.own_work` (vlastní práce – není výdaj), `costs.part_kind`,
`commissions.deposit_received_on`, `commissions.main_photo_id`, `commission_photos.phase` (pred/behem/po), nastavení
`invoice_autosend` (výchozí '0').
- `server/finance.js`: `costValue` (paid/own/est – nikdy se nesčítají), `commissionEconomics`, `updateCost` (přiřazení
  existujícího výdaje k zakázce; náklad patří vždy jen k hodinkám NEBO k zakázce), přehled roku rozlišuje
  **fakturováno** (tržby, z toho cíl 2 mil.) a **přijato** (podle data úhrady; zálohová faktura při úhradě, faktura jen
  částkou po odečtení zálohy, záloha bez dokladu u zakázky k datu přijetí). Náklady = jen zaplacené; vlastní práce zvlášť.
- `server/invoicing.js`: `send_mode` ulozit | schvalit (žádost v `approvals`, kind `faktura_odeslani`, payload = id
  faktury) | odeslat (jen když je `invoice_autosend` = 1 a platný e-mail). Odeslání uzavře žádost, storno ji zamítne,
  schválení v Systému fakturu rovnou odešle. Odečet zálohy bez dokladu (`deduct_cash_deposit`), kontrola výše zálohy
  před vystavením. `overdueInvoices` + stav „po splatnosti“.
- `server/os.js` (DT Finance): nálezy „po splatnosti“ a denní souhrn e-mailem POUZE majiteli (`overdue_digest_last`).
  Zákazníkům se žádné upomínky neposílají.
- Administrace: v zakázce fotky (fáze, hlavní, celá obrazovka, smazání s potvrzením), ekonomika, platby, faktury,
  náklady (rychlé druhy, zaplaceno/vlastní práce/odhad), přiřazení zapsaného výdaje. Seznam zakázek s miniaturou
  (jinak ikona hodinek) a datem DD.MM.RRRR. Nastavení → Faktury. Ekonomika: fakturováno vs. přijato, ziskovost zakázek.
- Testy: `tests/unit/zakazky.test.mjs`, rozšířený e2e (zakázky, schválení odeslání, fotky).
**Další krok:** díly ze skladu použité v zakázce (dnes jen u hodinek); případně upomínky zákazníkům – jen po schválení majitele.
**Pozor na:** e-shopové faktury se odesílají jako dosud (nastavení `invoice_autosend` se týká faktur z administrace).

---

## 2026-11-27 – Claude – claude/zakazka-bez-emailu
**Hotovo:** zakázku lze uložit bez e-mailu a telefonu (zákazníci z Instagramu). Migrace 0021: `commissions.contact_name`,
`contact_info`. S e-mailem se zákazník dál ukládá do `customers`; bez něj zůstane jméno a kontakt (telefon, Instagram) u zakázky.
Výpis zakázek bere `COALESCE(c.name, k.contact_name)`. Ověřeno v e2e testu.

---

## 2026-11-27 – Claude – claude/hero-tablet
**Hotovo:** úvodní fotka na tabletech. 881–1280 px (iPad na šířku, menší notebooky): fotka jen v pravých 64 % s maskou do tmy,
text vlevo ji nepřekrývá, nižší výška. 600–880 px (iPad na výšku, rozdělená obrazovka): široká fotka 16:9 s celou scénou
místo úzkého mobilního výřezu. Mobil a velké obrazovky beze změny. Ověřeno snímky 390–1440 px.
## 2026-11-27 – Claude – claude/sledovani-balikovna
**Hotovo:** sledování zásilek Balíkovny přes veřejné rozhraní České pošty (`server/cpost.js`, bez klíče). Stav z textu poslední
události převeden na stejné kódy jako Zásilkovna; denní běh DT Logistics i tlačítko „Zjistit stav“ fungují pro obě dopravy.
**Pozor na:** rozhraní České pošty není oficiálně dokumentované – při změně formátu se jen zobrazí chyba, nic jiného se nerozbije.

---

## 2026-11-27 – Claude – claude/os-sales-finance-director
**Hotovo:** podle zadání Dante Time OS oživeny role **DT Sales** a **DT Finance** (migrace 0020, `salesCheck`, `financeCheck`
v `server/os.js`, denně 8:00, bez AI). Sales: poptávky bez odpovědi 2+ dny (bez jmen), nabídky bez reakce 7+ dní, zakázky
po termínu / do 3 dnů, rezervace převodem končící do 24 h, inzeráty bez průměru pouzdra. Finance: doklady a prodeje ke kontrole,
hodinky bez nákupní ceny. **DT Director** týdně přidává náklady, zisk, hodnotu skladu, AI útratu, co se udělalo (poslední běhy rolí)
a upozornění po rolích. Stav agentů zapsán v `docs/DANTE-TIME-OS.md`.
**Další krok:** DT Innovation (týdně, AI v limitu) po pár týdnech provozu; Marketing a Scout čekají na podklady majitele.

---

## 2026-11-27 – Claude – claude/zasilkovna-expedice
**Hotovo:** DT Logistics – expedice. V detailu zaplacené objednávky (nebo dobírky) se Zásilkovnou: hmotnost + „Založit zásilku
v Zásilkovně“ (`createPacket`: výdejní místo z objednávky, hodnota = cena, dobírka u COD, volitelně `PACKETA_SENDER`).
Číslo zásilky se uloží samo, pak „Štítek k tisku (PDF)“ (`packetLabelPdf`, A6 na A4). Ochrana proti dvojímu založení.
**Pozor na:** založení je jen ručně tlačítkem; pokud Zásilkovna vyžaduje označení odesílatele, nastavit `PACKETA_SENDER`.

---

## 2026-11-27 – Claude – claude/elegantni-potvrzeni
**Hotovo:** krátké černozlaté potvrzení objednávky (poděkování, číslo, fotka a název hodinek, doprava, platba, celkem,
„Co bude dál“ podle platby/dopravy, tlačítko Zobrazit objednávku, kontakt, jedna věta o uzavření smlouvy a lhůtě 14 dnů).
Obchodní podmínky, poučení o odstoupení se vzorovým formulářem a záruční list jdou jako **PDF přílohy** v platné verzi:
`scripts/legal-pdf.mjs` je při každém buildu sází z `src/legal/*` do `dist/pravni/{cs,en}/…-v<verze>.pdf`
(vlastní sazeč, písmo DejaVu zmenšené v `scripts/fonts`, bez nových závislostí). `sendEmail` umí `attachments`
(čte z `env.ASSETS`, jinak Resend stáhne z URL) a `fallbackBody` – když přílohy selžou, odejde e-mail s plným zněním v textu.
Všechny e-maily mají nový tmavý obal (tabulky, max. 600 px, mobil).
**Pozor na:** obsah právních textů se neměnil, jen forma doručení (trvalý nosič = PDF příloha). Při nové verzi
podmínek stačí změnit `LEGAL_VERSION` – PDF i názvy příloh se vygenerují samy.

---

## 2026-11-27 – Claude – claude/sledovani-zasilek
**Hotovo:** DT Logistics – sledování zásilek Zásilkovny (`server/packeta.js`, REST/XML `packetStatus`, tajný klíč
`PACKETA_API_PASSWORD` – majitel uložil 27. 11.). Migrace 0019 přidává do `orders` sloupce `tracking_code/status/at/checked_at`.
Denní běh DT Logistics ověří odeslané zásilky Zásilkovny (bez doručených/vrácených), hlásí doručené a problémové.
V detailu objednávky řádek „Zásilka“ s tlačítkem „Zjistit stav“; po doručení se předvyplní datum převzetí.
**Pozor na:** převzetí (začátek lhůty pro odstoupení) se schválně nepotvrzuje automaticky – potvrdí majitel.
Balíkovna (Česká pošta) zatím sledování nemá.

---

## 2026-11-27 – Claude – claude/fotky-nova-zakazka
**Hotovo:** fotky jde vybrat už na obrazovce „Nová zakázka“ (nahrají se hned po uložení). Opraveno přetékání polí s datem (Termín, Předáno) v administraci na iPhonu (`.grid` s `minmax(0,1fr)`, `input[type=date]` bez nativního vzhledu).

---

## 2026-11-26 – Claude – claude/dt-sales-navrh-odpovedi
**Hotovo:** E4 – DT Sales. V Poptávkách je u každé poptávky „Návrh odpovědi (AI)“: volitelný pokyn majitele, návrh
předmětu a textu (vykání, do 120 slov, bez cen, termínů a závazků – co doplnit, vypíše zvlášť), tlačítka „Otevřít
v e-mailu“ (mailto) a „Kopírovat text“. Nic se neodesílá automaticky. Náklady jdou do `ai_costs` pod rolí `sales`
a hlídá je stejný měsíční limit (R20); pozastavení role `sales` návrhy vypne. `extractJson` umí i čistý text (bez dokumentu).
**Další krok:** DT Logistics – sledování zásilek (potřebuje `PACKETA_API_KEY`), import nákupů (podklady majitele).
**Pozor na:** zpráva zákazníka jde do AI v `<zprava_zakaznika>` jako data; model v návrhu nesmí slibovat ceny.

---

## 2026-11-26 – Claude – claude/balikovna-bez-pole
**Hotovo:** u Balíkovny zmizelo ruční pole „Výdejní místo (název a adresa)“ – místo se vybírá jen na mapě (pod tlačítkem se ukáže „Vybráno: …“). Ruční pole zůstává jen u Zásilkovny bez `PACKETA_API_KEY`.
## 2026-11-26 – Claude – claude/fotky-zakazek
**Hotovo:** fotografie u zakázek. V detailu zakázky sekce „Fotografie“ (nahrání z fotoaparátu/galerie, zmenšení v telefonu,
smazání, otevření ve velkém). Formulář služeb na webu má pole „Fotografie hodinek“ (max. 5, zmenší se na 1600 px a odstraní
se GPS); fotky se ukáží u poptávky a po „→ Zakázka“ se připojí k zakázce (štítek „Od zákazníka“). Tabulka
`commission_photos` (migrace 0018), soubory v KV pod `private/…` – veřejná cesta `/media` je nevydává, jen
`/api/admin/commission-photos/:id/(s|l)` po přihlášení. Fotky poptávek bez zakázky se mažou s poptávkou (po roce).
**Pozor na:** zásady ochrany osobních údajů fotky výslovně nezmiňují – ⚖️ navrhnout doplnění majiteli.

---

## 2026-11-26 – Claude – claude/oprava-vyber-vydejniho-mista
**Hotovo:** majitel nemohl v pokladně potvrdit výdejní místo (Balíkovna i Zásilkovna). Okno Balíkovny přes celou
obrazovku (na iPhonu zakrývala lišta prohlížeče spodní část mapy), zpráva z mapy se ověřuje jen podle původu
`*.cpost.cz` (dříve i podle okna – zpráva z vnořeného okna mapy se zahodila), tolerantnější čtení údajů bodu,
text „Vybráno: …“. Permissions-Policy povoluje polohu pro mapy Balíkovny a Zásilkovny (dříve zakázána všem).
Zásilkovna bez `PACKETA_API_KEY` jen odkazuje na mapu v novém okně – výběr se nepřenese, text to nyní říká.
**Pozor na:** neověřeno v prohlížeči proti skutečné mapě České pošty (z vývojového prostředí nedostupná) – ověřit na iPhonu.
Zjistit, zda je v Cloudflare nastaven `PACKETA_API_KEY`.

---

## 2026-11-26 – Claude – claude/import-faktur-503, claude/doklady-text (PR #20–#22)
**Hotovo:** Chyba 503 při hromadném importu cca 2MB faktur: server načítal soubor z D1 (BLOB → velká zátěž CPU na bezplatném Cloudflare) při kontrole duplicity i při čtení AI. Nyní se duplicita ověřuje přes `length()` v SQL, velký soubor se předá AI (Files API, `documents.ai_file_id`, migrace 0016) hned při nahrání a čtení AI ho z D1 nenačítá. Tlačítko „Začít import faktur znovu“ (smaže prodeje `source IN ('import','ai')` a jejich soubory, potvrzení slovem SMAZAT).
Skutečná příčina 503: D1 převádí BLOB po bajtech na čísla. Proto se nové doklady ukládají jako text base64 (`documents.enc = 'b64'`, migrace 0017, nativní `Uint8Array.toBase64`) a AI dostává base64 přímo. Klient při 503 nahrání i čtení AI až 3× zopakuje.
**Výsledek:** Všech 40 historických faktur 2026 je importováno, tržby 2026 = 515 200 Kč. Proti tabulce majitele je rozdíl +300 Kč v říjnu; majitel rozhodl ponechat.
**Další krok:** Import nákupů (náklady jsou zatím 0), pak E4.
**Pozor na:** Nikdy neukládat ani nečíst velké soubory jako BLOB v D1. Starší BLOB doklady fungují dál, ale jsou drahé.

## 2026-11-26 – Claude – claude/fakturace (centrální fakturační systém)
**Hotovo:** fakturace nezávislá na e-shopu: řada DT-RRRR-NNNN (čítač po letech, UNIQUE), zdroj prodeje
(eshop/vinted/aukro/instagram/facebook/osobne/zakazka/jine), druhy faktura / zálohová / dobropis, vyúčtování zálohy
(advance_deducted, záloha nejde odečíst dvakrát), hodinky ze skladu → prodáno + pas + garanční prohlídka, model a
výrobní číslo, nový vzhled podle vzoru majitele (zlaté logo, poděkování, útulek, slogan), QR u neuhrazených převodů,
e-mail zákazníkovi, filtrování, export s druhem a kanálem, storno vrací hodinky na sklad. Tržby = faktury + dobropisy
(bez záloh) + import (bez duplicit). Migrace 0014. E2E test pokrývá prodej Vinted, zálohu, dobropis, unikátní čísla.
**PDF:** z prohlížeče (Tisk → Uložit jako PDF), serverové PDF není (limit CPU Cloudflare zdarma).
**Pozor na:** staré faktury mají číslo RRRRNNNN – zůstávají beze změny.

---

## 2026-11-26 – Claude – claude/os-e3b-nakupy-prodeje (E3b v2 podle majitele)
**Hotovo:** univerzální evidence nákupů a prodejů: nahrání screenshotů/PDF/fotek (i hromadně), DT Doklady (Claude API,
strukturovaný výstup, effort low, limit 300 Kč), automatické potvrzení spolehlivých, „Ke kontrole“ pro nejisté,
kurzy ČNB (tabulka fx_rates), přiřazení hodinky/sklad/provoz, ruční zadání, duplicity, import faktur do `sales`,
tržby = faktury systému + import (bez dvojího započtení), export pro účetní. Migrace 0012. Závislost @anthropic-ai/sdk.
Ověřeno lokálně proti simulovanému API (klíč jde jako Authorization: Bearer – chování SDK 1.x).
**Čeká na majitele:** klíč ANTHROPIC_API_KEY v Cloudflare (💰), ⚖️ souhlas s doplněním Zásad (LEGAL-REVIEW 2g).
**Pozor na:** www.cnb.cz je z vývojového prostředí blokované – kurz ověřit na ostrém webu prvním nákupem v cizí měně
(při výpadku jde položka ke kontrole a kurz se doplní ručně).

---

## 2026-11-26 – Claude – claude/os-e3b-doklady (E3a nasazeno, E3b doklady bez AI)
**Hotovo:** E3a pas hodinek sloučen (PR #9) a ověřen na ostrém webu. E3b: doklady k nákladům (fotka/PDF,
D1 EU, bez GPS, duplicity), přehled Doklady, export „Doklad nahrán“. Oprava: zálohy nezahrnovaly costs,
parts, watch_passports, passport_events – doplněno (+ evidence dokladů bez souborů).
**Další krok:** AI vytěžení dokladů jen po souhlasu majitele (💰); doklady z e-mailu (Email Routing, oprávnění tokenu).
E4 Obchod a logistika (DT Sales návrhy odpovědí bez AI šablonami, sledování zásilek).
**Pozor na:** ⚖️ zásady ochrany osobních údajů zatím nezmiňují doklady od dodavatelů – fyzických osob
(např. nákup hodinek od soukromé osoby; právní titul: povinnost archivace účetních dokladů). Zapsáno do LEGAL-REVIEW, text neměněn.

---

## 2026-11-26 – Claude – claude/os-e3-priprava (E2 nasazeno, E3a pas hodinek)
**Hotovo:** E2 sklad a ekonomika sloučeno (PR #8) a ověřeno na ostrém webu. E3a: digitální pas hodinek s QR
(`/pas/<kód>`, `/en/passport/<kód>`), historie (předání, prohlídky, renovace), certifikát pravosti k tisku,
administrace Pasy hodinek. Pas vzniká sám při převzetí. Žádné osobní údaje ani ceny v pasu.
**Další krok:** E3b doklady – nejdřív bez AI; AI vytěžení až po souhlasu majitele (💰 Claude API, odhad 20–50 Kč/měs., levnější model pod 5 Kč).
**Pozor na:** stále čeká token „Workers Scripts: Edit“ a GitHub Secret BACKUP_KEY (majitel).

---

## 2026-11-26 – Claude – main (Dante Time OS E1 nasazeno)
**Hotovo:** E1 (PR #7): role a oprávnění, DT Guardian (kontroly bez AI, pozastavení rolí), DT Logistics
(automatické připomínky prohlídek), DT Director (týdenní souhrn), přehled Systém, šifrované zálohy,
prohlídky od skutečného převzetí, zákonná práva odděleně. Záruční texty sloučeny (CZ/EN), oprava ${…}.
**Čeká na majitele:** token Cloudflare + „Workers Scripts: Edit“ (časovač), GitHub Secret BACKUP_KEY (zálohy).
**Další krok:** E2 sklad a ekonomika (nákupní ceny, náklady, marže, přehledy) – větev claude/os-e2-ekonomika.
**Pozor na:** limit AI 300 Kč (R20); v repozitáři je historicky jen 5 inzerátů (4 PRIM + zrušený Chopard),
„6 inzerátů“ v produkční databázi neověřeno – zeptat se majitele.

---

## 2026-11-26 – Claude – main (SPUŠTĚNO)
**Hotovo:** web běží na https://atelier-dante-time.cz (Cloudflare Pages, doména přes Cloudflare DNS,
WEDOS jen registrátor). Objednávky zapnuté (`SHOP_MODE = "live"` ve wrangler.toml, jediný zdroj).
Podmínky 1.1 (R19), garanční prohlídka varianta A (R18), centrální údaje `src/terms.mjs`,
záruční list v potvrzení objednávky, e-maily v jazyce objednávky. Ostrá administrace nastavena majitelem.
**Další krok:** fáze Dante Time OS (interní administrativa + AI agenti) – návrh ke schválení.
**Pozor na:** otevřený bod L1 (živnost). Doména u WEDOS vyprší 9. 3. 2027. Cloudflare Web Analytics
doporučeno vypnout (CSP ho blokuje). Záloha starého webu: zaloha/main-2026-11-25-pred-spustenim.

---

## 2026-11-25 (večer) – Claude – claude/eshop-platforma (doména, etapa A rozpracována)
**Hotovo:** Resend: doména atelier-dante-time.cz přidána (region EU). Ve WEDOS DNS přidány
a aplikovány 4 záznamy: TXT `resend._domainkey` (DKIM), CNAME `rsend` → rsend-euw1.forge.rmta.net,
CNAME `send` → send.forge.rmta.net, TXT `_dmarc` = `v=DMARC1; p=none;`. Původní záznamy beze změny.
Majitel má znovu přístup do WEDOS (obnova hesla; pozor: iCloud Soukromý přenos mění IP).
**Další krok:** ověřit viditelnost záznamů (dns.google) → Resend „Verify“; Cloudflare Add a domain
(tarif Free) → etapa B (vypnout DNSSEC u WEDOS, pak NS). Majitel dosud neschválil právní dokumenty.
**Pozor na:** DNSSEC u WEDOS je zapnutý („DNSSEC WEDOS: ANO“).

---

## 2026-11-25 – Claude – claude/eshop-platforma (R15: nabídka podle oprávnění)
**Hotovo:** přepínač `SERVICES_OFFERED` (false): bez stránky Služby, poptávky servisu
a podmínek zakázek; přesměrování starých adres (302); dokumenty bez zmínek o externích
hodinářích; testy hlídají, že se služby nenabízejí. Otevřený právní bod L1 (LEGAL-REVIEW 2e).
**Další krok:** schválení dokumentů, doména etapy A–C, spuštění. Pak Dante Time OS.
**Změna:** majitel týž den rozhodl nabízet vše → `SERVICES_OFFERED = true` (riziko L1 nese majitel).

---

## 2026-11-25 – Claude – claude/eshop-platforma (závěrečná kontrola, doména, živnost)
**Hotovo:** právní dokumenty 3.2 (Resend, spolupracující hodinář, Facebook; CZ = EN),
rozbor živnostenského oprávnění (LEGAL-REVIEW 2c: Hodinářství + obor č. 49 pro použité
zboží), návod na přesun domény WEDOS → Cloudflare s návratem (`docs/SPUSTENI-DOMENA.md`).
**Další krok:** rozhodnutí majitele o živnosti (A–D), schválení dokumentů, etapy A–C domény.
**Pozor na:** u WEDOS je zapnutý DNSSEC, před změnou NS ho vypnout. Na doméně není MX.

---

## 2026-11-25 – Claude – claude/eshop-platforma (e-maily Resend)
**Hotovo:** e-maily přes Resend zapojené. Klíč `RESEND_API_KEY` je v GitHub Secrets
(oprávnění Sending access) a nasazení ho zapisuje do proměnných Cloudflare Pages
(zkušební i ostrá verze). Zkušební poptávka 25. 11. 2026 majiteli dorazila.
**Další krok:** ověřit doménu atelier-dante-time.cz v Resend (DNS záznamy u registrátora,
se souhlasem majitele). Do té doby zkušební verze odesílá z onboarding@resend.dev,
a to jen na e-mail účtu Resend.
**Pozor na:** ostrá verze má EMAIL_FROM objednavky@atelier-dante-time.cz. Bez ověřené
domény Resend e-maily odmítne. Doplnit Resend do GDPR (LEGAL-REVIEW 2a, bod 7).

---

## 2026-11-25 – Claude – claude/eshop-platforma (inzeráty hodinek)
**Hotovo:** katalog hodinek v repozitáři (`katalog/`, `scripts/catalog.mjs`, R12/R13);
zveřejněny 2 ze 6 inzerátů: PRIM – bílý ciferník, nerez a safír; PRIM kalibr 111 –
datum a malá vteřina (pozlacené nerezové pouzdro). Videa se v e-shopu nezobrazují
(majitel je dává na Instagram). Oprava šířky galerie na mobilu (`contain:paint`).
**Další krok:** další 4 inzeráty, pak etapa „Dokončení prodejní platformy“ (ROADMAP).
**Pozor na:** u pozlacených pouzder nikdy „zlatý/gold“ bez „pozlacený/v barvě zlata“
(kontrola v `src/shop/punc.mjs` nasazení zastaví).

## 2026-11-25 – Claude – claude/eshop-platforma (zkušební verze nasazena)
**Hotovo:** zkušební verze běží na https://claude-eshop-platforma.atelier-dante-time.pages.dev
(Cloudflare Pages + D1 v EU + KV, režim test, noindex). Majitel vytvořil účet
do administrace (2FA přes aplikaci Hesla). `scripts/cf-deploy.mjs` je odolný
vůči chybám při kopírování tajných údajů (Account ID ze záložní konstanty,
token z okolního textu, náhradní otisk instalačního kódu jen pro zkušební verzi).
**Další krok:** přidat do administrace výměnu klíče 2FA (klíč byl vidět na
snímku v chatu) a doporučit ji majiteli; projít s majitelem přidání hodinek.
**Pozor na:** tajná hodnota ADMIN_SETUP_TOKEN v GitHubu neodpovídá kódu
předanému majiteli – pro ostrou verzi ji před spuštěním nastavit znovu.

## 2026-11-25 – Claude – claude/eshop-platforma (rejstřík, DPH, punc)
**Hotovo:** ověřeno v ARES/RŽP (IČO 24020885): jen volná živnost, úřad Magistrát
města Kladna, **chybí řemeslná živnost Hodinářství**; neplátce DPH (`OPERATOR.vatPayer
= false`); puncovní pojistky `src/shop/punc.mjs` (klamavé výrazy u obecných kovů,
drahý kov jen s puncem, hmotností a potvrzením oznámení); migrace 0004
(`punc_notified`, `shipping_eu_insured_json`); pojištěná přeprava pro každou zemi EU;
přehled obratu a limitu OSS v administraci; meta description i bez ručního popisu.
**Další krok:** majitel rozhodne body v `docs/LEGAL-REVIEW.md` část 2a.
**Pozor na:** povolené hosty v prostředí `atelier-dante-time` (ARES, RŽP, punc.gov.cz,
zakonyprolidi.cz, e-sbirka.gov.cz).

## 2026-11-25 – Claude – claude/eshop-platforma (údaje provozovatele, EU, právní v3)
**Hotovo:** údaje provozovatele a banky v `src/site.mjs`; prodej do 27 zemí EU
(`src/shop/eu.mjs`, výběr země v košíku, ceny dopravy podle země z administrace);
platba v EUR (pevný kurz, zaokrouhlení nahoru, SEPA QR „BCD“); pojištěná přeprava
od nastavené hranice; osobní předání jen po domluvě; dobírka jen ČR + výdejní místo;
migrace 0003 (EUR, garance strojek/ciferník/ručičky, hmotnost drahého kovu,
`orders.lang`, smazán nepoužívaný `settings.terms_version`); právní dokumenty
návrh 3 ve dvou jazycích (`src/legal/cs.mjs`, `en.mjs`, `common.mjs`; `docs.mjs`
je jen vstupní bod); e-mail s podmínkami v jazyce objednávky; vlastní správa
souhlasu s cookies (`public/assets/consent.js`, odkaz v patičce); nezávislost
ateliéru (PRIM, OMEGA, ROLEX) v patičce. Testy: unit 9/9, html, odkazy 1260,
smoke 141/141, e2e celý proces.
**Rozpracováno:** nic.
**Další krok:** majitel ověří body 1–4 v `docs/LEGAL-REVIEW.md` (DPH, živnostenský
rejstřík, živnosti, Puncovní úřad) a vloží 3 tajné údaje pro Cloudflare
(`docs/CLOUDFLARE-SETUP.md`); pak nasadit zkušební verzi.
**Pozor na:** `[OVĚŘIT …]` a `[DOPLNIT …]` blokují ostré sestavení záměrně.
Ukázkový kurz EUR a ceny dopravy do EU jsou jen v demo datech zkušební verze.

## 2026-11-25 – Claude – claude/eshop-platforma (pokyny majitele z 25. 11.)
**Hotovo:** migrace 0002 (druh hodinek, materiál pouzdra, punc, pozlacení,
identifikace pro garanci, dobírka, tabulka faktur); pojistka punc u drahých kovů;
dobírka; Balíkovna – oficiální okno České pošty (postMessage pickerResult, origin
https://b2c.cpost.cz); faktury z administrace; právní dokumenty návrh 2 (garance
i pro další majitele); automatické nasazení scripts/cf-deploy.mjs (D1 v EU, KV,
ukázková data jen pro zkušební verzi, otisk instalačního kódu v DB); vizuální
náhled jako soukromý artifact.
**Rozpracováno:** nic – čeká se na 3 tajné hodnoty Cloudflare v GitHubu.
**Další krok:** po nastavení secrets spustit testy (push) → zkušební verze;
ověřit naostro okno Balíkovny; po schválení právních textů anglické verze.
**Pozor na:** cf-deploy.mjs nebyl spuštěn proti skutečnému Cloudflare (API je
z prostředí agenta nedostupné) – první běh sledovat a případně opravit.
Ostrou doménu neměnit bez majitele.

---

## 2026-11-25 – Claude – claude/eshop-platforma (PR #3, mandát R10)
**Hotovo:** celá nová platforma: generátor stránek (CZ/EN), Cloudflare Pages
Functions + D1 + KV, katalog a detail hodinek (SSR), košík a objednávky
s atomickou rezervací, QR platba, faktura, e-maily (bez poskytovatele jen
ukládány), online odstoupení (§ 1830a), administrace pro iPhone (heslo + TOTP),
přepracované právní dokumenty (návrh s [DOPLNIT]), testy (unit, smoke, e2e,
Lighthouse, gitleaks), nasazení na Cloudflare po testech (neaktivní bez klíčů).
**Rozpracováno:** integrace Zásilkovna/Balíkovna (podání zásilek), Comgate
(neověřeno naostro), účetní systém – viz docs/INTEGRATIONS.md.
**Další krok:** majitel: Cloudflare (docs/CLOUDFLARE-SETUP.md), údaje
a rozhodnutí do docs/LEGAL-REVIEW.md. Pak nasazení na náhled, test, DNS, merge.
**Pozor na:** NESLUČOVAT PR #3 před přesměrováním domény na Cloudflare –
GitHub Pages by přestal web zobrazovat (kořen už nemá index.html).
Dependabot PR #2 se po sloučení PR #3 musí obnovit (jiný package.json).

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy (krok A automatizace)
**Hotovo:** workflow v `.github/workflows/` (testy, publikace/značky,
dostupnost, týdenní přehled, návrat k verzi), Dependabot, `tests/smoke.mjs`,
`lighthouserc.json`, `.htmlvalidate.json`, `package.json`. Opraveny 2 neescapované
`&` v `index.html`. Vše ověřeno lokálně: HTML, odkazy, 30 kontrol stránek,
Lighthouse, gitleaks, návrat k verzi na kopii repozitáře, týdenní přehled
na smyšlených datech. Akce jsou připnuté na SHA.
**Rozpracováno:** nic.
**Další krok:** majitel sloučí PR #1 a zaškrtne „Allow GitHub Actions to create
and approve pull requests“. Pak krok B (ochrana `main`, CODEOWNERS, Strážce úrovní).
**Pozor na:** actionlint nešel v prostředí spustit, YAML ověřen jen syntakticky.
První skutečný běh testů proběhne na PR #1, takže zkontrolovat výsledky.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy (návrh automatizace)
**Hotovo:** návrh automatické údržby `docs/AUTOMATION.md` a tři úrovně
oprávnění v `AGENTS.md` (sekce 3a). Rozhodnutí R8 v `docs/DECISIONS.md`.
**Rozpracováno:** nic, nic se neaktivovalo.
**Další krok:** majitel schválí návrh, pak krok A (workflow v `.github/`, úroveň 3,
takže jen na výslovný pokyn majitele).
**Pozor na:** automatické publikování je NEAKTIVNÍ, dokud v DECISIONS.md
není schválen krok C.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy (dokončení fáze 1)
**Hotovo:** `robots.txt`, `sitemap.xml`, `404.html` (absolutní cesty, `noindex`),
`canonical` + OG/Twitter značky na všech stránkách, lepší `description`
u care/warranty/returns/terms/privacy/reklamace, JSON-LD `Organization`
na hlavní stránce, čisté odkazy na Instagram/TikTok (+ `noreferrer`),
odkazy Reklamace a Soukromí v patičce (CZ/EN). `privacy.html` a
`reklamace.html` převedeny do vzhledu webu, **text beze změny** (ověřeno
porovnáním). Lighthouse viz `docs/ROADMAP.md`.
**Rozpracováno:** nic.
**Další krok:** čeká se na schválení majitele a pull request do `main`.
Pak fáze 2 (Astro) po rozhodnutí R1.
**Pozor na:** `about.html` nemá patičku vůbec (původní stav, neměněno).
Interní poznámky z `privacy.html` a `reklamace.html` byly se souhlasem
majitele odstraněny. Úkoly z nich jsou ve fázi 5 v `docs/ROADMAP.md`.
Při přidání stránky ji doplň do `sitemap.xml`.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy (optimalizace obrázků)
**Hotovo:** Originály přesunuty do `assets/originals/`, optimalizované
verze (WebP, správné rozměry, `srcset`, `loading="lazy"`) jsou v `img/`.
Generuje je skript `tools/optimize-images.py`. Nový favicon (`favicon.ico`,
32 px PNG, `apple-touch-icon`), náhled pro sociální sítě `img/og-image.jpg`
(1200×630). Hlavní stránka: obrázky z ~5,9 MB na ~70 kB (mobil) / ~170 kB
(desktop). Vzhled ověřen srovnávacími snímky na 375/768/1280 px.
**Rozpracováno:** nic.
**Další krok:** zbytek fáze 1 (robots.txt, sitemap, canonical, 404).
**Pozor na:** nové fotky vkládej do `assets/originals/` a přidej je do
skriptu. Do HTML nikdy neodkazuj přímo na originály.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy
**Hotovo:** technický audit (`docs/AUDIT-2026-11.md`), plán vývoje
(`docs/ROADMAP.md`), pravidla `AGENTS.md`, záznam rozhodnutí
(`docs/DECISIONS.md`). Kód webu se neměnil.
**Rozpracováno:** nic.
**Další krok:** čeká se na schválení dokumentů majitelem a na rozhodnutí
R1–R7. Potom fáze 1 (optimalizace obrázků).
**Pozor na:** `logo.png` a `favicon.png` jsou totožné soubory (1,5 MB).
`privacy.html` a `reklamace.html` nejsou nikde prolinkované.
