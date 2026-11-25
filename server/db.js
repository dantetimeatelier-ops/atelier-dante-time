// Pomocné funkce pro databázi D1
import { HttpError } from './http.js';

export const now = () => new Date().toISOString();
export const addMinutes = (min) => new Date(Date.now() + min * 60000).toISOString();

export function randomId(bytes = 12) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, bytes * 2);
}
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function mode(env) {
  const m = env.SHOP_MODE || 'preview';
  return ['preview', 'test', 'live'].includes(m) ? m : 'preview';
}

/** Uvolní propadlé rezervace a označí nezaplacené objednávky jako vypršelé. */
export async function releaseExpired(env) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='expired', updated_at=?1, cancelled_at=?1 WHERE status='awaiting_payment' AND reserved_until IS NOT NULL AND reserved_until < ?1").bind(t),
    env.DB.prepare("UPDATE products SET status='available', reserved_order_id=NULL, reserved_until=NULL, updated_at=?1 WHERE status='reserved' AND reserved_until IS NOT NULL AND reserved_until < ?1").bind(t),
  ]);
}

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

/** Atomicky zvýší číselnou řadu a vrátí novou hodnotu. */
export async function nextCounter(env, name) {
  const row = await env.DB.prepare('UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value').bind(name).first();
  if (!row) throw new Error(`Chybí číselná řada ${name}`);
  return row.value;
}

/** Jednoduché omezení počtu požadavků (např. 5 poptávek za hodinu z jedné IP). */
export async function rateLimit(env, bucket, max, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  await env.DB.prepare('DELETE FROM rate_limits WHERE at < ?').bind(new Date(Date.now() - 86400000).toISOString()).run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ? AND at > ?').bind(bucket, since).first();
  if (row.n >= max) throw new HttpError('Příliš mnoho požadavků, zkuste to prosím později', 429);
  await env.DB.prepare('INSERT INTO rate_limits (bucket) VALUES (?)').bind(bucket).run();
}

export async function audit(env, actor, action, entity, entityId, details) {
  await env.DB.prepare('INSERT INTO audit_log (actor, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)')
    .bind(actor, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details).slice(0, 2000) : null).run();
}

export async function productsWithImages(env, where = '1=1', binds = [], order = 'sort_order ASC, published_at DESC', limit = 200) {
  const { results: products } = await env.DB.prepare(`SELECT * FROM products WHERE ${where} ORDER BY ${order} LIMIT ${Number(limit)}`).bind(...binds).all();
  if (!products.length) return [];
  const ids = products.map((p) => p.id);
  const { results: images } = await env.DB.prepare(`SELECT * FROM product_images WHERE product_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order ASC, created_at ASC`).bind(...ids).all();
  for (const p of products) p.images = images.filter((i) => i.product_id === p.id);
  return products;
}
