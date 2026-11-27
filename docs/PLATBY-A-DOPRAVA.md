# Platby a doprava – přehled ke schválení (27. 11. 2026)

Zadání majitele: Apple Pay, Google Pay, Visa, Mastercard, převod s QR, dobírka (bez PayPalu),
doprava po celé EU, automatizace, ochrana unikátního kusu. **Pokyn: „ať to nestojí peníze.“**

Stav: vše je naprogramované a otestované. **Nic placeného není zapnuté.** Zákazníci vidí jen to,
co skutečně funguje.

## 1. Co funguje hned a nic nestojí

| Možnost | Stav | Náklad pro ateliér |
|---|---|---|
| Bankovní převod s QR (CZK) a SEPA QR (EUR) | ✅ v provozu | 0 Kč |
| Dobírka (ČR, výdejní místo) | ✅ v provozu | poplatek dopravce, platí zákazník příplatkem |
| Zásilkovna výdejní místo / Z-BOX v ČR | ✅ v provozu | cena zásilky (platí zákazník v ceně dopravy) |
| **Zásilkovna na adresu v ČR** | ✅ nové – zapne se vyplněním ceny v Nastavení | dtto |
| **Packeta Slovensko a EU: výdejní místa i adresa** | ✅ nové – zapne se cenou pro zemi | dtto, účet Zásilkovny je zdarma |
| Balíkovna, osobní předání | ✅ v provozu | – |
| Automatické potvrzení platby, faktura, e-maily, štítky, sledování | ✅ | 0 Kč |

## 2. Platba kartou (Visa, Mastercard, Apple Pay, Google Pay) – ke schválení 💰

Karta nikdy není úplně zdarma: každá brána si bere procento z platby. Rozdíl je v tom, zda se platí
i **měsíční poplatek, když nic neprodáte**. Ceny z veřejných ceníků k 27. 11. 2026, příklad pro
hodinky za 13 000 Kč zaplacené evropskou spotřebitelskou kartou.

| | **Stripe** (doporučeno) | Comgate | GoPay |
|---|---|---|---|
| Měsíční poplatek | **0 Kč nikdy** | Start: 0 Kč 6 měsíců, pak tarif Easy 100 Kč/měs., pokud je obrat pod 100 000 Kč | Start: 0 Kč 12 měsíců, pak 80 Kč/měs. (do 50 000 Kč obratu) |
| Poplatek z platby | 1,5 % + 6,50 Kč (prémiové karty 1,9 %) | Start: 0 % do 50 000 Kč/měs. 6 měsíců; pak 1 % (firemní a mimoevropské karty 2 %) | 0 % 12 měsíců do 50 000 Kč/měs.; pak 0,95 % + 10 Kč za převod |
| Příklad 13 000 Kč | **≈ 202 Kč** | prvních 6 měs. 0 Kč, pak 130 Kč + 100 Kč/měs. | 1. rok 0 Kč, pak ≈ 124 Kč + 80 Kč/měs. |
| Měsíc bez prodeje kartou | **0 Kč** | 100 Kč | 80 Kč |
| Apple Pay, Google Pay, EUR | ano | ano (+0,15 % za cizí měnu) | ano |
| Vrácení platby / chargeback | bez poplatku (původní poplatek se nevrací) / cca 20 € | 5 Kč / 990 Kč | 5 Kč / 990 Kč |
| Napojení v e-shopu | ✅ hotové | ✅ hotové | nenaprogramováno |

**Doporučení: Stripe** – jediná brána bez jakýchkoli pravidelných poplatků; platí se jen
z uskutečněné platby kartou, při nulových prodejích kartou je náklad 0 Kč. Převod s QR zůstává
první (výchozí) volbou a stojí 0 Kč. Při obratu kartou nad ~100 000 Kč měsíčně (cíl 2 mil./rok)
vychází levněji Comgate – přechod je pak jen výměna klíčů, kód umí obě brány.

Pozor u Stripe: platí-li zákazník v EUR a výplata jde na korunový účet, Stripe účtuje +2 % za
převod měny. Řešení zdarma: v EUR nabízet jen převod (SEPA QR), nebo přidat eurový účet.

### Co je potřeba před zapnutím karty (⚖️ vyžaduje schválení majitele)
1. Váš souhlas s bránou (výše).
2. **Doplnit Zásady ochrany osobních údajů** o příjemce „poskytovatel platební brány (Stripe
   Payments Europe, Ltd., Irsko)“ – dnes tam brána uvedená není. Návrh textu předložím.
3. V tabulce „Doprava a platba“ změnit „bude k dispozici po aktivaci“ na skutečný stav.
4. Majitel si založí účet, vloží do Cloudflare `STRIPE_SECRET_KEY` (nejdřív testovací `sk_test_…`)
   a `STRIPE_WEBHOOK_SECRET`, ve Stripe nastaví oznámení na `https://atelier-dante-time.cz/api/payments/stripe`
   (události `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`).
5. Ostrý provoz: `PAYMENTS_LIVE=true` + ostrý klíč. Pojistka v kódu: ostrý klíč bez `PAYMENTS_LIVE`
   (nebo testovací klíč v ostrém provozu) platbu kartou zákazníkům vůbec nezobrazí.

## 3. Pojištění zásilek a drahé modely (Rolex, Omega)

| Dopravce | Limit hodnoty / pojištění | Vhodné pro |
|---|---|---|
| Zásilkovna / Packeta | obchodní podmínky (ověřená verze z 12/2020): max. hodnota zásilky **20 000 Kč / 700 €**; připojištění v aplikaci jen do 10 000 Kč. Aktuální limit pro e-shop ověřit v klientské sekci. | běžné kusy do 20 000 Kč |
| Balíkovna | udaná cena do 50 000 Kč v ceně, nad to 17 Kč za každých 10 000 Kč (ceník pro firmy 2025); podmínky 2026 mají výluky pro šperky a drahé kovy – ověřit | kusy do ~50 000 Kč (nerez, pozlacené) |
| **Česká pošta – Cenný balík** | udaná cena **až 1 000 000 Kč**, určený pro cennosti, předání proti podpisu, bez smlouvy | **Rolex, Omega v ČR** |
| Česká pošta – Cenný balík do zahraničí | limit udané ceny podle země | drahé kusy do EU |
| DHL Express | pojištění 1 % z hodnoty, min. 300 Kč; hodinky a šperky mají omezení podle země – ověřit předem | drahé kusy do EU |
| PPL | bez připojištění do 50 000 Kč, se zvýšenou odpovědností do 500 000 Kč | alternativa v ČR |

**Doporučení (bez nákladů navíc – pojištění platí zákazník v ceně dopravy):**
- V Nastavení → Pojištěná přeprava nastavit hranici **20 000 Kč**. Nad ní systém automaticky
  skryje Zásilkovnu, Balíkovnu i dobírku a nabídne jen „Pojištěnou přepravu na plnou hodnotu“
  nebo osobní předání.
- Cena pojištěné přepravy v ČR podle Cenného balíku (vyplníte vy), do EU podle země.
- Drahé kusy vždy proti podpisu, s fotografiemi balení a výrobního čísla před odesláním.

## 4. Automatizace (hotovo, zdarma)
- **Potvrzení platby:** brána pošle oznámení → stav se ověří přímo u brány → zaplaceno, kus prodán,
  faktura a e-mail zákazníkovi. Nesouhlasí-li částka, nic se neoznačí a majitel dostane upozornění.
- **Dvojí prodej je vyloučen:** rezervace v jedné transakci; platba kartou platí jen do konce rezervace
  (min. 35 min); kdyby platba přesto dorazila po prodeji jinému, objednávka se neoznačí a majitel
  dostane e-mail „Vrátit platbu“.
- **Štítky:** Zásilkovna na výdejní místo, Z-BOX, partnerská místa v zahraničí i na adresu (ČR, SR, EU).
- **Sledovací číslo:** po založení zásilky se objednávka sama označí „odesláno“ a zákazník dostane
  číslo zásilky s odkazem pro sledování (lze vypnout v Nastavení).
- **CZK a EUR:** převod (QR / SEPA QR) i karta.

## 5. Návrh změny podmínek (⚖️ jen po schválení)
- Dobírka i při doručení Zásilkovnou na adresu v ČR (dnes podmínky povolují jen výdejní místo –
  proto ji systém na adresu zatím nenabízí).
