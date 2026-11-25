# Integrace – stav a aktivace

Všechny integrace jsou **připravené, ale vypnuté**. Zapínají se nastavením
tajných hodnot v Cloudflare (projekt → Settings → Variables and Secrets).
Ostré platby navíc vyžadují `SHOP_MODE=live` **a** `PAYMENTS_LIVE=true`.
To nastavuje **jen majitel**.

| Integrace | Stav | Co je potřeba | Náklady |
|---|---|---|---|
| **Bankovní převod s QR platbou** | ✅ hotovo, otestováno | IBAN a číslo účtu (`src/site.mjs` nebo `SHOP_IBAN`, `SHOP_ACCOUNT`) | 0 Kč |
| **Faktura** (stránka k tisku / PDF) | ✅ hotovo, otestováno | údaje provozovatele, režim DPH | 0 Kč |
| **E-maily** (potvrzení, platba, odeslání, odstoupení, poptávky) | ✅ hotovo, bez poskytovatele se jen ukládají do administrace | účet **Resend** (free 3 000 e-mailů/měsíc), ověření domény v DNS, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | 0 Kč (free) |
| **Zásilkovna – výběr výdejního místa** | ⚠️ připraveno (widget v6), neověřeno naostro | účet Zásilkovny, API klíč do `PACKETA_API_KEY`. Bez klíče zákazník místo napíše ručně. | poplatky za zásilky dle ceníku |
| **Zásilkovna – podání zásilky** | ⏳ nedokončeno | zatím ručně v klientské sekci Zásilkovny (číslo zásilky se zadá v administraci) | – |
| **Balíkovna – výběr místa** | ⏳ nedokončeno | zákazník zadá výdejní místo ručně. Widget České pošty ověřit při aktivaci smluvního účtu. | dle ceníku |
| **Platební brána (karta)** | ⚠️ připraveno pro Comgate (API v1.0), neověřeno | smlouva s Comgate, `COMGATE_MERCHANT`, `COMGATE_SECRET`, v portálu Comgate nastavit URL oznámení `https://atelier-dante-time.cz/api/payments/comgate`. **Před aktivací ověřit aktuální verzi API.** | ~1–2 % z platby (dle smlouvy) 💰 |
| **Účetní systém (Fakturoid, iDoklad)** | ⏳ nedokončeno | po výběru služby přidat export | dle tarifu 💰 |
| **Automatické popisy pomocí AI** | ⏳ jen šablona bez AI | popisy se skládají z parametrů. Napojení na AI by bylo placené. | – |

## Bezpečnost tajných hodnot
- Tajné hodnoty nikdy nepatří do repozitáře ani do chatu.
- V Cloudflare je zadávejte jako typ **Secret** (po uložení nejsou vidět).
- Platební brána vždy začíná v testovacím režimu. Ostrý provoz zapíná
  jen majitel.
