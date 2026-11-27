# Stav projektu Dante Time OS – živý přehled

Jediné místo, kde každý agent (Claude, ChatGPT) i majitel najde **co je hotové, co se dělá, co čeká na majitele,
nalezené chyby a návrhy inovací**. Při každé práci ho aktualizuj (nové nahoru). Trvalé pravidlo: rozhodnutí R27.

Související: plán `ROADMAP.md`, rozhodnutí `DECISIONS.md`, agenti `DANTE-TIME-OS.md`, předávky `HANDOFF.md`.

## Trvalá pravidla a preference majitele (výtah)

- Pracuj samostatně (R27, R10). Co potřebuje majitele, zapiš níže do „Čeká na majitele“ a pokračuj jiným úkolem.
- Bez výslovného souhlasu nikdy: placené služby a předplatné, ceny a slevy, reklamní rozpočty, zásadní změny
  podmínek, nevratné mazání dat, bankovní a platební nastavení, nové externí přístupy k citlivým údajům,
  závazná komunikace se zákazníky mimo schválené automatizace.
- Žádné měsíční poplatky ani minimální odběry (R23, R25). AI do 300 Kč/měsíc.
- Názvy hodinek „DT – ZNAČKA …“ (R26). Doprava jednoduchá: Zásilkovna, Balíkovna, Cenná zásilka, osobní předání (R25).
- Reporty majiteli stručně česky: hotovo, přínos, na čem se pracuje, co čeká na rozhodnutí.
- Funkčnost vždy skutečně otestovat (unit + e2e v CI), před velkou změnou záloha / tag.

## Čeká na majitele

| # | Co | Proč čeká | Od |
|---|---|---|---|
| 1 | Stripe – testovací klíč a webhook v Cloudflare, pak zkušební nákup kartou 4242… | klíče zadává jen majitel | 27. 11. |
| 2 | Ověřit na iPhonu výběr Zásilkovny na mapě („Vybráno: …“) | oprava nasazena, nelze otestovat bez iPhonu | 27. 11. |
| 3 | 🔴 Ostrý Stripe (ověření účtu, `sk_live`, `PAYMENTS_LIVE=true`) | platební nastavení | – |
| 4 | ⚖️ Kontrola právních dokumentů, PR #32 (AI u poptávek v GDPR) | právní texty | 26. 11. |
| 5 | Fotky a údaje dalších hodinek (Rolex aj.) | podklady | – |
| 6 | PDF nákupů AliExpress/Temu (náklady 2026) | podklady | – |
| 7 | Přístupy Instagram/Facebook/Metricool (DT Marketing) | nový externí přístup | – |
| 8 | Kritéria nákupu pro DT Scout (značky, ceny, stav, tržiště) | zadání | – |
| 9 | 💰 Párování plateb z banky | může stát peníze / přístup k účtu | – |
| 10 | Fotka strojku Heritage Date do galerie? (poslal ji 27. 11.) | souhlas s použitím | 27. 11. |
| 11 | Ochrana větve `main` na GitHubu (ROADMAP fáze 0) | nastavení účtu | 25. 11. |

## Rozpracováno

- DT Innovation: týdenní analýza – spustit po prvních týdnech provozu.

## Dokončeno (nejnovější nahoře)

- 27. 11. Inzeráty: průměr pouzdra, kalibr 66 / PRIM typ 0111 a období výroby; Blanc balení sjednoceno (PR #59, #61, #63).
- 27. 11. Limit DPH v Přehledu počítá i nahrané prodeje – stejné číslo jako Ekonomika (PR #57).
- 27. 11. Balíkovna zpět, limit 50 000 Kč; oprava výběru Zásilkovny v mapě (PR #55, #56).
- 27. 11. Faktury: částečné platby, storno s důvodem, duplicity, koncepty, kopie, oprava odběratele.
- 27. 11. Náklady s fotkami dokladů, jednotná správa výdajů; fotky zakázek; potvrzovací e-mail s PDF.

## Nalezené chyby a řešení

| Datum | Chyba | Řešení |
|---|---|---|
| 27. 11. | Výběr místa v mapě Zásilkovny se nevrátil do košíku | parametry okna jako oficiální knihovna (`referrer` …), PR #55 – čeká na ověření na iPhonu |
| 27. 11. | Balíkovna zmizela u hodinek nad 5 000 Kč | limit podle pokynu majitele 50 000 Kč (migrace 0029, 0030) |
| 27. 11. | Limit DPH ukazoval jen faktury z aplikace | `FIN.vatTurnover` = faktury + nahrané prodeje (PR #57) |
| 27. 11. | Občasné selhání e2e kroku „Náklady a marže“ (timeout) | příčina: po výměně klíče 2FA se ukáže „Více“ a test klikl na jeho první položku dřív, než se načetly hodinky; test teď kliká jen na položky správného seznamu (i u prohlídek a pasů) |

## Návrhy inovací (k posouzení)

- Google Business profil a Merchant Center (zdarma) – víc důvěry a zobrazení ve vyhledávání.
- Recenze zákazníků po převzetí (vlastní, bez placené služby) – po schválení textu e-mailu majitelem.
- Upozornění na nové kusy pro zájemce (vlastní seznam, bez placeného newsletteru).
