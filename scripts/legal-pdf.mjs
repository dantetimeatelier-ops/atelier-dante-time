// PDF právních dokumentů (obchodní podmínky, poučení o odstoupení s formulářem, záruční list) v CZ i EN.
// Vzniká při sestavení webu z platného textu v src/legal/*, takže se vždy shoduje s webem.
// Bez externích knihoven: vlastní jednoduchý sazeč + písmo DejaVu (zmenšené, scripts/fonts) vložené do PDF.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const FONT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'fonts');

// ---- TrueType: šířky znaků a mapování Unicode → glyf ------------------------------------------
export function parseTtf(buf) {
  const u16 = (o) => buf.readUInt16BE(o); const i16 = (o) => buf.readInt16BE(o); const u32 = (o) => buf.readUInt32BE(o);
  const tables = {};
  for (let i = 0, n = u16(4); i < n; i++) { const e = 12 + 16 * i; tables[buf.toString('latin1', e, e + 4)] = u32(e + 8); }
  const head = tables.head; const hhea = tables.hhea;
  const upm = u16(head + 18);
  const bbox = [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)];
  const ascent = i16(hhea + 4); const descent = i16(hhea + 6); const nH = u16(hhea + 34);
  const hmtx = tables.hmtx;
  const adv = (g) => u16(hmtx + 4 * Math.min(g, nH - 1));
  const cmap = new Map();
  const c = tables.cmap;
  for (let i = 0, n = u16(c + 2); i < n; i++) {
    const pid = u16(c + 4 + 8 * i); const eid = u16(c + 6 + 8 * i); const off = c + u32(c + 8 + 8 * i);
    if (pid !== 3 || eid !== 1 || u16(off) !== 4) continue;
    const segX2 = u16(off + 6); const ends = off + 14; const starts = ends + segX2 + 2; const deltas = starts + segX2; const ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = u16(ends + 2 * s); const start = u16(starts + 2 * s); const delta = i16(deltas + 2 * s); const ro = u16(ranges + 2 * s);
      for (let ch = start; ch <= end && ch !== 0xffff; ch++) {
        let g;
        if (!ro) g = (ch + delta) & 0xffff;
        else { g = u16(ranges + 2 * s + ro + 2 * (ch - start)); if (g) g = (g + delta) & 0xffff; }
        if (g) cmap.set(ch, g);
      }
    }
  }
  return { upm, bbox, ascent, descent, adv, cmap, buf };
}

function loadFont(file, name) {
  const t = parseTtf(readFileSync(path.join(FONT_DIR, file)));
  const used = new Map(); // glyf → znak
  const glyph = (ch) => {
    const cp = ch.codePointAt(0);
    let g = t.cmap.get(cp);
    if (!g) { const alt = { 0x202f: 0x20, 0x2009: 0x20, 0x200b: null }[cp]; g = alt ? t.cmap.get(alt) : t.cmap.get(0x3f); }
    if (g && !used.has(g)) used.set(g, cp);
    return g || 0;
  };
  const width = (s, size) => { let w = 0; for (const ch of s) w += t.adv(glyph(ch)); return (w / t.upm) * size; };
  const hex = (s) => [...s].map((ch) => glyph(ch).toString(16).padStart(4, '0')).join('');
  return { t, name, used, width, hex };
}

// ---- HTML → bloky textu ----------------------------------------------------------------------
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', sect: '§', times: '×', euro: '€' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m));

export function htmlBlocks(html, { origin }) {
  const blocks = []; const lists = []; let cur = null; let bold = 0; let skip = 0; let box = 0; let meta = 0; let link = null;
  const flush = () => { if (cur && cur.runs.some((r) => r.text.trim())) blocks.push(cur); cur = null; };
  const start = (type, extra = {}) => { flush(); cur = { type, runs: [], box: box > 0, meta: meta > 0, ...extra }; };
  const text = (s) => {
    if (skip) return;
    s = decode(s).replace(/\s+/g, ' ');
    if (!s.trim() && !cur) return;
    if (!cur) start('p');
    cur.runs.push({ text: s, bold: bold > 0 });
  };
  const re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[3]) { text(m[3]); continue; }
    const tag = m[1].toLowerCase(); const close = m[0][1] === '/'; const attrs = m[2] || '';
    if (tag === 'nav') { skip += close ? -1 : 1; continue; }
    if (skip) continue;
    if (tag === 'strong' || tag === 'b') { bold += close ? -1 : 1; continue; }
    if (tag === 'br') { text(' '); continue; }
    if (tag === 'a') {
      if (!close) link = (attrs.match(/href="([^"]*)"/) || [])[1] || null;
      else if (link && cur) {
        const shown = cur.runs.map((r) => r.text).join('');
        let url = null;
        if (link.startsWith('/') && !link.startsWith('//')) url = `${origin.replace('https://', '')}${link.split('#')[0]}`;
        else if (/^https?:/.test(link)) { const bare = link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); if (!shown.includes(bare)) url = bare; }
        if (url && url !== origin.replace('https://', '')) cur.runs.push({ text: ` (${url})`, bold: false, muted: true });
        link = null;
      }
      continue;
    }
    if (tag === 'ol' || tag === 'ul') { if (close) { flush(); lists.pop(); } else { flush(); lists.push({ type: tag, n: 0 }); } continue; }
    if (tag === 'li') { if (close) flush(); else { const l = lists[lists.length - 1] || { type: 'ul', n: 0 }; l.n++; start('li', { level: Math.max(1, lists.length), marker: l.type === 'ol' ? `${l.n}.` : '•' }); } continue; }
    if (/^h[1-6]$/.test(tag)) { if (close) flush(); else start('h'); continue; }
    if (tag === 'p') {
      if (close) { flush(); continue; }
      const isMeta = /doc-meta/.test(attrs);
      start('p'); if (isMeta) cur.meta = true;
      continue;
    }
    if (tag === 'div') { flush(); if (close) box = Math.max(0, box - 1); else if (/class="[^"]*card/.test(attrs)) box++; continue; }
    if (tag === 'tr') { flush(); if (!close) start('p'); continue; }
    if (tag === 'td' || tag === 'th') { if (!close && cur && cur.runs.length) cur.runs.push({ text: ' – ', bold: false }); continue; }
  }
  flush();
  for (const b of blocks) { // ořez mezer na okrajích bloku
    b.runs[0].text = b.runs[0].text.replace(/^\s+/, '');
    b.runs[b.runs.length - 1].text = b.runs[b.runs.length - 1].text.replace(/\s+$/, '');
  }
  return blocks;
}

// ---- Sazba a zápis PDF -----------------------------------------------------------------------
const A4 = [595.28, 841.89];
const M = { l: 62, r: 62, t: 78, b: 72 };
const GOLD = '0.784 0.635 0.290'; const INK = '0.102 0.102 0.102'; const MUTED = '0.42 0.42 0.42';
const pdfStr = (s) => `<FEFF${[...s].map((ch) => { const c = ch.codePointAt(0); return c > 0xffff ? '003F' : c.toString(16).padStart(4, '0'); }).join('')}>`;

export function renderPdf({ title, docLabel, metaLine, footer, blocks, lang }) {
  const F = { body: loadFont('DejaVuSans.ttf', 'DejaVuSans'), bold: loadFont('DejaVuSans-Bold.ttf', 'DejaVuSans-Bold'), serif: loadFont('DejaVuSerif.ttf', 'DejaVuSerif') };
  const fontKey = { body: 'F1', bold: 'F2', serif: 'F3' };
  const W = A4[0] - M.l - M.r;
  const pages = []; let ops = null; let y = 0;
  const newPage = () => { ops = []; pages.push(ops); y = A4[1] - M.t; };
  const textAt = (font, size, color, x, yy, s, tc = 0) => { if (!s) return; ops.push(`BT /${fontKey[font]} ${size} Tf ${color} rg ${tc} Tc 1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm <${F[font].hex(s)}> Tj ET`); };
  const rule = (x1, x2, yy, color = GOLD, w = 0.6) => ops.push(`${color} RG ${w} w ${x1.toFixed(2)} ${yy.toFixed(2)} m ${x2.toFixed(2)} ${yy.toFixed(2)} l S`);

  // Zalomení řádků se zachováním tučných úseků
  const wrap = (runs, size, width, baseFont = 'body') => {
    const words = [];
    for (const r of runs) {
      const font = baseFont === 'serif' ? 'serif' : r.bold ? 'bold' : 'body';
      for (const part of r.text.split(/(\s+)/)) if (part) words.push({ text: part, font, muted: r.muted, space: /^\s+$/.test(part) });
    }
    const lines = []; let line = []; let lw = 0;
    const push = () => { while (line.length && line[line.length - 1].space) line.pop(); if (line.length) lines.push(line); line = []; lw = 0; };
    for (const w of words) {
      if (w.space) { if (line.length) { line.push({ ...w, text: ' ' }); lw += F[w.font].width(' ', size); } continue; }
      let ww = F[w.font].width(w.text, size);
      if (lw + ww > width && line.length) push();
      if (ww > width) { // příliš dlouhé slovo (adresa) – rozdělit po znacích
        let chunk = '';
        for (const ch of w.text) { if (F[w.font].width(chunk + ch, size) > width) { line.push({ ...w, text: chunk }); push(); chunk = ''; } chunk += ch; }
        w.text = chunk; ww = F[w.font].width(chunk, size);
      }
      line.push(w); lw += ww;
    }
    push();
    return lines;
  };
  const drawLines = (lines, x, size, lead, opts = {}) => {
    for (const [i, line] of lines.entries()) {
      if (y - lead < M.b) { newPage(); }
      y -= lead;
      let cx = x;
      if (opts.box) ops.push(`${GOLD} RG 1.2 w ${(M.l + 2).toFixed(2)} ${(y - 3).toFixed(2)} m ${(M.l + 2).toFixed(2)} ${(y + lead - 3).toFixed(2)} l S`);
      if (i === 0 && opts.marker) textAt('body', size, opts.markerColor || INK, x - (opts.markerW || 14), y, opts.marker);
      // sloučit sousední úseky stejného písma
      const segs = [];
      for (const w of line) { const last = segs[segs.length - 1]; if (last && last.font === w.font && last.muted === w.muted) last.text += w.text; else segs.push({ ...w }); }
      for (const s of segs) { textAt(s.font, size, s.muted || opts.muted ? MUTED : opts.color || INK, cx, y, s.text); cx += F[s.font].width(s.text, size); }
    }
  };

  newPage();
  // Titulní hlavička dokumentu
  textAt('serif', 21, INK, M.l, y - 4, title); y -= 26;
  for (const l of wrap([{ text: metaLine }], 9, W)) { y -= 13; textAt('body', 9, MUTED, M.l, y, l.map((w) => w.text).join('')); }
  y -= 10; rule(M.l, M.l + 60, y, GOLD, 1); y -= 8;

  for (const b of blocks) {
    if (b.type === 'h') {
      const lines = wrap(b.runs, 12.5, W, 'serif');
      if (y - 18 - lines.length * 17 - 30 < M.b) newPage(); // nadpis nezůstane osiřelý na konci stránky
      y -= 12; drawLines(lines, M.l, 12.5, 17, { color: INK }); y -= 3;
      continue;
    }
    const isLi = b.type === 'li';
    const size = b.meta ? 8.5 : 9.6; const lead = b.meta ? 12 : 13.8;
    const indent = isLi ? 16 * b.level : 0; const boxPad = b.box ? 12 : 0;
    const lines = wrap(b.runs, size, W - indent - boxPad);
    y -= isLi ? 2.5 : 5;
    drawLines(lines, M.l + indent + boxPad, size, lead, { marker: isLi ? b.marker : null, markerColor: GOLD, markerW: b.marker === '•' ? 10 : 15, muted: b.meta, box: b.box });
  }

  // Záhlaví a zápatí na každé stránce (číslování „strana n z m“)
  const total = pages.length;
  pages.forEach((p, i) => {
    ops = p;
    textAt('body', 7.5, GOLD, M.l, A4[1] - 44, 'ATELIER DANTE TIME', 1.6);
    const lw = F.body.width(docLabel, 7.5); textAt('body', 7.5, MUTED, A4[0] - M.r - lw, A4[1] - 44, docLabel);
    rule(M.l, A4[0] - M.r, A4[1] - 52, GOLD, 0.4);
    rule(M.l, A4[0] - M.r, 50, '0.85 0.85 0.85', 0.4);
    textAt('body', 7.5, MUTED, M.l, 38, footer);
    const pn = lang === 'en' ? `page ${i + 1} of ${total}` : `strana ${i + 1} z ${total}`;
    textAt('body', 7.5, MUTED, A4[0] - M.r - F.body.width(pn, 7.5), 38, pn);
  });

  // ---- Zápis objektů PDF
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const stream = (dict, data, compress = true) => { const d = compress ? deflateSync(data) : data; return Buffer.concat([Buffer.from(`<< ${dict} /Length ${d.length}${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`, 'latin1'), d, Buffer.from('\nendstream', 'latin1')]); };
  const fontRefs = {};
  for (const [k, f] of Object.entries(F)) {
    const sc = 1000 / f.t.upm;
    const gids = [...f.used.keys()].sort((a, b) => a - b);
    const ff = add(stream(`/Length1 ${f.t.buf.length}`, f.t.buf));
    const fd = add(`<< /Type /FontDescriptor /FontName /${f.name} /Flags 32 /FontBBox [${f.t.bbox.map((v) => Math.round(v * sc)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(f.t.ascent * sc)} /Descent ${Math.round(f.t.descent * sc)} /CapHeight ${Math.round(f.t.ascent * sc * 0.7)} /StemV 80 /FontFile2 ${ff} 0 R >>`);
    const widths = gids.map((g) => `${g} [${Math.round(f.t.adv(g) * sc)}]`).join(' ');
    const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fd} 0 R /W [${widths}] /DW 600 /CIDToGIDMap /Identity >>`);
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def
1 begincodespacerange <0000> <FFFF> endcodespacerange
${gids.length} beginbfchar
${gids.map((g) => `<${g.toString(16).padStart(4, '0')}> <${f.used.get(g).toString(16).padStart(4, '0')}>`).join('\n')}
endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`;
    const tu = add(stream('', Buffer.from(cmap, 'latin1')));
    fontRefs[fontKey[k]] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${f.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
  }
  const res = `<< /Font << ${Object.entries(fontRefs).map(([k, r]) => `/${k} ${r} 0 R`).join(' ')} >> >>`;
  const pagesId = objs.length + 1 + pages.length * 2; // objekt Pages přijde za stránkami
  const kids = [];
  for (const p of pages) {
    const c = add(stream('', Buffer.from(p.join('\n'), 'latin1')));
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources ${res} /Contents ${c} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const info = add(`<< /Title ${pdfStr(`${title}`)} /Author ${pdfStr('Atelier Dante Time')} /Producer ${pdfStr('Dante Time')} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R /Lang (${lang === 'en' ? 'en' : 'cs-CZ'}) /ViewerPreferences << /DisplayDocTitle true >> >>`);
  const parts = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; const offsets = []; let pos = parts[0].length;
  objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]); offsets.push(pos); pos += b.length; parts.push(b); });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return { pdf: Buffer.concat(parts), pages: total };
}

// ---- Všechny dokumenty do dist/pravni ----------------------------------------------------------
export async function buildLegalPdfs(dist) {
  const { legalDoc, LEGAL_VERSION, EFFECTIVE_DATE } = await import('../src/legal/docs.mjs');
  const { legalPdfs } = await import('../src/legal/pdf-files.mjs');
  const { SITE, OPERATOR } = await import('../src/site.mjs');
  const out = [];
  for (const lang of ['cs', 'en']) {
    for (const f of legalPdfs(lang)) {
      const doc = legalDoc(f.key, lang);
      const html = doc.body().replace(/<p class="doc-meta">[^<]*(Verze|Version):[^<]*<\/p>/, ''); // verze je v hlavičce
      const blocks = htmlBlocks(html, { origin: SITE.origin });
      const en = lang === 'en';
      const { pdf, pages } = renderPdf({
        lang, title: doc.title, docLabel: f.label,
        metaLine: `${en ? 'Version' : 'Verze'} ${LEGAL_VERSION} · ${en ? 'Effective from' : 'Účinnost od'} ${EFFECTIVE_DATE} · ${OPERATOR.name} (${OPERATOR.tradeName}), ${en ? 'company ID' : 'IČO'} ${OPERATOR.ico} · ${SITE.email} · ${SITE.origin.replace('https://', '')}`,
        footer: `${SITE.name} · ${en ? 'version' : 'verze'} ${LEGAL_VERSION} · ${en ? 'effective from' : 'účinnost od'} ${EFFECTIVE_DATE}`,
        blocks,
      });
      const file = path.join(dist, f.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, pdf);
      out.push({ path: f.path, pages, bytes: pdf.length });
    }
  }
  return out;
}
