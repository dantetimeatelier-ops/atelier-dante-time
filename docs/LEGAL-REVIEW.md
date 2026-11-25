# Právní dokumenty – kontrola před zveřejněním

**Stav:** ⚖️ NÁVRH 3.1 – rejstřík, DPH a punc ověřeny 25. 11. 2026, čeká na schválení majitele (část 2a)
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
| Platby | převod CZK (QR platba) i EUR (SEPA QR), podnikatelský účet 7058919329/0800, IBAN, BIC, splatnost 3 dny; zahraničí jen předem; dobírka jen ČR (+49 Kč) |
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

## 2. Ověřeno 25. 11. 2026

| Bod | Výsledek | Zdroj |
|---|---|---|
| DPH | **neplátce DPH** (potvrdil majitel; v registru DPH není zápis). Na webu: „Prodávající není plátcem DPH. Uvedené ceny jsou konečné.“ Faktura: „Není plátcem DPH.“ | majitel, ARES |
| Živnostenský úřad | **Magistrát města Kladna** | ARES – RŽP |
| Živnostenské oprávnění | 1 živnost volná „Výroba, obchod a služby neuvedené v přílohách 1 až 3“ od 2. 12. 2025, obory: velkoobchod a maloobchod; zprostředkování obchodu a služeb; reklamní činnost; výroba plastových a pryžových výrobků; poskytování software… **Hodinářství (řemeslná živnost) zapsáno není.** | ARES – RŽP |
| Vedlejší činnost | na obsah dokumentů nemá vliv | majitel |
| Punc – sortiment | nerezová a pozlacená pouzdra **nejsou zboží z drahých kovů** → nepodléhají puncovní kontrole a **nevzniká oznamovací povinnost**. U pozlacených platí zákaz klamavého označení (§ 40): používat „pozlacené“, „v barvě zlata“, „gold-plated“, ne „zlaté“, „gold“, „18k“ apod. | zákon 539/1992 Sb. §§ 2, 35, 39, 40 (znění od 1. 7. 2017 na zakonyprolidi.cz); výklad Puncovního úřadu k „pozlaceným“ podle puncovnictvivpraxi.cz |
| Punc – zlatá pouzdra (výjimečně) | před prvním prodejem: oznámit Puncovnímu úřadu obchod s drahými kovy (do 15 dnů od zahájení, § 35 odst. 1) a e-shop (nejméně 3 dny předem, § 35 odst. 2); pouzdro musí mít platný punc (cizí vintage kusy předložit k puncovní kontrole); doklad uvádí druh, cenu, hmotnost a ryzost (§ 39) | zákon 539/1992 Sb. |
| Adresa pro vrácení | sídlo Buková 1561, Unhošť | majitel |
| Doprava, pojištění, kurz EUR | nastavitelné v administraci (ceny pro každou zemi EU zvlášť, pojištěná přeprava pro každou zemi zvlášť nebo společná cena) | – |

**Pojistky v administraci (nové):** hodinky z drahého kovu nejdou zveřejnit bez puncu,
hmotnosti a potvrzení „oznámeno Puncovnímu úřadu“ (Nastavení). U ostatních pouzder
administrace zastaví zveřejnění, pokud text obsahuje klamavý výraz (zlatý, gold, 18k, 585/1000…).
Přehled hlídá obrat neplátce (limit 2 000 000 Kč) a prodej spotřebitelům do EU (limit 10 000 €).

## 2a. ⚖️ Ke schválení majitelem před ostrým spuštěním

| # | Bod | Riziko | Můj návrh |
|---|---|---|---|
| 1 | 🔴 **Chybí řemeslná živnost Hodinářství.** Ta podle živnostenského zákona (příloha 1) zahrnuje výrobu, sestavování, seřizování a opravy hodinek. Web nabízí servis, renovace, přestavby a zakázkové sestavy a e-shop prodává hodinky renovované a sestavené v ateliéru. Volná živnost (maloobchod) kryje **jen prodej**. | podnikání bez oprávnění (pokuta od živnostenského úřadu) | ohlásit Hodinářství na Magistrátu Kladno (doklad: výuční list „hodinář“, nebo jiný doklad o způsobilosti, nebo odpovědný zástupce). Do té doby ověřit na živnostenském úřadu, co smíte nabízet. |
| 2 | **Limit 10 000 € pro prodej do EU (OSS).** Neplátce, který překročí limit u prodeje spotřebitelům do jiných zemí EU, řeší DPH v zemi zákazníka. | doměření DPH | ověřit s účetní; administrace na blížící se limit upozorní |
| 3 | **Limit obratu 2 000 000 Kč** pro povinnou registraci k DPH | registrace k DPH | administrace upozorní při 80 % |
| 4 | Text „pozlacené“ / „gold-plated“ – Puncovní úřad toleruje zavedený výraz „pozlacené“; anglické „gold-plated“ je analogie | výklad úřadu | doporučuji krátký dotaz Puncovnímu úřadu (zdarma) |
| 5 | Funkce „Odstoupit od smlouvy“ (§ 1830a OZ od 1. 1. 2027) – číslo zákona 159/2026 Sb. jen ze sekundárních zdrojů | – | ověřit v e-Sbírce před spuštěním |
| 6 | Novela „právo na opravu“ (sněmovní tisk 53) | – | po účinnosti upravit reklamační řád |
| 7 | Platební brána a e-mailová služba – doplnit do GDPR po aktivaci | – | až po vašem výběru |
| 8 | GPSR (bezpečnost výrobků) – u sestav z ateliéru jste výrobce | – | údaje o výrobci vyplňovat u každého kusu |
| 9 | Pojištění odpovědnosti / převzatých hodinek – nikde neuvádím | – | uvedu po doložení |
| 10 | Datum účinnosti = den spuštění | – | doplním v den spuštění |
| 11 | Kontrola dokumentů advokátem (CZ + EN) | – | doporučeno |

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
- Zákon č. 539/1992 Sb., o puncovnictví a zkoušení drahých kovů (§§ 2, 27, 35, 39, 40)
- Zákon č. 455/1991 Sb., živnostenský zákon, příloha 1 (Hodinářství – řemeslná živnost)
- ARES / Registr živnostenského podnikání, IČO 24020885 (výpis 25. 11. 2026)
- Nařízení vlády č. 363/2013 Sb. (vzorový formulář)
- Nařízení (EU) 2016/679 (GDPR), zákon č. 110/2019 Sb.
- Směrnice 2002/58/ES, § 89 odst. 3 zákona č. 127/2005 Sb. (cookies)
- Nařízení (EU) 593/2008 (Řím I), (EU) 2018/302 (geoblokace), (EU) 2023/988 (GPSR), (EU) 2024/3228 (zrušení ODR)
- Směrnice (EU) 2023/2673 (funkce pro odstoupení), (EU) 2024/1799 (právo na opravu)

## 5. Jak dokumenty schválit

1. Rozhodněte bod 1 z části 2a (živnost Hodinářství) a projděte ostatní body.
2. Vyplníte ceny dopravy, pojištění a kurz EUR v administraci.
3. Doporučuji kontrolu advokátem.
4. Po vašem „schvaluji“ nastavím datum účinnosti = den spuštění a e-shop se zveřejní.
