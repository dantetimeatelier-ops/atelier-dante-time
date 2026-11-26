# Předání projektu Dante Time – stav k 25. 11. 2026

## 1. Co je hotové

### Na ostrém webu (zveřejněno, PR #1)
- Rychlejší web: hlavní stránka 5,9 MB → 91 kB, rychlost 75 → 100 bodů
- SEO: sitemap, robots.txt, kanonické odkazy, náhledy pro sdílení, strukturovaná data
- Stránka 404, sjednocený vzhled stránek Soukromí a Reklamace
- Automatické testy u každé změny, hlídání dostupnosti každou hodinu,
  týdenní přehled každé pondělí, záznam verzí, akce „Návrat k verzi“
- Zálohy: značka `v0-puvodni-web` a větev `zaloha/puvodni-web-2026-11-25`

### Nová platforma (hotová a otestovaná, PR #3, čeká na Cloudflare)
| Oblast | Co umí |
|---|---|
| **Web** | modernizovaný luxusní vzhled, mobilní menu, CZ i EN, stránky Kolekce a Kontakt, formuláře poptávek na Službách, Kontaktu i u každých hodinek |
| **E-shop** | katalog s filtry, detail hodinek s galerií a parametry, košík, objednávka, výběr dopravy a platby, rezervace kusu (nelze prodat dvakrát), QR platba, stránka objednávky, faktura, e-maily |
| **Administrace (iPhone)** | přihlášení heslem a kódem z aplikace Hesla, přidání hodinek s fotkami z telefonu, automatický popis a SEO, stavy hodinek, objednávky (platba, odeslání, zrušení, odstoupení), zakázky, poptávky, zákazníci, nastavení dopravy, e-maily, historie změn |
| **Právní dokumenty** | obchodní podmínky, reklamační řád, odstoupení a formulář, online funkce „Odstoupit od smlouvy“ (§ 1830a), záruka a doživotní garance pravosti, zakázková výroba a servis, doprava a platba, GDPR, cookies, informace o provozovateli |
| **Bezpečnost** | bezpečnostní hlavičky (CSP, HSTS…), ochrana proti CSRF a spamu, omezení pokusů o přihlášení, šifrovaná hesla, fotky bez GPS, zákaznická data jen v databázi (nikdy v repozitáři), pojistka proti ostrému režimu s nevyplněnými údaji |

## 2. Výsledky testů

| Test | Výsledek |
|---|---|
| Jednotkové testy (QR platba, popisy, TOTP dle RFC 6238, hesla, rezervace, právní náležitosti) | 8 / 8 ✅ |
| Kód HTML (html-validate) | bez chyb ✅ |
| Odkazy uvnitř webu | 775 odkazů, vše v pořádku ✅ |
| Všechny stránky ve 3 šířkách (375 / 768 / 1280 px) | 84 / 84 ✅ |
| Celý proces v prohlížeči iPhone: nastavení administrace → hodinky s fotkou → nákup → platba → faktura → odeslání → odstoupení → poptávka → zakázka | ✅ |
| Souběžné objednávky stejného kusu | prošla právě 1 ze 3 ✅ |
| Lighthouse (výkon / přístupnost / SEO) | 100 / 100 / 100 ✅ |
| Hesla a klíče v historii (gitleaks) | žádné ✅ |

Testy běží automaticky na GitHubu u každé změny. Nasazení proběhne jen
tehdy, když projdou všechny.

## 3. Provozní náklady

| Položka | Měsíčně |
|---|---|
| Hosting, databáze, fotografie (Cloudflare Free) | **0 Kč** |
| GitHub (repozitář, testy, automatika) | **0 Kč** |
| E-maily (Resend Free, 3 000/měsíc) | **0 Kč** |
| Doména atelier-dante-time.cz | beze změny (platíte už dnes) |
| **Celkem fixně** | **0 Kč** |

Variabilní náklady jen při skutečném prodeji: poplatek platební brány
za platbu kartou (~1–2 %, jen po aktivaci 💰) a poštovné dopravců.
Bankovní převod s QR platbou je bez poplatků.

## 4. Co zbývá a kdo to udělá

### Vy (nutné ke spuštění)
1. **Cloudflare** – návod `docs/CLOUDFLARE-SETUP.md` (30–45 min, zdarma).
2. **Údaje a rozhodnutí k právním dokumentům** – `docs/LEGAL-REVIEW.md`
   (identifikace firmy, DPH, účet, ceny dopravy, garance pravosti).
3. 🔴 Ověřit **puncovnictví** (zlaté a stříbrné hodinky) a **živnostenská
   oprávnění**. Doporučuji i krátkou kontrolu dokumentů advokátem.
4. Rozhodnout o **ostrém spuštění** e-shopu (`SHOP_MODE=live`).

### Agent (po vašich krocích)
1. Doplnit údaje, nasadit na náhledovou adresu Cloudflare, otestovat naostro.
2. Po přesměrování domény sloučit PR #3. Současný web do té doby běží beze změny.
3. Aktivovat integrace podle toho, co si založíte (e-maily, Zásilkovna, platební brána).

### Nedokončené integrace
| Integrace | Stav |
|---|---|
| Zásilkovna – automatické podání zásilky | ruční podání, číslo zásilky se zadá v administraci |
| Balíkovna – výběr místa na mapě | zákazník píše výdejní místo ručně |
| Platební brána Comgate | kód připraven, neověřeno naostro (chybí smlouva) |
| Účetní systém (Fakturoid / iDoklad) | nezačato, záleží na vaší volbě |
| Anglické verze právních dokumentů | po schválení českých verzí |
| Popisy pomocí AI | jen šablona z parametrů (AI by byla placená) |

## 5. Dokumenty
- `docs/NAVOD-IPHONE.md` – **jednoduchý návod k obsluze z telefonu**
- `docs/CLOUDFLARE-SETUP.md` – spuštění platformy
- `docs/LEGAL-REVIEW.md` – nejasnosti a rizika právních dokumentů
- `docs/INTEGRATIONS.md` – stav a aktivace integrací
- `docs/ARCHITECTURE.md` – technické řešení
- `AGENTS.md` – pravidla pro AI agenty (Claude, ChatGPT)
