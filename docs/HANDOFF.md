# Předávací poznámky mezi agenty

Nejnovější záznam je nahoře. Formát je popsán v `AGENTS.md`, sekce 5.

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
