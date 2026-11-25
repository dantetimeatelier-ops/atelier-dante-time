# Spuštění nové platformy na Cloudflare – návod pro majitele

Toto je jediná část, kterou za vás agent udělat nemůže, protože jde o založení
účtu na vaše jméno. Trvá asi **30–45 minut** a **nic to nestojí**.
Platební kartu zadávat nemusíte.

## Co budete potřebovat
- e-mail a heslo pro nový účet Cloudflare,
- přístup k nastavení domény `atelier-dante-time.cz` u registrátora
  (např. Forpsi, Wedos, Active24 – kde doménu platíte).

---

## Krok 1: Účet Cloudflare
1. Otevřete **dash.cloudflare.com/sign-up** a zaregistrujte se.
2. V nastavení účtu zapněte **dvoufázové ověření** (My Profile → Authentication).

## Krok 2: Databáze (D1)
1. V levém menu **Storage & Databases → D1** → **Create database**.
2. Název: `dante-time` → **Create**.
3. Zkopírujte **Database ID** (dlouhý kód s pomlčkami).

## Krok 3: Úložiště fotografií (KV)
1. **Storage & Databases → KV** → **Create namespace**.
2. Název: `dante-time-media` → **Add**.
3. Zkopírujte **ID** (32 znaků).

## Krok 4: Přístupový klíč pro GitHub
1. Vpravo nahoře ikona profilu → **My Profile → API Tokens → Create Token**.
2. **Create Custom Token**, pojmenujte „GitHub nasazení Dante Time“.
3. Oprávnění (Permissions), vše na úrovni **Account**:
   - Cloudflare Pages → **Edit**
   - D1 → **Edit**
   - Workers KV Storage → **Edit**
4. **Continue → Create Token** a token zkopírujte. Zobrazí se jen jednou.
5. Zkopírujte i **Account ID** (na hlavní stránce účtu vpravo, „Account ID“).

## Krok 5: Uložení do GitHubu (bezpečně, nikdo jiný je neuvidí)
V repozitáři na GitHubu: **Settings → Secrets and variables → Actions**.

Záložka **Secrets** → **New repository secret**:
| Název | Hodnota |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token z kroku 4 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID z kroku 4 |

Záložka **Variables** → **New repository variable**:
| Název | Hodnota |
|---|---|
| `D1_DATABASE_ID` | Database ID z kroku 2 |
| `KV_NAMESPACE_ID` | ID z kroku 3 |
| `SHOP_MODE` | `preview` |

Pak mi napište „Cloudflare je nastavený“. První nasazení spustím na náhledové
adrese a otestuji ho.

## Krok 6: Tajný instalační kód administrace
Až bude projekt `atelier-dante-time` vidět v **Workers & Pages**:
1. Otevřete ho → **Settings → Variables and Secrets → Add**.
2. Typ **Secret**, název `ADMIN_SETUP_TOKEN`, hodnota: libovolných
   30 a více znaků (např. vymyšlená dlouhá věta bez mezer). Uložte ji
   do Hesel v iPhonu.
3. Přidejte i proměnnou (typ **Text**) `SHOP_MODE` = `preview`.
4. Otevřete `https://<náhledová-adresa>/admin/` a projděte první nastavení
   (návod v `docs/NAVOD-IPHONE.md`).

## Krok 7: Přesměrování domény (až bude vše otestováno)
1. V projektu **Custom domains → Set up a custom domain** → `atelier-dante-time.cz`.
2. Cloudflare ukáže, jaký záznam DNS nastavit u registrátora (obvykle
   CNAME na `atelier-dante-time.pages.dev`). Případně nabídne převedení
   celé domény pod Cloudflare, což je jednodušší a také zdarma.
3. Po změně DNS (do několika hodin) poběží web na Cloudflare.
4. Teprve potom se sloučí pull request s novou platformou. Do té doby
   běží současný web na GitHub Pages beze změny.

---

## Co je zdarma a jaké jsou limity (Cloudflare Free, stav 11/2026)

| Služba | Limit zdarma | Odhad potřeby Dante Time |
|---|---|---|
| Pages (hosting) | neomezený provoz statických stránek | ✓ |
| Functions (katalog, objednávky) | 100 000 požadavků denně | stovky až tisíce denně |
| D1 (databáze) | 5 GB, 5 mil. čtení denně | jednotky MB |
| KV (fotografie) | 1 GB, 100 000 čtení a 1 000 zápisů denně | ~1 GB ≈ 3 000 fotek |

Při překročení limitu zdarma služba **nepřejde do placeného režimu sama**.
Požadavky nad limit jen selžou. Placený tarif by bylo nutné výslovně
aktivovat, a to agent bez vašeho souhlasu neudělá.
