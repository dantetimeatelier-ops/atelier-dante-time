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
- [ ] Vytvořit tag `v0-puvodni-web`, zálohu současného stavu, ke které
      se lze kdykoli vrátit

## Fáze 1: Rychlá vylepšení stávajícího webu

Cíl: rychlejší a lépe dohledatelný web, beze změny vzhledu a textů podmínek.

- [x] Optimalizace obrázků (WebP, správné rozměry, `loading="lazy"`)
- [x] Skutečný favicon a ikony pro mobil
- [ ] `robots.txt`, `sitemap.xml`, `canonical`, OG značky všude
- [ ] Stránka 404 ve stylu značky
- [ ] Propojení `privacy.html` a `reklamace.html` z patičky a sjednocení vzhledu
- [ ] Strukturovaná data `Organization`
- [ ] Měření rychlosti (Lighthouse) před a po změnách

**Výsledek:** hlavní stránka se zmenší z asi 4,3 MB na méně než 0,5 MB.

## Fáze 2: Nový technický základ

Cíl: jeden společný vzhled pro všechny stránky a příprava na katalog
a jazyky.

- [ ] Přechod na generátor statického webu **Astro** (doporučení, viz
      rozhodnutí R1): sdílená hlavička, patička a styly, výstupem zůstane
      rychlé statické HTML
- [ ] Design systém: barvy, písma, tlačítka a karty jako jedno místo pravdy
- [ ] Zachování všech současných URL (např. `/services.html`), aby se
      neztratilo SEO
- [ ] Automatická kontrola při každé změně (build, odkazy, velikost obrázků)
      přes GitHub Actions
- [ ] Náhledová verze webu z vývojové větve, aby majitel viděl změny
      ještě před schválením

## Fáze 3: Vícejazyčnost

- [ ] Struktura URL: `/` čeština, `/en/` angličtina, později např. `/de/`
- [ ] `hreflang` a jazykové sitemapy
- [ ] Překlady v samostatných souborech (`src/i18n/cs.json`, `en.json`)
- [ ] Přepínač jazyka, který vede na odpovídající stránku
- [ ] Ceny v Kč, později volitelně v EUR (rozhodnutí R5)

## Fáze 4: Katalog hodinek a administrace

Cíl: majitel sám přidává hodinky, fotky, ceny a dostupnost.

- [ ] Datový model hodinky: název, slug, popis (CZ/EN), strojek, průměr
      pouzdra, materiál, sklíčko, vodotěsnost, řemínek, cena, stav
      (`k dispozici` / `rezervováno` / `prodáno`), fotogalerie, pořadí
- [ ] Stránka kolekce a detail hodinek s galerií a zoomem
- [ ] Prodané kusy zůstanou jako „Archiv“, což pomáhá důvěře i SEO
- [ ] **Administrace** (rozhodnutí R2), přihlášení přes účet s
      dvoufázovým ověřením (2FA)
- [ ] Automatická optimalizace nahraných fotografií
- [ ] Strukturovaná data `Product` (cena, dostupnost)

## Fáze 5: Objednávkový systém

- [ ] Košík (u unikátních kusů spíš tlačítko „Koupit“ / „Rezervovat“)
- [ ] Objednávkový formulář s výběrem dopravy a souhlasem s podmínkami
- [ ] Rezervace kusu během objednávky, aby nedošlo k prodeji dvakrát
- [ ] Potvrzovací e-mail zákazníkovi a upozornění majiteli
- [ ] Přehled objednávek v administraci
- [ ] Ochrana proti spamu ve formulářích
- [ ] Aktualizace `privacy.html` (GDPR) a cookie lišty (**připraví majitel
      nebo právník**, agent jen navrhne strukturu)

## Fáze 6: Platby, doprava, fakturace 💰

Každá služba vyžaduje smlouvu nebo registraci majitele. Agent připraví
integraci v testovacím režimu a ostrý provoz zapne až po souhlasu.

- [ ] Platební brána (rozhodnutí R3): Comgate / GoPay / Stripe
- [ ] Zásilkovna: výběrové okno výdejních míst (widget) a API pro zásilky
- [ ] Balíkovna (Česká pošta): výběr pobočky a podání
- [ ] Automatická fakturace (rozhodnutí R4): Fakturoid / iDoklad
- [ ] Testy celé cesty objednávky v testovacím (sandbox) režimu

## Fáze 7: Provoz a růst

- [ ] Měření návštěvnosti šetrné k soukromí (např. Plausible 💰 nebo
      bezplatná alternativa)
- [ ] Pravidelný měsíční audit (rychlost, SEO, odkazy, zabezpečení)
- [ ] Newsletter, upozornění na nové kusy 💰
- [ ] Google Business profil, Merchant Center

---

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
