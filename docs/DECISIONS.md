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
