// Sestaví týdenní přehled a založí ho jako GitHub issue.
const fs = require('fs');

const LABEL = 'týdenní-přehled';
const TIER_LABELS = { 'úroveň-1': '🟢', 'úroveň-2': '🟡', 'úroveň-3': '🔴' };

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / 86400000 + 1) / 7) };
}

const fmtDate = (d) => new Date(d).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });
const pct = (v) => (v == null ? null : Math.round(v * 100));

module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86400000);
  const sinceDay = since.toISOString().slice(0, 10);
  const { year, week } = isoWeek(now);

  try { await github.rest.issues.createLabel({ owner, repo, name: LABEL, color: 'c8a24a', description: 'Automatický týdenní přehled' }); }
  catch (e) { if (e.status !== 422) throw e; }

  // Minulý přehled (kvůli srovnání čísel)
  const previous = await github.rest.issues.listForRepo({ owner, repo, labels: LABEL, state: 'all', per_page: 1 });
  const prevIssue = previous.data[0];
  const prevData = (() => {
    const m = prevIssue?.body?.match(/<!-- data:(\{.*?\}) -->/);
    try { return m ? JSON.parse(m[1]) : {}; } catch { return {}; }
  })();

  // 1) Publikované změny (sloučené pull requesty)
  const merged = await github.paginate(github.rest.search.issuesAndPullRequests,
    { q: `repo:${owner}/${repo} is:pr is:merged merged:>=${sinceDay}`, per_page: 100 });
  const tierOf = (pr) => {
    const names = pr.labels.map(l => l.name);
    for (const t of ['úroveň-3', 'úroveň-2', 'úroveň-1']) if (names.includes(t)) return TIER_LABELS[t];
    return '⚪';
  };

  // 2) Čeká na schválení
  const waiting = await github.paginate(github.rest.search.issuesAndPullRequests,
    { q: `repo:${owner}/${repo} is:pr is:open`, per_page: 100 });

  // 3) Verze (značky publikace)
  const releases = (await github.rest.repos.listReleases({ owner, repo, per_page: 50 })).data
    .filter(r => new Date(r.created_at) >= since);

  // 4) Výpadky
  const outages = await github.paginate(github.rest.search.issuesAndPullRequests,
    { q: `repo:${owner}/${repo} is:issue label:"výpadek" created:>=${sinceDay}`, per_page: 100 });
  let downMinutes = 0;
  for (const o of outages) {
    const end = o.closed_at ? new Date(o.closed_at) : now;
    downMinutes += Math.max(60, (end - new Date(o.created_at)) / 60000);
  }
  const uptime = Math.max(0, 100 - (downMinutes / (7 * 24 * 60)) * 100);

  // 5) Lighthouse ostrého webu
  const lh = {};
  for (const name of ['index', 'services']) {
    const r = readJson(`prehled/lh-${name}.json`);
    if (r?.categories) lh[name] = {
      perf: pct(r.categories.performance?.score), a11y: pct(r.categories.accessibility?.score),
      bp: pct(r.categories['best-practices']?.score), seo: pct(r.categories.seo?.score),
      kb: Math.round((r.audits['total-byte-weight']?.numericValue || 0) / 1024),
    };
  }
  const diff = (cur, prev) => (cur == null || prev == null || cur === prev ? '' : cur > prev ? ` (▲ ${cur - prev})` : ` (▼ ${prev - cur})`);

  // 6) Nefunkční odkazy
  const links = readJson('prehled/odkazy.json');
  const broken = [];
  if (links?.error_map) {
    for (const [page, errs] of Object.entries(links.error_map))
      for (const e of errs) broken.push(`${e.url} (na stránce ${page}: ${e.status?.text || e.status?.code || 'chyba'})`);
  }

  // --- Sestavení textu ---
  const L = [];
  L.push(`Přehled za **${fmtDate(since)} – ${fmtDate(now)}**.`, '');

  L.push('## 📦 Publikované změny', '');
  if (merged.length === 0) L.push('Tento týden se na web nic nepublikovalo.');
  else {
    L.push('🟢 úroveň 1 · 🟡 úroveň 2 · 🔴 úroveň 3 · ⚪ neurčeno', '');
    for (const pr of merged) L.push(`- ${tierOf(pr)} [#${pr.number}](${pr.html_url}) ${pr.title}`);
  }
  if (releases.length) {
    L.push('', `Nové verze webu (${releases.length}): ` + releases.map(r => `[${r.tag_name}](${r.html_url})`).join(', '));
  }
  L.push('');

  L.push('## ⏳ Čeká na vaše schválení', '');
  if (waiting.length === 0) L.push('Nic nečeká. 👍');
  else for (const pr of waiting) L.push(`- [#${pr.number}](${pr.html_url}) ${pr.title}, otevřeno ${fmtDate(pr.created_at)}`);
  L.push('');

  L.push('## 🌐 Dostupnost webu', '');
  L.push(outages.length === 0
    ? `**${uptime.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %**: žádný výpadek nebyl zaznamenán.`
    : `**${uptime.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %**: zaznamenané výpadky (${outages.length}): ` + outages.map(o => `[#${o.number}](${o.html_url})`).join(', '));
  L.push('');

  L.push('## ⚡ Rychlost a SEO ostrého webu (Lighthouse, mobil)', '');
  if (Object.keys(lh).length === 0) L.push('Měření se tento týden nepodařilo spustit.');
  else {
    L.push('| Stránka | Výkon | Přístupnost | Správné postupy | SEO | Velikost |', '|---|---|---|---|---|---|');
    for (const [name, v] of Object.entries(lh)) {
      const p = prevData.lh?.[name] || {};
      L.push(`| ${name === 'index' ? 'Hlavní stránka' : 'Služby'} | ${v.perf}${diff(v.perf, p.perf)} | ${v.a11y}${diff(v.a11y, p.a11y)} | ${v.bp}${diff(v.bp, p.bp)} | ${v.seo}${diff(v.seo, p.seo)} | ${v.kb} kB |`);
    }
    L.push('', '_Šipky ukazují změnu oproti minulému týdnu._');
  }
  L.push('');

  L.push('## 🔗 Odkazy', '');
  if (!links) L.push('Kontrola odkazů se tento týden nepodařila.');
  else if (broken.length === 0) L.push('Všechny odkazy fungují. ✅');
  else { L.push(`Nefunkční odkazy (${broken.length}):`, ''); for (const b of broken.slice(0, 20)) L.push(`- ${b}`); }
  L.push('');

  // Doporučení
  const tips = [];
  if (waiting.length) tips.push(`Projděte ${waiting.length === 1 ? 'čekající pull request' : `čekající pull requesty (${waiting.length})`}.`);
  for (const [name, v] of Object.entries(lh)) {
    if (v.perf != null && v.perf < 90) tips.push(`Rychlost stránky ${name} klesla pod 90: agent může připravit optimalizaci (úroveň 1).`);
    if (v.seo != null && v.seo < 95) tips.push(`SEO stránky ${name} je pod 95: agent může doplnit chybějící značky (úroveň 1).`);
  }
  if (broken.length) tips.push('Opravit nefunkční odkazy (úroveň 1).');
  if (outages.length) tips.push('Prověřit příčinu výpadků.');
  L.push('## 💡 Doporučení na další týden', '');
  L.push(tips.length ? tips.map(t => `- ${t}`).join('\n') : '- Vše v pořádku, žádná akce není potřeba.');
  L.push('', '---', '_Tento přehled vytvořila automatická akce „Týdenní přehled“. Pravidla jsou v AGENTS.md._');
  L.push(`<!-- data:${JSON.stringify({ lh })} -->`);

  const issue = await github.rest.issues.create({
    owner, repo, labels: [LABEL],
    title: `📋 Týdenní přehled ${year}-W${String(week).padStart(2, '0')}`,
    body: L.join('\n'),
  });
  core.notice(`Přehled vytvořen: ${issue.data.html_url}`);

  // Starý přehled uzavřít, ať je v issues pořádek
  if (prevIssue && prevIssue.state === 'open') {
    await github.rest.issues.update({ owner, repo, issue_number: prevIssue.number, state: 'closed', state_reason: 'completed' });
  }
};
