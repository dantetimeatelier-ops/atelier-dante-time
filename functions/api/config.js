import { json, handle } from '../../server/http.js';
import { shopConfig, cartFacts } from '../../server/orders.js';

export const onRequestGet = handle(async ({ env, request }) => {
  const u = new URL(request.url);
  const lang = u.searchParams.get('lang') === 'en' ? 'en' : 'cs';
  const country = (u.searchParams.get('country') || 'CZ').toUpperCase();
  // Hodnota a materiál pouzder se berou z databáze podle hodinek v košíku (prohlížeči se nevěří)
  const ids = String(u.searchParams.get('items') || '').split(',').map((x) => x.trim()).filter((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 10);
  const facts = ids.length ? await cartFacts(env, ids) : { itemsTotal: Math.max(0, Math.min(Number(u.searchParams.get('total')) || 0, 1e9)), metals: [] };
  const c = await shopConfig(env, lang, { country, itemsTotal: facts.itemsTotal, metals: facts.metals });
  return json({ mode: c.mode, country: c.country, insuredOnly: c.insuredOnly, noCarrier: c.noCarrier, shipping: c.shipping, payment: c.payment, currencies: c.currencies, eurRate: c.eurRate, packetaKey: c.packetaKey });
});
