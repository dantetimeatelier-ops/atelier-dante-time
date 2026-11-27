// Dante Time OS – jádro (etapa E1, rozhodnutí R20)
// Role = agenti s pevně danými oprávněními. Každý běh se zapisuje (agent_runs), nálezy do os_findings.
// Guardian kontroluje ostatní role a může je pozastavit; obnovit je smí jen majitel.
// Vše zde je klasická automatizace bez AI (0 Kč). AI se přidá v dalších etapách s limitem nákladů.
import { randomId, now, audit, getSettings } from './db.js';
import { sendEmail, ownerEmail } from './email.js';
import { sendDueReminders } from './warranty.js';
import { SITE } from '../src/site.mjs';
import { today } from '../src/shop/warranty.mjs';
import { refreshAll, refreshOrder, CPOST_METHODS, PACKETA_METHODS } from './packeta.js';
import { markShipped } from './orders.js';
import { recordMissingCardFees } from './payment-events.js';
import { productEconomics, overview } from './finance.js';
import { overdueInvoices } from './invoicing.js';

// ---- Role a běhy --------------------------------------------------------------------------
export async function roles(env) {
  const { results } = await env.DB.prepare('SELECT * FROM agent_roles ORDER BY active DESC, CASE id WHEN \'guardian\' THEN 0 WHEN \'director\' THEN 1 ELSE 2 END, name').all();
  return results.map((r) => ({ ...r, permissions: JSON.parse(r.permissions || '{}') }));
}

async function role(env, id) { return env.DB.prepare('SELECT * FROM agent_roles WHERE id = ?').bind(id).first(); }

/** Spustí úlohu role: kontrola pozastavení, zápis běhu, zachycení chyby. */
export async function runRole(env, roleId, task, fn) {
  const r = await role(env, roleId);
  if (!r || !r.active) return { skipped: 'neaktivní' };
  const id = randomId(); const started = now();
  if (r.paused) {
    await env.DB.prepare("INSERT INTO agent_runs (id, role_id, task, started_at, finished_at, status, summary) VALUES (?, ?, ?, ?, ?, 'skipped', ?)").bind(id, roleId, task, started, started, `Pozastaveno: ${r.paused_reason || ''}`).run();
    return { skipped: 'pozastaveno' };
  }
  await env.DB.prepare('INSERT INTO agent_runs (id, role_id, task, started_at) VALUES (?, ?, ?, ?)').bind(id, roleId, task, started).run();
  let status = 'ok'; let summary = '';
  try {
    const out = (await fn()) || {};
    status = out.status || 'ok'; summary = out.summary || '';
  } catch (e) { status = 'error'; summary = String(e.message || e).slice(0, 500); }
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE agent_runs SET finished_at=?, status=?, summary=? WHERE id=?').bind(t, status, summary, id),
    env.DB.prepare('UPDATE agent_roles SET last_run_at=?, last_status=?, last_summary=?, updated_at=? WHERE id=?').bind(t, status, summary, t, roleId),
  ]);
  return { status, summary };
}

export async function pauseRole(env, roleId, by, reason) {
  if (roleId === 'guardian' && by !== 'majitel') throw new Error('Guardiana smí pozastavit jen majitel');
  await env.DB.prepare('UPDATE agent_roles SET paused=1, paused_by=?, paused_reason=?, paused_at=?, updated_at=? WHERE id=?').bind(by, reason, now(), now(), roleId).run();
  await audit(env, by, 'role_pozastavena', 'agent_role', roleId, { reason });
}
export async function resumeRole(env, roleId, ownerEmail_) {
  await env.DB.prepare('UPDATE agent_roles SET paused=0, paused_by=NULL, paused_reason=NULL, paused_at=NULL, updated_at=? WHERE id=?').bind(now(), roleId).run();
  await audit(env, ownerEmail_, 'role_obnovena', 'agent_role', roleId, {});
}

// ---- Nálezy --------------------------------------------------------------------------------
async function finding(env, roleId, key, severity, title, detail = '') {
  const t = now();
  const open = await env.DB.prepare('SELECT id FROM os_findings WHERE check_key = ? AND resolved_at IS NULL').bind(key).first();
  if (open) { await env.DB.prepare('UPDATE os_findings SET last_seen_at=?, severity=?, title=?, detail=? WHERE id=?').bind(t, severity, title, detail, open.id).run(); return false; }
  await env.DB.prepare('INSERT INTO os_findings (id, role_id, check_key, severity, title, detail, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(randomId(), roleId, key, severity, title, detail, t, t).run();
  return true;
}
async function resolveMissing(env, roleId, seenKeys) {
  const { results } = await env.DB.prepare('SELECT id, check_key FROM os_findings WHERE role_id = ? AND resolved_at IS NULL').bind(roleId).all();
  for (const f of results) if (!seenKeys.has(f.check_key)) await env.DB.prepare('UPDATE os_findings SET resolved_at=? WHERE id=?').bind(now(), f.id).run();
}
export async function openFindings(env) {
  const { results } = await env.DB.prepare("SELECT * FROM os_findings WHERE resolved_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC LIMIT 200").all();
  return results;
}

// ---- Náklady AI (limit) ----------------------------------------------------------------------
export async function aiBudget(env) {
  const s = await getSettings(env);
  const month = today().slice(0, 7);
  const spent = (await env.DB.prepare('SELECT COALESCE(SUM(cost_czk),0) AS s FROM ai_costs WHERE substr(created_at,1,7) = ?').bind(month).first()).s;
  const limit = Number(s.ai_limit_czk) || 0;
  return { limit, spent: Math.round(spent * 100) / 100, left: Math.max(0, limit - spent), blocked: spent >= limit };
}

// ---- DT Logistics ---------------------------------------------------------------------------
async function logistics(env) {
  const sent = await sendDueReminders(env, 'DT Logistics');
  const track = await refreshAll(env).catch(() => null);
  const stuck = (await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status='paid' AND paid_at < ?").bind(new Date(Date.now() - 4 * 86400000).toISOString()).first()).n;
  const parts = [];
  if (sent) parts.push(`odesláno ${sent} připomínek garanční prohlídky`);
  if (stuck) parts.push(`${stuck} zaplacených objednávek čeká na odeslání déle než 4 dny`);
  if (track?.checked) parts.push(`zkontrolováno ${track.checked} zásilek`);
  if (track?.delivered.length) parts.push(`doručeno (potvrďte převzetí): ${track.delivered.join(', ')}`);
  if (track?.problems.length) parts.push(`problém se zásilkou: ${track.problems.join('; ')}`);
  if (track?.errors) parts.push(`${track.errors} zásilek se nepodařilo ověřit`);
  return { status: stuck || track?.problems.length || track?.delivered.length ? 'warning' : 'ok', summary: parts.join('; ') || 'nic k vyřízení' };
}

// ---- DT Logistics: předání dopravci (každou hodinu) ------------------------------------------------
// Objednávka se označí „odesláno“ a zákazník dostane e-mail s číslem zásilky až ve chvíli, kdy dopravce
// zásilku skutečně převezme (rozhodnutí R23) – ne při vytvoření štítku.
export const handedOver = (st) => st && st.code >= 2 && ![9, 10, 11, 12, 999].includes(st.code) && !/data|elektronick/i.test(String(st.text || ''));
export async function handoverCheck(env, deps) {
  const s = await getSettings(env);
  if (s.ship_autonotify === '0') return { checked: 0, shipped: [] };
  const list = [...CPOST_METHODS, ...(env.PACKETA_API_PASSWORD ? PACKETA_METHODS : [])];
  const methods = `(${list.map((x) => `'${x}'`).join(',')})`;
  const { results } = await env.DB.prepare(`SELECT id, number, shipping_method, tracking_number FROM orders WHERE (status = 'paid' OR (status = 'awaiting_payment' AND payment_method = 'cod')) AND shipping_method IN ${methods} AND tracking_number IS NOT NULL AND tracking_number != '' ORDER BY created_at LIMIT 30`).all();
  const out = { checked: 0, shipped: [] };
  for (const o of results) {
    try {
      const st = await refreshOrder(env, o, deps); out.checked++;
      if (handedOver(st)) { await markShipped(env, o.id, o.tracking_number, 'DT Logistics'); out.shipped.push(o.number); }
    } catch { /* zkusí se za hodinu */ }
  }
  return out;
}

// ---- DT Sales (bez AI): nic nezapadne ------------------------------------------------------------
const TYPE_CS = { servis: 'servis', renovace: 'renovace', zakazkova_vyroba: 'zakázková sestava', prestavba: 'přestavba', jine: 'dotaz', product: 'zájem o hodinky', general: 'dotaz' };
const dCs = (iso) => new Date(iso).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });
export async function salesCheck(env, at = Date.now()) {
  const seen = new Set();
  const f = async (key, sev, title, detail) => { seen.add(key); await finding(env, 'sales', key, sev, title, detail); };
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results);
  const iso = (h) => new Date(at - h * 3600000).toISOString();
  const day = new Date(at).toISOString().slice(0, 10);
  // Poptávky bez odpovědi déle než 2 dny (bez jmen – jen druh a datum)
  const inq = await q("SELECT id, type, created_at FROM inquiries WHERE status = 'nova' AND created_at < ? ORDER BY created_at", iso(48));
  for (const i of inq) await f(`poptavka:${i.id}`, 'warning', `Poptávka (${TYPE_CS[i.type] || i.type}) z ${dCs(i.created_at)} čeká na odpověď`, 'Poptávky → Návrh odpovědi (AI) nebo odpovězte e-mailem a označte „Vyřizuje se“.');
  // Zakázky: nabídka bez reakce 7+ dní, termín v ohrožení nebo prošlý
  for (const k of await q("SELECT id, number, updated_at FROM commissions WHERE status = 'nabidka' AND updated_at < ?", iso(7 * 24))) await f(`nabidka:${k.id}`, 'info', `Nabídka ${k.number} je bez reakce od ${dCs(k.updated_at)}`, 'Zvažte připomenutí zákazníkovi.');
  for (const k of await q("SELECT id, number, due_date FROM commissions WHERE due_date IS NOT NULL AND due_date <> '' AND status NOT IN ('hotovo','predano','zruseno','poptavka')")) {
    if (k.due_date < day) await f(`termin:${k.id}`, 'warning', `Zakázka ${k.number} je po termínu (${dCs(k.due_date)})`, 'Domluvte se zákazníkem nový termín.');
    else if (k.due_date <= new Date(at + 3 * 86400000).toISOString().slice(0, 10)) await f(`termin:${k.id}`, 'info', `Zakázka ${k.number} má termín ${dCs(k.due_date)}`, '');
  }
  // Rezervace hodinek převodem, které do 24 h vyprší
  for (const o of await q("SELECT id, number, reserved_until FROM orders WHERE status = 'awaiting_payment' AND payment_method = 'bank_transfer' AND reserved_until BETWEEN ? AND ?", new Date(at).toISOString(), new Date(at + 24 * 3600000).toISOString())) await f(`rezervace:${o.id}`, 'info', `Rezervace objednávky ${o.number} vyprší ${new Date(o.reserved_until).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}`, 'Platba zatím nedorazila – případně zákazníkovi připomeňte.');
  // Inzeráty: chybějící údaje, které zákazníci u hodinek hledají
  for (const p of await q("SELECT id, title FROM products WHERE status = 'available' AND (case_diameter_mm IS NULL OR case_diameter_mm = 0)")) await f(`prumer:${p.id}`, 'info', `Inzerát bez průměru pouzdra: ${p.title}`, 'Hodinky → upravit → Průměr pouzdra (mm).');
  await resolveMissing(env, 'sales', seen);
  return { status: inq.length ? 'warning' : 'ok', summary: seen.size ? `${seen.size} připomínek (${inq.length} poptávek čeká na odpověď)` : 'vše vyřízeno' };
}

// ---- DT Finance (bez AI): úplná a správná čísla -----------------------------------------------------
export async function financeCheck(env) {
  const seen = new Set();
  const f = async (key, sev, title, detail) => { seen.add(key); await finding(env, 'finance', key, sev, title, detail); };
  const one = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const costs = (await one("SELECT COUNT(*) AS n FROM costs WHERE status = 'ke_kontrole'")).n;
  if (costs) await f('doklady-kontrola', 'warning', `${costs} nákladových dokladů čeká na kontrolu`, 'Ekonomika → Doklady ke kontrole: potvrďte nebo opravte údaje vytěžené z dokladů.');
  const sales = (await one("SELECT COUNT(*) AS n FROM sales WHERE status = 'ke_kontrole'").catch(() => ({ n: 0 }))).n;
  if (sales) await f('prodeje-kontrola', 'warning', `${sales} prodejních dokladů čeká na kontrolu`, 'Ekonomika → Prodeje ke kontrole.');
  const { results: prods } = await env.DB.prepare("SELECT id, title, status FROM products WHERE status IN ('available','reserved','sold')").all();
  let missing = 0;
  for (const p of prods) {
    const e = await productEconomics(env, p.id);
    if (!e.hasPurchase) { missing++; await f(`nakup:${p.id}`, p.status === 'sold' ? 'warning' : 'info', `Hodinky bez nákupní ceny: ${p.title}`, 'Bez nákupní ceny nejde spočítat marže a zisk. Hodinky → Ekonomika kusu → přidat náklad „Nákup“.'); }
  }
  // Faktury po splatnosti: upozornění v přehledu a jednou denně souhrn e-mailem POUZE majiteli (zákazníkům nic)
  const overdue = await overdueInvoices(env).catch(() => []);
  for (const i of overdue) await f(`splatnost:${i.id}`, 'warning', `Faktura ${i.number} je ${i.days} ${i.days === 1 ? 'den' : i.days < 5 ? 'dny' : 'dní'} po splatnosti (${kcz(i.due)})`, `${i.buyer_company || i.buyer_name}${i.commission_number ? ` · zakázka ${i.commission_number}` : ''}. Upomínku zákazníkovi posíláte sami.`);
  if (overdue.length) await overdueDigest(env, overdue);
  await resolveMissing(env, 'finance', seen);
  return { status: costs || sales || overdue.length ? 'warning' : 'ok', summary: seen.size ? `${costs + sales} dokladů ke kontrole, ${missing} hodinek bez nákupní ceny, ${overdue.length} faktur po splatnosti` : 'evidence je úplná' };
}

const kcz = (n) => `${Math.round(Number(n)).toLocaleString('cs-CZ')} Kč`;

/** Denní souhrn neuhrazených faktur po splatnosti – jen majiteli, nejvýš jednou za den. */
export async function overdueDigest(env, list) {
  const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });
  const s = await getSettings(env);
  if (s.overdue_digest_last === day || !list.length) return false;
  const total = list.reduce((a, i) => a + i.due, 0);
  const rows = list.map((i) => `<li><b>${i.number}</b> · ${i.buyer_company || i.buyer_name}${i.commission_number ? ` · zakázka ${i.commission_number}` : ''} · ${kcz(i.due)} · ${i.days} dní po splatnosti${i.sent_at ? '' : ' · <i>zákazníkovi zatím neodesláno</i>'}</li>`).join('');
  await sendEmail(env, { to: ownerEmail(env), related: 'os:splatnost', subject: `Faktury po splatnosti: ${list.length} (${kcz(total)})`,
    body: `<p>Dobrý den,</p><p>tyto faktury jsou neuhrazené po splatnosti:</p><ul>${rows}</ul><p>Celkem <b>${kcz(total)}</b>. Zákazníkům nebyla odeslána žádná automatická upomínka.</p><p><a href="${SITE.origin}/admin/#/faktury?status=po_splatnosti">Otevřít faktury po splatnosti</a></p><p>DT Finance</p>` });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('overdue_digest_last', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(day).run();
  return true;
}

// ---- DT Guardian (nezávislá kontrola, bez AI) --------------------------------------------------
async function guardian(env) {
  const seen = new Set();
  const f = async (key, sev, title, detail) => { seen.add(key); await finding(env, 'guardian', key, sev, title, detail); };
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results);
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  // Hodinky v prodeji: cena, fotky
  for (const p of await q("SELECT p.id, p.title, p.price_czk, (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) AS n FROM products p WHERE p.status = 'available'")) {
    if (!(p.price_czk > 0)) await f(`cena:${p.id}`, 'critical', `Hodinky v prodeji bez ceny: ${p.title}`, 'Doplňte cenu nebo stáhněte z prodeje.');
    if (!p.n) await f(`foto:${p.id}`, 'warning', `Hodinky v prodeji bez fotografie: ${p.title}`, '');
  }
  // Změny cen za poslední den (kontrola, že je provedl majitel)
  for (const a of await q("SELECT entity_id, actor, at AS created_at FROM audit_log WHERE action LIKE 'hodinky_%' AND at > ? AND details LIKE '%price_czk%' AND actor NOT LIKE '%@%'", dayAgo)) {
    await f(`cena-zmena:${a.entity_id}:${a.created_at}`, 'critical', 'Cenu změnil někdo jiný než majitel', `Kdo: ${a.actor}`);
  }
  // Objednávky a faktury: součet položek = celkem
  for (const o of await q("SELECT o.id, o.number, o.total, o.shipping_price, o.cod_fee, (SELECT COALESCE(SUM(price_czk),0) FROM order_items i WHERE i.order_id = o.id) AS items FROM orders o WHERE o.created_at > ?", new Date(Date.now() - 30 * 86400000).toISOString())) {
    if (o.items + (o.shipping_price || 0) + (o.cod_fee || 0) !== o.total) await f(`soucet:${o.id}`, 'critical', `Objednávka ${o.number}: celková částka nesedí se součtem položek`, `položky ${o.items} + doprava ${o.shipping_price} + dobírka ${o.cod_fee} ≠ ${o.total}`);
  }
  // Ekonomika (E2): prodané hodinky bez nákupní ceny, záporná marže
  try {
    const noCost = (await q("SELECT COUNT(*) AS n FROM products p WHERE p.status = 'sold' AND NOT EXISTS (SELECT 1 FROM costs c WHERE c.product_id = p.id AND c.category = 'nakup')"))[0].n;
    if (noCost) await f('ekonomika-nakup', 'info', `${noCost} prodaných hodinek nemá zapsanou nákupní cenu`, 'Bez ní nelze spočítat skutečný zisk. Hodinky → Náklady a marže.');
    for (const x of await q("SELECT p.id, p.title, (SELECT i.price_czk FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = p.id AND o.status IN ('paid','shipped','completed') LIMIT 1) AS sale, (SELECT COALESCE(SUM(amount_czk),0) FROM costs c WHERE c.product_id = p.id AND c.estimate = 0 AND c.own_work = 0 AND c.status = 'potvrzeno') AS cost FROM products p WHERE p.status = 'sold'")) {
      if (x.sale != null && x.cost > x.sale) await f(`marze:${x.id}`, 'warning', `Záporná marže: ${x.title}`, `prodej ${x.sale} Kč, náklady ${x.cost} Kč`);
    }
  } catch { /* tabulka costs v této verzi není */ }
  // E-maily, které se nepodařilo odeslat
  const failed = (await q("SELECT COUNT(*) AS n FROM emails WHERE status='failed' AND created_at > ?", dayAgo))[0].n;
  if (failed) await f('emaily-chyby', 'warning', `${failed} e-mailů za 24 h se nepodařilo odeslat`, 'Administrace → Více → E-maily');
  // Přihlášení: podezřelý počet neúspěšných pokusů
  const badLogins = (await q("SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0 AND at > ?", dayAgo).catch(() => [{ n: 0 }]))[0].n;
  if (badLogins >= 10) await f('prihlaseni', 'critical', `${badLogins} neúspěšných pokusů o přihlášení za 24 h`, 'Zvažte změnu hesla. Přihlášení je chráněno dvoufázovým ověřením.');
  // Zálohy
  const lastBackup = (await q('SELECT MAX(created_at) AS t FROM backups'))[0].t;
  if (!env.BACKUP_KEY) await f('zaloha-klic', 'warning', 'Šifrované zálohy nejsou zapnuté (chybí klíč BACKUP_KEY)', 'Do té doby lze databázi obnovit vestavěnou funkcí Cloudflare D1 až 7 dní zpět. Návod: docs/DANTE-TIME-OS.md.');
  else if (!lastBackup || lastBackup < new Date(Date.now() - 2 * 86400000).toISOString()) await f('zaloha', 'warning', 'Záloha databáze je starší než 2 dny', lastBackup ? `poslední ${lastBackup}` : 'zatím žádná');
  // Náklady AI
  const b = await aiBudget(env);
  if (b.blocked && b.limit > 0) await f('ai-limit', 'warning', `Měsíční limit AI ${b.limit} Kč vyčerpán – AI funkce stojí, e-shop běží dál`, '');
  // Kontrola ostatních rolí (včetně Directora): chyby a podezřelá aktivita
  for (const r of await q("SELECT id, name FROM agent_roles WHERE active = 1 AND id <> 'guardian' AND paused = 0")) {
    const errs = (await q("SELECT COUNT(*) AS n FROM agent_runs WHERE role_id = ? AND status = 'error' AND started_at > ?", r.id, dayAgo))[0].n;
    if (errs >= 3) { await f(`role-chyby:${r.id}`, 'critical', `${r.name}: ${errs} chybných běhů za 24 h – role pozastavena`, 'Obnovit smí jen majitel v přehledu Systém.'); await pauseRole(env, r.id, 'DT Guardian', `${errs} chyb za 24 h`); }
  }
  const mails = (await q("SELECT COUNT(*) AS n FROM emails WHERE related LIKE 'warranty:%' AND created_at > ?", dayAgo))[0].n;
  if (mails > 30) { await f('logistics-emaily', 'critical', `DT Logistics poslal ${mails} e-mailů za 24 h – role pozastavena`, 'Neobvyklé množství; ověřte, než ji obnovíte.'); await pauseRole(env, 'logistics', 'DT Guardian', 'neobvyklé množství e-mailů'); }
  // Prohlídky, které se nepodařilo připomenout
  const remErr = (await q('SELECT COUNT(*) AS n FROM warranty_inspections WHERE reminder_error IS NOT NULL AND reminder_sent_at IS NULL'))[0].n;
  if (remErr) await f('prohlidky-chyby', 'warning', `${remErr} připomínek garanční prohlídky se nepodařilo odeslat`, 'Garanční prohlídky → otevřít a poslat ručně');

  await resolveMissing(env, 'guardian', seen);
  const open = await openFindings(env);
  const crit = open.filter((x) => x.severity === 'critical').length;
  return { status: crit ? 'warning' : 'ok', summary: open.length ? `${open.length} otevřených nálezů (${crit} závažných)` : 'vše v pořádku' };
}

// ---- Zálohy databáze (soukromé úložiště KV, 30 dní) ----------------------------------------------
const BACKUP_TABLES = ['products', 'product_images', 'customers', 'orders', 'order_items', 'commissions', 'inquiries', 'withdrawals', 'invoices', 'settings', 'counters', 'warranty_inspections', 'agent_roles', 'approvals', 'audit_log', 'costs', 'parts', 'watch_passports', 'passport_events', 'commission_photos', 'invoice_drafts'];
// Doklady: v záloze jen evidence (bez souborů – ty chrání vestavěná obnova Cloudflare D1).
const BACKUP_QUERIES = { documents: 'SELECT id, cost_id, kind, filename, mime, size, sha256, note, created_by, created_at FROM documents' };
export async function backup(env) {
  const data = {}; let rows = 0;
  for (const t of BACKUP_TABLES) {
    try { const { results } = await env.DB.prepare(`SELECT * FROM ${t}`).all(); data[t] = results; rows += results.length; } catch { /* tabulka v této verzi není */ }
  }
  for (const [t, sql] of Object.entries(BACKUP_QUERIES)) {
    try { const { results } = await env.DB.prepare(sql).all(); data[t] = results; rows += results.length; } catch { /* tabulka v této verzi není */ }
  }
  // Zálohy obsahují osobní údaje → šifrují se (AES-256-GCM) klíčem BACKUP_KEY, který zná jen majitel.
  if (!env.BACKUP_KEY || env.BACKUP_KEY.length < 32) {
    return { status: 'warning', summary: 'záloha neuložena: chybí šifrovací klíč BACKUP_KEY (obnova je možná vestavěnou funkcí Cloudflare D1 až 7 dní zpět)' };
  }
  const plain = new TextEncoder().encode(JSON.stringify({ version: 1, created_at: now(), tables: data }));
  const cryptoKey = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.BACKUP_KEY)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plain));
  const blob = new Uint8Array(iv.length + enc.length); blob.set(iv); blob.set(enc, iv.length);
  const key = `backup/db-${now().replace(/[:.]/g, '-')}.enc`;
  await env.MEDIA_KV.put(key, blob, { expirationTtl: 30 * 86400, metadata: { type: 'application/octet-stream' } });
  const body = blob;
  await env.DB.prepare('INSERT INTO backups (id, storage_key, tables, rows, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(randomId(), key, Object.keys(data).length, rows, body.length, now()).run();
  await env.DB.prepare('DELETE FROM backups WHERE created_at < ?').bind(new Date(Date.now() - 30 * 86400000).toISOString()).run();
  return { status: 'ok', summary: `${rows} řádků v ${Object.keys(data).length} tabulkách (${Math.round(body.length / 1024)} kB)` };
}

// ---- DT Director: týdenní souhrn majiteli (bez AI) ----------------------------------------------
export async function directorSummary(env) {
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const wk = await q("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM invoices WHERE cancelled_at IS NULL AND kind <> 'zalohova' AND issued_at > ? AND mode = 'live'", weekAgo);
  const fin = await overview(env).catch(() => null); // tržby, náklady, zisk letos (DT Finance)
  const orders = await q('SELECT COUNT(*) AS n FROM orders WHERE created_at > ?', weekAgo);
  const toShip = await q("SELECT COUNT(*) AS n FROM orders WHERE status='paid'");
  const inq = await q("SELECT COUNT(*) AS n FROM inquiries WHERE status='nova'");
  const newInq = await q('SELECT COUNT(*) AS n FROM inquiries WHERE created_at > ?', weekAgo);
  const appr = await q("SELECT COUNT(*) AS n FROM approvals WHERE status='ceka'");
  const insp = await q("SELECT COUNT(*) AS n FROM warranty_inspections WHERE status IN ('planovana','objednana') AND window_from <= ? AND window_to >= ?", today(), today());
  const done = await q("SELECT COUNT(*) AS n FROM orders WHERE completed_at > ?", weekAgo);
  const shipped = await q("SELECT COUNT(*) AS n FROM orders WHERE shipped_at > ?", weekAgo);
  const ai = await aiBudget(env);
  const findings = await openFindings(env);
  const { results: runs } = await env.DB.prepare("SELECT r.name, a.task, a.status, a.summary FROM agent_runs a JOIN agent_roles r ON r.id = a.role_id WHERE a.started_at > ? AND a.status <> 'skipped' AND a.started_at = (SELECT MAX(b.started_at) FROM agent_runs b WHERE b.role_id = a.role_id AND b.task = a.task) ORDER BY r.name").bind(weekAgo).all();
  const kc = (n) => `${Math.round(Number(n)).toLocaleString('cs-CZ')} Kč`;
  const li = (t) => `<li>${t}</li>`;
  const h = (t) => `<h3 style="font-family:Georgia,serif;font-weight:normal;color:#f2f2f2;margin:22px 0 6px">${t}</h3>`;
  const icon = { critical: '🔴', warning: '🟡', info: '·' };
  const byRole = (r) => findings.filter((x) => x.role_id === r);
  const list = (arr) => (arr.length ? `<ul>${arr.slice(0, 8).map((x) => li(`${icon[x.severity] || '·'} ${x.title}`)).join('')}${arr.length > 8 ? li(`… a dalších ${arr.length - 8}`) : ''}</ul>` : '<p style="color:#9a9a9a">Nic.</p>');
  const body = `<p>Dobrý den,</p><p>stručný týdenní přehled Dante Time:</p>
${h('Stav firmy')}<ul>
${li(`Tržby za 7 dní: <b>${kc(wk.s)}</b> (${wk.n} faktur), nové objednávky: ${orders.n}, nové poptávky: ${newInq.n}`)}
${fin ? `${li(`Letos: tržby <b>${kc(fin.revenue)}</b> · náklady ${kc(fin.costs)} · <b>zisk ${kc(fin.profit)}</b>`)}${li(`Cíl ${kc(fin.goal)}: splněno <b>${fin.goalPct} %</b>${fin.stockValue ? ` · hodnota skladu (náklady neprodaných kusů) ${kc(fin.stockValue)}` : ''}`)}` : ''}
${li(`AI tento měsíc: ${kc(ai.spent)} z limitu ${kc(ai.limit)}`)}</ul>
${h('Co se tento týden udělalo')}<ul>
${li(`Odesláno ${shipped.n} a dokončeno ${done.n} objednávek`)}
${runs.map((r) => li(`${r.name} – ${r.task}: ${r.summary || r.status}`)).join('')}</ul>
${h('Co čeká na vás')}<ul>
${li(`K odeslání: <b>${toShip.n}</b> objednávek`)}${li(`Poptávky bez odpovědi: <b>${inq.n}</b>`)}${li(`Ke schválení: <b>${appr.n}</b>`)}${li(`Garanční prohlídky v termínu: ${insp.n}`)}</ul>
${h('Obchod (DT Sales)')}${list(byRole('sales'))}
${h('Ekonomika (DT Finance)')}${list(byRole('finance'))}
${h('Zjištěné problémy (DT Guardian)')}${list(findings.filter((x) => !['sales', 'finance'].includes(x.role_id)))}
<p><a href="${SITE.origin}/admin/#/system">Otevřít přehled systému</a></p><p>DT Director</p>`;
  const res = await sendEmail(env, { to: ownerEmail(env), subject: `Týdenní přehled Dante Time – ${new Date().toLocaleDateString('cs-CZ')}`, body, related: 'os:director' });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('director_last_summary', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(now()).run();
  return { status: res?.failed ? 'error' : 'ok', summary: `souhrn odeslán (tržby letos ${kc(fin?.revenue || 0)}, ${findings.length} upozornění)` };
}

// ---- Časovač: jeden „tik“ za hodinu ------------------------------------------------------------
// Volá ho Worker s časovačem (workers/os-cron). Každá úloha si hlídá, kdy naposledy běžela.
export async function tick(env, { force = false } = {}) {
  const s = await getSettings(env);
  const last = s.os_last_tick || '';
  const nowIso = now();
  if (!force && last && Date.now() - Date.parse(last) < 50 * 60000) return { skipped: 'běželo před méně než hodinou' };
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('os_last_tick', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(nowIso).run();
  const prague = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' }));
  const hour = prague.getHours(); const dow = prague.getDay();
  const out = {};
  const lastRun = async (roleId, task) => (await env.DB.prepare("SELECT MAX(started_at) AS t FROM agent_runs WHERE role_id = ? AND task = ? AND status <> 'skipped'").bind(roleId, task).first()).t;
  const olderThan = (t, h) => !t || Date.now() - Date.parse(t) > h * 3600000;

  // Každou hodinu, bez AI a zdarma: předání zásilek dopravci a doplnění poplatků platební brány do nákladů
  try { const h = await handoverCheck(env); if (h.checked) out.handover = h; } catch (e) { out.handover = { error: String(e?.message || e) }; }
  try { const f = await recordMissingCardFees(env); if (f) out.cardFees = f; } catch (e) { out.cardFees = { error: String(e?.message || e) }; }
  if (force || (hour >= 8 && olderThan(await lastRun('logistics', 'denní kontrola'), 20))) out.logistics = await runRole(env, 'logistics', 'denní kontrola', () => logistics(env));
  if (force || (hour >= 8 && olderThan(await lastRun('sales', 'denní kontrola'), 20))) out.sales = await runRole(env, 'sales', 'denní kontrola', () => salesCheck(env));
  if (force || (hour >= 8 && olderThan(await lastRun('finance', 'denní kontrola'), 20))) out.finance = await runRole(env, 'finance', 'denní kontrola', () => financeCheck(env));
  if (force || olderThan(await lastRun('guardian', 'záloha'), 20)) out.backup = await runRole(env, 'guardian', 'záloha', () => backup(env));
  out.guardian = await runRole(env, 'guardian', 'kontrola', () => guardian(env));
  if ((dow === 1 && hour >= 7 && olderThan(s.director_last_summary, 6 * 24)) || (force === 'director')) out.director = await runRole(env, 'director', 'týdenní souhrn', () => directorSummary(env));
  return out;
}
