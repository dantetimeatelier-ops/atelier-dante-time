// Automatické nasazení na Cloudflare (spouští GitHub Actions po úspěšných testech).
// Samo vytvoří vše potřebné: projekt Pages, databáze D1 (uložené v EU),
// úložiště fotografií KV, strukturu databáze, ukázková data pro zkušební verzi
// a otisk instalačního kódu administrace. Nic placeného neaktivuje.
//
// Potřebné tajné hodnoty (GitHub → Settings → Secrets → Actions):
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ADMIN_SETUP_TOKEN
//
// Použití: node scripts/cf-deploy.mjs <větev>
//   main            → ostrý web (prázdná databáze, SHOP_MODE z proměnné repozitáře, výchozí preview)
//   jakákoli jiná   → zkušební verze s ukázkovými daty (SHOP_MODE=test, neindexuje se)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { demoSql, demoImages } from './demo-data.mjs';
import { loadCatalog, catalogSql, catalogMedia } from './catalog.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROJECT = 'atelier-dante-time';
// Account ID není tajný údaj (jen označuje účet Cloudflare). Slouží jako záloha, když tajná hodnota v GitHubu chybí nebo je chybná.
const KNOWN_ACCOUNT_ID = 'd0ea3159408fb0fd4a8621e5ac201c27';
const branch = process.argv[2];
if (!branch) throw new Error('Chybí název větve');
const production = branch === 'main';
const env = production ? null : 'preview';
const names = production
  ? { d1: 'dante-time', kv: 'dante-time-media', d1Placeholder: '00000000-0000-0000-0000-000000000000', kvPlaceholder: '11111111111111111111111111111111' }
  : { d1: 'dante-time-preview', kv: 'dante-time-media-preview', d1Placeholder: '22222222-2222-2222-2222-222222222222', kvPlaceholder: '33333333333333333333333333333333' };

for (const k of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'ADMIN_SETUP_TOKEN']) {
  if (!process.env[k]) throw new Error(`Chybí tajná hodnota ${k} (docs/CLOUDFLARE-SETUP.md)`);
}
// Odolnost vůči chybám při kopírování z telefonu: mezery, konce řádků, celá adresa dash.cloudflare.com/<ID>/home
for (const k of ['CLOUDFLARE_API_TOKEN', 'ADMIN_SETUP_TOKEN']) process.env[k] = process.env[k].trim();
{
  // Token vložený i s okolním textem (např. „Bearer …“ nebo celý ukázkový příkaz z Cloudflare): vybrat jen samotný token
  const t = process.env.CLOUDFLARE_API_TOKEN;
  if (!/^[A-Za-z0-9_-]{30,}$/.test(t)) {
    const runs = t.match(/cf[a-z]{2}_[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{35,}/g) || [];
    if (runs.length === 1) { process.env.CLOUDFLARE_API_TOKEN = runs[0]; console.log('Token obsahoval navíc jiný text – použije se jen samotný token.'); }
    else console.log(`Pozor: CLOUDFLARE_API_TOKEN nemá tvar tokenu (délka ${t.length}, nalezených kandidátů ${runs.length}).`);
  }
}
{
  const raw = process.env.CLOUDFLARE_ACCOUNT_ID;
  const m = raw.match(/[0-9a-f]{32}/i) || raw.replace(/[\s-]/g, '').match(/^[0-9a-f]{32}$/i);
  if (m) process.env.CLOUDFLARE_ACCOUNT_ID = m[0].toLowerCase();
  else if (KNOWN_ACCOUNT_ID) {
    console.log('Uložené Account ID není platné – použije se Account ID účtu Dante Time uvedené ve skriptu.');
    process.env.CLOUDFLARE_ACCOUNT_ID = KNOWN_ACCOUNT_ID;
  } else {
    // Záloha: zjistit Account ID přímo z Cloudflare podle tokenu (token smí jen do jednoho účtu)
    // Bezpečný popis tvaru hodnoty (bez prozrazení obsahu)
    const shape = [...raw].map((c) => (/[0-9a-f]/i.test(c) ? 'h' : /[a-z]/i.test(c) ? 'p' : /[-/:. _]/.test(c) ? c : '?')).join('').replace(/(h+|p+)/g, (x) => `${x[0]}${x.length}`).slice(0, 80);
    if (/^cf[a-z]{2}_/i.test(raw)) console.log('Pozor: hodnota v CLOUDFLARE_ACCOUNT_ID vypadá jako API token, ne jako Account ID.');
    console.log(`Uložené Account ID není platné (délka ${raw.length}, tvar ${shape}) – zjišťuji ho z Cloudflare podle tokenu.`);
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.log('Odpověď Cloudflare:', JSON.stringify((j.errors || []).map((e) => ({ code: e.code, message: e.message }))));
    const ids = (j.result || []).map((a) => a.id).filter((id) => /^[0-9a-f]{32}$/.test(id));
    if (ids.length !== 1) throw new Error(`Account ID se nepodařilo zjistit (HTTP ${r.status}, nalezeno účtů: ${ids.length}). Zkopírujte ho z dash.cloudflare.com → Workers & Pages → Account details do CLOUDFLARE_ACCOUNT_ID.`);
    process.env.CLOUDFLARE_ACCOUNT_ID = ids[0];
    console.log('Account ID zjištěno z Cloudflare.');
  }
}
if (process.env.ADMIN_SETUP_TOKEN.length < 24) throw new Error('ADMIN_SETUP_TOKEN musí mít alespoň 24 znaků');

const scratch = mkdtempSync(path.join(tmpdir(), 'cf-'));
// Příkazy pro zakládání prostředků běží mimo složku projektu, aby wrangler neměnil konfiguraci
const run = (args, { cwd = ROOT, capture = false } = {}) => {
  const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' };
  const out = execFileSync(path.join(ROOT, 'node_modules', '.bin', 'wrangler'), args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8' });
  return capture ? out : '';
};
const json = (args) => { const out = run([...args, '--json'], { cwd: scratch, capture: true }); return JSON.parse(out.slice(out.indexOf('['))); };
const step = (msg) => console.log(`\n▶ ${msg}`);

// 1) Projekt Pages
step('Projekt Cloudflare Pages');
try { run(['pages', 'project', 'create', PROJECT, '--production-branch', 'main'], { cwd: scratch, capture: true }); console.log('vytvořen'); }
catch (e) { if (/already exists|8000002/i.test(String(e.stdout) + String(e.stderr))) console.log('již existuje'); else throw e; }

// 2) Databáze D1 (v EU)
step(`Databáze ${names.d1}`);
let db = json(['d1', 'list']).find((d) => d.name === names.d1);
if (!db) {
  run(['d1', 'create', names.d1, '--jurisdiction', 'eu'], { cwd: scratch, capture: true });
  db = json(['d1', 'list']).find((d) => d.name === names.d1);
  console.log('vytvořena (EU)');
} else console.log('již existuje');
const dbId = db.uuid || db.id;

// 3) Úložiště fotografií KV
step(`Úložiště fotografií ${names.kv}`);
const kvList = () => { const out = run(['kv', 'namespace', 'list'], { cwd: scratch, capture: true }); return JSON.parse(out.slice(out.indexOf('['))); };
let kv = kvList().find((n) => n.title === names.kv);
if (!kv) {
  run(['kv', 'namespace', 'create', names.kv], { cwd: scratch, capture: true });
  kv = kvList().find((n) => n.title === names.kv || n.title.endsWith(`-${names.kv}`));
  console.log('vytvořeno');
} else console.log('již existuje');
if (!kv) throw new Error('Úložiště KV se nepodařilo najít');

// 4) Doplnění ID do konfigurace (jen v pracovní kopii na serveru GitHubu)
let toml = readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
toml = toml.replace(names.d1Placeholder, dbId).replace(names.kvPlaceholder, kv.id);
writeFileSync(path.join(ROOT, 'wrangler.toml'), toml);

// 5) Struktura databáze
step('Struktura databáze (migrace)');
run(['d1', 'migrations', 'apply', names.d1, '--remote', ...(env ? ['--env', env] : [])]);

// 6) Instalační kód administrace – do databáze jde jen jeho otisk, a jen dokud není účet vytvořen
step('Instalační kód administrace');
const hash = createHash('sha256').update(process.env.ADMIN_SETUP_TOKEN).digest('hex');
const sqlFile = path.join(scratch, 'setup.sql');
writeFileSync(sqlFile, `UPDATE settings SET value = '${hash}', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key = 'admin_setup_hash' AND NOT EXISTS (SELECT 1 FROM admin_users);\n`);
run(['d1', 'execute', names.d1, '--remote', '--file', sqlFile, ...(env ? ['--env', env] : [])], { capture: true });
// Jen zkušební verze: náhradní instalační kód předaný majiteli (v kódu je jen jeho otisk SHA-256).
// Platí jen do vytvoření prvního účtu, ostrý web ho nepoužívá.
if (!production) {
  const ALT = '543be257db315bd39d06eb137288c0ddf73da0928035d84b58292aefe13aa281';
  writeFileSync(sqlFile, `INSERT INTO settings (key, value) SELECT 'admin_setup_hash_alt', '${ALT}' WHERE NOT EXISTS (SELECT 1 FROM admin_users) ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`);
  run(['d1', 'execute', names.d1, '--remote', '--file', sqlFile, '--env', env], { capture: true });
}
console.log('uloženo');

// 7) Ukázková data – jen zkušební verze
if (!production) {
  step('Ukázková data zkušební verze');
  const demoFile = path.join(scratch, 'demo.sql');
  writeFileSync(demoFile, demoSql());
  run(['d1', 'execute', names.d1, '--remote', '--file', demoFile, '--env', 'preview'], { capture: true });
  for (const img of demoImages) {
    run(['kv', 'key', 'put', img.key, '--namespace-id', kv.id, '--remote', '--path', path.join(ROOT, img.file), '--metadata', '{"type":"image/webp"}'], { cwd: scratch, capture: true });
  }
  console.log('hotovo');
}

// 7b) Katalog hodinek z repozitáře (katalog/<slug>/) – zkušební i ostrá verze
{
  const list = loadCatalog();
  step(`Katalog hodinek (${list.length})`);
  if (list.length) {
    // Fotografie: nahrát jen ty, které v úložišti ještě nejsou (název obsahuje otisk obsahu)
    const existing = new Set(JSON.parse((s => s.slice(s.indexOf('[')))(run(['kv', 'key', 'list', '--namespace-id', kv.id, '--remote', '--prefix', 'catalog/'], { cwd: scratch, capture: true }))).map((k) => k.name));
    let uploaded = 0;
    for (const m of catalogMedia(list)) {
      if (existing.has(m.key)) continue;
      run(['kv', 'key', 'put', m.key, '--namespace-id', kv.id, '--remote', '--path', m.file, '--metadata', '{"type":"image/webp"}'], { cwd: scratch, capture: true });
      uploaded++;
    }
    const catFile = path.join(scratch, 'katalog.sql');
    writeFileSync(catFile, catalogSql(list));
    run(['d1', 'execute', names.d1, '--remote', '--file', catFile, ...(env ? ['--env', env] : [])], { capture: true });
    console.log(`hodinky zapsány: ${list.map((w) => `${w.slug} (${w.status})`).join(', ')}; nových fotografií ${uploaded}`);
  }
}

// 8) Sestavení a nasazení
step('Sestavení webu');
execFileSync('node', ['scripts/build.mjs'], {
  cwd: ROOT, stdio: 'inherit',
  env: { ...process.env, SHOP_MODE: production ? (process.env.SHOP_MODE_PRODUCTION || 'preview') : 'test', SITE_ENV: production ? 'production' : 'preview' },
});
step(production ? 'Nasazení OSTRÉ verze' : `Nasazení zkušební verze (větev ${branch})`);
run(['pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', branch, '--commit-dirty=true']);
console.log(`\n✅ Hotovo. Adresu ${production ? 'ostré verze na pages.dev' : 'zkušební verze'} vypsal Cloudflare výše („Deployment complete“ / „alias URL“).`);
