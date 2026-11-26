// Přihlášení do administrace: heslo (PBKDF2) + jednorázový kód (TOTP, RFC 6238)
import { HttpError, clientIp } from './http.js';
import { randomToken, sha256Hex, now } from './db.js';

const ITER = 100000; // maximum podporované v prostředí Cloudflare Workers
const COOKIE = '__Host-dt_admin';
const SESSION_DAYS = 30;
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPassword(password, saltB64 = b64(crypto.getRandomValues(new Uint8Array(16))), iterations = ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations }, key, 256);
  return { hash: b64(bits), salt: saltB64, iterations };
}

export function timingSafeEqual(a, b) {
  const x = enc.encode(String(a)); const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

// --- TOTP -------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes) {
  let bits = 0; let value = 0; let out = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s) {
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const c of clean) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

export async function totpCode(secret, step) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); new DataView(msg).setUint32(4, step);
  new DataView(msg).setUint32(0, Math.floor(step / 2 ** 32));
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

/** Vrátí krok, ve kterém kód platí (±1 krok = ±30 s), nebo null. */
export async function verifyTotp(secret, code, at = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const step = Math.floor(at / 30000);
  for (const s of [step, step - 1, step + 1]) if (timingSafeEqual(await totpCode(secret, s), code)) return s;
  return null;
}

export const otpauthUrl = (secret, email) =>
  `otpauth://totp/${encodeURIComponent(`Dante Time:${email}`)}?secret=${secret}&issuer=${encodeURIComponent('Dante Time')}&algorithm=SHA1&digits=6&period=30`;

// --- Relace -------------------------------------------------------------------
const readCookie = (request) => (request.headers.get('Cookie') || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === COOKIE)?.[1];

export async function createSession(env, userId, request) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, expires, (request.headers.get('User-Agent') || '').slice(0, 200)).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function destroySession(env, request) {
  const token = readCookie(request);
  if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function requireAdmin(env, request) {
  const token = readCookie(request);
  if (!token || !/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new HttpError('Nepřihlášeno', 401);
  const row = await env.DB.prepare(`SELECT u.id, u.email FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await sha256Hex(token), now()).first();
  if (!row) throw new HttpError('Přihlášení vypršelo', 401);
  // Mutující požadavky musí nést vlastní hlavičku (další ochrana proti CSRF)
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('X-DT-Admin') !== '1') throw new HttpError('Chybí ochranná hlavička', 403);
  return row;
}

/** Omezení pokusů o přihlášení: 5 neúspěšných za 15 minut z jedné adresy. */
export async function checkLoginRate(env, request) {
  const ip = clientIp(request);
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(new Date(Date.now() - 30 * 86400000).toISOString()).run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ok = 0 AND at > ?')
    .bind(ip, new Date(Date.now() - 15 * 60000).toISOString()).first();
  if (row.n >= 5) throw new HttpError('Příliš mnoho neúspěšných pokusů. Zkuste to za 15 minut.', 429);
  return ip;
}
export const recordLogin = (env, ip, ok) => env.DB.prepare('INSERT INTO login_attempts (ip, ok) VALUES (?, ?)').bind(ip, ok ? 1 : 0).run();
