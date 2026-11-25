# Právní dokumenty – kontrola před zveřejněním

**Stav:** ⚖️ NÁVRH 3 – údaje a rozhodnutí majitele zapracovány, CZ i EN, čeká na ověření bodů níže
**Připraveno:** 25. 11. 2026
**Zdroj textů:** `src/legal/cs.mjs` (česky), `src/legal/en.mjs` (anglicky), společné údaje
`src/legal/common.mjs` a `src/site.mjs` (objekt `OPERATOR`).

| Dokument | Česky | Anglicky |
|---|---|---|
| Obchodní podmínky | `/terms` | `/en/terms` |
| Reklamační řád | `/reklamace` | `/en/complaints` |
| Odstoupení a vrácení (+ vzorový formulář) | `/returns` | `/en/withdrawal` |
| Záruka a doživotní garance pravosti | `/warranty` | `/en/warranty` |
| Zakázková výroba, servis a renovace | `/zakazkova-vyroba` | `/en/custom-work` |
| Doprava a platba | `/doprava-a-platba` | `/en/shipping-payment` |
| Ochrana osobních údajů (GDPR) | `/privacy` | `/en/privacy` |
| Cookies + tlačítko „Nastavení cookies“ | `/cookies` | `/en/cookies` |
| Mimosoudní řešení sporů (ADR) | `/reseni-sporu` | `/en/dispute-resolution` |
| Prodej do zemí EU | `/prodej-do-eu` | `/en/eu-sales` |
| Informace o provozovateli | `/provozovatel` | `/en/legal-notice` |
| Online odstoupení (funkce § 1830a OZ) | `/odstoupeni` | (česky, s anglickým popisem v plánu) |

> **Nejsem advokát.** Dokumenty odpovídají předpisům, jak je znám, a klíčové
> novinky 2023–2026 jsem ověřil z veřejných zdrojů. U e-shopu s luxusním zbožím
> a prodejem do celé EU doporučuji jednorázovou kontrolu advokátem.

---

## 1. Co je zapracováno (podle zadání majitele z 25. 11. 2026)

| Téma | Stav |
|---|---|
| Provozovatel | Patrik Hužička, OSVČ, značka Dante Time, IČO 24020885, Buková 1561, 273 51 Unhošť, podnikání od 2. 12. 2025 |
| Platby | převod CZK (QR platba) i EUR (SEPA QR), účet 2854824133/0800, IBAN, BIC, splatnost 3 dny; zahraničí jen předem; dobírka jen ČR (+49 Kč) |
| Doprava ČR | Zásilkovna 99 Kč, Balíkovna 79 Kč, výběr výdejního místa na mapě, osobní předání jen po domluvě |
| Doprava EU | všech 27 států; cena se ukáže po výběru země **před odesláním objednávky** |
| Drahé hodinky | od nastavené ceny jen pojištěná přeprava nebo osobní předání |
| Expedice | do 3 pracovních dnů od platby / potvrzení dobírky |
| Nepřevzatá dobírka | jen skutečné náklady jako náhrada škody, žádná smluvní pokuta |
| Zakázky | záloha 50 %, převzetí do 30 dnů, bez skladného, termín individuálně, tolerance ±30 s/den, předchozí schválení ceny i víceprací |
| Záruka | 24 měsíců (hodinky i práce) |
| Garance pravosti | doživotně, na deklarované originální **strojky, ciferníky a ručičky**, i pro další majitele; podmínka identifikace a ověření; náprava výměna nebo vrácení ceny; zákonná práva nedotčena |
| Odstoupení | 14 dnů u hotových hodinek (smluvně i pro firmy), výjimka zakázka na míru |
| Přestavby | vždy rozlišeny originální vs. nové součásti |
| Nezávislost | „není autorizovaným servisem ani prodejcem PRIM, OMEGA, ROLEX…“ v patičce, u hodinek i v dokumentech |
| Punc | zákon č. 539/1992 Sb. (dříve chybně uvedeno 19/1993 – opraveno); faktura uvádí druh kovu, ryzost a hmotnost |
| Cookies | jen nezbytné úložiště; vlastní správa souhlasu bez externích služeb (volitelné kategorie vypnuté) |
| EU | geoblokační nařízení 2018/302, Řím I čl. 6, Evropské spotřebitelské centrum |
| Datum účinnosti | = den ostrého spuštění (do té doby se ostrý web nesestaví) |

## 2. 🔴 Co je potřeba ověřit před ostrým spuštěním

Na zkušebním webu jsou tyto body vidět jako zvýrazněné `[OVĚŘIT: …]` nebo
`[DOPLNIT: …]`. **Ostrý režim nejde sestavit, dokud tam zůstanou.**

| # | Co ověřit | Kde a jak | Proč |
|---|---|---|---|
| 1 | 🔴 **Plátce / neplátce DPH** | daňová přiznání, účetní; ARES (nedostupný z mého prostředí) | věta o DPH v cenách, faktura, OSS |
| 2 | 🔴 **Zápis v živnostenském rejstříku** a příslušný úřad (pravděpodobně Magistrát města Kladna) | výpis z rzp.gov.cz | provozovatel, faktura, dozor |
| 3 | 🔴 **Živnosti:** hodinářství (řemeslná, vyžaduje odbornou způsobilost) + výroba, obchod a služby (volná, prodej) | výpis z rejstříku | prodej i servis musí být kryty |
| 4 | 🔴 **Puncovní úřad:** oznámení zahájení obchodu se zbožím z drahých kovů (do 15 dnů) a provozu e-shopu (nejméně 3 dny předem) | puncovniurad.cz | povinnost dle zákona 539/1992 Sb. před prodejem zlatých/stříbrných pouzder |
| 5 | **OSS (DPH při prodeji do EU)** – sledovat limit 10 000 EUR ročně | účetní | nad limitem DPH v zemi zákazníka (týká se plátců i neplátců – ověřit s účetní) |
| 6 | **Ceny dopravy do jednotlivých zemí EU** | administrace → Nastavení | dokud nejsou vyplněné, země nabídne jen osobní předání / poptávku |
| 7 | **Hranice a cena pojištěné přepravy** (ČR i EU) a konkrétní dopravce | administrace → Nastavení | zkušební web má ukázku 50 000 Kč / 290 Kč / 890 Kč |
| 8 | **Kurz EUR** (pevný v administraci, aktualizovat ručně) | administrace → Nastavení | zkušební web má ukázku 25 Kč/EUR |
| 9 | **Adresa pro vracení zboží** – zatím se používá sídlo | potvrďte, nebo pošlete jinou | odstoupení, reklamace |
| 10 | **Pojištění** odpovědnosti / převzatých hodinek – **nikde se neuvádí**, dokud ho nedoložíte | – | nesmíme tvrdit neověřené |
| 11 | Funkce „Odstoupit od smlouvy“ (§ 1830a OZ od 1. 1. 2027) – číslo zákona 159/2026 Sb. jen ze sekundárních zdrojů | e-Sbírka | ověřit konečné znění |
| 12 | Novela „právo na opravu“ (sněmovní tisk 53) | sledovat | po účinnosti upravit reklamační řád |
| 13 | Platební brána a e-mailová služba – názvy doplnit do GDPR po aktivaci | – | GDPR čl. 3 |
| 14 | GPSR (bezpečnost výrobků) – u sestav z ateliéru jste výrobce | advokát / ČOI | údaje o výrobci a upozornění |
| 15 | Kontrola advokátem (CZ + EN) | – | doporučeno |

## 3. Upozornění

1. **Neprezentovat zákonná práva jako výhodu** (24 měsíců na vady, 14 dní na
   vrácení). Skutečnou výhodou je **garance pravosti** a smluvní vrácení pro firmy.
2. **Evropská platforma ODR byla zrušena 20. 7. 2025** – neuvádí se.
3. **Potvrzení objednávky** obsahuje celé obchodní podmínky a poučení
   o odstoupení **v jazyce objednávky** (trvalý nosič).
4. **Ochranné známky:** nepoužívat loga značek; text o nezávislosti je všude.
5. **Slevy:** při zobrazení slevy uvádět nejnižší cenu za 30 dní.
6. **GDPR:** Cloudflare, Google a GitHub – ověřit certifikaci v EU–US DPF.
7. **Faktura:** po ověření režimu DPH nechat formát potvrdit účetní.

## 4. Použité zdroje

- Zákon č. 89/2012 Sb., občanský zákoník (novela 374/2022 Sb.; § 1830a od 1. 1. 2027)
- Zákon č. 634/1992 Sb., o ochraně spotřebitele
- Zákon č. 539/1992 Sb., o puncovnictví a zkoušení drahých kovů
- Nařízení vlády č. 363/2013 Sb. (vzorový formulář)
- Nařízení (EU) 2016/679 (GDPR), zákon č. 110/2019 Sb.
- Směrnice 2002/58/ES, § 89 odst. 3 zákona č. 127/2005 Sb. (cookies)
- Nařízení (EU) 593/2008 (Řím I), (EU) 2018/302 (geoblokace), (EU) 2023/988 (GPSR), (EU) 2024/3228 (zrušení ODR)
- Směrnice (EU) 2023/2673 (funkce pro odstoupení), (EU) 2024/1799 (právo na opravu)

## 5. Jak dokumenty schválit

1. Ověřte body 1–4 z části 2 a pošlete mi výsledek (stačí v chatu).
2. Doplním je, vyplníte ceny dopravy v administraci.
3. Doporučuji kontrolu advokátem.
4. Po vašem „schvaluji“ nastavím datum účinnosti = den spuštění a e-shop se zveřejní.
