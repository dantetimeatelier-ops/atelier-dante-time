import { json, handle, readJson, assertSameOrigin, clientIp, HttpError } from '../../server/http.js';
import { rateLimit } from '../../server/db.js';
import { isBot } from '../../server/validate.js';
import { createOrder } from '../../server/orders.js';

export const onRequestPost = handle(async ({ env, request }) => {
  assertSameOrigin(request);
  const body = await readJson(request);
  if (isBot(body)) throw new HttpError('Požadavek byl odmítnut', 400);
  await rateLimit(env, `order:${clientIp(request)}`, 10, 60);
  const out = await createOrder(env, body, new URL(request.url).origin);
  return json(out, 201);
});
