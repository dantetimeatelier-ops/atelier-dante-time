// Napojení na Claude API (Anthropic) pro DT Doklady. Zapne se až klíčem ANTHROPIC_API_KEY
// (majitel ho uloží jako šifrovanou proměnnou v Cloudflare). Hlídá měsíční limit (R20: 300 Kč).
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { randomId, now, getSettings } from './db.js';
import { aiBudget } from './os.js';
import { cnbRate } from './fx.js';

// Ceny v USD za 1 milion tokenů (ceník Anthropic, listopad 2026)
export const MODELS = {
  'claude-opus-5-5': { name: 'Claude Opus 5.5 (nejpřesnější)', in: 4, out: 20 },
  'claude-sonnet-5-5': { name: 'Claude Sonnet 5.5 (vyvážený)', in: 2, out: 10 },
  'claude-haiku-5-5': { name: 'Claude Haiku 5.5 (nejlevnější)', in: 0.1, out: 0.5 },
};

export async function aiStatus(env) {
  const s = await getSettings(env);
  const model = MODELS[s.ai_model] ? s.ai_model : 'claude-opus-5-5';
  const budget = await aiBudget(env);
  const role = await env.DB.prepare("SELECT active, paused FROM agent_roles WHERE id = 'office'").first().catch(() => null);
  const enabled = Boolean(cleanKey(env.ANTHROPIC_API_KEY));
  let reason = null;
  if (!enabled) reason = 'AI není zapnutá (chybí klíč Anthropic) – údaje vyplníte ručně';
  else if (role?.paused) reason = 'Role DT Doklady je pozastavená (přehled Systém)';
  else if (budget.blocked && budget.limit > 0) reason = `Měsíční limit AI ${budget.limit} Kč je vyčerpán – údaje vyplníte ručně`;
  return { enabled, ready: enabled && !reason, reason, model, modelName: MODELS[model].name, budget, models: MODELS };
}

/** Klíč vložený na iPhonu často obsahuje mezeru, konec řádku nebo neviditelný znak → odstranit vše mimo tisknutelné ASCII. */
export const cleanKey = (k) => String(k || '').replace(/[^\x21-\x7E]/g, '');

const BIG = 400_000; // nad tuto velikost Files API
const b64 = (bytes) => {
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
};

/** Pošle dokument modelu a vrátí vyčtený JSON podle schématu. Zapíše náklady do deníku AI. */
const aiClient = (env, deps) => deps.client || new Anthropic({ apiKey: cleanKey(env.ANTHROPIC_API_KEY), baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 120000 });
const fname = (mime) => (mime === 'application/pdf' ? 'doklad.pdf' : 'doklad');

/** Předá velký soubor AI hned při nahrání (bajty jsou v paměti z požadavku). Vrátí id souboru, nebo null. */
export async function uploadAiFile(env, bytes, mime, deps = {}) {
  if (bytes.length <= BIG || !(await aiStatus(env)).ready) return null;
  try {
    const f = await aiClient(env, deps).files.upload({ file: await toFile(bytes, fname(mime), { type: mime }), expires_in_seconds: 3600 });
    return f.id;
  } catch { return null; } // nevadí – AI si soubor vezme z databáze až při čtení
}

/** Smaže soubor u AI (po přečtení). Chyby se ignorují – soubor by i tak sám vypršel. */
export async function deleteAiFile(env, fileId, deps = {}) {
  if (fileId) await aiClient(env, deps).files.delete(fileId).catch(() => {});
}

export async function extractJson(env, { bytes, fileId: preId, mime, system, prompt, schema }, deps = {}) {
  const st = await aiStatus(env);
  if (!st.ready) { const e = new Error(st.reason); e.code = 'ai_off'; throw e; }
  const client = aiClient(env, deps);
  // Velké soubory se posílají přes Files API (bez převodu do base64 – ten by na bezplatném Cloudflare překročil
  // časový limit procesoru). Soubor se po přečtení hned smaže a i tak by za hodinu sám vypršel.
  let fileId = null;
  let source;
  if (preId) source = { type: 'file', file_id: preId }; // soubor předaný už při nahrání (smaže ho volající)
  else if (bytes.length > BIG) {
    const f = await client.files.upload({ file: await toFile(bytes, fname(mime), { type: mime }), expires_in_seconds: 3600 });
    fileId = f.id;
    source = { type: 'file', file_id: fileId };
  } else source = { type: 'base64', media_type: mime, data: b64(bytes) };
  const block = mime === 'application/pdf' ? { type: 'document', source } : { type: 'image', source };
  let res;
  try {
  res = await client.messages.create({
    model: st.model,
    max_tokens: 8000,
    system,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }],
  });
  } finally {
    if (fileId) await client.files.delete(fileId).catch(() => {});
  }
  const m = MODELS[st.model];
  const usd = ((res.usage?.input_tokens || 0) * m.in + (res.usage?.output_tokens || 0) * m.out) / 1e6;
  const usdCzk = (await cnbRate(env, 'USD', now().slice(0, 10))) || 24;
  await env.DB.prepare('INSERT INTO ai_costs (id, role_id, model, tokens_in, tokens_out, cost_czk, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(randomId(), 'office', st.model, res.usage?.input_tokens || 0, res.usage?.output_tokens || 0, Math.round(usd * usdCzk * 100) / 100, now()).run();
  if (res.stop_reason === 'refusal') throw new Error('AI dokument odmítla zpracovat – vyplňte ručně');
  if (res.stop_reason === 'max_tokens') throw new Error('Dokument je příliš dlouhý – vyplňte ručně');
  const text = res.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  try { return JSON.parse(text); } catch { throw new Error('AI vrátila nečitelnou odpověď – vyplňte ručně'); }
}
