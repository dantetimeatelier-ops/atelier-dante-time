// Správa souhlasu s cookies (bez externích služeb).
// Web nyní používá jen nezbytné úložiště. Volitelné kategorie jsou vypnuté
// a bez souhlasu se nikdy nespustí. Volbu ukládá do localStorage (dt_consent, 12 měsíců).
(function () {
  var KEY = 'dt_consent', MAX = 365 * 24 * 3600 * 1000;
  var en = document.documentElement.lang === 'en';
  var T = en
    ? { title: 'Cookie settings', text: 'We only use storage strictly necessary for the cart and the website to work. We use no analytics or marketing cookies; the optional categories stay off unless you allow them.', nec: 'Necessary (always on) – cart, this choice', an: 'Analytics (currently not used)', mk: 'Marketing (currently not used)', save: 'Save choice', all: 'Allow all', rej: 'Necessary only', more: 'Cookie policy', href: '/en/cookies' }
    : { title: 'Nastavení cookies', text: 'Používáme jen úložiště nezbytné pro košík a fungování webu. Analytické ani marketingové cookies nepoužíváme; volitelné kategorie zůstávají vypnuté, dokud je nepovolíte.', nec: 'Nezbytné (vždy zapnuté) – košík, tato volba', an: 'Analytické (zatím nepoužíváme)', mk: 'Marketingové (zatím nepoužíváme)', save: 'Uložit volbu', all: 'Povolit vše', rej: 'Jen nezbytné', more: 'Zásady cookies', href: '/cookies' };

  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Date.now() - v.at < MAX ? v : null; } catch (e) { return null; } }
  function write(an, mk) {
    var v = { necessary: true, analytics: !!an, marketing: !!mk, at: Date.now(), v: 1 };
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('dt:consent', { detail: v }));
  }
  window.dtConsent = function () { return read() || { necessary: true, analytics: false, marketing: false }; };

  var box;
  function close() { if (box) { box.remove(); box = null; } }
  function open() {
    close();
    var c = window.dtConsent();
    box = document.createElement('div');
    box.className = 'consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'false'); box.setAttribute('aria-labelledby', 'consent-title');
    box.innerHTML = '<h2 id="consent-title">' + T.title + '</h2><p>' + T.text + ' <a href="' + T.href + '">' + T.more + '</a></p>' +
      '<label><input type="checkbox" checked disabled> ' + T.nec + '</label>' +
      '<label><input type="checkbox" data-c="an"' + (c.analytics ? ' checked' : '') + '> ' + T.an + '</label>' +
      '<label><input type="checkbox" data-c="mk"' + (c.marketing ? ' checked' : '') + '> ' + T.mk + '</label>' +
      '<div class="row"><button type="button" class="btn" data-a="rej">' + T.rej + '</button><button type="button" class="btn ghost" data-a="save">' + T.save + '</button><button type="button" class="btn ghost" data-a="all">' + T.all + '</button></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'rej') write(false, false);
      if (a === 'all') write(true, true);
      if (a === 'save') write(box.querySelector('[data-c=an]').checked, box.querySelector('[data-c=mk]').checked);
      close();
    });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    var first = box.querySelector('[data-a=rej]'); if (first) first.focus();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-consent-open]');
    if (t) { e.preventDefault(); open(); }
  });
  // Dokud nepoužíváme volitelné cookies, lištu automaticky neukazujeme (není důvod obtěžovat).
  // Jakmile se zavede volitelná služba, nastaví se <html data-consent-required> a lišta se zobrazí při první návštěvě.
  if (document.documentElement.hasAttribute('data-consent-required') && !read()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open); else open();
  }
})();
