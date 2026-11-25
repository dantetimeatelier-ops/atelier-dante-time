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
