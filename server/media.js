// Úložiště fotografií: Workers KV (výchozí, zdarma bez platební karty)
// nebo R2 (volitelně, pokud je v Cloudflare připojeno jako MEDIA).
export function media(env) {
  if (env.MEDIA) {
    return {
      put: (key, data, type) => env.MEDIA.put(key, data, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } }),
      get: async (key) => { const o = await env.MEDIA.get(key); return o ? { body: o.body, type: o.httpMetadata?.contentType } : null; },
      delete: (keys) => env.MEDIA.delete(keys),
    };
  }
  if (env.MEDIA_KV) {
    return {
      put: (key, data, type) => env.MEDIA_KV.put(key, data, { metadata: { type } }),
      get: async (key) => { const o = await env.MEDIA_KV.getWithMetadata(key, { type: 'stream', cacheTtl: 86400 }); return o?.value ? { body: o.value, type: o.metadata?.type } : null; },
      delete: async (keys) => { for (const k of [].concat(keys)) await env.MEDIA_KV.delete(k); },
    };
  }
  throw new Error('Není připojeno úložiště fotografií (MEDIA_KV nebo MEDIA)');
}
