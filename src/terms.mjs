// Centrální obchodní údaje Atelier Dante Time (lhůty, záruka, prohlídky, zálohy).
// ⚖️ ÚROVEŇ 3 – hodnoty mění jen majitel. Používají je právní dokumenty (CZ i EN),
// patička, stránky hodinek, košík a e-maily, takže změna zde se projeví všude.
// Ceny dopravy a dobírky jsou v administraci (Nastavení); zde jsou jen výchozí hodnoty,
// které platí, dokud je majitel v administraci nezmění.
export const TERMS = {
  warrantyMonths: 24,          // dobrovolná záruka za jakost (§ 2113 OZ)
  liabilityMonths: 24,         // zákonná práva z vadného plnění spotřebitele (§ 2165 OZ)
  presumptionMonths: 12,       // vada projevená do 12 měsíců se považuje za existující při převzetí (§ 2161 OZ)
  claimDays: 30,               // zákonná lhůta pro vyřízení reklamace spotřebitele (§ 19 odst. 3 zákona č. 634/1992 Sb.)
  withdrawalDays: 14,          // odstoupení spotřebitele bez udání důvodu (§ 1829 OZ)
  refundDays: 14,              // vrácení plateb po odstoupení (§ 1831 OZ)
  paymentDueDays: 3,           // splatnost převodem
  dispatchWorkingDays: 3,      // odeslání hotových hodinek od platby
  pickupDays: 30,              // převzetí hotové zakázky od oznámení
  accuracyVintage: '±30 s/den', // orientační tolerance chodu vintage hodinek
  deposit: { typical: '20–30 %' }, // záloha u zakázek: jen po individuální dohodě
  // Garanční prohlídka – podmínka dobrovolné záruky ve 2. roce (R18)
  inspection: { enabled: true, afterMonths: 12, toleranceDays: 30, priceCzk: 690, fromVersion: '1.1' }, // varianta A schválena (R18)
  defaultPrices: { zasilkovna: 99, balikovna: 79, cod: 49 },
};

const cz = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const priceCs = (n) => `${cz(n)} Kč`;
export const priceEn = (n) => `CZK ${cz(n)}`;
