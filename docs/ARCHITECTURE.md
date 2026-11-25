# Architektura platformy Dante Time

**Stav:** ve vývoji ve větvi `claude/eshop-platforma` (mandát R10)
**Cíl:** web, e-shop a administrace s provozními náklady 0 Kč měsíčně.

## Proč tohle řešení

| Požadavek | Řešení | Cena |
|---|---|---|
| Rychlý web, dobré SEO | statické stránky generované při sestavení (`scripts/build.mjs`) | 0 Kč |
| Katalog, který se mění bez programátora | stránky hodinek se vykreslují ze databáze při návštěvě (Cloudflare Pages Functions) | 0 Kč (free: 100 000 požadavků denně) |
| Databáze hodinek, objednávek a zákazníků | Cloudflare **D1** (SQLite), **mimo veřejný repozitář** | 0 Kč (free: 5 GB) |
| Fotografie | Cloudflare **R2** | 0 Kč (free: 10 GB, bez poplatků za přenos) |
| Administrace z iPhonu | vlastní mobilní aplikace v prohlížeči `/admin`, přihlášení heslem a ověřovacím kódem (2FA) | 0 Kč |
| Hosting a HTTPS | Cloudflare Pages | 0 Kč |

Žádný framework, jen čisté HTML, CSS a JavaScript, plus malý vlastní
generátor stránek. Méně závislostí znamená menší riziko, rychlejší
web a snadnou údržbu pro jakéhokoli AI agenta.

## Struktura

```
src/                  zdroj stránek (sdílený layout, texty, právní dokumenty)
  layout.mjs          hlavička, patička, <head>, SEO značky
  site.mjs            nastavení webu (adresa, jazyky, navigace)
  i18n/               překlady (cs, en)
  pages/              obsah statických stránek
  legal/              právní dokumenty
  shop/               sdílená logika e-shopu (popisy, ceny, QR platba…)
public/               soubory kopírované beze změny (obrázky, CSS, JS, admin)
functions/            serverová část (Cloudflare Pages Functions)
  api/                API pro e-shop
  api/admin/          API administrace (vyžaduje přihlášení)
migrations/           struktura databáze D1
scripts/build.mjs     sestavení webu do dist/
tests/                testy (jednotkové, prohlížečové, odkazy)
```

## Režimy e-shopu (proměnná `SHOP_MODE`)

| Režim | Co dělá | Kdy |
|---|---|---|
| `preview` *(výchozí)* | katalog je vidět, místo nákupu tlačítko **Mám zájem** (nezávazná poptávka) | do ověření právních dokumentů |
| `test` | celý nákup funguje, ale vše je označeno jako TEST a platby jen v testovacím režimu | ověřování objednávkového procesu |
| `live` | ostrý provoz | **jen po výslovném souhlasu majitele** |

Skutečné platby navíc vyžadují samostatnou proměnnou `PAYMENTS_LIVE=true`,
kterou agent nikdy nenastavuje.

## Ochrana proti prodeji jednoho kusu dvakrát

Každé hodinky jsou v databázi jeden řádek se stavem
`draft → available → reserved → sold`. Při objednávce se kus rezervuje
příkazem, který uspěje **jen pokud je kus právě dostupný**:

```sql
UPDATE products SET status='reserved', reserved_order_id=?, reserved_until=?
WHERE id=? AND status='available'
```

Databáze provádí tento příkaz atomicky, takže ze dvou současných
objednávek uspěje vždy jen jedna. Druhá dostane zprávu, že kus byl právě
prodán. Nezaplacené rezervace po uplynutí lhůty automaticky vyprší.

## Zabezpečení

- Administrace: heslo (PBKDF2-SHA256) + jednorázový kód (TOTP, např.
  aplikace Hesla v iPhonu), omezení pokusů, relace v `__Host-` cookie
  (HttpOnly, Secure, SameSite=Strict), kontrola původu požadavku.
- Bezpečnostní hlavičky (`public/_headers`): CSP, HSTS, X-Frame-Options,
  Referrer-Policy, Permissions-Policy.
- Fotografie se před nahráním v iPhonu zmenší a **odstraní se z nich
  metadata** (včetně GPS polohy).
- Zákaznická data jsou jen v D1, nikdy v repozitáři ani v logu.
- Tajné klíče jen v nastavení Cloudflare (Secrets), nikdy v kódu.
