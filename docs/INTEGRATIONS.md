# Integrace – stav a aktivace

Všechny integrace jsou **připravené, ale vypnuté**. Zapínají se nastavením
tajných hodnot v Cloudflare (projekt → Settings → Variables and Secrets).
Ostré platby navíc vyžadují `SHOP_MODE=live` **a** `PAYMENTS_LIVE=true`.
To nastavuje **jen majitel**.

| Integrace | Stav | Co je potřeba | Náklady |
|---|---|---|---|
| **Bankovní převod s QR platbou** | ✅ hotovo, otestováno | IBAN a číslo účtu – jediné místo: `src/site.mjs` (OPERATOR); objednávky a faktury si účet ukládají | 0 Kč |
| **Faktury z administrace** (objednávky automaticky, zakázky a ruční faktury, storno, úhrada; tisk / PDF) | ✅ hotovo, otestováno, bez externího systému | údaje provozovatele, režim DPH | 0 Kč |
| **Dobírka** (příplatek, rezervace do odeslání, faktura po zaplacení) | ✅ hotovo, otestováno | zapnout v administraci → Nastavení | dle ceníku dopravce |
| **E-maily** (potvrzení, platba, odeslání, odstoupení, poptávky) | ✅ hotovo, bez poskytovatele se jen ukládají do administrace | účet **Resend** (free 3 000 e-mailů/měsíc), ověření domény v DNS, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | 0 Kč (free) |
| **Zásilkovna – výběr výdejního místa** | ⚠️ připraveno (widget v6), neověřeno naostro | bezplatný účet Zásilkovny a API klíč do `PACKETA_API_KEY`. Bez klíče zákazník dostane odkaz na mapu poboček a místo napíše. | poplatky za zásilky dle ceníku |
| **Zásilkovna – sledování zásilek** | ✅ připraveno (DT Logistics, denně + tlačítko v objednávce) | tajný klíč `PACKETA_API_PASSWORD` (API heslo). Číslo zásilky ve tvaru Z + 10 číslic. Doručení jen hlásí – převzetí potvrzuje majitel. | zdarma |
| **Zásilkovna – podání zásilky** | ⏳ nedokončeno | zatím ručně v klientské sekci Zásilkovny (číslo zásilky se zadá v administraci) | – |
| **Balíkovna – výběr místa na mapě** | ✅ hotovo (oficiální okno České pošty, bez klíče), otestováno s náhradou okna | naostro ověřit na zkušební verzi | dle ceníku |
| **Platební brána (karta)** | ⚠️ připraveno pro Comgate (API v1.0), neověřeno | smlouva s Comgate, `COMGATE_MERCHANT`, `COMGATE_SECRET`, v portálu Comgate nastavit URL oznámení `https://atelier-dante-time.cz/api/payments/comgate`. **Před aktivací ověřit aktuální verzi API.** | ~1–2 % z platby (dle smlouvy) 💰 |
| **Externí účetní systém** | ⏸ nezaváděn (rozhodnutí majitele) | faktury vystavuje přímo administrace | – |
| **Automatické popisy pomocí AI** | ⏳ jen šablona bez AI | popisy se skládají z parametrů. Napojení na AI by bylo placené. | – |

## Bezpečnost tajných hodnot
- Tajné hodnoty nikdy nepatří do repozitáře ani do chatu.
- V Cloudflare je zadávejte jako typ **Secret** (po uložení nejsou vidět).
- Platební brána vždy začíná v testovacím režimu. Ostrý provoz zapíná
  jen majitel.
