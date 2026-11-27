# Plán vývoje: z prezentace na luxusní e-shop

**Stav k:** 25. 11. 2026
**Vlastník rozhodnutí:** majitel Dante Time
**Výchozí podklad:** [`AUDIT-2026-11.md`](AUDIT-2026-11.md)

Plán má 7 fází. Každá fáze končí **schválením majitele** a teprve potom
jde na ostrý web. Body označené 💰 mohou znamenat placenou službu a bez
výslovného souhlasu majitele se neaktivují.

---

## Fáze 0: Základy a bezpečnost práce *(probíhá)*

- [x] Technický audit (`docs/AUDIT-2026-11.md`)
- [x] Plán vývoje (tento soubor)
- [x] Společná pravidla pro AI agenty (`AGENTS.md`)
- [ ] Majitel nastaví ochranu větve `main` na GitHubu (*Settings → Branches →
      Add rule → Require a pull request before merging*)
- [ ] Ověřit, že GitHub Pages publikuje jen z větve `main` a má zapnuté
      „Enforce HTTPS“
- [x] Vytvořit tag `v0-puvodni-web`, zálohu současného stavu, ke které
      se lze kdykoli vrátit (vytvoří ho automaticky akce „Záznam verze“ při sloučení PR #1)

## Fáze 0b: Automatická údržba *(návrh čeká na schválení)*

Podrobnosti: [`docs/AUTOMATION.md`](AUTOMATION.md)

- [x] Návrh řešení, nákladů a bezpečnosti
- [x] Tři úrovně oprávnění zapsané v `AGENTS.md`
- [x] Krok A: automatické testy, týdenní přehled, hlídání dostupnosti, návrat k verzi (PR #1)
- [ ] Krok B: ochrana `main`, `CODEOWNERS`, Strážce úrovní
- [ ] Krok C 🔴: zapnutí automatického publikování úrovně 1 (**výslovný souhlas majitele**)
- [ ] Krok D: publikace přes Actions s automatickým návratem

## Fáze 1: Rychlá vylepšení stávajícího webu

Cíl: rychlejší a lépe dohledatelný web, beze změny vzhledu a textů podmínek.

- [x] Optimalizace obrázků (WebP, správné rozměry, `loading="lazy"`)
- [x] Skutečný favicon a ikony pro mobil
- [x] `robots.txt`, `sitemap.xml`, `canonical`, OG značky všude
- [x] Stránka 404 ve stylu značky
- [x] Propojení `privacy.html` a `reklamace.html` z patičky a sjednocení vzhledu
- [x] Strukturovaná data `Organization`
- [x] Měření rychlosti (Lighthouse) před a po změnách

**Výsledek (Lighthouse, mobil, 25. 11. 2026):**

| Stránka | Výkon před → po | Velikost před → po | LCP před → po |
|---|---|---|---|
| Hlavní stránka | 75 → **100** | 5 942 kB → **91 kB** | 30,8 s → **1,1 s** |
| Služby | 75 → **100** | 3 876 kB → **77 kB** | 21,2 s → **1,1 s** |

Přístupnost, správné postupy a SEO: 98–100 před i po.

## ✅ Stav k 25. 11. 2026 (mandát R10)

Fáze 2–5 jsou **naprogramované a otestované** ve větvi `claude/eshop-platforma`
(PR #3). Čekají na spuštění na Cloudflare (`docs/CLOUDFLARE-SETUP.md`)
a schválení právních dokumentů (`docs/LEGAL-REVIEW.md`). Fáze 6 je
připravená, ale neaktivní (`docs/INTEGRATIONS.md`). Odchylka od původního
plánu: místo frameworku Astro vlastní lehký generátor stránek, který má méně
závislostí a stejný výsledek.

## Fáze 2: Nový technický základ

Cíl: jeden společný vzhled pro všechny stránky a příprava na katalog
a jazyky.

- [ ] Přechod na generátor statického webu **Astro** (doporučení, viz
      rozhodnutí R1): sdílená hlavička, patička a styly, výstupem zůstane
      rychlé statické HTML
- [x] Design systém: barvy, písma, tlačítka a karty jako jedno místo pravdy
- [ ] Zachování všech současných URL (např. `/services.html`), aby se
      neztratilo SEO
- [x] Automatická kontrola při každé změně (build, odkazy, velikost obrázků)
      přes GitHub Actions
- [x] Náhledová verze webu z vývojové větve, aby majitel viděl změny
      ještě před schválením

## Fáze 3: Vícejazyčnost

- [x] Struktura URL: `/` čeština, `/en/` angličtina, později např. `/de/`
- [x] `hreflang` a jazykové sitemapy
- [ ] Překlady v samostatných souborech (`src/i18n/cs.json`, `en.json`)
- [x] Přepínač jazyka, který vede na odpovídající stránku
- [x] Ceny v Kč, platba volitelně v EUR (pevný kurz z administrace, SEPA QR)

## Fáze 4: Katalog hodinek a administrace

Cíl: majitel sám přidává hodinky, fotky, ceny a dostupnost.

- [ ] Datový model hodinky: název, slug, popis (CZ/EN), strojek, průměr
      pouzdra, materiál, sklíčko, vodotěsnost, řemínek, cena, stav
      (`k dispozici` / `rezervováno` / `prodáno`), fotogalerie, pořadí
- [x] Stránka kolekce a detail hodinek s galerií a zoomem
- [x] Prodané kusy zůstanou jako „Archiv“, což pomáhá důvěře i SEO
- [ ] **Administrace** (rozhodnutí R2), přihlášení přes účet s
      dvoufázovým ověřením (2FA)
- [x] Automatická optimalizace nahraných fotografií
- [x] Strukturovaná data `Product` (cena, dostupnost)

## Fáze 5: Objednávkový systém

- [ ] Košík (u unikátních kusů spíš tlačítko „Koupit“ / „Rezervovat“)
- [x] Objednávkový formulář s výběrem dopravy a souhlasem s podmínkami
- [x] Rezervace kusu během objednávky, aby nedošlo k prodeji dvakrát
- [x] Potvrzovací e-mail zákazníkovi a upozornění majiteli
- [x] Přehled objednávek v administraci
- [x] Ochrana proti spamu ve formulářích
- [ ] ⚖️ Doplnit do `reklamace.html` přesnou reklamační lhůtu a formulace pro prodej hotových kusů (prodej vs. služba), **připraví majitel nebo právník**
- [ ] Aktualizace `privacy.html` (GDPR) a cookie lišty (**připraví majitel
      nebo právník**, agent jen navrhne strukturu)

## Fáze 6: Platby, doprava, fakturace 💰

Každá služba vyžaduje smlouvu nebo registraci majitele. Agent připraví
integraci v testovacím režimu a ostrý provoz zapne až po souhlasu.

- [ ] Platební brána (rozhodnutí R3): Comgate / GoPay / Stripe
- [ ] Zásilkovna: výběrové okno výdejních míst (widget) a API pro zásilky
- [x] Balíkovna (Česká pošta): výběr pobočky (podání zatím ručně)
- [ ] Automatická fakturace (rozhodnutí R4): Fakturoid / iDoklad
- [x] Testy celé cesty objednávky v testovacím (sandbox) režimu

## Fáze 7: Provoz a růst

- [ ] Měření návštěvnosti šetrné k soukromí (např. Plausible 💰 nebo
      bezplatná alternativa)
- [ ] Pravidelný měsíční audit (rychlost, SEO, odkazy, zabezpečení)
- [ ] Newsletter, upozornění na nové kusy 💰
- [ ] Google Business profil, Merchant Center

---

## Etapa „Dokončení prodejní platformy“ (zadání majitele 25. 11. 2026)
Začíná po zveřejnění všech šesti produktových inzerátů. Změny vyžadující podklady
nebo schválení majitele se nejprve konzultují.

- [x] 0. Skutečné inzeráty hodinek – majitel 27. 11.: finálně 4 inzeráty (původně šest (4/5 hotovo, Chopard zrušen: PRIM – bílý ciferník, nerez a safír; PRIM kalibr 111 – datum a malá vteřina; PRIM 17 Jewels – nerez s plastickým vzorem; PRIM 17 Jewels – leštěná nerez)
- [x] 1. Nová úvodní fotografie (podklad od majitele), úprava pro počítač, tablet i mobil
- [x] 2a. Ukázkové hodinky odstraněny ze zkušební verze (25. 11.)
- [ ] 2. Vyčištění e-shopu: ponechat šest skutečných, kontrola fotek, cen, popisů a dostupnosti
- [x] 3. Sociální sítě: elegantní ikony Instagram, TikTok, Facebook v horní liště a patičce, návrh další decentní propagace (podklad: odkaz na Facebook)
- [ ] 4. Společná kontrola dokumentů: obchodní podmínky, GDPR, reklamační řád, odstoupení, doprava a platba
- [x] 5. Faktura ve vizuálním stylu podle vzoru majitele, se zákonnými náležitostmi, maximálně automatické vystavování z objednávek
- [ ] 6. Závěrečná kontrola webu, e-shopu, objednávek, odkazů a mobilního zobrazení
- [x] 7. Fotografie u zakázek a přiložení fotek k poptávce (26. 11.)
- [x] 8. Zakázky: náklady (zaplacené / vlastní práce / odhad), zálohy, faktury se schválením odeslání, po splatnosti, fakturováno vs. přijato; fotky (fáze, hlavní, celá obrazovka), miniatury (27. 11.)
- [x] 9. Díly ze skladu použité v zakázce (27. 11.)
- [x] 8. E4 – DT Sales: návrh odpovědi na poptávku v administraci (26. 11.); DT Logistics – sledování zásilek Zásilkovny hotovo 27. 11.

## Rozhodnutí, která čekají na majitele

| ID | Otázka | Možnosti | Doporučení agenta |
|---|---|---|---|
| **R1** | Na čem e-shop postavit? | **A)** vlastní řešení (Astro + serverové funkce + databáze)<br>**B)** hotová česká platforma (Shoptet, Upgates) 💰<br>**C)** Shopify 💰 | **A**, protože dává plnou kontrolu nad luxusním vzhledem, nízké měsíční náklady a hodí se k malému počtu unikátních kusů. **B** je rychlejší start, ale s omezeným vzhledem a měsíčním poplatkem. |
| **R2** | Administrace | **A)** Git CMS (Decap/Sveltia, přihlášení přes GitHub s 2FA, zdarma)<br>**B)** databáze + vlastní admin (Supabase apod.) | Katalog nejdřív přes **A**, objednávky přes **B**, až to bude potřeba. |
| **R3** | Platební brána | Comgate, GoPay, Stripe | Comgate nebo GoPay (české banky, Apple/Google Pay, nízké poplatky v ČR). |
| **R4** | Fakturace | Fakturoid, iDoklad | Fakturoid (jednoduché API, oblíbený u živnostníků). |
| **R5** | Jazyky a měny | CZ+EN, později DE; Kč / EUR | Začít CZ+EN v Kč. |
| **R6** | Hosting pro fázi 5+ | Cloudflare Pages, Netlify, Vercel | Cloudflare Pages (štědrý bezplatný tarif, bezpečnostní hlavičky, serverové funkce). |
| **R7** | Tón komunikace | tykání / vykání | Vykání odpovídá luxusní značce. |

Rozhodnutí se zapisují do [`docs/DECISIONS.md`](DECISIONS.md).
