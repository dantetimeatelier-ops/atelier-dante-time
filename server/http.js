// Odpovědi serveru se zabezpečovacími hlavičkami
export const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://widget.packeta.com",
  "script-src 'self' https://widget.packeta.com",
  "style-src 'self' 'unsafe-inline' https://widget.packeta.com",
  "frame-src https://widget.packeta.com",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const withHeaders = (headers = {}) => ({ ...SECURITY_HEADERS, ...headers });

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: withHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }) });

export const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: withHeaders({ 'Content-Type': 'text/html; charset=utf-8', ...headers }) });

export const error = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);

export async function readJson(request, maxBytes = 20000) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.includes('application/json')) throw new HttpError('Očekáván formát JSON', 415);
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError('Požadavek je příliš velký', 413);
  try { return JSON.parse(text); } catch { throw new HttpError('Neplatný formát dat', 400); }
}

export class HttpError extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || '0.0.0.0';

/** Obalí handler: chyby HttpError převede na JSON, ostatní zaloguje bez osobních údajů. */
export const handle = (fn) => async (ctx) => {
  try { return await fn(ctx); } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status, e.extra);
    console.error('Chyba serveru:', e?.message);
    return error('Interní chyba serveru', 500);
  }
};

/** Ochrana proti CSRF: mutující požadavky musí přijít ze stejného původu. */
export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  const host = new URL(request.url).origin;
  if (!origin || origin !== host) throw new HttpError('Nepovolený původ požadavku', 403);
}
