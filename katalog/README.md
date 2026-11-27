# Katalog hodinek

Každé hodinky mají vlastní složku `katalog/<adresa-na-webu>/`:

- `hodinky.json` – údaje, texty, cena a stav (`draft` = koncept, `available` = skladem),
- `01-l.webp`, `01-s.webp`, … – fotografie (velká a malá), první je hlavní.

Hodinky připravuje agent z fotografií a údajů od majitele. Po úspěšných testech je
nasazení automaticky zapíše do e-shopu (`scripts/catalog.mjs`, `scripts/cf-deploy.mjs`).
Rezervované a prodané kusy si stav ponechají, katalog je nepřepíše.

Fotografie se připravují příkazem `python3 scripts/foto-katalog.py <slug> <fotky…>`,
který je zmenší a odstraní z nich metadata (včetně polohy).

## Jména hodinek (rozhodnutí R22 a R26)

Závazný tvar názvu (R26): **`DT – ZNAČKA <řada> <název> <označení>`**, značka VELKÝMI písmeny,
např. `DT – PRIM Classic Soleil LTD.01`. Předponu `DT – ` a velkou značku doplní katalog i administrace
automaticky (`src/shop/naming.mjs`), do `hodinky.json` se přesto píše celý název v tomto tvaru.

Když majitel pošle fotografie nových hodinek, agent **vždy navrhne jméno modelu** a předloží ho ke schválení:

- jméno modelu ve tvaru `<řada> <název> LTD.<číslo>` (pole `model`), řady **Classic** (elegantní kusy na kůži
  i na tahu) a **Heritage** (patina, zlato, historický kalibr); řada Sport se nepoužívá – ateliér dělá elegantní hodinky,
- název vychází z charakteru kusu (ciferník, pouzdro, barva, detail), krátký a výstižný (Soleil, Diamant, Blanc, Date…),
- číslo LTD roste v rámci stejného názvu (LTD.01, LTD.02…); evidenční čísla existujících kusů se nikdy nemění,
- `title` = `DT – ZNAČKA` + jméno modelu, SEO titulek = název + klíčová slova,
- u přestaveb (`"kind": "prestavba"`) katalog sám doplní na konec popisu upozornění, že jde o nezávislou přestavbu
  ateliéru Dante Time s originálními historickými komponenty, nikoli o oficiální nový model původního výrobce,
- jméno se nesmí opakovat (katalog to při nasazení kontroluje).
