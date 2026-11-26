// Otisk stylů a skriptů (public/assets). Přidává se k odkazům jako ?v=…, aby prohlížeče
// po každé změně vzhledu načetly novou verzi a nepoužily starou z paměti.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export function computeAssetVersion() {
  const dir = path.join(ROOT, 'public', 'assets');
  const h = createHash('sha256');
  for (const f of readdirSync(dir).sort()) h.update(f).update(readFileSync(path.join(dir, f)));
  return h.digest('hex').slice(0, 10);
}
export function writeAssetVersion() {
  const v = computeAssetVersion();
  const file = path.join(ROOT, 'src', 'asset-version.mjs');
  const content = `// Vytváří scripts/build.mjs – neupravovat ručně.\nexport const ASSET_V = '${v}';\n`;
  if (!existsSync(file) || readFileSync(file, 'utf8') !== content) writeFileSync(file, content);
  return v;
}
