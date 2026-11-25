import { json, handle } from '../../server/http.js';
import { shopConfig } from '../../server/orders.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const u = new URL(request.url);
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'cs';
  const country = (u.searchParams.get('country') || 'CZ').toUpperCase();
  const itemsTotal = Math.max(0, Math.min(Number(u.searchParams.get('total')) || 0, 1e9));
  const c = await shopConfig(env, lang, { country, itemsTotal });
  return json({ mode: c.mode, country: c.country, insuredOnly: c.insuredOnly, shipping: c.shipping, payment: c.payment, currencies: c.currencies, eurRate: c.eurRate, packetaKey: c.packetaKey });
});
