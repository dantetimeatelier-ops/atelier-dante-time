// Opakování platby kartou z odkazu objednávky (např. když zákazník bránu zavřel)
import { json, handle, readJson, assertSameOrigin, clientIp, HttpError } from '../../server/http.js';
import { rateLimit, releaseExpired } from '../../server/db.js';
import { startCardPayment } from '../../server/orders.js';
import { checkoutEnv } from '../../server/auth.js';

export const onRequestPost = handle(async ({ env: baseEnv, request }) => {
  const env = await checkoutEnv(baseEnv, request);
  assertSameOrigin(request);
  const body = await readJson(request);
  await rateLimit(env, `pay:${clientIp(request)}`, 10, 60);
  const token = String(body.token || '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError('Objednávka nenalezena', 404);
  await releaseExpired(env);
  const order = await env.DB.prepare('SELECT * FROM orders WHERE public_token = ?').bind(token).first();
  if (!order) throw new HttpError('Objednávka nenalezena', 404);
  return json({ redirect: await startCardPayment(env, order, new URL(request.url).origin) });
});
