// Vykreslení dynamických stránek ve stejném vzhledu jako statické
import { layout } from '../src/layout.mjs';
import { html } from './http.js';
import { mode } from './db.js';
import { SHOP_BANNER } from '../src/shop/views.mjs';

export function page(env, o, status = 200, cache = 'public, max-age=60') {
  const m = mode(env);
  return html(layout({ shop: m !== 'preview', banner: SHOP_BANNER[m], ...o }), status, { 'Cache-Control': cache });
}
