// Kontrola vstupů z formulářů
import { HttpError } from './http.js';

export const str = (v, { max = 500, required = false, name = 'pole' } = {}) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) throw new HttpError(`Vyplňte prosím ${name}`);
  if (s.length > max) throw new HttpError(`Pole ${name} je příliš dlouhé`);
  return s || null;
};

export const email = (v) => {
  const s = str(v, { max: 200, required: true, name: 'e-mail' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new HttpError('Zadejte platný e-mail');
  return s.toLowerCase();
};

export const oneOf = (v, list, name) => {
  if (!list.includes(v)) throw new HttpError(`Neplatná hodnota: ${name}`);
  return v;
};

export const int = (v, { min = 0, max = 100000000, name = 'číslo', nullable = true } = {}) => {
  if ((v === '' || v == null) && nullable) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(`Neplatné ${name}`);
  return n;
};

export const num = (v, { min = 0, max = 1000, name = 'číslo' } = {}) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(`Neplatné ${name}`);
  return n;
};

/** Pole „website“ je past na roboty: člověk ho nevidí a nevyplní. */
export const isBot = (body) => typeof body?.website === 'string' && body.website.trim() !== '';
