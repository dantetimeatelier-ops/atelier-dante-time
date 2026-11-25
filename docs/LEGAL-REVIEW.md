# Právní dokumenty – kontrola před zveřejněním

**Stav:** ⚖️ NÁVRH – čeká na doplnění údajů a rozhodnutí majitele
**Připraveno:** 25. 11. 2026
**Dokumenty:** `src/legal/docs.mjs` (na webu `/terms`, `/reklamace`, `/returns`, `/warranty`,
`/zakazkova-vyroba`, `/doprava-a-platba`, `/privacy`, `/cookies`, `/provozovatel`, `/odstoupeni`)

> Dokumenty jsem připravil podle aktuálních předpisů, jak je znám, a ověřil
> jsem klíčové novinky z let 2023–2026. **Nejsem advokát.** U e-shopu
> s luxusním zbožím doporučuji jednorázovou kontrolu advokátem se zaměřením
> na spotřebitelské právo (orientačně několik tisíc Kč). Body označené 🔴
> považuji za nejdůležitější.

---

## 1. Údaje, které musíte doplnit

Na webu se zobrazují jako zvýrazněné `[DOPLNIT: …]`. **Web nepůjde spustit
v ostrém režimu, dokud tam nějaké zůstanou** (pojistka v `scripts/build.mjs`).
Údaje se zapisují do `src/site.mjs` (objekt `OPERATOR`). Stačí mi je poslat
a doplním je.

| # | Údaj | Kde se používá |
|---|---|---|
| 1 | 🔴 Jméno a příjmení podnikatele, nebo obchodní firma | všechny dokumenty, faktura |
| 2 | 🔴 IČO | všechny dokumenty, faktura |
| 3 | 🔴 Sídlo / místo podnikání | všechny dokumenty, faktura |
| 4 | 🔴 Zápis v živnostenském rejstříku (příslušný úřad) | provozovatel, faktura |
| 5 | 🔴 Plátce / neplátce DPH (případně DIČ) | ceny, faktura |
| 6 | Číslo účtu a IBAN | QR platba, obchodní podmínky |
| 7 | Adresa pro vracení zboží (pokud se liší od sídla) | odstoupení, reklamace |
| 8 | Příslušný živnostenský úřad | dozor |
| 9 | Datum účinnosti dokumentů | všechny dokumenty |
| 10 | Splatnost při platbě převodem (návrh: 3 dny = 72 h rezervace) | OP čl. 4 |
| 11 | Doba odeslání po zaplacení (návrh: 3 pracovní dny) | OP čl. 5, doprava |
| 12 | Ceny dopravy (Zásilkovna, Balíkovna) | doprava (zadáte v administraci) |
| 13 | Místo osobního převzetí, nebo tuto možnost zrušit | doprava |
| 14 | Výše zálohy u zakázkové výroby (návrh: 30–50 %) | zakázková výroba |
| 15 | Lhůta pro vyzvednutí hotové zakázky a případné skladné | zakázková výroba |
| 16 | Pojištění odpovědnosti za převzaté hodinky (máte? limit?) | zakázková výroba |
| 17 | Název platební brány a poskytovatele e-mailů (po aktivaci) | GDPR, doprava a platba |
| 18 | Účetní / fakturační služba (pokud ji používáte) | GDPR |

## 2. Rozhodnutí, která jsou na vás

| # | Otázka | Můj návrh |
|---|---|---|
| A | 🔴 **Garance pravosti – co zákazník dostane**, když se deklarovaný díl ukáže jako neoriginální? | Volba zákazníka: výměna dílu za originální na vaše náklady, nebo vrácení celé ceny proti vrácení hodinek. |
| B | 🔴 **Garance pravosti – pro koho platí?** Jen pro prvního kupujícího, nebo pro každého dalšího majitele s dokladem? | Pro každého majitele s dokladem o koupi. Zvyšuje hodnotu hodinek při dalším prodeji a je to silný prodejní argument. |
| C | Co přesně znamená „originální díl“? Díl od výrobce hodinek, nebo i dobově odpovídající díl? | Jen díl od výrobce daných hodinek. Dobové díly vždy uvádět jako „neoriginální“. |
| D | **Dvouletá záruka i na servis?** Původní web uváděl 12 měsíců. Návrh nyní uvádí 24 měsíců podle vašeho závazku. | Ponechat 24 měsíců (na provedenou práci a nové díly). |
| E | **14denní vrácení i pro firmy (podnikatele)?** Zákon ho dává jen spotřebitelům. | Nabídnout i podnikatelům, protože je to jednodušší a odpovídá vašemu závazku. |
| F | Tolerance přesnosti chodu u vintage hodinek (co není vadou) | Uvádět u každého kusu, obecně např. ±30 s/den. |
| G | Doručování mimo ČR (Slovensko, EU)? | Zatím jen ČR. |
| H | Anglické verze právních dokumentů | Zatím jen česky (na webu je to označeno „CZ“). Překlad po schválení českých verzí. |
| I | Dobírka | Nenabízet (riziko nepřevzetí u drahého zboží). |

## 3. Právní rizika a upozornění

1. 🔴 **Prodej zlatých a stříbrných hodinek – puncovnictví.** Pouzdra z drahých
   kovů smí být v ČR prodávána jen s platnou puncovní značkou (zákon
   č. 19/1993 Sb., o puncovnictví). U vintage kusů ze zahraničí to může být
   problém. Doporučuji konzultaci s Puncovním úřadem, než budete prodávat
   zlaté nebo stříbrné kusy.
2. 🔴 **Živnostenské oprávnění.** Hodinářství je řemeslná živnost
   (vyžaduje odbornou způsobilost), prodej zboží je živnost volná. Ověřte,
   že máte obojí, ještě před spuštěním e-shopu.
3. 🔴 **Bezpečnost výrobků (nařízení GPSR 2023/988).** U každého výrobku
   nabízeného online musí být údaje o výrobci a bezpečnostní upozornění.
   U zakázkových sestav jste **výrobcem vy** (povinnosti výrobce: posouzení
   rizik, technická dokumentace, označení výrobku). Administrace má pro tyto
   údaje pole. Doporučuji si povinnosti nechat potvrdit.
4. **Tlačítko „Odstoupit od smlouvy“ (§ 1830a OZ, účinnost od 1. 1. 2027)** je
   na webu připravené na stránce `/odstoupeni` (dvoukrokové potvrzení
   a okamžité e-mailové potvrzení přijetí). Podle sekundárních zdrojů jde
   o zákon č. 159/2026 Sb. Číslo zákona a konečné znění je potřeba ověřit
   v e-Sbírce.
5. **Připravovaná novela „právo na opravu“** (sněmovní tisk 53, Sněmovna
   schválila 14. 10. 2026) prodlouží odpovědnost za vadu odstraněnou opravou.
   Po nabytí účinnosti upravím reklamační řád. Automatika na to v týdenním
   přehledu neupozorní, je to v plánu jako úkol.
6. **Neprezentovat zákonná práva jako výhodu.** Zákon zakazuje uvádět
   zákonná práva spotřebitele (24 měsíců na vady, 14 dní na vrácení) jako
   zvláštnost nabídky (příloha č. 1 zákona o ochraně spotřebitele). Proto
   web píše „podle zákona“ a jako skutečnou výhodu zdůrazňuje **garanci
   pravosti**. Totéž platí pro Instagram a TikTok.
7. **Evropská platforma ODR byla zrušena 20. 7. 2025** (nařízení (EU)
   2024/3228). Odkaz na ni se proto neuvádí. Uvádí se jen ČOI.
8. **Potvrzení objednávky obsahuje celý text obchodních podmínek** a poučení
   o odstoupení (tzv. trvalý nosič). Zvažte navíc přílohu PDF.
9. **Ochranné známky (Omega, PRIM…).** Popis pravých hodinek značkou je
   v pořádku. Nepoužívejte loga značek a nenaznačujte, že jste
   autorizovaný servis nebo prodejce.
10. **Ceny a slevy.** Pokud někdy uvedete slevu, musí se zobrazit nejnižší
    cena za posledních 30 dní (§ 12a zákona o ochraně spotřebitele). Web
    zatím slevy nezobrazuje.
11. **Recenze.** Pokud budete zveřejňovat recenze, musí obchodní podmínky
    uvádět, zda a jak ověřujete, že pocházejí od skutečných zákazníků.
12. **GDPR – zpracovatelé v USA.** Cloudflare, Google a GitHub jsou podle
    dostupných informací certifikováni v EU–US Data Privacy Framework.
    Ověřte aktuální stav na dataprivacyframework.gov. Smlouvy o zpracování
    se uzavírají přijetím jejich podmínek.
13. **Přístupnost (zákon č. 424/2023 Sb.).** Mikropodniky poskytující
    služby (méně než 10 zaměstnanců a obrat nebo bilance do 2 mil. EUR)
    jsou z povinností vyňaty. Web je přesto navržen přístupně (Lighthouse
    přístupnost 100).
14. **Faktura u neplátce DPH.** Formát dokladu odpovídá běžné praxi. Až
    budete znát režim DPH, nechte si ho potvrdit účetní.
15. **Riziko přepravy hodinek do ateliéru** nese podle návrhu odesílatel.
    U spotřebitele zvažte, zda raději neposkytnout svoz nebo pojištění.

## 4. Použité zdroje

- Zákon č. 89/2012 Sb., občanský zákoník, ve znění novely č. 374/2022 Sb.
  (účinná od 6. 1. 2023) a zákona o funkci pro odstoupení (§ 1830a,
  účinnost 1. 1. 2027)
- Zákon č. 634/1992 Sb., o ochraně spotřebitele
- Nařízení vlády č. 363/2013 Sb. (vzorový formulář pro odstoupení)
- Nařízení (EU) 2016/679 (GDPR), zákon č. 110/2019 Sb.
- Zákon č. 127/2005 Sb., o elektronických komunikacích, § 89 odst. 3 (cookies)
- Nařízení (EU) 2023/988 (GPSR), nařízení (EU) 2024/3228 (zrušení ODR)
- Směrnice (EU) 2023/2673 (funkce pro odstoupení), (EU) 2024/1799 (právo na opravu)

## 5. Jak dokumenty schválit

1. Pošlete mi údaje z části 1 a rozhodnutí z části 2. Stačí v chatu.
2. Doplním je a připravím finální verzi.
3. Doporučuji rychlou kontrolu advokátem.
4. Po vašem „schvaluji“ se dokumenty zveřejní spolu s e-shopem.
