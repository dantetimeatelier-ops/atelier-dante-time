// Veřejná stránka digitálního pasu (/pas/<kód>, /en/passport/<kód>)
import { page } from './render.js';
import { publicData, publicBody } from './passport.js';
import { rateLimit } from './db.js';
import { clientIp } from './http.js';

export async function renderPassport({ env, request, params }, lang) {
  const code = String(params.code || '').toUpperCase();
  const path = lang === 'en' ? `/en/passport/${code}` : `/pas/${code}`;
  const alternate = lang === 'en' ? `/pas/${code}` : `/en/passport/${code}`;
  // Ochrana proti hádání kódů
  const limited = await rateLimit(env, `pas:${clientIp(request)}`, 60, 10).then(() => false, () => true);
  const data = limited ? null : await publicData(env, code);
  if (!data) {
    return page(env, { lang, title: lang === 'en' ? 'Passport not found' : 'Pas nenalezen', description: '', path, noindex: true,
      body: `<section class="section"><div class="wrap passport"><h1>${lang === 'en' ? 'Passport not found' : 'Pas nenalezen'}</h1><p class="passport-status void">${lang === 'en' ? 'No watch passport exists under this code. Please check the code or contact us.' : 'Pod tímto kódem neexistuje žádný pas hodinek. Zkontrolujte kód nebo nás kontaktujte.'}</p></div></section>` }, 404, 'no-store');
  }
  const title = lang === 'en' ? `Watch passport – ${data.p.title}` : `Pas hodinek – ${data.p.title}`;
  return page(env, { lang, title, description: lang === 'en' ? 'Verification of a watch passport issued by Atelier Dante Time.' : 'Ověření digitálního pasu hodinek vystaveného ateliérem Dante Time.', path, alternate, noindex: true, body: publicBody(data, lang) }, 200, 'no-store');
}
