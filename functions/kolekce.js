import { handle } from '../server/http.js';
import { renderCollection } from '../server/catalog.js';
export const onRequestGet = handle((ctx) => renderCollection(ctx, 'cs'));
