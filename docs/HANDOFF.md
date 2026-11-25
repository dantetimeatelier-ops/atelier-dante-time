# Předávací poznámky mezi agenty

Nejnovější záznam je nahoře. Formát je popsán v `AGENTS.md`, sekce 5.

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
