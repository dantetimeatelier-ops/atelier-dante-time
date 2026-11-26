// Dante Time OS – časovač. Jednou za hodinu zavolá ostrý web (/api/os/tick) s tajným klíčem.
// Veškerá logika je na webu (server/os.js); tento Worker jen „zvoní budíkem“.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(`${env.SITE_ORIGIN}/api/os/tick`, { method: 'POST', headers: { 'X-OS-Key': env.OS_TICK_SECRET, 'Content-Type': 'application/json' }, body: '{}' })
      .then(async (r) => console.log('tick', r.status, (await r.text()).slice(0, 300)))
      .catch((e) => console.error('tick chyba', e.message)));
  },
  async fetch() { return new Response('Dante Time OS – časovač', { status: 200 }); },
};
