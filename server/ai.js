// Napojení na Claude API (Anthropic) pro DT Doklady. Zapne se až klíčem ANTHROPIC_API_KEY
// (majitel ho uloží jako šifrovanou proměnnou v Cloudflare). Hlídá měsíční limit (R20: 300 Kč).
import Anthropic from '@anthropic-ai/sdk';
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

const aiClient = (env, deps) => deps.client || new Anthropic({ apiKey: cleanKey(env.ANTHROPIC_API_KEY), baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 120000 });

/** Smaže soubor u AI (po přečtení). Chyby se ignorují – soubor by i tak sám vypršel. */
export async function deleteAiFile(env, fileId, deps = {}) {
  if (fileId) await aiClient(env, deps).files.delete(fileId).catch(() => {});
}

/** Pošle dokument modelu a vrátí vyčtený JSON podle schématu. Zapíše náklady do deníku AI. */
export async function extractJson(env, { b64, fileId, mime, system, prompt, schema, maxTokens = 8000 }, deps = {}) {
  const st = await aiStatus(env);
  if (!st.ready) { const e = new Error(st.reason); e.code = 'ai_off'; throw e; }
  const client = aiClient(env, deps);
  // Doklad jde jako base64 přímo z databáze (bez převodu na serveru), nebo jako soubor u AI (starší koncepty)
  const source = fileId ? { type: 'file', file_id: fileId } : { type: 'base64', media_type: mime, data: b64 };
  const block = mime === 'application/pdf' ? { type: 'document', source } : { type: 'image', source };
  const res = await client.messages.create({
    model: st.model,
    max_tokens: Math.min(16000, maxTokens),
    system,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }],
  });
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
