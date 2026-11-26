// Rozšifrování zálohy Dante Time OS: node scripts/backup-decrypt.mjs zaloha.enc > zaloha.json
// Klíč se čte z proměnné prostředí BACKUP_KEY (stejný jako v GitHub Secrets). Nikdy ho nepište do souborů.
import { readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
const key = process.env.BACKUP_KEY;
if (!key) { console.error('Nastavte proměnnou BACKUP_KEY'); process.exit(1); }
const blob = new Uint8Array(readFileSync(process.argv[2]));
const k = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)), 'AES-GCM', false, ['decrypt']);
const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12) }, k, blob.slice(12));
process.stdout.write(new TextDecoder().decode(plain));
