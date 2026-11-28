#!/usr/bin/env python3
"""
Generátor statické grafiky karty digitálního pasu (85,6 × 54 mm) → server/passport-card-art.js

Spouští se jen při změně designu (ne při sestavení webu):  python3 scripts/card-art.py
Potřebuje: fontTools, opencv-python (cv2), numpy, rsvg-convert (jen kontrola), písma Crimson Text a Inter (OFL).

Všechny texty se převádějí na křivky už tady (SVG pro xTool tak nepotřebuje žádná písma).
Logo se vektorizuje z public/img/logo-faktura.webp (skutečné logo Dante Time – štít s monogramem DT).
Výstup obsahuje jen absolutní příkazy M, L, C, Z v milimetrech (osa y dolů), aby šel stejně převést do SVG i PDF.
Tvary se nepřekrývají, takže inverze (evenodd s obdélníkem karty) dává přesný negativ.
"""
import json, os, subprocess, sys, tempfile
import numpy as np, cv2
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 85.6, 54.0
SERIF = '/usr/share/fonts/truetype/google-fonts/ofl/crimsontext/CrimsonText-SemiBold.ttf'
SANS = '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
SANS_IT = '/usr/share/fonts/opentype/inter/Inter-Italic.otf'
SANS_MED = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
SANS_SEMI = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'

f3 = lambda v: f'{v:.3f}'.rstrip('0').rstrip('.') if abs(v) >= 0.0005 else '0'


class AbsPen(BasePen):
    """Zapisuje obrys jako M/L/C/Z (kvadratické křivky převede na kubické)."""
    def __init__(self, glyphSet):
        super().__init__(glyphSet); self.d = []; self.cur = (0, 0)
    def _moveTo(self, p): self.d.append(f'M{f3(p[0])} {f3(p[1])}'); self.cur = p
    def _lineTo(self, p): self.d.append(f'L{f3(p[0])} {f3(p[1])}'); self.cur = p
    def _curveToOne(self, a, b, c): self.d.append(f'C{f3(a[0])} {f3(a[1])} {f3(b[0])} {f3(b[1])} {f3(c[0])} {f3(c[1])}'); self.cur = c
    def _qCurveToOne(self, a, b):
        p0 = self.cur
        c1 = (p0[0] + 2 / 3 * (a[0] - p0[0]), p0[1] + 2 / 3 * (a[1] - p0[1]))
        c2 = (b[0] + 2 / 3 * (a[0] - b[0]), b[1] + 2 / 3 * (a[1] - b[1]))
        self._curveToOne(c1, c2, b)
    def _closePath(self): self.d.append('Z')
    def _endPath(self): self.d.append('Z')


class Font:
    def __init__(self, path):
        self.f = TTFont(path); self.gs = self.f.getGlyphSet(); self.cmap = self.f.getBestCmap()
        self.upm = self.f['head'].unitsPerEm
        self.cap = getattr(self.f['OS/2'], 'sCapHeight', 0) or self.upm * 0.7
        self.kern = {}
        # jednoduchý párový kerning z GPOS se neřeší – texty mají rozpal, na kartě to nepoznáte
    def width(self, text, size, track=0):
        s = size / self.upm
        return sum(self.gs[self.cmap[ord(ch)]].width * s for ch in text) + track * size * max(len(text) - 1, 0)
    def path(self, text, size, x, y, track=0):
        """size = velikost písma v mm (em), (x, y) = levý konec účaří."""
        s = size / self.upm; out = []
        for ch in text:
            g = self.gs[self.cmap[ord(ch)]]
            pen = AbsPen(self.gs)
            g.draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
            out += pen.d
            x += g.width * s + track * size
        return ' '.join(out)


serif, sans, sans_it, sans_med, sans_semi = Font(SERIF), Font(SANS), Font(SANS_IT), Font(SANS_MED), Font(SANS_SEMI)


def text(font, s, size, cx=None, x=None, y=0, track=0, maxw=None):
    if maxw:
        while font.width(s, size, track) > maxw: size *= 0.98
    w = font.width(s, size, track)
    x0 = cx - w / 2 if cx is not None else x
    return font.path(s, size, x0, y, track), (x0, x0 + w), size


def trace(mask, px_per_mm, eps=0.35, min_area=6, smooth=2, ox=0, oy=0):
    """Binární maska → obrysy (M/L/Z, mm). Díry jako vnitřní obrysy (evenodd)."""
    cnts, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cnts:
        if cv2.contourArea(c) < min_area * px_per_mm * px_per_mm / 100: continue
        c = cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(float)
        for _ in range(smooth):
            n = len(c); q = []
            for i in range(n):
                a, b = c[i], c[(i + 1) % n]; q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
            c = np.array(q)
        pts = c / px_per_mm + [ox, oy]
        out.append('M' + ' L'.join(f'{f3(px)} {f3(py)}' for px, py in pts) + ' Z')
    return ' '.join(out)


def logo(height_mm, cx, top):
    im = cv2.imread(os.path.join(ROOT, 'public/img/logo-faktura.webp'), cv2.IMREAD_UNCHANGED)
    a = im[:, :, 3].astype(np.float32) / 255
    g = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY).astype(np.float32)
    ink = a * (255 - g)
    S = 8
    big = cv2.GaussianBlur(cv2.resize(ink, None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC), (0, 0), S * 1.2)
    bw = cv2.threshold(big, 55, 255, cv2.THRESH_BINARY)[1].astype(np.uint8)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (S * 3, S * 3)))
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (S * 2, S * 2)))
    bw = cv2.threshold(cv2.GaussianBlur(bw, (0, 0), S * 0.8), 127, 255, cv2.THRESH_BINARY)[1]
    ys, xs = np.nonzero(bw); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    k = (y1 - y0) / height_mm  # px na mm
    w_mm = (x1 - x0) / k
    bw = bw[y0:y1 + 1, x0:x1 + 1].copy()
    bw = cv2.copyMakeBorder(bw, 2, 2, 2, 2, cv2.BORDER_CONSTANT, value=0)
    return trace(bw, k, eps=S * 0.45, min_area=0.5, ox=cx - w_mm / 2 - 2 / k, oy=top - 2 / k), w_mm


def gears(region):
    """Hodinářský motiv: dvě ozubená kola kreslená linkou, oříznutá okrajem karty (rastr → obrys = bez překryvů)."""
    x0, y0, x1, y1 = region; K = 60  # px/mm
    Wp, Hp = int((x1 - x0) * K), int((y1 - y0) * K)
    m = np.zeros((Hp, Wp), np.uint8)
    lw = max(1, int(0.32 * K))
    def gear(cx, cy, r, teeth, depth, hub, spokes, rot):
        cx, cy = (cx - x0) * K, (cy - y0) * K
        pts = []
        # lichoběžníkové zuby: patka → bok → hlava → bok
        prof = [(0.00, 0), (0.12, 1), (0.42, 1), (0.54, 0)]
        for i in range(teeth):
            for f, tip in prof:
                t = (i + f) / teeth * 2 * np.pi + rot
                rr = r if tip else r - depth
                pts.append((cx + rr * K * np.cos(t), cy + rr * K * np.sin(t)))
        cv2.polylines(m, [np.int32(pts)], True, 255, lw, cv2.LINE_AA)
        rim = r - depth - 1.0
        cv2.circle(m, (int(cx), int(cy)), int(rim * K), 255, lw, cv2.LINE_AA)
        cv2.circle(m, (int(cx), int(cy)), int(hub * K), 255, lw, cv2.LINE_AA)
        cv2.circle(m, (int(cx), int(cy)), int(hub * 0.42 * K), 255, lw, cv2.LINE_AA)
        for j in range(spokes):
            t = j / spokes * 2 * np.pi + rot * 3
            a = (cx + hub * K * np.cos(t), cy + hub * K * np.sin(t))
            b = (cx + rim * K * np.cos(t), cy + rim * K * np.sin(t))
            cv2.line(m, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), 255, lw, cv2.LINE_AA)
    gear(11.5, 52.4, 9.2, 24, 0.95, 1.8, 5, 0.05)
    gear(26.6, 53.6, 6.6, 17, 0.85, 1.35, 4, 0.16)
    # jemný oblouk kolem velkého kola (jako v návrhu)
    cv2.ellipse(m, (int((11.5 - x0) * K), int((52.4 - y0) * K)), (int(11.0 * K), int(11.0 * K)), 0, 188, 258, 255, lw, cv2.LINE_AA)
    m = cv2.threshold(m, 110, 255, cv2.THRESH_BINARY)[1]
    m = cv2.copyMakeBorder(m, 0, 0, 0, 0, cv2.BORDER_CONSTANT, value=0)
    return trace(m, K, eps=0.6, min_area=0.02, smooth=1, ox=x0, oy=y0)


def rect(x, y, w, h):
    return f'M{f3(x)} {f3(y)} L{f3(x + w)} {f3(y)} L{f3(x + w)} {f3(y + h)} L{f3(x)} {f3(y + h)} Z'


# ---------------------------------------------------------------- rozvržení (mm)
L_CX = 22.4          # střed levého bloku
R_X0, R_X1 = 47.6, 82.6
R_CX = (R_X0 + R_X1) / 2
parts = []

lp, lw = logo(12.6, L_CX, 3.9); parts.append(('logo', lp))
p, (a, b), _ = text(serif, 'DANTE TIME', 4.6, cx=L_CX, y=21.2, track=0.13); parts.append(('brand', p))
sub, (sa, sb), _ = text(sans_med, 'ATELIÉR HODINEK', 1.55, cx=L_CX, y=24.15, track=0.22); parts.append(('sub', sub))
ly = 23.62
parts.append(('sublines', rect(sa - 6.2, ly, 4.8, 0.16) + ' ' + rect(sb + 1.4, ly, 4.8, 0.16)))
parts.append(('divider', rect(44.75, 4.6, 0.2, 19.6)))

t1, _, s1 = text(serif, 'DIGITÁLNÍ PAS HODINEK', 3.6, cx=R_CX, y=10.0, track=0.06, maxw=R_X1 - R_X0)
t2, _, _ = text(sans_med, 'DIGITAL WATCH PASSPORT', 1.75, cx=R_CX, y=13.6, track=0.2, maxw=R_X1 - R_X0 - 4)
parts.append(('title_cs', t1)); parts.append(('title_en', t2))

TX = 4.0; TW = 39.5
cz1, _, csz = text(sans, 'Digitální pas hodinek s ověřením', 2.05, x=TX, y=30.6, maxw=TW)
cz2, _, _ = text(sans, 'pravosti, původu a servisní historie.', csz, x=TX, y=33.35)
parts.append(('cz', cz1 + ' ' + cz2))
parts.append(('sep', rect(TX, 35.15, 17.5, 0.14)))
en1, _, esz = text(sans_it, 'Digital watch passport with verification', csz, x=TX, y=38.0, maxw=TW)
en2, _, _ = text(sans_it, 'of authenticity, origin and service history.', esz, x=TX, y=40.75, maxw=TW)
parts.append(('en', en1 + ' ' + en2))

parts.append(('gears', gears((0.0, 41.7, 44.0, H))))

# QR a kód – jen místo; obsah se doplní za běhu (server/passport-card.js)
QR = {'cx': R_CX, 'top': 17.2, 'size': 24.2}   # velikost včetně klidové zóny 4 moduly
CODE = {'cx': R_CX, 'y': 46.3, 'size': 2.75, 'track': 0.14}

# glyfy pro kód pasu (abeceda kódu + číslice a písmena pro jistotu)
glyphs = {}
for ch in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-':
    g = sans_semi.gs[sans_semi.cmap[ord(ch)]]
    pen = AbsPen(sans_semi.gs); s = 1 / sans_semi.upm
    g.draw(TransformPen(pen, (s, 0, 0, -s, 0, 0)))
    glyphs[ch] = {'w': round(g.width * s, 5), 'd': ' '.join(pen.d).replace('M', 'M').strip()}

# ---------------------------------------------------------------- kontrola: nonzero vs evenodd (překryvy obrysů)
def png(d, rule):
    with tempfile.TemporaryDirectory() as t:
        sv = os.path.join(t, 'a.svg'); pn = os.path.join(t, 'a.png')
        open(sv, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{int(W*20)}" height="{int(H*20)}"><rect width="100%" height="100%" fill="#fff"/><path fill-rule="{rule}" d="{d}"/></svg>')
        subprocess.run(['rsvg-convert', sv, '-o', pn], check=True)
        return cv2.imread(pn, cv2.IMREAD_GRAYSCALE)
allp = ' '.join(d for _, d in parts)
diff = int((cv2.absdiff(png(allp, 'nonzero'), png(allp, 'evenodd')) > 128).sum())
print('rozdíl nonzero/evenodd (pixely):', diff)
if diff > 40: sys.exit('Tvary se překrývají – inverze by nebyla přesná.')
# překryv statických tvarů s plochou QR
qr_l, qr_t = QR['cx'] - QR['size'] / 2, QR['top']
m = png(allp, 'evenodd')[int(qr_t * 20):int((qr_t + QR['size']) * 20), int(qr_l * 20):int((qr_l + QR['size']) * 20)]
assert (m < 128).sum() == 0, 'Statická grafika zasahuje do klidové zóny QR'

out = {'W': W, 'H': H, 'QR': QR, 'CODE': CODE, 'STATIC': {k: v for k, v in parts}, 'GLYPHS': glyphs}
js = ('// VYGENEROVÁNO skriptem scripts/card-art.py – neupravovat ručně.\n'
      '// Grafika karty digitálního pasu (85,6 × 54 mm): logo Dante Time, texty převedené na křivky (Crimson Text, Inter – OFL), ozubená kola.\n'
      f'export const CARD = {json.dumps(out, ensure_ascii=False, separators=(",", ":"))};\n')
open(os.path.join(ROOT, 'server/passport-card-art.js'), 'w').write(js)
print('zapsáno', len(js) // 1024, 'kB')
