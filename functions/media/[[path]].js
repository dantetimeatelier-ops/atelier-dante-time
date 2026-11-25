// Fotografie hodinek z úložiště R2
export const onRequestGet = async ({ env, params }) => {
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join('/');
  if (!/^products\/[a-z0-9]+\/[a-z0-9-]+\.(jpg|webp)$/.test(key)) return new Response('Nenalezeno', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Nenalezeno', { status: 404 });
  return new Response(obj.body, { headers: {
    'Content-Type': obj.httpMetadata?.contentType || (key.endsWith('.webp') ? 'image/webp' : 'image/jpeg'),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  } });
};
