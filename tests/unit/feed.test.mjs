// Produktový feed pro Google Merchant Center
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleFeed } from '../../src/shop/feed.mjs';

test('Google feed: jen hodinky v prodeji s cenou a fotkou, správné ceny, dostupnost a escapování', () => {
  const img = (k, media = 'image') => ({ key_large: `${k}-l.webp`, media });
  const xml = googleFeed([
    { id: 'a', slug: 'soleil', status: 'available', title: 'DT – PRIM Classic Soleil LTD.01', brand: 'PRIM', model: 'Classic Soleil LTD.01', kind: 'prestavba', price_czk: 9000, description_cs: 'Ocel & safír <b>', images: [img('v', 'video'), img('1'), img('2')] },
    { id: 'b', slug: 'rez', status: 'reserved', title: 'DT – PRIM X', brand: 'PRIM', price_czk: 12000, images: [img('3')] },
    { id: 'c', slug: 'prodano', status: 'sold', title: 'Prodané', price_czk: 9000, images: [img('4')] },
    { id: 'd', slug: 'bez-ceny', status: 'available', title: 'Bez ceny', price_czk: null, images: [img('5')] },
    { id: 'e', slug: 'bez-fotky', status: 'available', title: 'Bez fotky', price_czk: 9000, images: [img('6', 'video')] },
  ], 'https://atelier-dante-time.cz');
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.match(xml, /<g:price>9000\.00 CZK<\/g:price>/);
  assert.match(xml, /<g:image_link>https:\/\/atelier-dante-time\.cz\/media\/1-l\.webp<\/g:image_link>/);
  assert.match(xml, /<g:additional_image_link>[^<]*2-l\.webp/);
  assert.doesNotMatch(xml, /v-l\.webp/);
  assert.match(xml, /<g:availability>out_of_stock<\/g:availability>/);
  assert.match(xml, /Ocel &amp; safír &lt;b&gt;/);
  assert.match(xml, /<g:link>https:\/\/atelier-dante-time\.cz\/hodinky\/soleil<\/g:link>/);
  assert.doesNotMatch(xml, /Prodané|Bez ceny|Bez fotky/);
  assert.doesNotMatch(xml, /\n\n/);
});
