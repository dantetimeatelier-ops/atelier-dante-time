// Karta digitálního pasu k gravírování: SVG v křivkách, QR = adresa pasu, klidová zóna, PDF ve skutečné velikosti, ZIP
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32 as zcrc } from 'node:zlib';
import * as C from '../../server/passport-card.js';
import { CARD } from '../../server/passport-card-art.js';

const code = '8T5TKKWQQ4QJ';
const url = `https://atelier-dante-time.cz/pas/${code}`;

const loops = (d) => d.split('M').slice(1).map((s) => s.match(/-?\d*\.?\d+/g).map(Number));
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; } return a / 2; };

test('SVG: rozměr karty, jen křivky (žádné texty a písma), jedna cesta evenodd', () => {
  const s = C.cardSvg({ code, url });
  assert.match(s, /width="85.6mm" height="54mm" viewBox="0 0 85.6 54"/);
  assert.ok(!/<text|font-family|<image|stroke=/.test(s));
  assert.equal((s.match(/<path /g) || []).length, 1);
  assert.match(s, /fill-rule="evenodd"/);
  assert.ok(!/<rect/.test(s), 'normální karta bez podkladu a bez olemování');
  const inv = C.cardSvg({ code, url, invert: true });
  assert.match(inv, /d="M3.18 0 L82.42 0 C/, 'inverze začíná podkladem karty se zaoblenými rohy');
  assert.match(C.cardSvg({ code, url, preview: true }), /<rect width="85.6" height="54" rx="3.18" fill="#fff"\/>/);
});

test('QR: obrys modulů má přesně plochu tmavých modulů, klidová zóna bez cizí grafiky, modul ≥ 0,45 mm', () => {
  const m = C.qrMatrix(url); const L = C.qrLayout(m);
  const dark = m.flat().filter(Boolean).length;
  const d = C.matrixPath(m, L.x0, L.y0, L.cell);
  const total = loops(d).reduce((s, l) => s + area(l), 0);
  assert.ok(Math.abs(total - dark * L.cell * L.cell) < 0.05, `plocha ${total} vs ${dark * L.cell ** 2}`);
  assert.ok(L.cell >= 0.45 && L.quiet >= 4 * L.cell - 1e-9);
  // žádný bod statické grafiky ani kódu v čtverci QR (vč. klidové zóny)
  const { x, y, size } = L.box; const inBox = (px, py) => px > x && px < x + size && py > y && py < y + size;
  for (const [k, p] of Object.entries(CARD.STATIC)) for (const l of loops(p)) for (let i = 0; i < l.length; i += 2) assert.ok(!inBox(l[i], l[i + 1]), `${k} zasahuje do QR`);
  // vše uvnitř karty
  for (const l of loops(C.cardPath({ code, url }))) for (let i = 0; i < l.length; i += 2) assert.ok(l[i] >= -0.01 && l[i] <= 85.61 && l[i + 1] >= -0.01 && l[i + 1] <= 54.01);
  const chk = C.qrCheck({ code, url, expectedUrl: url, status: 'platny' });
  assert.equal(chk.ok, true);
  assert.equal(C.qrCheck({ code, url, expectedUrl: url + 'x', status: 'platny' }).ok, false);
  assert.equal(C.qrCheck({ code, url, expectedUrl: url, status: 'zruseny' }).ok, false);
});

test('každé hodinky mají vlastní kartu (jiný kód → jiný QR i text)', () => {
  const a = C.cardPath({ code, url }); const b = C.cardPath({ code: 'ABCDEFGHJKMN', url: url.replace(code, 'ABCDEFGHJKMN') });
  assert.notEqual(a, b);
});

test('PDF: stránka přesně 85,6 × 54 mm, vektorově, více karet = více stránek', () => {
  const txt = new TextDecoder('latin1').decode(C.cardsPdf([{ code, url }, { code: 'ABCDEFGHJKMN', url }], { invert: true }));
  assert.match(txt, /^%PDF-1\.4/);
  assert.equal((txt.match(/\/Type \/Page /g) || []).length, 2);
  assert.match(txt, /\/MediaBox \[0 0 242\.646 153\.071\]/);
  assert.match(txt, /\/PrintScaling \/None/);
  assert.match(txt, /f\*\n/);
  const xref = Number(txt.match(/startxref\n(\d+)/)[1]); assert.equal(txt.slice(xref, xref + 4), 'xref');
});

test('ZIP: platný archiv s CRC', () => {
  const z = C.zip([{ name: 'a.svg', data: 'ahoj' }, { name: 'b/c.pdf', data: new Uint8Array([1, 2, 3]) }]);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(14, true), zcrc(Buffer.from('ahoj')));
  assert.equal(dv.getUint16(z.length - 12, true), 2);
});

test('QR z vykreslené karty se skutečně přečte (jen když je k dispozici rsvg-convert + OpenCV)', (t) => {
  const ok = spawnSync('python3', ['-c', 'import cv2'], { stdio: 'ignore' }).status === 0 && spawnSync('rsvg-convert', ['--version'], { stdio: 'ignore' }).status === 0;
  if (!ok) return t.skip('rsvg-convert / OpenCV není nainstalované');
  const dir = mkdtempSync(path.join(tmpdir(), 'karta-'));
  for (const invert of [false, true]) {
    const sv = path.join(dir, `k${invert}.svg`); const pn = path.join(dir, `k${invert}.png`);
    writeFileSync(sv, C.cardSvg({ code, url, invert }));
    execFileSync('rsvg-convert', ['-w', '1011', '-b', 'white', sv, '-o', pn]);
    const out = execFileSync('python3', ['-c', `import cv2,sys\nim=cv2.imread(sys.argv[1])\nif sys.argv[2]=='1': im=255-im\nprint(cv2.QRCodeDetector().detectAndDecode(im)[0])`, pn, invert ? '1' : '0'], { encoding: 'utf8' }).trim();
    assert.equal(out, url, invert ? 'inverze (po vypálení na tmavém materiálu)' : 'normální karta');
  }
});
