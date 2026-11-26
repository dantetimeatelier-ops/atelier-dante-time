# Katalog hodinek

Každé hodinky mají vlastní složku `katalog/<adresa-na-webu>/`:

- `hodinky.json` – údaje, texty, cena a stav (`draft` = koncept, `available` = skladem),
- `01-l.webp`, `01-s.webp`, … – fotografie (velká a malá), první je hlavní.

Hodinky připravuje agent z fotografií a údajů od majitele. Po úspěšných testech je
nasazení automaticky zapíše do e-shopu (`scripts/catalog.mjs`, `scripts/cf-deploy.mjs`).
Rezervované a prodané kusy si stav ponechají, katalog je nepřepíše.

Fotografie se připravují příkazem `python3 scripts/foto-katalog.py <slug> <fotky…>`,
který je zmenší a odstraní z nich metadata (včetně polohy).
