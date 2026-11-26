# Spuštění zkušební verze na Cloudflare – co musíte udělat vy

Všechno ostatní je automatické: databáze (uložená v EU), úložiště fotografií,
projekt, ukázková data i samotné nasazení vytvoří GitHub sám po úspěšných
testech. Vy uděláte jen tyto **3 kroky (asi 15 minut)**. Je to **zdarma**,
platební kartu nezadáváte a **ostrá doména se nemění**. Web
atelier-dante-time.cz běží dál beze změny.

---

## Krok 1: Účet Cloudflare (5 minut)
1. Na počítači otevřete **https://dash.cloudflare.com/sign-up**.
2. Zadejte e-mail a heslo a potvrďte e-mail.
3. Doporučeno: **My Profile → Authentication → Two-Factor Authentication**
   zapnout (aplikace Hesla v iPhonu umí ověřovací kódy).

## Krok 2: Klíč pro GitHub (5 minut)
1. Vpravo nahoře ikona profilu → **My Profile → API Tokens → Create Token**.
2. Úplně dole **Custom token → Get started**.
3. Název: `GitHub Dante Time`.
4. **Permissions** (tři řádky, vždy **Account**):
   | Account | Cloudflare Pages | Edit |
   |---|---|---|
   | Account | D1 | Edit |
   | Account | Workers KV Storage | Edit |
5. **Account Resources:** Include → váš účet.
6. **Continue to summary → Create Token** → token **zkopírujte**
   (zobrazí se jen jednou).
7. Zkopírujte také **Account ID**: v levém menu **Workers & Pages**,
   vpravo ve sloupci „Account details“ → **Account ID** (ikona kopírování).

## Krok 3: Uložení do GitHubu (5 minut)
1. Otevřete https://github.com/dantetimeatelier-ops/atelier-dante-time
2. **Settings → Secrets and variables → Actions → New repository secret**.
3. Vytvořte postupně tyto **tři** tajné hodnoty:

| Name | Secret |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token z kroku 2 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID z kroku 2 |
| `ADMIN_SETUP_TOKEN` | **váš instalační kód**: vymyslete dlouhou větu bez mezer, alespoň 24 znaků (např. `MojeHodinkyTikajiUzOd1968Rano`). Uložte si ji do Hesel v iPhonu. Použijete ji jen jednou při prvním přihlášení. |

Hotovo. Napište mi „Cloudflare je nastavený“. Spustím nasazení a pošlu vám
adresu zkušební verze.

---

## Co se pak stane automaticky
1. GitHub spustí testy. Když projdou, vytvoří na Cloudflare:
   - projekt `atelier-dante-time`,
   - databázi `dante-time-preview` (zkušební, s ukázkovými hodinkami) uloženou v EU.
     Ostrá databáze `dante-time` vznikne až při spuštění ostré verze,
   - úložiště fotografií,
2. nahraje zkušební verzi na adresu typu
   `https://claude-eshop-platforma.atelier-dante-time.pages.dev`
   (vyhledávače ji neindexují, objednávky jsou jen testovací),
3. při každé další změně se zkušební verze sama aktualizuje.

## Co se NEstane bez vašeho souhlasu
- **Doména atelier-dante-time.cz se nepřesměruje.** Přesměrování uděláte
  až po schválení (návod připravím), jde o změnu u registrátora domény.
- Nezapne se žádná placená služba ani ostré platby.

## Limity zdarma (Cloudflare Free)
| Služba | Limit zdarma | Potřeba Dante Time |
|---|---|---|
| Pages (web) | neomezený provoz statických stránek | ✓ |
| Functions (katalog, objednávky) | 100 000 požadavků denně | stovky až tisíce |
| D1 (databáze) | 5 GB | jednotky MB |
| KV (fotografie) | 1 GB, 1 000 zápisů denně | ~3 000 fotek |

Při překročení limitu se nic nezačne účtovat. Požadavky nad limit jen
selžou. Placený tarif by se musel výslovně zapnout.
