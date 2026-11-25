// Fotografie hodinek z úložiště (KV nebo R2)
import { media } from '../../server/media.js';
export const onRequestGet = async ({ env, params }) => {
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join('/');
  if (!/^(products\/[a-z0-9]+|catalog\/[a-z0-9-]+)\/[a-z0-9-]+\.(jpg|webp)$/.test(key)) return new Response('Nenalezeno', { status: 404 });
  const obj = await media(env).get(key);
  if (!obj) return new Response('Nenalezeno', { status: 404 });
  return new Response(obj.body, { headers: {
    'Content-Type': obj.type || (key.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
};
