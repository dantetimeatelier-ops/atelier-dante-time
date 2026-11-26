# Záznam rozhodnutí

Sem se zapisuje každé schválené rozhodnutí majitele, aby na něj mohli
navázat Claude, ChatGPT i lidé.

Formát:

```
## RX – Název (YYYY-MM-DD)
**Rozhodl:** majitel
**Rozhodnutí:** …
**Důvod:** …
**Důsledky:** …
```

---

## R0 – Pravidla spolupráce AI agentů (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Platí pravidla v `AGENTS.md`. Veškerá práce probíhá ve
vývojových větvích, `main` se mění jen po schválení majitelem.
**Důvod:** bezpečnost ostrého webu a možnost návratu.
**Důsledky:** každá změna prochází pull requestem.

## R8 – Tři úrovně oprávnění pro změny (2026-11-25)
**Rozhodl:** majitel (zadání)
**Rozhodnutí:** Změny se dělí na úroveň 1 (automaticky po testech),
2 (schvaluje majitel) a 3 (zakázáno bez výslovného souhlasu). Pravidla
jsou v `AGENTS.md`, sekce 3a.
**Důvod:** maximální automatizace při zachování kontroly nad důležitými věcmi.
**Důsledky:** automatické publikování úrovně 1 **zatím není aktivní**,
zapne se až samostatným schválením kroku C v `docs/AUTOMATION.md`.

## R9 – Zavedení kroku A automatizace (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Schválena příprava kroku A z `docs/AUTOMATION.md`
(testy, záznam verzí, hlídání dostupnosti, týdenní přehled, návrat k verzi).
**Důvod:** historie změn, kontrola kvality a přehled bez nutnosti zásahu.
**Důsledky:** soubory v `.github/` (úroveň 3) jsou součástí PR #1.
Automatické publikování (krok C) zůstává **vypnuté**.

## R10 – Rozšířený mandát pro dokončení projektu (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Agent samostatně modernizuje web, buduje administraci a
e-shop, přepracuje právní dokumenty a smí slučovat a publikovat bezpečné
a úspěšně otestované změny bez průběžného schvalování.
**Výjimky (vždy jen s výslovným souhlasem):** prodejní ceny, placené služby
a předplatné, skutečné platby, mazání záloh, rozšíření vlastních oprávnění,
zákaznické údaje, faktury, hesla a klíče ve veřejném repozitáři.
E-shop pro skutečné objednávky až po ověření právních dokumentů,
zabezpečení a objednávkového procesu majitelem. Nejasnosti v právních
dokumentech předložit před zveřejněním.
**Důvod:** urychlení projektu a minimum průběžného schvalování.
**Důsledky:** nahrazuje omezení průběžného schvalování z R0 a R8 pro
technické změny. Po dokončení projektu se nastaví omezená oprávnění.

## R11 – Daňový režim, sortiment a nastavení dopravy (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Provozovatel je **neplátce DPH** a podniká jako OSVČ na vedlejší
činnost. Sortiment tvoří převážně **nerezová a pozlacená pouzdra**; pozlacená se
vždy odlišují od pouzder z ryzího zlata a zlatých slitin. Doručuje se po celé EU.
Ceny dopravy, pojištění zásilek a kurz eura se nastavují v administraci.
Adresa pro vrácení zboží je zatím adresa sídla v Unhošti. Údaje o živnosti
a povinnosti vůči Puncovnímu úřadu ověřuje agent ve veřejných zdrojích.
Zbývající neověřené právní údaje agent předloží ke schválení před spuštěním.
**Důsledky:** viz `docs/LEGAL-REVIEW.md`, části 2 a 2a.

## R12 – Hodinky do e-shopu přidává agent (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Majitel posílá agentovi fotografie, základní údaje, cenu a případně
vlastní text. Agent samostatně vytvoří kompletní produktovou kartu (texty v prémiovém
stylu Dante Time, technické parametry, druh hodinek, pořadí fotografií, SEO, cena,
dostupnost, záruční informace), zkontroluje zobrazení na počítači i mobilu a hodinky
zveřejní, pokud majitel výslovně neřekne, že mají zůstat jako koncept.
**Omezení:** agent nevymýšlí neověřené technické ani historické údaje; na chybějící
důležité údaje se zeptá jen na ně. Cenu nastavuje vždy jen podle majitele.
**Technicky:** složka `katalog/` v repozitáři → automatické nasazení (`scripts/catalog.mjs`).

## R13 – Výchozí šablona hodinek PRIM a označení přestaveb (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** U hodinek PRIM platí, pokud majitel neuvede jinak: originální strojek,
ciferník a ručičky PRIM; nové nerezové pouzdro Dante Time; průměr 39–42 mm podle modelu
(přesný rozměr jen když ho majitel sdělí); šířka uchycení 20 mm; safírové přední sklo;
průhledné dýnko; voděodolnost 3 ATM; kompletně servisovaný a seřízený strojek; záruka
24 měsíců; doživotní garance pravosti originálních komponentů; dárková krabička a
dokumentace Dante Time. Kalibr a rok výroby jen pokud jsou známé. Cenu sděluje majitel.
Druh se označuje „Ateliérová přestavba Dante Time“.
**Doplněno týž den:** videa se v e-shopu nezobrazují (na iPhonu se nezobrazovala správně),
majitel je zveřejňuje na Instagramu. Do katalogu se přidávají jen fotografie.
**Technicky:** `katalog/sablona-prim.json`.

## R14 – Podnikatelský bankovní účet (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Pro všechny platby se používá výhradně podnikatelský účet Patrik Hužička,
Česká spořitelna, 7058919329/0800, IBAN CZ76 0800 0000 0070 5891 9329, BIC GIBACZPX.
Původní osobní účet se pro nové objednávky nepoužívá. Dříve vystavené doklady se nemění.
**Technicky:** jediné místo `src/site.mjs` (OPERATOR); objednávky a faktury si účet ukládají
(migrace 0006), proto pozdější změna účtu staré doklady neovlivní.

## R15 – Živnostenské oprávnění a nabídka webu (2026-11-25)
**Rozhodl:** majitel
**Rozhodnutí:** Odpovědného zástupce se neustanovuje. Majitel absolvoval hodinářský kurz
a rozšíření živnostenského oprávnění si vyřeší osobně. Záležitost zůstává na odpovědnosti
majitele a eviduje se jako **otevřený právní bod L1** (`docs/LEGAL-REVIEW.md`, část 2e).
Web se zveřejní s nabídkou činností, které pokrývá současné oprávnění, tedy s prodejem
hotových hodinek. Servis, renovace a zakázky pro zákazníky se do vyřešení nenabízejí.
Dokumenty neuvádějí nepravdivé informace o externích hodinářích. Design, fotografie
a produkty zůstávají beze změny.
**Technicky:** přepínač `SERVICES_OFFERED` v `src/site.mjs` (false). Po zápisu oprávnění
ho agent na pokyn majitele přepne na true a stránka Služby, poptávka servisu a podmínky
zakázkové výroby se vrátí.
**Změna týž den (majitel):** „Ne, vše nech, vše nabízíme.“ Web nabízí i servis, renovace
a zakázky (`SERVICES_OFFERED = true`). Odpovědnost za živnostenské oprávnění nese majitel,
bod L1 zůstává otevřený.
**Upřesnění týž den (majitel):** Současná prezentace Dante Time se zásadně nemění: filozofie,
historie, fotografie, tvorba, design, individualizace a dokončené projekty zůstávají.
Dante Time nesmí působit jako pouhý přeprodejce. Právní omezení jen v nezbytném rozsahu
u nabídky a objednávání konkrétních služeb, nic se trvale nemaže. **Zásadní změny textů
nebo struktury webu agent nejdřív předloží majiteli ke schválení.** Priorita: dokončení
a spuštění webu.


## R16 – Úvodní sekce hlavní stránky (2026-11-26)
**Rozhodl:** majitel („schvaluji úvod“)
**Rozhodnutí:** Úvodní sekce podle návrhu majitele: velký zlatý štít DT, nápis DANTE TIME,
„Dáváme času nový život“ s linkami a ornamentem, „Tradice. Řemeslo. Čas.“ a jedno zlaté
orámované tlačítko „Objevte naši tvorbu“; pod ním malý odkaz „Servis a zakázka na míru“.
Fotografie zůstává. Krátký popis ateliéru z úvodu odebrán.

## R17 – Schválení právních dokumentů a spuštění (2026-11-26)
**Rozhodl:** majitel („schvaluji dokumenty“)
**Rozhodnutí:** Právní dokumenty verze 3.2 (CZ + EN) schváleny jako verze 1.0 s účinností
od 26. 11. 2026. Web se spouští na doméně atelier-dante-time.cz. Otevřený právní bod L1
(živnostenské oprávnění) zůstává na odpovědnosti majitele (R15).

## R18 – Garanční prohlídka, varianta A (2026-11-26)
**Rozhodl:** majitel („beru jako A“)
**Rozhodnutí:** Dobrovolná záruka 24 měsíců; ve 2. roce trvá po garanční prohlídce po 12 měsících
od převzetí (±30 dnů), cena 690 Kč, prohlídka jen v ateliéru, doprava na náklady zákazníka.
Zákonná práva zachována, platí jen pro nákupy od verze 1.1, garance pravosti nezávislá.
Majitel bere na vědomí riziko přiměřenosti u zákazníků z EU (LEGAL-REVIEW 2f).
Majitel potvrdil, že tištěná knížka už obsahuje stejné podmínky (varianta A), takže se záruční texty neliší.
**Fyzické balení:** majitel dodává knížku a gravírovanou kartičku s modelem; další tištěný
záruční list nechce. Záruční list v textové podobě (§ 2174a OZ) jde e-mailem s potvrzením objednávky.

## R19 – Schválení podmínek verze 1.1 a zapnutí objednávek (2026-11-26)
**Rozhodl:** majitel („schvaluji 1.1“)
**Rozhodnutí:** Podmínky 1.1 (reklamace s prodloužením jen po dohodě, garanční prohlídka varianta A,
zálohy jen po dohodě 20–30 %, záruční list v potvrzení objednávky) platí od 26. 11. 2026.
Ostrý web přijímá objednávky (`SHOP_MODE = "live"` ve `wrangler.toml`).
