# Návrh: automatická údržba webu Dante Time

**Stav:** 🟡 NÁVRH, čeká na schválení majitele
**Datum:** 25. 11. 2026
**Automatické publikování:** ❌ NEAKTIVNÍ (zapne se až po výslovném schválení, viz krok C)

---

## 1. Cíl

Web se má udržovat co nejvíce sám a majitel má zasahovat jen tam, kde je
to opravdu potřeba. Každá změna:

- projde **automatickými testy**,
- má **záznam v historii** (kdo, co, kdy a proč),
- jde **vrátit zpět** jedním kliknutím,
- objeví se v **týdenním přehledu**.

## 2. Tři úrovně oprávnění

| Úroveň | Co sem patří | Kdo schvaluje | Publikace |
|---|---|---|---|
| 🟢 **1 – Bezpečné technické opravy** | optimalizace obrázků, oprava nefunkčních odkazů, SEO značky, `sitemap.xml`, atributy přístupnosti, zrychlení bez změny vzhledu, aktualizace testovacích nástrojů, dokumentace v `docs/` | automatické testy | automaticky po úspěšných testech *(až po schválení kroku C)* |
| 🟡 **2 – Větší změny** | nové stránky a funkce, změny vzhledu, marketingové texty, nové knihovny, změna struktury webu nebo hostingu | **majitel** v pull requestu | po schválení majitelem |
| 🔴 **3 – Zakázané bez výslovného souhlasu** | ceny, obchodní podmínky, záruka, reklamace, vrácení zboží, GDPR, platby, placené služby, zákaznická data, hesla a klíče, doména (`CNAME`), automatizace samotná (`.github/`), pravidla `AGENTS.md` | **majitel předem + v pull requestu** | jen ručně po schválení |

### Jak systém pozná úroveň změny

Úroveň neurčuje agent sám o sobě. Při každém pull requestu ji automaticky
ověří kontrola **„Strážce úrovní“** (`tier-gate`):

1. **Podle souborů.** Změna kteréhokoli souboru ze seznamu úrovně 3
   (`terms.html`, `warranty.html`, `returns.html`, `reklamace.html`,
   `privacy.html`, `CNAME`, `.github/**`, `AGENTS.md`, budoucí soubory
   s cenami a platbami) znamená **úroveň 3**.
2. **Podle obsahu.** Pokud změna přidá nebo odebere text s cenou
   (`Kč`, `CZK`, `€`, `EUR`, `cena`, `price`), znamená to **úroveň 3**.
3. **Podle vzhledu.** Kontrola pořídí snímky všech stránek před a po
   změně a porovná je. Pokud se vzhled změnil viditelně (více než 0,5 %
   pixelů), jde nejméně o **úroveň 2**.
4. **Podle rozsahu.** Více než 10 souborů nebo 300 změněných řádků
   znamená nejméně **úroveň 2**.
5. **Podle typu souboru.** Úroveň 1 smí měnit jen povolené cesty
   (`img/`, `assets/`, `docs/`, `sitemap.xml`, `robots.txt`, značky
   v `<head>` HTML stránek).
6. Výsledná úroveň je ta **nejvyšší** zjištěná. Agent si ji nemůže snížit.

## 3. Automatické testy (při každém pull requestu)

| Test | Nástroj | Co hlídá |
|---|---|---|
| Validace HTML | `html-validate` | chyby v kódu stránek |
| Nefunkční odkazy | `lychee` | odkazy a obrázky, které nikam nevedou |
| Rychlost a SEO | Lighthouse CI | výkon ≥ 90, SEO ≥ 95, přístupnost ≥ 95, velikost stránky ≤ 500 kB |
| Mobil a desktop | Playwright | stránky se nerozjíždí, nejsou chyby JavaScriptu, obrázky se načtou (375 / 768 / 1280 px) |
| Vizuální porovnání | Playwright | snímky před a po, jestli se změnil vzhled |
| Hesla a klíče | `gitleaks` + GitHub Secret Scanning | do repozitáře se nedostal žádný tajný údaj |
| Strážce úrovní | vlastní skript | úroveň změny 1 / 2 / 3, viz výše |

Pull request s neúspěšným testem **nelze sloučit**, a to platí pro
všechny, agenty i lidi.

## 4. Pravidelné automatické úlohy

| Kdy | Úloha | Výsledek |
|---|---|---|
| každou hodinu | **Hlídání dostupnosti** webu | při výpadku se automaticky založí issue, GitHub pošle majiteli e-mail |
| každý den | Kontrola nefunkčních odkazů na ostrém webu | issue jen při problému |
| každý týden | Lighthouse audit ostrého webu | čísla do týdenního přehledu |
| každý týden | Kontrola aktualizací nástrojů (Dependabot) | pull request úrovně 1 |
| **každé pondělí 8:00** | **Týdenní přehled** | issue „Týdenní přehled 2026-W48“, GitHub ho pošle e-mailem |

### Obsah týdenního přehledu

- seznam publikovaných změn s rozdělením podle úrovní 🟢 / 🟡 / 🔴,
- pull requesty, které čekají na schválení majitele,
- rychlost a SEO skóre a srovnání s minulým týdnem,
- dostupnost webu (např. 100 %) a případné výpadky,
- nalezené problémy (nefunkční odkazy, varování z testů),
- doporučení na další týden.

## 5. Historie a návrat zpět

1. **Každá změna jde přes pull request**, takže je vidět kdo, co, kdy a proč.
2. **Každá publikace dostane značku** (tag) `deploy-2026-11-25-1430`.
3. **Soubor `CHANGELOG.md`** se automaticky doplní srozumitelným popisem změny.
4. **Návrat zpět je možný dvěma způsoby:**
   - u konkrétní změny tlačítkem **Revert** v pull requestu,
   - celého webu k libovolnému datu ručním spuštěním akce
     **„Návrat k verzi“**: vyberete značku a systém připraví pull request,
     který web vrátí. Na kliknutí stačí mobil.
5. *(Volitelně, krok D)* **Automatický návrat:** po každé publikaci se
   ostrý web otestuje. Když nefunguje, systém sám vrátí předchozí verzi
   a pošle upozornění.

## 6. Bezpečnostní opatření

| Opatření | Proč |
|---|---|
| **Ochrana větve `main`** (ruleset): bez pull requestu a úspěšných testů nelze nic změnit, nelze přepsat historii (zákaz force push) ani smazat větev | nikdo, ani agent, nemůže obejít testy |
| **`CODEOWNERS`**: soubory úrovně 3 vyžadují schválení majitele | technická pojistka, nejen pravidlo |
| **Agent nesmí měnit automatizaci ani pravidla** (`.github/`, `AGENTS.md` jsou úroveň 3) | agent si nemůže sám rozšířit oprávnění |
| **Minimální oprávnění** akcí (`permissions:` u každé akce, výchozí jen čtení) | při chybě nebo útoku je škoda co nejmenší |
| **Akce připnuté na konkrétní verzi** (SHA), aktualizace přes Dependabot | ochrana před podvrženou novou verzí cizí akce |
| **Žádné `pull_request_target` se spouštěním cizího kódu** | ochrana před útokem přes cizí pull request |
| **Hlavní vypínač**: proměnná `AUTO_MERGE_TIER1` (výchozí `false`) | automatické publikování jde kdykoli jedním přepnutím vypnout |
| **Secret scanning + push protection** (zdarma pro veřejné repozitáře) | GitHub zablokuje nahrání hesla nebo klíče |
| **Dvoufázové ověření (2FA)** na účtu majitele | ochrana nejcennějšího přístupu |
| **Tajné klíče jen v GitHub Secrets** a v prostředích s ochranou | klíče nikdy nejsou v kódu ani v logu |
| **Prostředí `production`** s pravidlem „jen z větve `main`“ | publikovat lze jen schválený kód |

## 7. Náklady

| Položka | Cena |
|---|---|
| GitHub Actions | **0 Kč**: repozitář je veřejný a GitHub Pages zdarma vyžaduje veřejný repozitář, takže minuty jsou neomezené |
| GitHub Pages hosting | **0 Kč** |
| Nástroje (Lighthouse CI, Playwright, lychee, html-validate, gitleaks, Dependabot) | **0 Kč**, open source nebo součást GitHubu |
| Hlídání dostupnosti přes GitHub Actions | **0 Kč** |
| E-mailová upozornění (GitHub Issues) | **0 Kč** |
| **Celkem** | **0 Kč měsíčně** |

Volitelné 💰 (nezapíná se bez souhlasu):

- **Pravidelná práce AI agenta** (např. týdenní audit a návrhy oprav
  přes plánované úlohy Claude Code nebo ChatGPT) se čerpá z vašeho
  předplatného, ne jako samostatná platba.
- Externí hlídání dostupnosti s SMS (např. UptimeRobot Pro) stojí
  řádově stovky Kč měsíčně. Bezplatná verze e-mailem stačí.

> Kdyby se repozitář někdy změnil na soukromý, GitHub Free má 2 000 minut
> měsíčně. Odhad spotřeby je asi 1 000–1 500 minut, hlavně kvůli
> hodinovému hlídání dostupnosti. To by se pak omezilo.

## 8. Postup zavedení

| Krok | Co | Riziko | Schválení |
|---|---|---|---|
| **A** | Automatické testy u pull requestů, týdenní přehled, hlídání dostupnosti, `CHANGELOG.md`, akce „Návrat k verzi“ | žádné, nic nepublikuje | 🟡 pull request |
| **B** | Ochrana větve `main`, `CODEOWNERS`, Strážce úrovní jako povinná kontrola | žádné, jen zpřísní pravidla | 🟡 pull request + **majitel klikne nastavení** (návod připravím) |
| **C** | **Zapnutí automatického publikování úrovně 1** (`AUTO_MERGE_TIER1=true`) | nízké, chrání ho testy | 🔴 **výslovný souhlas majitele** |
| **D** | Publikace přes GitHub Actions s testem ostrého webu a automatickým návratem | nízké | 🟡 majitel přepne zdroj Pages v nastavení |

Doporučuji nechat mezi kroky B a C **2–4 týdny zkušebního provozu**.
Strážce úrovní během nich jen značí, co by se publikovalo samo, a
majitel si v týdenních přehledech ověří, že rozhoduje správně.

## 9. Co musí udělat majitel (jednorázově, asi 15 minut)

1. Zapnout 2FA na GitHub účtu (pokud ještě není).
2. V *Settings → Code security* zapnout **Secret scanning** a **Push protection**.
3. V *Settings → Rules* vytvořit pravidla pro `main` (přesný návod
   s obrázky připravím v kroku B).
4. V *Settings → Notifications* nechat zapnuté e-maily pro issues,
   aby týdenní přehled chodil e-mailem.
5. Krok C: schválit zapnutí automatického publikování.
