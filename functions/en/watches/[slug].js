import { handle } from '../../../server/http.js';
import { renderProduct } from '../../../server/catalog.js';
export const onRequestGet = handle((ctx) => renderProduct(ctx, 'en'));
