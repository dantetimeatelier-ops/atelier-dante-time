// QR Platba (formát SPD 1.0, standard České bankovní asociace)
// https://qr-platba.cz/pro-vyvojare/specifikace-formatu/

const clean = (s, max) => String(s ?? '').replace(/\*/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').slice(0, max);

/** Kontrola IBAN (ISO 13616, modulo 97) */
export function isValidIban(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let mod = 0;
  for (const ch of r) mod = (mod * 10 + Number(ch)) % 97;
  return mod === 1;
}

/**
 * @param {{iban:string, amount:number, vs:string, message?:string, recipient?:string}} p
 */
export function spdString({ iban, amount, vs, message, recipient }) {
  const acc = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!isValidIban(acc)) throw new Error('Neplatný IBAN');
  if (!/^\d{1,10}$/.test(String(vs))) throw new Error('Neplatný variabilní symbol');
  const parts = ['SPD', '1.0', `ACC:${acc}`, `AM:${Number(amount).toFixed(2)}`, 'CC:CZK', `X-VS:${vs}`];
  if (recipient) parts.push(`RN:${clean(recipient, 35)}`);
  if (message) parts.push(`MSG:${clean(message, 60)}`);
  return parts.join('*');
}
