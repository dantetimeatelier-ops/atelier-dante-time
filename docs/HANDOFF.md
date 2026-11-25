# Předávací poznámky mezi agenty

Nejnovější záznam je nahoře. Formát je popsán v `AGENTS.md`, sekce 5.

---

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
