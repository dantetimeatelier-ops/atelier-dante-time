# Přesun domény atelier-dante-time.cz na nový web

**Stav:** připraveno 25. 11. 2026, čeká na provedení majitelem (doména je u WEDOS).
**Úroveň 3 (doména, DNS):** každý krok provádí majitel nebo ho výslovně schvaluje.

## 1. Současný stav (ověřeno 25. 11. 2026 přes veřejné DNS)

| Záznam | Hodnota | Co dělá |
|---|---|---|
| NS | ns.wedos.com, ns.wedos.net, ns.wedos.cz, ns.wedos.eu | DNS spravuje WEDOS |
| DNSSEC | **zapnuto** (DS 33701, TTL 1 h) | před změnou NS se musí vypnout |
| A `@` | 185.199.108.153, 185.199.109.153, 185.199.110.153 (+ .111.153) | současný web (GitHub Pages) |
| CNAME `www` | dantetimeatelier-ops.github.io | současný web |
| A `*` (zástupný) | 185.199.111.153 | libovolná subdoména → GitHub |
| TXT `@` | google-site-verification=4inS_geusYftNA3psC6bGPWwSU2fO0sq0VwPZpu38ew | ověření Google Search Console, **zachovat** |
| MX | **žádný** | na doméně není e-mailová schránka. E-mail běží na Gmailu a změna domény ho neovlivní. |

## 2. Zvolené řešení

DNS se přesune z WEDOS do **Cloudflare (tarif Free, zdarma)**. Doména zůstává
registrovaná u WEDOS, mění se jen „nameservery“.

Proč: nový web běží na Cloudflare Pages a hlavní adresu bez `www` lze napojit
jen tehdy, když DNS spravuje Cloudflare. U WEDOS by fungovala jen adresa `www`.

**Návrat je vždy možný:** zóna u WEDOS zůstane beze změny. Stačí vrátit
nameservery WEDOS (viz bod 6).

## 3. Etapa A – příprava (web se nemění, lze kdykoli)

1. **Resend → Domains → Add domain** `atelier-dante-time.cz`, region **EU (Ireland)**.
   Resend ukáže 3–4 záznamy (DKIM `resend._domainkey`, MX a TXT pro `send`).
2. **Cloudflare → Add a domain** `atelier-dante-time.cz` → tarif **Free**
   (pozor, nevybírat placený) → Cloudflare načte stávající záznamy.
3. Zkontrolovat seznam záznamů v Cloudflare:
   - A `@` ×4 na GitHub a CNAME `www` → **DNS only (šedý mráček)**, aby se do spuštění nic nezměnilo,
   - TXT google-site-verification, ponechat,
   - zástupný `*` smazat (nepotřebujeme ho),
   - přidat záznamy z Resend (DNS only),
   - přidat TXT `_dmarc` = `v=DMARC1; p=none;` (doporučení pro doručitelnost).
4. Cloudflare ukáže **2 nameservery** (např. `xxx.ns.cloudflare.com`). Opsat.

**Stav 25. 11. 2026 večer:** etapa A hotová. Resend ověřen (DKIM, SPF). Zóna v Cloudflare (Free)
obsahuje: 3× A @ (GitHub, DNS only), CNAME www (DNS only), CNAME rsend, CNAME send, TXT google,
TXT _dmarc, TXT resend._domainkey. Zástupný `*` nepřevzat. **Nameservery Cloudflare:
`aurora.ns.cloudflare.com`, `donovan.ns.cloudflare.com`.**

## 4. Etapa B – přepnutí DNS (web se stále nemění)

**Stav 25. 11. 2026 22:20:** u WEDOS podán požadavek na zrušení DNSSEC („nepoužívat DNSSEC“).
Další krok: ověřit, že záznam DS zmizel (`dns.google/resolve?name=atelier-dante-time.cz&type=DS`),
počkat ještě nejméně 1 hodinu (TTL), pak změnit DNS servery na aurora/donovan.ns.cloudflare.com.
**Pozor:** registrace domény u WEDOS vyprší 9. 3. 2027, prodloužení je placené a hradí ho majitel.

1. **WEDOS → Domény → atelier-dante-time.cz → DNSSEC → vypnout.**
2. Počkat **nejméně 2 hodiny** (DS záznam má platnost 1 h). Ověří agent.
3. **WEDOS → Domény → atelier-dante-time.cz → Změna DNS serverů →** zadat 2 nameservery Cloudflare.
4. Počkat, až Cloudflare ukáže **Active** (obvykle do hodin, nejvýše 24 h).
   Web stále běží ze starého GitHubu. Agent ověří, že doména odpovídá.
5. Resend → Verify. E-maily pak mohou chodit z `objednavky@atelier-dante-time.cz`.
6. Později lze zapnout DNSSEC v Cloudflare (DNS → Settings → Enable DNSSEC → přidat DS u WEDOS).

## 5. Etapa C – spuštění nového webu (až po schválení majitelem)

Podmínky: schválené právní dokumenty, otevřený bod L1 evidován (R15), nastavená
doprava a ceny v administraci zkušební verze, etapa B dokončena.

1. Agent nastaví datum účinnosti právních dokumentů a finální číslo verze.
2. Majitel sloučí pull request #3 do `main` → automatické testy → nasazení ostré verze
   na `atelier-dante-time.pages.dev` (asi 5 minut).
3. **Cloudflare → Workers & Pages → atelier-dante-time → Custom domains → Set up a domain**
   → `atelier-dante-time.cz`. Cloudflare sám nahradí A záznamy GitHubu.
4. Přesměrování `www`: DNS → CNAME `www` → `atelier-dante-time.cz`, **Proxied (oranžový)**,
   a **Rules → Redirect Rules → šablona „Redirect from WWW to root“** (301, zdarma).
5. Instalační kód administrace pro ostrou verzi (nový GitHub Secret) → nastavení hesla a 2FA.
6. Agent zkontroluje ostrý web: všechny stránky, staré adresy (`/about.html` → `/about`),
   HTTPS, bezpečnostní hlavičky, objednávku, formuláře a e-maily.
7. V Google Search Console odeslat novou mapu webu `https://atelier-dante-time.cz/sitemap.xml`.

Výpadek při spuštění: několik minut (mezi sloučením a připojením domény).

## 6. Návrat k původnímu stavu

| Situace | Postup | Doba |
|---|---|---|
| Problém po spuštění (etapa C) | Cloudflare → Custom domains → odebrat doménu. V DNS vrátit A `@` 185.199.108.153–111.153 a CNAME `www` → dantetimeatelier-ops.github.io. Na GitHubu tlačítko **Revert** u sloučeného PR #3 (obnoví starý web v `main`). | minuty |
| Záloha starého webu | větev `zaloha/main-2026-11-25-pred-spustenim` a značka `v0-puvodni-web` | – |
| Návrat celé DNS k WEDOS | WEDOS → Změna DNS serverů → ns.wedos.com, ns.wedos.net, ns.wedos.cz, ns.wedos.eu. Zóna u WEDOS zůstala nedotčená. Případně znovu zapnout DNSSEC u WEDOS. | do 24 h |

## 7. Náklady

Cloudflare Free, Pages, D1 a KV v bezplatných limitech: **0 Kč**. Resend Free (3 000 e-mailů
měsíčně, 100 denně): **0 Kč**. Registrace domény u WEDOS: beze změny.
