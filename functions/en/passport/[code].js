import { handle } from '../../../server/http.js';
import { renderPassport } from '../../../server/passport-page.js';
export const onRequestGet = handle((ctx) => renderPassport(ctx, 'en'));
