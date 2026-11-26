// Časovač Dante Time OS: volá ho Worker s cron (workers/os-cron) jednou za hodinu.
// Chráněno tajným klíčem OS_TICK_SECRET (hlavička X-OS-Key), jinak 403.
import { json, handle, HttpError } from '../../../server/http.js';
import { timingSafeEqual } from '../../../server/auth.js';
import { tick } from '../../../server/os.js';

export const onRequestPost = handle(async ({ env, request }) => {
  const key = request.headers.get('X-OS-Key') || '';
  if (!env.OS_TICK_SECRET || env.OS_TICK_SECRET.length < 32 || !timingSafeEqual(key, env.OS_TICK_SECRET)) throw new HttpError('Zakázáno', 403);
  return json(await tick(env));
});
