# Platby a doprava (stav k 27. 11. 2026, rozhodnutí R23)

Schváleno majitelem: **Stripe Standard** bez paušálu, aktivačního poplatku a placených doplňků; bankovní převod
s QR jako výchozí; dobírka i na adresu v ČR; doprava po EU; **všechny hodinky pojištěné na plnou hodnotu**;
„odesláno“ až při předání dopravci; ochrana proti dvojímu prodeji i mimo e-shop.

## 1. Platby

| Možnost | Pro zákazníka | Náklad ateliéru |
|---|---|---|
| Bankovní převod v Kč s QR (výchozí) | zdarma | 0 Kč |
| Bankovní převod v EUR s QR kódem SEPA | zdarma | příchozí SEPA platba 5 Kč (ceník ČS) + kurzový rozdíl banky při převodu na Kč |
| Karta Visa / Mastercard / Apple Pay / Google Pay (Stripe) | zdarma, **strhává se vždy v Kč** | 1,5 % + 6,50 Kč (evropské karty), prémiové 1,9 % + 6,50 Kč |
| Dobírka (ČR: Zásilkovna výdejní místo i adresa, Balíkovna) | příplatek dle Nastavení | poplatek dopravce |

Stripe nemá měsíční ani aktivační poplatek. V pokladně se posílá jen typ platby `card` (Apple Pay a Google Pay
jsou karetní peněženky) – PayPal, Link ani jiné metody se nezobrazí. Kód nepoužívá placené doplňky
(Stripe Tax, Stripe Invoicing, Billing, Radar for Fraud Teams).

**Poplatky v Dante Time OS:** po potvrzení platby se skutečný poplatek ze Stripe zapíše jako náklad
„Poplatky“ u prodaných hodinek (u více kusů podle ceny). Když ho Stripe hned neuvádí, doplní se při hodinové kontrole.

### Platby v EUR – nejlevnější řešení bez paušálu
- **Karta:** Stripe účtuje +2 % za převod měny, pokud se platba v EUR vyplácí na korunový účet. Druhá možnost –
  eurový účet a vyplácení v EUR – vyžaduje eurový bankovní účet (u ČS zpravidla s měsíčním poplatkem) a Stripe za
  vypořádání v jiné než hlavní měně také účtuje poplatek. **Proto se karta vždy strhává v Kč**: ateliér platí jen
  1,5 % + 6,50 Kč, přepočet udělá banka zákazníka.
- **Převod v EUR (SEPA QR):** zůstává; ateliér platí 5 Kč za příchozí SEPA platbu a kurzový rozdíl banky. Cena v EUR
  se zaokrouhluje nahoru na celé euro, což rozdíl obvykle pokryje.

## 2. Doprava a pojištění na plnou hodnotu (zjednodušeno, R25)

Vše se nastavuje v administraci → Dopravci. Bez nových firemních smluv, bez měsíčních poplatků a minimálních odběrů.
Přehled limitů a co zákazník uvidí: `docs/DOPRAVCI.md`.

| Hodnota hodinek | ČR | Slovensko a EU |
|---|---|---|
| do 5 000 Kč | Zásilkovna, Balíkovna, Cenná zásilka, osobně | Zásilkovna (Packeta) |
| 5 000–20 000 Kč (běžné PRIM, OMEGA) | Zásilkovna (i dobírka), Cenná zásilka, osobně | Packeta do 700 € (cca 17 000 Kč) |
| nad 20 000 Kč (Rolex) | Cenná zásilka České pošty (platba předem), osobně | po domluvě (osobně) |

**Odeslání:** vytvoření štítku objednávku neoznačí. Každou hodinu se u Zásilkovny a České pošty ověří, zda dopravce
zásilku převzal; teprve pak se objednávka označí „odesláno“ a zákazník dostane e-mail se sledovacím číslem.
Ručně: tlačítko „Předáno dopravci – informovat zákazníka“.

## 3. Ochrana proti dvojímu prodeji
- e-shop: rezervace kusu v jedné transakci; karta jde zaplatit jen do konce rezervace; pozdní platba po prodeji
  jinému se neoznačí a majitel dostane e-mail „Vrátit platbu“,
- ruční faktura v administraci: kus se zabere dřív, než vznikne doklad; kus rezervovaný e-shopem nejde prodat,
- zálohová faktura na hodinky: kus se „rezervuje osobně“ a e-shop ho nikomu jinému neprodá; storno zálohy ho uvolní,
- ruční zápis prodeje (Nákupy a prodeje) a změna stavu hodinek: jen pokud kus mezitím nerezervovala objednávka,
- nový stav hodinek „Rezervováno osobně“ pro domluvený prodej mimo e-shop.

## 4. Aktivace Stripe – co udělá majitel
1. Účet na stripe.com (zdarma), země Česko, typ účtu fyzická osoba podnikatel; zatím jen **testovací režim**.
2. Developers → API keys: zkopírovat **testovací** Secret key (`sk_test_…`) do Cloudflare jako Secret `STRIPE_SECRET_KEY`.
3. Developers → Webhooks: koncový bod `https://atelier-dante-time.cz/api/payments/stripe`, události
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`; jeho Signing secret (`whsec_…`) do Cloudflare jako Secret `STRIPE_WEBHOOK_SECRET`.
4. Proměnná `PAYMENT_GATEWAY` = `stripe` (běžná proměnná, ne tajná).
5. Zkušební nákup testovací kartou 4242 4242 4242 4242 → objednávka se sama označí zaplacená, přijde faktura,
   v ekonomice hodinek se objeví poplatek.
6. Ve Stripe dokončit ověření (doklad totožnosti, podnikatelský účet CZ76 0800 0000 0070 5891 9329), Settings →
   Payment methods: zapnuté jen Cards, Apple Pay, Google Pay; nezapínat Stripe Tax, Invoicing, Billing ani Radar for Fraud Teams.
7. Ostrý provoz: ostrý Secret key (`sk_live_…`) a ostrý webhook secret místo testovacích + proměnná `PAYMENTS_LIVE` = `true`.
Pojistka v kódu: ostrý klíč bez `PAYMENTS_LIVE=true` se zákazníkům nezobrazí a naopak.
