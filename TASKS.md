# TASKS – úkoly Dante Time OS

**Aktualizováno:** 28. 11. 2026. Nové položky nahoru. Po každém úkolu aktualizuj (R28).
Stav systému: [`PROJECT_STATE.md`](PROJECT_STATE.md) · plán: [`ROADMAP.md`](ROADMAP.md) · rozhodnutí: [`DECISIONS.md`](DECISIONS.md)

Značky: 🔴 platby/bezpečnost · ⚖️ právní texty, ceny · 💰 může stát peníze

## ⏳ Čeká na majitele

| # | Co | Proč čeká | Od |
|---|---|---|---|
| 3 | Ověřit na iPhonu výběr Zásilkovny na mapě („Vybráno: …“) | oprava nasazena (PR #55), bez iPhonu nelze otestovat | 27. 11. |
| 4 | ⚖️ Kontrola právních dokumentů 1.2 a PR #32 (AI u poptávek v GDPR) | právní texty | 26. 11. |
| 5 | R7 – tykání, nebo vykání (doporučení: vykání) | tón značky | 25. 11. |
| 6 | Ochrana větve `main` na GitHubu (Settings → Branches) | nastavení účtu | 25. 11. |
| 7 | Google Merchant Center (zdarma): založit účet, zdroj dat `https://atelier-dante-time.cz/feed/google.xml` | účet zakládá majitel | 27. 11. |
| 8 | Fotky a údaje dalších hodinek (Rolex aj.) | podklady | – |
| 9 | PDF nákupů AliExpress/Temu (náklady 2026) | podklady | – |
| 10 | Přístupy Instagram/Facebook/Metricool (DT Marketing) | nový externí přístup | – |
| 11 | Kritéria nákupu pro DT Scout (značky, ceny, stav, tržiště) | zadání | – |
| 12 | 💰 Párování plateb z banky | přístup k účtu, může stát peníze | – |
| 13 | Fotka strojku Heritage Date do galerie? | souhlas s použitím | 27. 11. |
| 14 | Zkušební vypálení karty pasu v xTool a načtení QR telefonem (normální i inverze podle materiálu) | fyzický test | 28. 11. |

## 🔧 Rozpracováno

- (nic)

## 📋 Plánováno (agent může udělat sám)

| Priorita | Úkol | Poznámka |
|---|---|---|
| 1 | Po první ostré platbě ověřit, že se poplatek Stripe (vč. Radar 1,40 Kč) zapsal do nákladů hodinek | PROJECT_STATE rozpor 2 |
| 2 | E-mail „Nová objednávka“ – u testovací platby nepsat „(ostrá)“ | kosmetika |
| 3 | Komplexní kontrola R27: objednávky, faktury, pasy, mobil, výpočty, duplicity | pravidelně |
| 4 | Ověřit, zda workflow GitHub Pages ještě něco dělá; případně navrhnout vypnutí (úroveň 3, `.github/`) | PROJECT_STATE rozpor 5 |
| 5 | DT Innovation – první týdenní analýza | po prvních týdnech provozu |
| 6 | Vyčištění e-shopu: kontrola fotek, cen, popisů, dostupnosti 4 inzerátů | z ROADMAP |
| 7 | Závěrečná kontrola webu, odkazů a mobilního zobrazení | z ROADMAP |

## ✅ Dokončeno (výběr, podrobně v CHANGELOG.md)

- 28. 11. Podpis a razítko na certifikát pravosti (nahrání v Nastavení).
- 28. 11. Pas ze zakázky: kalibr → popis strojku a roky výroby, výchozí originalita (přestavba / vše originální).
- 28. 11. Údaje pasu (kalibr, originální a vyměněné díly) se vyplňují v zakázce a do pasu se přepisují samy.
- 28. 11. Digitální pas automaticky i pro zakázky (po přijetí; práce a předání do historie; bez zákazníka a ceny).
- 28. 11. Karta digitálního pasu k gravírování (SVG v křivkách, PNG 600 DPI, PDF, inverze, hromadný ZIP, kontrola QR).
- 28. 11. Platba kartou, Apple Pay a Google Pay v ostrém provozu (Integrace: klíč ostrý, webhook ok, zákazníci vidí: ano) – PR #71 + klíče majitele.
- 28. 11. Centrální dokumentace R28 – PR #70.
- 28. 11. Ostrý Stripe: ověření účtu, ostrý webhook, metody Cards/Apple Pay/Google Pay, klíče v Cloudflare, nasazení.
- 28. 11. Test plateb kartou v sandboxu na ostrém webu (obj. 2026-0004 se sama zrušila, bez faktury) – PR #54.
- 27. 11. Zjednodušení dopravy (R25), Balíkovna 50 000 Kč (pokyn majitele), Cenná zásilka – PR #47, #55, #56.
- 27. 11. Jednotné názvy „DT – ZNAČKA …“ (R26) – PR #64; trvalý pokyn R27 – PR #65.
- 27. 11. Faktury: koncepty, náhled, částečné platby, storno, kopie, bez DUZP – PR #48–#52, #60, #62.
- 27. 11. Google feed, správa výdajů, díly v zakázce, kalibr, inzeráty – PR #45–#46, #50, #57–#59, #61, #63, #67.
- 26. 11. Dante Time OS E1–E3 (jádro, sklad, pasy, nákupy a prodeje s AI), fakturační systém – PR #7–#20.
- 26. 11. Spuštění platformy, e-shop, podmínky 1.1 a zapnutí objednávek – PR #3, #5, #6.
- 25. 11. Fáze 1: zrychlení webu, SEO, 404, automatické testy – PR #1.

## Vyřešené otázky z původního plánu (R1–R6)

| ID | Otázka | Výsledek v praxi |
|---|---|---|
| R1 | Na čem e-shop | vlastní řešení na Cloudflare Pages (bez Astro – vlastní generátor) |
| R2 | Administrace | vlastní `/admin` s databází D1 |
| R3 | Platební brána | Stripe Standard (R23) |
| R4 | Fakturace | vlastní fakturační systém (ne Fakturoid/iDoklad) |
| R5 | Jazyky a měny | CZ + EN, ceny v Kč, zobrazení i v EUR, karta vždy v Kč |
| R6 | Hosting | Cloudflare Pages |
| R7 | Tykání/vykání | **otevřené** – Čeká na majitele #5 |
