#!/usr/bin/env python3
"""Příprava fotografií hodinek do katalogu (spouští agent, ne CI).

Použití: python3 scripts/foto-katalog.py <slug> <foto1> [foto2 ...]
Pořadí argumentů = pořadí na webu (první = hlavní fotografie).
Vytvoří katalog/<slug>/01-l.webp (max. 2000 px) a 01-s.webp (max. 800 px),
otočí podle EXIF a odstraní všechna metadata (poloha, zařízení, čas).
Na výstup vypíše JSON pro pole "fotky" v hodinky.json.
"""
import json, sys, os
from PIL import Image, ImageOps

slug, files = sys.argv[1], sys.argv[2:]
out_dir = os.path.join(os.path.dirname(__file__), '..', 'katalog', slug)
os.makedirs(out_dir, exist_ok=True)
res = []
for i, f in enumerate(files, 1):
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    name = f'{i:02d}'
    for suffix, size, q in (('l', 2000, 84), ('s', 800, 80)):
        c = im.copy(); c.thumbnail((size, size), Image.LANCZOS)
        c.save(os.path.join(out_dir, f'{name}-{suffix}.webp'), 'WEBP', quality=q, method=6)  # bez exif = bez metadat
        if suffix == 'l': w, h = c.size
    res.append({'soubor': name, 'alt': '', 'width': w, 'height': h})
print(json.dumps(res, ensure_ascii=False, indent=2))
