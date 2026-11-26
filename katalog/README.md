# Katalog hodinek

Každé hodinky mají vlastní složku `katalog/<adresa-na-webu>/`:

- `hodinky.json` – údaje, texty, cena a stav (`draft` = koncept, `available` = skladem),
- `01-l.webp`, `01-s.webp`, … – fotografie (velká a malá), první je hlavní.

Hodinky připravuje agent z fotografií a údajů od majitele. Po úspěšných testech je
nasazení automaticky zapíše do e-shopu (`scripts/catalog.mjs`, `scripts/cf-deploy.mjs`).
Rezervované a prodané kusy si stav ponechají, katalog je nepřepíše.

Fotografie se připravují příkazem `python3 scripts/foto-katalog.py <slug> <fotky…>`,
který je zmenší a odstraní z nich metadata (včetně polohy).

## Jména modelů (rozhodnutí R22)

Když majitel pošle fotografie nových hodinek, agent **vždy navrhne jméno modelu** a předloží ho ke schválení:

- tvar `Prim <řada> <název> LTD.<číslo>` (u jiné značky obdobně), řady **Classic** (elegantní, kůže),
  **Sport** (tah, robustní), **Heritage** (patina, zlato, historický kalibr),
- název vychází z charakteru kusu (ciferník, pouzdro, barva, detail), krátký a výstižný (Soleil, Diamant, Blanc, Date…),
- číslo LTD roste v rámci stejného názvu (LTD.01, LTD.02…),
- jméno se zapíše do `title` i `model`, SEO titulek = jméno + klíčová slova,
- jméno se nesmí opakovat (katalog to při nasazení kontroluje).

