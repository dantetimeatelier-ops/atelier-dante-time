# CLAUDE.md – hlavní instrukce pro agenty Dante Time OS

Platí pro Claude i ostatní agenty (ChatGPT/Codex čte `AGENTS.md`). Závazná pravidla jsou v `AGENTS.md` – načti je:

@AGENTS.md

## Než začneš (vždy, R28)

1. `git fetch` a přečti: [`PROJECT_STATE.md`](PROJECT_STATE.md) → [`TASKS.md`](TASKS.md) → horní záznamy
   [`docs/HANDOFF.md`](docs/HANDOFF.md) → otevřené pull requesty a větve.
2. Zkontroluj, jestli úkol už není hotový nebo rozpracovaný (`CHANGELOG.md`, `git log`, otevřené PR).
3. Ověř skutečný stav (kód, testy, CI, web). Dokumentace může zaostávat – při rozporu platí realita a dokumentaci oprav.
4. Úkol potřebující majitele zapiš do `TASKS.md` → Čeká na majitele a pokračuj jiným nezávislým úkolem.

## Když skončíš

Aktualizuj `TASKS.md`, `PROJECT_STATE.md`, `CHANGELOG.md`, případně `DECISIONS.md` (jen rozhodnutí majitele)
a přidej záznam do `docs/HANDOFF.md`. Majiteli piš stručně česky: hotovo, přínos, na čem se pracuje, co čeká na něj.

## Nejdůležitější pravidla (výtah, plné znění v AGENTS.md a DECISIONS.md)

- Komunikace s majitelem česky, jednoduše, krok za krokem. Nic nepředstírej; co nevíš nebo nevidíš, řekni.
- **Bez výslovného souhlasu nikdy:** placené služby a předplatné, ceny a slevy, reklamní rozpočty, zásadní změny
  podmínek, nevratné mazání dat, bankovní a platební nastavení, nové externí přístupy k citlivým údajům, závazná
  komunikace se zákazníky mimo schválené automatizace (R27, AGENTS 3a úroveň 3).
- Žádné měsíční poplatky ani minimální odběry; AI do 300 Kč/měsíc (R20, R23, R25).
- Tajné klíče zadává jen majitel v Cloudflare → Secrets. Nikdy je nežádej do chatu ani nezapisuj do repozitáře.
- Názvy hodinek vždy přes `src/shop/naming.mjs` – „DT – ZNAČKA …“ (R26).
- Existující migrace nikdy neupravuj, přidej novou. Funkční řešení nepřepisuj bez důvodu, nevytvářej duplicitní systémy.
- Každá změna: větev → testy (`npm test`, CI e2e) → pull request → zápis do dokumentace.

## Rychlá orientace

| Co | Kde |
|---|---|
| Stránky a texty | `src/pages/`, `src/legal/`, `src/site.mjs` |
| Server, API | `functions/`, `server/` |
| Databáze | `migrations/` (D1) |
| Administrace | `public/admin/` |
| Agenti OS | `server/os.js`, `workers/os-cron`, `docs/DANTE-TIME-OS.md` |
| Platby a doprava | `server/payments.js`, `server/shipping.js`, `docs/PLATBY-A-DOPRAVA.md`, `docs/DOPRAVCI.md` |
| Testy | `tests/unit/`, `tests/e2e/` |
