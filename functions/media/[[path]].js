// Fotografie a videa hodinek z úložiště (KV nebo R2). Videa podporují Range (Safari to vyžaduje).
import { media } from '../../server/media.js';
export const onRequestGet = async ({ env, params, request }) => {
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join('/');
  if (!/^(products\/[a-z0-9]+|catalog\/[a-z0-9-]+)\/[a-z0-9-]+\.(jpg|webp|mp4)$/.test(key)) return new Response('Nenalezeno', { status: 404 });
  const obj = await media(env).get(key);
  if (!obj) return new Response('Nenalezeno', { status: 404 });
  const type = obj.type || (key.endsWith('.webp') ? 'image/webp' : key.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
  const headers = { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
  if (!key.endsWith('.mp4')) return new Response(obj.body, { headers });
  const buf = new Uint8Array(await new Response(obj.body).arrayBuffer());
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!m) return new Response(buf, { headers: { ...headers, 'Content-Length': String(buf.length) } });
  let start = m[1] === '' ? Math.max(0, buf.length - Number(m[2])) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
  if (start > end || start >= buf.length) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${buf.length}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': String(end - start + 1) } });
};
