// Fakturace – čisté výpočty (bez databáze), sdílené serverem, administrací a testy.
export const INVOICE_KINDS = { faktura: 'Faktura', zalohova: 'Zálohová faktura', dobropis: 'Opravný doklad (dobropis)' };
export const SALE_CHANNELS = { eshop: 'E-shop', vinted: 'Vinted', aukro: 'Aukro', instagram: 'Instagram', facebook: 'Facebook', osobne: 'Osobní prodej', zakazka: 'Zakázka / renovace', jine: 'Jiný kanál' };
export const INVOICE_PAY = { bank_transfer: 'Bankovní převod', cash: 'Hotově', card: 'Platební karta', cod: 'Dobírka' };

/** Číslo dokladu nové řady: DT-RRRR-NNNN. */
export const invoiceNumber = (year, seq) => `DT-${year}-${String(seq).padStart(4, '0')}`;
/** Variabilní symbol (jen číslice, max. 10): RRRRNNNN. */
export const invoiceVs = (year, seq) => `${year}${String(seq).padStart(4, '0')}`;
/** Rok dokladu podle data vystavení v čase Prahy. */
export const pragueYear = (iso = new Date().toISOString()) => Number(new Date(iso).toLocaleString('en-CA', { timeZone: 'Europe/Prague', year: 'numeric' }));

/** Položky: { text, qty, price } – price = cena za kus v Kč (celé číslo, může být záporná u slevy/dobropisu). */
export function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((i) => ({
    text: String(i?.text ?? '').trim().slice(0, 300),
    qty: Number.isInteger(Number(i?.qty)) && Number(i.qty) > 0 ? Number(i.qty) : 1,
    price: Number(i?.price),
  })).filter((i) => i.text && Number.isInteger(i.price));
}

/** Součty: mezisoučet = celkem; k úhradě = celkem − odečtená záloha. */
export function invoiceTotals(items, advanceDeducted = 0) {
  const list = normalizeItems(items);
  const total = list.reduce((s, i) => s + i.qty * i.price, 0);
  const adv = Math.max(0, Math.round(Number(advanceDeducted) || 0));
  return { items: list, total, advance: adv, due: total - adv };
}
