// Karta digitálního pasu hodinek k laserovému gravírování (85,6 × 54 mm, černobílá).
// Vše se skládá z vektorových cest v milimetrech: statická grafika (server/passport-card-art.js),
// kód pasu z glyfů (texty už jsou křivky – xTool nepotřebuje písma) a QR kód obrysem modulů.
// Exporty: SVG (gravírování), PDF (tisk ve skutečné velikosti), ZIP (hromadně). PNG 600 DPI vzniká v prohlížeči ze SVG.
import qrcode from 'qrcode-generator';
import { CARD } from './passport-card-art.js';

const { W, H, QR, CODE } = CARD;
export const CARD_MM = { width: W, height: H };
const R = 3.18; // poloměr rohů platební karty (ISO/IEC 7810 ID-1) – jen pro inverzi (obdélník podkladu)
const n3 = (v) => (Math.round(v * 1000) / 1000).toString();

/** QR kód adresy pasu: úroveň opravy chyb Q (25 %) – odolnější při gravírování. */
export function qrMatrix(text) {
  const q = qrcode(0, 'Q');
  q.addData(text, 'Byte');
  q.make();
  const n = q.getModuleCount();
  const m = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
  return m;
}

/** Obrys tmavých modulů (sjednocené plochy bez švů, díry jako vnitřní obrysy) → cesta M/L/Z. */
export function matrixPath(m, x0, y0, cell) {
  const n = m.length;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && m[r][c];
  // orientované hrany: tmavá plocha vždy vpravo (po směru hodinových ručiček v souřadnicích y dolů)
  const edges = new Map();
  const add = (a, b) => { const k = `${a[0]},${a[1]}`; (edges.get(k) || edges.set(k, []).get(k)).push(b); };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!m[r][c]) continue;
    if (!dark(r - 1, c)) add([c, r], [c + 1, r]);
    if (!dark(r, c + 1)) add([c + 1, r], [c + 1, r + 1]);
    if (!dark(r + 1, c)) add([c + 1, r + 1], [c, r + 1]);
    if (!dark(r, c - 1)) add([c, r + 1], [c, r]);
  }
  const loops = [];
  while (edges.size) {
    const [startKey, list] = edges.entries().next().value;
    let cur = startKey.split(',').map(Number); let next = list.pop(); if (!list.length) edges.delete(startKey);
    const loop = [cur]; let prevDir = [next[0] - cur[0], next[1] - cur[1]];
    while (`${next[0]},${next[1]}` !== startKey) {
      const k = `${next[0]},${next[1]}`; const opts = edges.get(k);
      // v rohu dvou diagonálních modulů zatoč doprava (konzistentní obrysy bez křížení)
      let pick = 0;
      if (opts.length > 1) {
        const right = [-prevDir[1], prevDir[0]];
        const i = opts.findIndex((o) => o[0] - next[0] === right[0] && o[1] - next[1] === right[1]);
        pick = i >= 0 ? i : 0;
      }
      const nn = opts.splice(pick, 1)[0]; if (!opts.length) edges.delete(k);
      const dir = [nn[0] - next[0], nn[1] - next[1]];
      if (dir[0] !== prevDir[0] || dir[1] !== prevDir[1]) loop.push(next);
      prevDir = dir; cur = next; next = nn;
    }
    loops.push(loop);
  }
  return loops.map((l) => 'M' + l.map(([c, r]) => `${n3(x0 + c * cell)} ${n3(y0 + r * cell)}`).join(' L') + ' Z').join(' ');
}

/** Text kódu z glyfů (Inter SemiBold), vycentrovaný. */
function codePath(code) {
  const { cx, y, size, track } = CODE;
  const chars = [...String(code).toUpperCase()].filter((ch) => CARD.GLYPHS[ch]);
  const w = chars.reduce((s, ch) => s + CARD.GLYPHS[ch].w * size, 0) + track * size * Math.max(chars.length - 1, 0);
  let x = cx - w / 2; const out = [];
  for (const ch of chars) {
    const g = CARD.GLYPHS[ch];
    out.push(g.d.replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (() => { let i = 0; return (v) => n3(i++ % 2 === 0 ? x + Number(v) * size : y + Number(v) * size); })()));
    x += g.w * size + track * size;
  }
  return out.join(' ');
}

/** Rozvržení QR: velikost modulu, klidová zóna 4 moduly uvnitř vyhrazeného čtverce. */
export function qrLayout(matrix) {
  const n = matrix.length; const cell = QR.size / (n + 8);
  return { n, cell, x0: QR.cx - QR.size / 2 + 4 * cell, y0: QR.top + 4 * cell, quiet: 4 * cell, box: { x: QR.cx - QR.size / 2, y: QR.top, size: QR.size } };
}

/** Všechny tvary karty (jedna cesta, evenodd). */
export function cardPath({ code, url }) {
  const m = qrMatrix(url);
  const L = qrLayout(m);
  return [Object.values(CARD.STATIC).join(' '), codePath(code), matrixPath(m, L.x0, L.y0, L.cell)].join(' ');
}

const roundedRect = (w, h, r) => `M${r} 0 L${n3(w - r)} 0 C${n3(w - r * 0.4477)} 0 ${w} ${n3(r * 0.4477)} ${w} ${r} L${w} ${n3(h - r)} C${w} ${n3(h - r * 0.4477)} ${n3(w - r * 0.4477)} ${h} ${n3(w - r)} ${h} L${r} ${h} C${n3(r * 0.4477)} ${h} 0 ${n3(h - r * 0.4477)} 0 ${n3(h - r)} L0 ${r} C0 ${n3(r * 0.4477)} ${n3(r * 0.4477)} 0 ${r} 0 Z`;

/**
 * SVG k gravírování. Normálně: černé tvary, bez podkladu (bílá = negravírovat).
 * invert: černý podklad karty se zaoblenými rohy, tvary vyříznuté (přesný negativ) – pro tmavé kartičky,
 * aby po vypálení zůstal QR čitelný (tmavé moduly na světlém poli).
 */
export function cardSvg({ code, url, invert = false, preview = false }) {
  const shapes = cardPath({ code, url });
  const d = invert ? `${roundedRect(W, H, R)} ${shapes}` : shapes;
  const bg = preview && !invert ? `<rect width="${W}" height="${H}" rx="${R}" fill="#fff"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
<title>Digitální pas hodinek ${code} – Dante Time</title>
${bg}<path fill="#000" fill-rule="evenodd" d="${d}"/>
</svg>
`;
}

// --- PDF (vektorové, stránka přesně 85,6 × 54 mm) ---------------------------------------
const PT = 72 / 25.4;
function pdfOps(d) {
  const out = []; const nums = [];
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pt = (x, y) => `${(x * PT).toFixed(3)} ${((H - y) * PT).toFixed(3)}`;
  let cmd = null;
  for (const t of toks) {
    if (/[MLCZ]/.test(t)) { if (t === 'Z') out.push('h'); cmd = t; nums.length = 0; continue; }
    nums.push(Number(t));
    if (cmd === 'M' && nums.length === 2) { out.push(`${pt(nums[0], nums[1])} m`); nums.length = 0; cmd = 'L'; }
    else if (cmd === 'L' && nums.length === 2) { out.push(`${pt(nums[0], nums[1])} l`); nums.length = 0; }
    else if (cmd === 'C' && nums.length === 6) { out.push(`${pt(nums[0], nums[1])} ${pt(nums[2], nums[3])} ${pt(nums[4], nums[5])} c`); nums.length = 0; }
  }
  return out.join('\n');
}

/** PDF s jednou nebo více kartami (každá na vlastní stránce ve skutečné velikosti). */
export function cardsPdf(cards, { invert = false } = {}) {
  const enc = new TextEncoder();
  const objs = []; // [číslo] = obsah
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null); const pages = add(null);
  const kids = [];
  const wpt = (W * PT).toFixed(3), hpt = (H * PT).toFixed(3);
  for (const c of cards) {
    const shapes = cardPath(c);
    const d = invert ? `${roundedRect(W, H, R)} ${shapes}` : shapes;
    const stream = `0 g\n${pdfOps(d)}\nf*\n`;
    const content = add(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${wpt} ${hpt}] /TrimBox [0 0 ${wpt} ${hpt}] /Contents ${content} 0 R /Resources << >> >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R /ViewerPreferences << /PrintScaling /None >> >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (Digitalni pas hodinek - Dante Time) /Producer (Dante Time OS) >>`);
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
  const parts = [out];
  let len = enc.encode(out).length;
  objs.forEach((o, i) => { offs.push(len); const s = `${i + 1} 0 obj\n${o}\nendobj\n`; parts.push(s); len += enc.encode(s).length; });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(xref);
  return enc.encode(parts.join(''));
}

// --- Kontrola QR (bez externích služeb) ---------------------------------------------------
/**
 * Ověří, že QR na kartě odkazuje na veřejný pas, má dost velké moduly pro laser a klidovou zónu 4 moduly
 * bez cizí grafiky. Fyzické přečtení kódu se navíc zkouší v prohlížeči (BarcodeDetector) a v testech.
 */
export function qrCheck({ code, url, expectedUrl, status }) {
  const m = qrMatrix(url); const L = qrLayout(m);
  const checks = [
    { ok: url === expectedUrl, text: 'QR odkazuje na veřejný digitální pas těchto hodinek', detail: url },
    { ok: L.cell >= 0.45, text: `Velikost modulu ${L.cell.toFixed(2)} mm (pro laser min. 0,45 mm)` },
    { ok: L.quiet >= 4 * L.cell - 1e-9, text: `Volný okraj kolem QR ${L.quiet.toFixed(1)} mm (4 moduly)` },
    { ok: m.length <= 37, text: `QR verze ${(m.length - 17) / 4} (${m.length} × ${m.length} modulů), oprava chyb Q – 25 %` },
    { ok: /^[2-9A-Z]{8,16}$/.test(String(code)), text: `Identifikátor pasu ${code}` },
    { ok: status !== 'zruseny', text: status === 'zruseny' ? 'Pas je ZRUŠENÝ – stránka ukáže, že neplatí' : 'Pas je platný' },
  ];
  return { ok: checks.every((c) => c.ok), checks, modules: m.length, cell: L.cell };
}

// --- ZIP (bez komprese, bez knihoven) -----------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder(); const chunks = []; const central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255]; const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(data);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    chunks.push(Uint8Array.from(head), name, data);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + data.length;
  }
  const csize = central.reduce((s, c) => s + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
  const all = [...chunks, ...central, end]; const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0)); let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}
