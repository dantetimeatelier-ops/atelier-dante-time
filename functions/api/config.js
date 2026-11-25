import { json, handle } from '../../server/http.js';
import { shopConfig } from '../../server/orders.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'cs';
  const { mode, shipping, payment, packetaKey } = await shopConfig(env, lang);
  return json({ mode, shipping, payment, packetaKey });
});
