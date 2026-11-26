# Rekonstrukce nákladů 2026 – návod pro majitele

**Kde:** administrace → Více → **Rekonstrukce nákladů 2026** (nebo Ekonomika → karta Rekonstrukce).

Za rok 2026 už nejde přesně říct, který díl skončil ve kterých hodinkách. Rekonstrukce proto
odděluje dvě věci:

| | Co to je | Kam to jde |
|---|---|---|
| **Skutečné** | zaplacené částky z PDF (po slevách, s dopravou, bez vratek) a vystavené faktury | export pro daňového poradce, Ekonomika |
| **Odhad** | průměrné ceny dílů, materiál na jednotlivé hodinky, zbývající zásoby, ziskovost kusů | jen interně, soubory označené „ODHAD“ |

Nové nákupy a nové hodinky od teď evidujte přesně v **Nákupech a prodejích** (u hodinek / do skladu dílů).

## Postup krok za krokem

1. **Import PDF** – vyberte platformu (AliExpress / Temu) a nahrajte souhrnná PDF. Soubor zůstane
   uložený jako podklad. AI ho čte po 6 stranách; u dlouhých stran sama zkusí menší dávky.
   Přerušené čtení dokončíte tlačítkem **Číst dál**.
2. **Ke kontrole** – sem jde vše, co AI nepřečetla jistě: nejasný účel, návrh „soukromé“, nesedící
   součet objednávky, vratky, zrušené objednávky, chybějící kurz, možné duplicity. U každé položky
   vyberte účel (a u dílů druh a typ hodinek) a **Potvrdit**. Zaškrtnutím „stejně zařadit i další
   položky se stejným názvem“ vyřešíte opakované nákupy najednou. Nic se nemaže samo.
   Ve stejné záložce určíte typ hodinek u faktur, kde ho systém nepoznal (nebo „nejde o prodej hodinek“).
3. **Ceny a sklad → Kusovníky** – pro PRIM, OMEGA a ROLEX nastavte, kolik kterých dílů spotřebuje
   jeden prodaný kus. Výchozí je jen odhad: 1 pouzdro, 1 řemínek, 1 krabička.
4. **Ceny a sklad → Poškozené, odpad, inventura** – zapište zničené a nepoužitelné díly. Až díly
   spočítáte, zapište **inventuru** – nahradí odhad zbývajících kusů skutečným počtem a ukáže rozdíl.
5. **Souhrn** – tržby, výdaje, výsledek (skutečné) a hodnota zásob a výsledek po zohlednění zásob (odhad).
   **Hodinky** – odhad zisku každého prodaného kusu.
6. **Export** – pro daňového poradce: *Výdaje*, *Příjmy (faktury)* a *Nezahrnuté položky*
   (ke kontrole, soukromé, nezapočítané – aby poradce viděl úplný obraz). Interně: *Zásoby* a *Ziskovost*.

## Účely nákupů

| Účel | Příklad | Průměrné ceny a sklad |
|---|---|---|
| Komponenty hodinek | pouzdro, řemínek, náramek, strojek, ciferník, ručičky, sklo, korunka, pérka | ano |
| Krabičky a obaly | krabičky na hodinky, bublinkové obálky, páska | ano |
| Nářadí | šroubováky, otvírák pouzder, lis | ne – provozní výdaj |
| Spotřební materiál | oleje, čistidla, leštidla, rukavice | ne – provozní výdaj |
| Provozní výdaj | ostatní pro ateliér | ne |
| Soukromý nákup | nesouvisí s hodinkami | **nezapočítává se** |
| Nejasné | z názvu nelze poznat | čeká na vaše rozhodnutí |

Typ hodinek u dílu se vyplní, jen když ho název výslovně uvádí. Ostatní díly jsou **univerzální**
a použijí se pro všechny typy, které nemají vlastní nákupy daného dílu.

## Jak se počítá

- **Položka:** cena řádku + podíl dopravy − podíl slev − vratky, přepočteno kurzem ČNB ke dni objednávky.
  Doprava a slevy objednávky se dělí podle ceny položek. Částku v Kč můžete vždy ručně přepsat.
- **Průměrná cena** dílu = zaplaceno celkem ÷ nakoupené kusy (bez vrácených), zvlášť pro PRIM / OMEGA /
  ROLEX / univerzální. Počítají se jen potvrzené položky.
- **Materiál hodinek** = kusovník typu × průměrná cena (vlastní fond typu, jinak univerzální).
- **Zásoby** = nakoupeno − spotřeba podle prodaných kusů − poškozené − odpad (nebo inventura) × průměrná cena.
- **Podíl režie** = nářadí, materiál a provozní výdaje ÷ počet prodaných hodinek.

## Ochrana proti dvojímu započtení

- stejný soubor PDF podruhé → přeskočen; soubor nahraný už v Nákupech a prodejích → odmítnut,
- stejná položka (platforma, objednávka, název, provedení, kusy, cena) → přeskočena i z jiného PDF,
- stejné číslo objednávky z jiného PDF nebo v Nákupech a prodejích → **ke kontrole** s upozorněním,
- souhrn ukazuje počet potvrzených položek, jejichž objednávka je i v Nákupech a prodejích.

## Náklady na AI

Při každém čtení dávky dostane AI celé PDF. U 40stránkového PDF to je zhruba 7 čtení a jednotky
až desítky Kč (Opus 5.5); Sonnet 5.5 je asi o polovinu levnější. Hlídá se měsíční limit AI (300 Kč) –
při vyčerpání lze položky zadat ručně nebo počkat na další měsíc.

> Daňové posouzení (např. nářadí nad 80 000 Kč jako majetek, dovoz zboží ze třetích zemí) dělá
> daňový poradce. Export mu dává zaplacené částky s odkazem na původní PDF a číslo objednávky.
