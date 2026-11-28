# PROJECT_STATE – ověřený stav Dante Time OS

**Aktualizováno:** 28. 11. 2026 13:30 (Claude)
**Jak ověřeno:** kód a historie v repozitáři (`main` @ 3f16a26 + tato větev), poslední běh CI „Testy“ na `main`
(28. 11. 11:3x: sestavení, jednotkové testy, e2e nákup a administrace, Lighthouse, kontrola klíčů, nasazení – vše ✅),
snímky obrazovky od majitele (Stripe, Cloudflare). **Neověřeno přímo:** obsah ostré databáze D1 a hodnoty tajných
klíčů v Cloudflare – agent k nim nemá přístup (hodnoty jsou šifrované i pro majitele).

Úkoly a „Čeká na majitele“ jsou v [`TASKS.md`](TASKS.md), plán v [`ROADMAP.md`](ROADMAP.md),
rozhodnutí v [`DECISIONS.md`](DECISIONS.md), historie v [`CHANGELOG.md`](CHANGELOG.md).

## 1. Co běží naostro (atelier-dante-time.cz)

| Oblast | Stav | Poznámka |
|---|---|---|
| Web (CZ/EN), SEO, sitemap, 404 | ✅ | statické stránky z `scripts/build.mjs`, Lighthouse v CI |
| E-shop s objednávkami | ✅ ostrý (`SHOP_MODE=live`, R19) | 4 skutečné inzeráty PRIM (`katalog/`) |
| Platba převodem s QR | ✅ výchozí | |
| Dobírka | ✅ jen ČR, jen u dopravců, kteří ji nabízejí | |
| Platba kartou, Apple Pay, Google Pay (Stripe) | ✅ ostrý provoz od 28. 11. 13:26 | ověřeno v Administraci → Integrace: klíč ostrý (omezený `rk_live_`, bez výplat a převodů), webhook ok, PAYMENTS_LIVE true, zákazníci vidí: ano |
| Doprava | ✅ | Zásilkovna do 20 000 Kč (SK/EU Packeta do 700 €), Balíkovna do 50 000 Kč (riziko viz DECISIONS doplnění R25), Cenná zásilka ČP (bez dobírky, 190 Kč + 14 Kč / 10 000 Kč nad 30 000), osobní předání zdarma; PPL a Balíkovna na adresu vypnuté (R25) |
| Ochrana proti dvojímu prodeji | ✅ | rezervace kusu, atomické označení prodeje i u ruční faktury/zálohy |
| Právní dokumenty | ✅ verze 1.2 (účinnost 27. 11. 2026) | ⚖️ kontrola majitelem/právníkem dál otevřená (TASKS) |
| Faktury | ✅ vlastní systém (neplátce DPH) | koncepty, náhled, částečné platby, storno s důvodem, kopie |
| Administrace `/admin` (iPhone) | ✅ | heslo + 2FA, hodinky, objednávky, zakázky, sklad, náklady, dopravci, faktury |
| Ekonomika | ✅ | náklady s doklady, marže po hodinkách vč. dopravy a poplatků brány, limit DPH, export pro účetní |
| Digitální pas hodinek + certifikát | ✅ | QR, bez AI; automaticky i u zakázek po přijetí (servis/renovace = jméno hodinek zákazníka, přestavba/výroba = DT – …), práce a předání se zapíšou samy |
| Karta pasu k gravírování | ✅ | 85,6 × 54 mm z existujícího pasu: SVG (texty v křivkách), PNG 600 DPI, PDF, inverze, hromadný ZIP, kontrola QR; `server/passport-card.js` |
| Garanční prohlídky | ✅ | připomínky (DT Logistics) |
| Google Nákupy feed | ✅ `/feed/google.xml` | účet Merchant Center zakládá majitel (TASKS) |
| E-maily | ✅ Resend | odesílatel objednavky@atelier-dante-time.cz |

## 2. Agenti Dante Time OS (běží v systému, 0 Kč mimo AI na pokyn)

| Agent | Stav |
|---|---|
| DT Guardian | ✅ každou hodinu kontroly, denně záloha DB |
| DT Director | ✅ pondělí 7:00 týdenní e-mail |
| DT Logistics | ✅ denně 8:00; sledování zásilek, „odesláno“ až při předání dopravci |
| DT Sales | ✅ denně 8:00; návrh odpovědi (AI) na tlačítko |
| DT Finance | ✅ denně 8:00; vytěžení dokladů (AI) na pokyn; zápis poplatků Stripe |
| DT Marketing | ⏸ čeká na přístupy (TASKS) |
| DT Scout | ⏸ čeká na kritéria nákupu (TASKS) |
| DT Innovation | ⏸ připraveno, spustit po prvních týdnech provozu |
| DT Developer | ✅ mimo systém – Claude/ChatGPT přes pull requesty (AGENTS.md) |

## 3. Technický základ

- Cloudflare Pages + Pages Functions (`functions/`, `server/`), D1 `dante-time` (migrace `migrations/0001`–`0032`),
  KV na média, R2 zálohy, Worker `workers/os-cron` (časovač agentů).
- Konfigurace: textové proměnné v `wrangler.toml` (`SHOP_MODE=live`, e-mail), tajné hodnoty jen v Cloudflare → Secrets:
  `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `PACKETA_API_KEY`, `PACKETA_API_PASSWORD`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_LIVE` (secret „true“, protože textové proměnné spravuje `wrangler.toml`).
- Stripe: ostrý webhook `https://atelier-dante-time.cz/api/payments/stripe` (4 události checkout.session.*),
  metody Cards + Apple Pay + Google Pay, Radar Standard (1,40 Kč/transakce), Tax a Climate vypnuté, výplaty týdně v pondělí na účet ČS v CZK.
- Pojistky v kódu: ostrý klíč bez `PAYMENTS_LIVE=true` se nepoužije; testovací klíč na ostrém webu vidí jen
  přihlášený majitel a testovací platba nic neprodá ani nevyfakturuje.
- Nasazení: jen po zelených testech (CI „Testy“), PR do `main` slučuje majitel nebo agent podle R10.

## 4. Známé rozpory, rizika a nesrovnalosti

| # | Co | Stav |
|---|---|---|
| 1 | Balíkovna do 50 000 Kč vs. Poštovní podmínky (cennosti nad 5 000 Kč) | rozhodl majitel, riziko zná (DECISIONS) |
| 2 | Poplatek Stripe Radar (1,40 Kč) se účtuje zvlášť a nemusí být v `balance_transaction.fee` | ověřit po prvních ostrých platbách (TASKS) |
| 3 | E-mail o nové objednávce u testovací platby píše „(ostrá)“ | kosmetické, opravit (TASKS) |
| 4 | Duplicitní čísla migrací 0024 a 0025 (různé názvy souborů) | funkční, jen poznámka pro agenty |
| 5 | GitHub Pages workflow („pages build and deployment“) stále běží vedle Cloudflare | ověřit, zda je potřeba (TASKS) |
| 6 | Tykání/vykání (R7) nerozhodnuto | čeká na majitele |
| 7 | Ochrana větve `main` na GitHubu není nastavená | čeká na majitele |

## 5. Zdroje kontextu a co agent neviděl

- Dostupné: tento repozitář (kód, `docs/HANDOFF.md` – záznamy všech agentů od 25. 11., `DECISIONS.md`),
  paměť Claude o projektu a konverzace, ve které vznikla centralizace (platby, doprava, Stripe).
- **Nedostupné:** ostatní konverzace v projektu „Dante Time“ (Claude je nemůže otevřít). Jejich výsledky jsou známé
  jen tak, jak je agenti zapsali do repozitáře (HANDOFF, DECISIONS, commity). Co v repozitáři zapsané není, tady chybí.
