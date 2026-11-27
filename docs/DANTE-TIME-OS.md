# Dante Time OS – návrh architektury (ke schválení)

**Připraveno:** 26. 11. 2026 · **Autor:** Claude (DT Developer) · **Stav:** ⚖️💰 návrh, čeká na schválení majitele

Cíl: z ročního obratu ~600 000 Kč růst k 2 000 000 Kč při zachování prémiové značky.
Majitel se věnuje nákupu, hodinářské práci, rozhodování a expedici. Zbytek přebírá systém.

---

## 0. Výchozí stav (analýza 26. 11. 2026)

| Oblast | Stav | Hodnocení |
|---|---|---|
| Web | Cloudflare Pages + Functions, vlastní generátor, CZ/EN, ostrý provoz od 26. 11. 2026 | ✅ rychlý, bezpečný, 0 Kč |
| Databáze | Cloudflare D1 (EU), 17 tabulek: hodinky, fotky, zákazníci, objednávky, zakázky, poptávky, faktury, e-maily, audit, nastavení | ✅ dobrý základ jednotného zdroje dat |
| Soubory | Cloudflare KV (fotky) | ⚠️ pro doklady a PDF vhodnější R2 (zdarma do 10 GB) |
| Administrace | /admin, iPhone, heslo + 2FA, historie změn (audit_log) | ✅ rozšíříme, ne nahradíme |
| E-maily | Resend (doména ověřena), 3 000/měsíc zdarma | ✅ |
| Doména | Cloudflare DNS, registrace WEDOS (do 9. 3. 2027) | ✅ |
| Testy a nasazení | GitHub Actions: testy, Lighthouse, kontrola hesel; zkušební verze pro každou větev | ✅ testovací prostředí už existuje |
| Plánované spouštění | **chybí** (Pages neumí časovač) | ➜ přidat Cloudflare Worker s časovačem (Cron Triggers, zdarma) |
| AI | **žádná** | ➜ přidat (placené podle použití) |
| Inzeráty | **na ostrém webu jsou 4 hodinky**, ne 6 | ⚠️ 2 inzeráty chybí – pošlete podklady, doplním |

**Závěr:** současná platforma je pro Dante Time OS vhodná. **Nepotřebujeme nový systém ani
nový hosting** – stačí ji rozšířit o časovač, úložiště dokladů a AI.

---

## 1. Celková architektura (doporučené, efektivnější řešení)

Místo 9 samostatných „robotů“ navrhuji **jedno jádro s rolemi**:

```
             ┌──────────── Majitel (iPhone) ─────────────┐
             │  schvaluje · dostává souhrny · rozhoduje   │
             └───────────────▲──────────────┬────────────┘
                             │ fronta schválení
┌────────────────────────────┴──────────────▼───────────────────────────┐
│                    DANTE TIME OS – administrace /admin                 │
│ hodinky · sklad · zákazníci · zakázky · doklady · finance · přehledy   │
├───────────────────────────────────────────────────────────────────────┤
│ JÁDRO: databáze D1 · historie změn · oprávnění rolí · fronta schválení │
│        · deník nákladů AI · „STOP“ tlačítko Guardiana                  │
├──────────────┬──────────────┬───────────────┬─────────────────────────┤
│ Časovač      │ Příjem e-mailů│ AI (Claude)   │ Vývoj (GitHub)          │
│ Worker cron  │ doklady@…    │ podle role,   │ DT Developer jen přes   │
│ (denně/týdně)│ alerty@…     │ s limitem Kč  │ pull request + testy    │
└──────────────┴──────────────┴───────────────┴─────────────────────────┘
       Veřejný web atelier-dante-time.cz čte stejnou databázi (jen veřejná data)
```

**Proč takto:**
1. **Jeden zdroj pravdy** – agenti nemají vlastní data, pracují nad stejnou databází jako web a administrace.
2. **Agent = role + oprávnění + plán spouštění**, ne samostatný server. Levné, přehledné, snadno rozšiřitelné.
3. **Každá akce agenta je buď „samostatná“, nebo „návrh“.** Návrh čeká ve frontě, schválíte ho jedním klepnutím.
4. **Kontrola nákladů zabudovaná v jádru** – každé volání AI se zapíše s cenou; po dosažení měsíčního limitu se AI zastaví.
5. **Guardian má nezávislý vypínač** – může pozastavit kteroukoli roli (i Directora); znovu ji zapnete jen vy.

### Kde agenti běží

| Typ práce | Kde | Proč |
|---|---|---|
| Rychlé úlohy v administraci (vytěžení účtenky, návrh odpovědi, popis hodinek) | Cloudflare Worker + Claude API | okamžitě, platí se jen za použití |
| Pravidelné úlohy (souhrny, kontroly, připomínky, prohlídky) | Worker s časovačem (cron) | zdarma, spolehlivé |
| Vývoj a údržba webu (DT Developer), týdenní hloubkové analýzy (Innovation, Guardian audit) | Claude Code – plánované úlohy nad repozitářem | pracuje s kódem, výstup jen jako pull request s testy |

---

## 2. Centrální databáze a administrace

Rozšíření stávajících tabulek (nové migrace, stávající data a funkce zůstávají):

| Modul | Nové tabulky / pole | Co umí |
|---|---|---|
| **Hodinky a sklad** | `products` + nákupní cena, datum a zdroj nákupu, stav ve skladu; `parts` (strojky, ciferníky, pouzdra, skla, řemínky) | sklad dílů, co je v kterých hodinkách, originál × nový díl |
| **Náklady** | `costs` (díl, materiál, práce v hodinách × sazba, doprava, poplatky) navázané na hodinky/zakázku; `overheads` (provozní náklady: krabičky, nářadí, hosting, reklama) | **automatická marže a zisk na kus i zakázku** |
| **Doklady** | `documents` (účtenky, přijaté faktury: soubor v R2, dodavatel, datum, částka, kategorie, stav vytěžení) | nahrání fotky z iPhonu → AI přečte údaje → vy potvrdíte |
| **Zákazníci a obchod** | rozšířené `customers`, `leads` (zájemci), `inquiries` + stav příležitosti | přehled rozjednaných obchodů |
| **Digitální pas hodinek** | `passports` (veřejný kód, historie servisu, vlastníci, fotky, originální díly) | **QR kód na kartičce → stránka /pas/XYZ** s ověřením pravosti a historií |
| **Záruky** | `warranty_inspections` | garanční prohlídky (12 měsíců ±30 dnů), připomínky, protokoly, prodloužení záruky |
| **Dokumenty** | šablony: faktura (už je), záruční list, certifikát pravosti | automaticky při prodeji, PDF/HTML |
| **Přehledy** | výpočty z výše uvedeného | tržby, náklady, zisk, marže, vývoj po měsících, cíl 2 mil. Kč |
| **Agenti** | `agent_roles` (oprávnění), `agent_runs` (běhy), `approvals` (fronta), `ai_costs` (náklady), `audit_log` (už je) | kdo co udělal, za kolik, co čeká na schválení |
| **Analytika** | návštěvnost (Cloudflare Web Analytics, bez cookies) + prodejní konverze z vlastních dat | ⚖️ zapnutí analytiky vyžaduje váš souhlas |

Administrace zůstane jedna, v současném prémiovém stylu, pro telefon i počítač.

---

## 3. Agenti: oprávnění, komunikace, spouštění

**Společná pravidla (zapsaná v kódu, ne jen v textu):**
- Agent smí jen akce ze svého seznamu oprávnění. Ostatní = návrh do fronty schválení.
- Vždy vyžaduje schválení: výdaje a nákupy, změna prodejní ceny, placená reklama, zásadní změna webu,
  změna podmínek, právně závazné kroky, nevratné operace, e-mail zákazníkovi s cenou nebo příslibem.
- Každý běh: zápis do historie (co, proč, výsledek, cena AI).
- Agent bez skutečného důvodu nic nemění: každý návrh musí obsahovat přínos, náklady a riziko.
- Komunikace mezi agenty = záznamy v databázi (úkoly, nálezy), žádné skryté kanály.

| Agent | Spouštění | Samostatně smí | Jen se schválením |
|---|---|---|---|
| **DT Director** | denně ráno, souhrn e-mailem týdně (po) | sestavit priority, rozdělit úkoly, souhrn | cokoli z „vždy schválení“ |
| **DT Developer** | při úkolu + týdně kontrola | opravy přes pull request, testy, zkušební verze | sloučení zásadních změn do ostrého webu |
| **DT Finance** | při nahrání dokladu, denně, měsíční uzávěrka | vytěžit doklad, zařadit náklad, spočítat marže, upozornit na nesrovnalost, připravit podklady pro účetní | vystavit/stornovat fakturu mimo standardní proces, odeslat cokoli úřadům |
| **DT Marketing** | týdně plán, denně příprava | připravit obsah, texty, plán publikací, analýzu výsledků | publikovat, spustit placenou reklamu |
| **DT Sales** | při nové poptávce | návrh odpovědi a nabídky, evidence zájemců, připomenutí rozjednaných obchodů | odeslat zákazníkovi, slevy, závazné přísliby |
| **DT Scout** | denně (z upozornění tržišť) | vyhodnotit nabídku, odhad marže, upozornit jen na zajímavé | jakýkoli nákup |
| **DT Logistics** | při změně objednávky, denně | kontrola úplnosti, podklady k expedici, sledování zásilek, upozornění | — |
| **DT Guardian** | po každém běhu ostatních + denní audit | kontrolovat výpočty, ceny, faktury, změny webu, osobní údaje; **pozastavit roli** | odblokování smí jen majitel |
| **DT Innovation** | týdně (neděle) | analýza webu, trhu, konkurence; zpráva s návrhy | realizace návrhů |

---

## Stav agentů k 27. 11. 2026 (porovnání se zadáním majitele)

| Agent | Stav | Co skutečně dělá | Spouštění | Náklady |
|---|---|---|---|---|
| **DT Guardian** | ✅ běží | kontrola cen, fotek, faktur, změn cen, e-mailů, zálohy DB; smí pozastavit roli | každou hodinu, záloha denně | 0 Kč |
| **DT Director** | ✅ běží | týdenní e-mail: tržby, náklady, zisk, cíl 2 mil., co se udělalo, co čeká, upozornění všech rolí | pondělí 7:00 | 0 Kč |
| **DT Logistics** | ✅ běží | připomínky garančních prohlídek, nevyřízené objednávky, sledování Zásilkovny; expedice (založení zásilky, štítek) na tlačítko | denně 8:00 | 0 Kč |
| **DT Sales** | ✅ běží | poptávky bez odpovědi 2+ dny, nabídky bez reakce, zakázky po termínu, končící rezervace, neúplné inzeráty; návrh odpovědi (AI) na tlačítko | denně 8:00 | AI jen na pokyn |
| **DT Finance** | ✅ běží | doklady ke kontrole, hodinky bez nákupní ceny; vytěžení dokladů (AI) na pokyn; přehledy, marže, export pro účetní | denně 8:00 | AI jen na pokyn |
| **DT Developer** | ✅ (mimo systém) | vývoj přes pull requesty s testy (Claude / ChatGPT podle AGENTS.md) | při úkolu | – |
| **DT Marketing** | ⏸ čeká | potřebuje přístup k Instagramu/Facebooku a údaje o Metricool (bod 7) | – | – |
| **DT Scout** | ⏸ čeká | potřebuje tržiště a kritéria nákupu (bod 8); bez souhlasu nikdy nenakupuje | – | – |
| **DT Innovation** | ⏸ připraveno | týdenní analýza s návrhy – spustit po prvních týdnech provozu, aby měla z čeho vycházet | – | AI v limitu 300 Kč |

Všechny role sdílejí jednu databázi (D1), deník běhů (`agent_runs`), upozornění (`os_findings`), frontu schválení
(`approvals`) a deník nákladů AI s měsíčním limitem. Zákazníkům nic neposílají bez majitele.

## 4. Etapy realizace

| Etapa | Obsah | Přínos | Náklady navíc |
|---|---|---|---|
| **E1 – Jádro** | oprávnění rolí, fronta schválení, deník nákladů, vypínač Guardian, časovač (Worker), noční zálohy do R2, **garanční prohlídky** | bezpečný základ, první automatizace | 0 Kč |
| **E2 – Sklad a ekonomika** | nákupní ceny, díly, náklady, provozní náklady, marže a zisk, přehledy, cíl 2 mil. | víte přesně, co vydělává | 0 Kč |
| **E3 – Doklady a dokumenty** | nahrání účtenek z iPhonu + AI vytěžení, doklady z e-mailu (doklady@atelier-dante-time.cz), záruční list a certifikát pravosti, **digitální pas s QR** | konec ručního přepisování | AI dle použití |
| **E4 – Obchod a logistika** | DT Sales (návrhy odpovědí/nabídek), DT Logistics (expedice, sledování Zásilkovny) | rychlejší odpovědi, nic nezapadne | AI dle použití |
| **E5 – Řízení a kontrola** | DT Director (souhrny e-mailem), DT Guardian (audit), DT Developer (plánovaná údržba) | přehled bez práce | AI dle použití |
| **E6 – Růst** | DT Marketing (+ Metricool), analytika webu, DT Scout, DT Innovation | noví zákazníci a příležitosti | AI + případně Metricool |

Každá etapa: zkušební verze → testy → váš souhlas → ostrý provoz. Každou lze vrátit zpět.

---

## 5. Služby a měsíční náklady (odhad pro současnou velikost)

| Služba | K čemu | Cena |
|---|---|---|
| Cloudflare Pages, D1, KV, Workers + cron, R2, Email Routing | web, databáze, časovač, doklady, příjem e-mailů | **0 Kč** (bezplatné limity stačí; při růstu Workers Paid cca 5 USD/měsíc) |
| Resend | e-maily | 0 Kč (do 3 000/měsíc) |
| GitHub | kód, testy, zálohy kódu | 0 Kč |
| 💰 Claude API (Anthropic) | AI agenti v administraci | **odhad 200–800 Kč/měsíc** při současném objemu; pevný měsíční limit nastavíte vy |
| Claude Code (váš současný plán) | DT Developer, týdenní analýzy | v rámci vašeho předplatného (limity použití) |
| 💰 Metricool (volitelné) | plánování a analýza sociálních sítí | podle tarifu; API jen ve vyšších tarifech – ověřím před nákupem |
| WEDOS | registrace domény | beze změny (ročně) |

**Celkem na začátku: 0 Kč v etapách E1–E2, potom jednotky stovek Kč měsíčně za AI.**

---

## 6. Omezení a rizika

1. **AI dělá chyby** → proto Guardian, fronta schválení u všeho podstatného a historie změn. Částky z dokladů vždy potvrzujete.
2. **Sociální sítě:** Instagram/Facebook publikují přes Meta API (firemní účty); TikTok má omezené API → u TikToku jen příprava obsahu, publikujete vy nebo Metricool.
3. **Tržiště (Scout):** stahování cizích webů často porušuje jejich podmínky. Legální cesta: **uložená hledání s e-mailovými upozorněními** (Aukro, Bazoš, eBay, Chrono24…) přeposílaná na alerty@ → Scout je vyhodnotí.
4. **Účetnictví:** systém připraví podklady a přehledy, **nenahrazuje účetní ani daňové přiznání**.
5. **Osobní údaje:** zákaznická data zůstávají v databázi v EU; AI dostává jen nezbytné údaje; doplníme zpracovatele (Anthropic) do zásad ochrany osobních údajů ⚖️.
6. **Otevřený bod L1** (živnostenské oprávnění) se týká i garančních prohlídek a zakázek.
7. **Vývoj agentem:** změny jen přes pull request s testy; zásadní změny webu slučujete vy.

---

## 7. Co od vás potřebuji

| # | Co | Kdy |
|---|---|---|
| 1 | **Souhlas s architekturou a etapami** (případně úpravy) | teď |
| 2 | 💰 Souhlas s Claude API + **měsíční limit v Kč** (doporučuji začít 500 Kč) | před E3 |
| 3 | Rozšíření klíče Cloudflare o Workers, R2 a Email Routing (provedu vás) | před E1 časovačem |
| 4 | Nákupní ceny a náklady prodaných i skladových hodinek (stačí tabulka nebo fotky poznámek) | E2 |
| 5 | Kdo vede účetnictví a v jakém formátu chce podklady (Excel/CSV, Pohoda, Money…) | E2 |
| 6 | Podklady ke 2 chybějícím inzerátům (web má 4 hodinky, ne 6) | kdykoli |
| 7 | Přístup k firemním účtům Instagram/Facebook, info o Metricool (máte? jaký tarif?) | E6 |
| 8 | Tržiště a kritéria pro Scouta (značky, ceny, stav) | E6 |
| 9 | ⚖️ Souhlas s anonymní analytikou návštěvnosti (Cloudflare Web Analytics, bez cookies) | E6 |

---

**Doporučený první krok:** E1 Jádro včetně garančních prohlídek – je zdarma, nic nemění na veřejném
webu a vytvoří bezpečný základ, na kterém budou všichni agenti stát.

---

## Stav realizace

### E1 – Jádro (26. 11. 2026, schváleno R20)
| Část | Stav |
|---|---|
| Role a oprávnění (`agent_roles`), běhy (`agent_runs`), nálezy (`os_findings`), fronta schválení (`approvals`), deník nákladů AI (`ai_costs`, limit **300 Kč/měsíc**) | ✅ migrace 0008 |
| Přehled **Systém** v administraci: role, činnost, výsledky, oprávnění, pozastavení/obnovení, nálezy, schvalování, náklady, zálohy | ✅ |
| **DT Guardian** (bez AI): ceny a fotky v prodeji, změny cen jinou osobou, součty objednávek, neodeslané e-maily, pokusy o přihlášení, zálohy, limit AI, chybovost a aktivita ostatních rolí včetně Directora → **automatické pozastavení**; obnovit smí jen majitel | ✅ |
| **DT Logistics**: automatické připomínky garančních prohlídek, upozornění na neodeslané objednávky | ✅ |
| **DT Director**: týdenní souhrn e-mailem (pondělí 7:00) + na vyžádání | ✅ |
| Garanční prohlídky od **skutečného převzetí** (tlačítko „Převzato zákazníkem“ u objednávky, u dobírky den zaplacení), dobrovolná záruka a zákonná práva evidovány zvlášť | ✅ |
| Časovač: Worker `workers/os-cron` (každou hodinu) → `/api/os/tick` s tajným klíčem; záložně běží kontroly při otevření administrace | ✅ kód, ⏳ čeká na oprávnění tokenu |
| Zálohy: denně, **šifrované AES-256**, 30 dní, ke stažení v přehledu Systém; obnova `scripts/backup-decrypt.mjs` + Cloudflare D1 Time Travel | ✅ kód, ⏳ čeká na klíč BACKUP_KEY |

### Co udělá majitel (jednorázově, asi 5 minut)
1. **Token Cloudflare – přidat oprávnění** (Cloudflare → My Profile → API Tokens → stávající token → Edit):
   `Account → Workers Scripts → Edit`. Nic dalšího (R2 ani Email Routing zatím nepotřebujeme).
2. **Šifrovací klíč záloh:** vymyslet dlouhé heslo (alespoň 32 znaků), **uložit si ho do aplikace Hesla**
   a zadat jako GitHub Secret `BACKUP_KEY`. Bez tohoto klíče nejde zálohu přečíst – ani agentovi.

### Obnova ze zálohy (postup pro agenta)
1. Stáhnout šifrovanou zálohu z přehledu Systém (nebo z KV `backup/…`).
2. `BACKUP_KEY=… node scripts/backup-decrypt.mjs zaloha.enc > zaloha.json` (klíč zadá majitel, nikam se neukládá).
3. Obnovu do D1 provést jen po souhlasu majitele, nejdřív do zkušební databáze. Pro nedávné chyby
   použít `wrangler d1 time-travel restore` (až 7 dní zpět).

### E2 – Sklad a ekonomika (26. 11. 2026)
| Část | Stav |
|---|---|
| Náklady (`costs`): nákup hodinek, díly, materiál, práce (hodiny × sazba), doprava, poplatky, reklama, provoz | ✅ migrace 0009 |
| Interní údaje odděleně od veřejné tabulky hodinek (test hlídá) | ✅ |
| Sklad dílů (`parts`): druh, originál, kalibr, cena, dodavatel, stav, použití v hodinkách | ✅ |
| Náklady a marže u každých hodinek (Hodinky → detail → Náklady a marže) | ✅ |
| Přehled Ekonomika: tržby, náklady, zisk po měsících, cíl 2 mil. Kč, hodnota skladu, marže kusů | ✅ |
| Export pro účetní (CSV pro Excel): náklady a vydané faktury za období | ✅ |
| DT Guardian: prodané hodinky bez nákupní ceny, záporná marže | ✅ |
| Hodinová sazba práce – nastaví majitel (Ekonomika → Hodinová sazba) | ⏳ majitel |


### E3a – Digitální pas hodinek a certifikát pravosti (26. 11. 2026, bez AI, 0 Kč)
| Část | Stav |
|---|---|
| Pas hodinek (`watch_passports`, `passport_events`, migrace 0010): identifikace hodinek, součásti s garancí pravosti, historie | ✅ |
| **Bez osobních údajů:** pas neobsahuje jméno, kontakt ani cenu; výrobní číslo veřejně jen zkráceně (••••1234) | ✅ test hlídá |
| Veřejné ověření přes QR: `/pas/<kód>` a `/en/passport/<kód>`, kód 12 znaků (nelze uhodnout), noindex, ochrana proti hádání | ✅ |
| Pas vzniká sám při zápisu převzetí (i u dobírky), záznam o předání; garanční prohlídka se zapíše do historie sama | ✅ |
| Administrace: Více → Pasy hodinek; u hodinek tlačítko „Pas hodinek“; ruční pas pro hodinky mimo katalog; zrušení pasu (ztráta, podvrh) | ✅ |
| Certifikát pravosti k tisku / PDF s QR kódem (A4) | ✅ |
| Záruční list: text ze schválených podmínek 1.1 se posílá v potvrzení objednávky (§ 2174a) – beze změny | ✅ |

### E3b v2 – Nákupy a prodeje (upraveno podle majitele 26. 11. 2026)
Majitel nakupuje hlavně přes Aukro, AliExpress, eBay a od soukromých osob → místo účtenek univerzální evidence.

| Část | Stav |
|---|---|
| **Více → Nákupy a prodeje:** nahrát více screenshotů / fotek / PDF najednou (nákupy) nebo hromadně vydané faktury (import 2026) | ✅ |
| **DT Doklady (AI):** vyčte datum, platformu, prodávajícího, číslo objednávky, položky, měnu, cenu, dopravu; u faktur číslo, odběratele, položky, částku a platbu | ✅ kód, ⏳ klíč majitele |
| Spolehlivě rozpoznané se **uloží samo**; nejisté údaje, duplicita nebo chybějící kurz → **Ke kontrole** s popisem, co ověřit | ✅ |
| Kurz **ČNB** k datu nákupu (zdarma, ukládá se), ruční úprava kurzu i částky v Kč | ✅ |
| Přiřazení: **hodinky** (i automatické spárování podle názvu), **sklad dílů** (naskladní díl s cenou), **provoz** | ✅ |
| Ruční zadání nákupu i prodeje bez dokladu; původní soubor zůstává uložený | ✅ |
| Duplicity: stejný soubor, stejné číslo objednávky / faktury, stejná částka + datum + platforma | ✅ |
| Import faktur → tabulka `sales` (nezasahuje do číselné řady), zákazník s e-mailem → seznam zákazníků | ✅ |
| Faktury vystavené v Dante Time OS se do ekonomiky propisují **samy** (bez nahrávání); import je v tržbách jen jednou | ✅ |
| Limit AI 300 Kč/měsíc hlídán, při vyčerpání vše funguje ručně; model volitelný (Opus 5.5 / Sonnet 5.5 / Haiku 5.5) | ✅ |
| Žádné účetní funkce navíc (DPH, deník, rozvaha) – podklady pro účetní jako CSV | záměrně |

**Odhad nákladů AI (ceník Anthropic 11/2026):** Opus 5.5 ~1 Kč za doklad; jednorázový import cca 100 faktur ~100 Kč;
běžný měsíc 30–50 dokladů 30–50 Kč. Haiku 5.5 je cca 40× levnější, ale méně přesný u rozmazaných screenshotů.

**Zapnutí AI (majitel, jednorázově):** console.anthropic.com → účet a kredit (např. 5 USD, limit útraty) → API klíč →
Cloudflare → Workers & Pages → projekt → Settings → Variables and Secrets → Secret `ANTHROPIC_API_KEY`.
⚖️ Před importem faktur s AI schválit doplnění Zásad o Anthropic jako zpracovatele (LEGAL-REVIEW 2g).

- Doklady z e-mailu (doklady@…) vyžadují Cloudflare Email Routing (zdarma) a rozšíření oprávnění tokenu.
