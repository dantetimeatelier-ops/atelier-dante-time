# CHANGELOG – historie změn Dante Time OS

Nejnovější nahoře. Každá změna jde přes pull request (číslo #). Po každém úkolu přidej řádek (R28).
Podrobnosti k jednotlivým změnám: `docs/HANDOFF.md` a popisy pull requestů na GitHubu.

## 2026-11-28
- Podpis a razítko: automatické oříznutí okrajů, větší na certifikátu.
- Podpis a razítko na certifikát pravosti (#77).
- Pas ze zakázky: popis strojku podle kalibru, výchozí originalita (#76).
- Údaje pasu se vyplňují v zakázce a přepisují do pasu (#75).
- Digitální pas automaticky i pro hodinky ze zakázek (#74).
- Karta digitálního pasu k gravírování: SVG v křivkách, PNG 600 DPI, PDF, inverze, hromadný ZIP, kontrola QR (#73).
- Platba kartou v ostrém provozu: omezený ostrý klíč Stripe (bez výplat a převodů), diagnostika v administraci, tolerantní PAYMENTS_LIVE (#71).
- Centrální dokumentace: CLAUDE.md, AGENTS.md, PROJECT_STATE.md, TASKS.md, ROADMAP.md, DECISIONS.md (přesun do kořene), CHANGELOG.md (R28).
- Ostrý provoz Stripe: ověřený účet, ostrý webhook, klíče v Cloudflare, nové nasazení (bez změny kódu).
- Zkouška plateb kartou v sandboxu na ostrém webu úspěšná (objednávka se sama zrušila, bez faktury).

## 2026-11-27
- STAV a HANDOFF: večer 27. 11. (#69)
- Aktualizace testovacích nástrojů (Dependabot #4 na aktuální main) (#68)
- Produktový feed pro Google Nákupy (#67)
- E2E test: oprava občasného selhání (#66)
- Trvalý pokyn R27 a přehled docs/STAV.md (#65)
- Jednotné názvy hodinek „DT – ZNAČKA …“ v celém systému (R26) (#64)
- Blanc: balení jako u ostatních hodinek (#63)
- Náhled faktury před vystavením, oprava zobrazení e-mailu na faktuře (#62)
- Heritage Date: historie strojku PRIM typ 0111 (#61)
- Faktura: bez data plnění, položka = hodinky ze zakázky (#60)
- Inzeráty: průměr, kalibr a období výroby (#59)
- Zakázky: pole Kalibr a předvyplnění faktury ze zakázky (#58)
- Limit DPH: obrat i s nahranými prodeji (#57)
- Balíkovna: limit hodnoty 50 000 Kč (#56)
- Pokladna: oprava výběru Zásilkovny, Balíkovna zpět (#55)
- ⚖️ Zkouška plateb kartou (Stripe) na ostrém webu – vidí jen přihlášený majitel (#54)
- ⚖️💰 Platby kartou (Stripe, vypnuté), správa dopravců s pojištěním na plnou hodnotu, náklady dopravy do zisku, podmínky 1.2 (#47)
- Zakázka: tlačítko Upravit · fotky dokladu u nákladu (#52)
- Faktury: storno s důvodem ze seznamu, oprava odběratele (#51)
- Jednotná správa výdajů a kontrola modulů (#50)
- Audit administrace: fakturace s platbami, storno, duplicity a úpravy záznamů (#49)
- Koncepty faktur a adresa u zakázky (#48)
- Administrace bez vlastní práce a hodinové sazby (#46)
- Díly ze skladu v zakázce (#45)
- Zakázky: náklady, zálohy, faktury se schválením odeslání, po splatnosti a fotky (#44)
- Oprava: „Neznámá operace“ u zakázek (fotky) (#43)
- Zakázka bez e-mailu (zákazníci z Instagramu) (#42)
- Úvodní fotka na mobilu: menší hodinky, nápis hned vidět (#41)
- Úvodní fotka: hodinky na tabletech ještě menší (#40)
- Úvodní fotka: menší hodinky na tabletech (#39)
- DT Logistics: sledování zásilek Balíkovny (#38)
- Dante Time OS: aktivní DT Sales a DT Finance, úplnější přehled DT Director (#37)
- DT Logistics: založení zásilky v Zásilkovně a štítek k tisku (#36)
- ⚖️ Elegantní potvrzení objednávky, právní dokumenty jako PDF přílohy (#35)
- DT Logistics: sledování zásilek Zásilkovny (#34)
- Fotky už při zakládání zakázky + oprava polí s datem (#33)
- ⚖️ Zásady OOÚ: AI i pro návrhy odpovědí na poptávky (#32)

## 2026-11-26
- DT Sales: bez jména zákazníka v dotazu na AI (#31)
- DT Sales: návrh odpovědi na poptávku (AI) (#30)
- Balíkovna: výdejní místo jen z mapy (bez ručního pole) (#29)
- Fotografie u zakázek a fotky od zákazníka v poptávce (#28)
- Pokladna: Zásilkovna ve vlastním okně jako Balíkovna (oprava zamrznutí) (#27)
- Pokladna: Zásilkovna se vybírá tlačítkem stejně jako Balíkovna (#26)
- Oprava výběru výdejního místa v pokladně (Balíkovna, Zásilkovna) (#25)
- HANDOFF: import faktur 2026 dokončen (#23)
- Doklady jako text: oprava chyby 503 při importu faktur (#22)
- Import faktur: oprava chyby 503 a tlačítko Začít import znovu (#21)
- AI: velké doklady přes Files API, úklid prázdných konceptů (#20)
- Doklady až 10 MB a obnovení AI z Nákupů a prodejů (#19)
- ⚖️ Zásady ochrany osobních údajů: evidence prodejů a nákupů, Anthropic jako zpracovatel (R21) (#12)
- Centrální fakturační systém Dante Time OS (#18)
- Katalog: vlastní jména modelů hodinek – Classic Soleil, Classic Diamant, Classic Blanc, Heritage Date (#17)
- Prodeje: model hodinek a výrobní číslo z faktur (#16)
- Oprava: AI klíč s neviditelnými znaky (#15)
- Oprava: falešná duplicita po smazání konceptu dokladu (#14)
- Oprava: nahrávání dokladů na iPhonu, zobrazení chyby AI, Přečíst znovu (#13)
- Dante Time OS E3b v2: univerzální evidence nákupů a prodejů s AI (#11)
- Dante Time OS E3b: doklady k nákladům (bez AI) a úplnější zálohy (#10)
- Dante Time OS E3a: digitální pas hodinek s QR a certifikát pravosti (#9)
- Dante Time OS E2: sklad a ekonomika (#8)
- Dante Time OS E1: jádro, DT Guardian, garanční prohlídky, oprava záručních textů (#7)
- Podmínky 1.1, nová úvodní sekce a zapnutí objednávek (#6)
- Oprava: režim e-shopu ostrého webu z jediného zdroje (#5)
- Spuštění nové platformy Dante Time: e-shop, administrace, právní dokumenty 1.0 (#3)

## 2026-11-25
- Fáze 1 + krok A: zrychlení webu, SEO, stránka 404, automatické testy (#1)
