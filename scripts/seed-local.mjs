// Ukázková data POUZE pro místní vývoj (nikdy na ostrý web).
// Spuštění: npm run seed:local
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { demoSql, demoImages } from './demo-data.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = path.join(ROOT, '.wrangler', 'seed');
mkdirSync(tmp, { recursive: true });
const w = (...args) => execFileSync('npx', ['wrangler', ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });

writeFileSync(path.join(tmp, 'seed.sql'), demoSql({ reset: true }));
w('d1', 'execute', 'DB', '--local', '--file', path.join(tmp, 'seed.sql'));
for (const img of demoImages) {
  w('kv', 'key', 'put', img.key, '--binding', 'MEDIA_KV', '--local', '--path', path.join(ROOT, img.file), '--metadata', '{"type":"image/webp"}');
}
console.log('✅ Ukázková data nahrána (jen místně).');
