#!/usr/bin/env python3
"""Vygeneruje optimalizované obrázky webu z originálů.

Originály:  assets/originals/   (neměnit, slouží jako zdroj)
Výstup:     img/  a  favicon.ico

Spuštění:   python3 tools/optimize-images.py
Potřebuje:  Pillow s podporou WebP  (pip install Pillow)
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals"
OUT = ROOT / "img"
OUT.mkdir(exist_ok=True)


def load(name):
    return ImageOps.exif_transpose(Image.open(SRC / name))


def resized(im, width):
    if im.width <= width:
        return im.copy()
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def save_webp(im, name, quality=78):
    im.save(OUT / name, "WEBP", quality=quality, method=6)


def save_jpg(im, name, quality=80):
    im.convert("RGB").save(OUT / name, "JPEG", quality=quality,
                           optimize=True, progressive=True)


# Logo: zobrazuje se max. 78 px -> 160 px stačí i pro Retina displeje
logo = load("logo.png").convert("RGBA")
save_webp(resized(logo, 160), "logo-160.webp", quality=85)
resized(logo, 32).save(OUT / "favicon-32.png", optimize=True)
apple = Image.new("RGB", (180, 180), (7, 7, 7))
apple.paste(resized(logo, 180), (0, 0), resized(logo, 180))
apple.save(OUT / "apple-touch-icon.png", optimize=True)
logo.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# Úvodní fotka (pozadí hlavní stránky)
hero = load("hero-bg.jpg")
save_webp(resized(hero, 800), "hero-800.webp", quality=72)
save_webp(resized(hero, 1536), "hero-1536.webp", quality=72)

# Náhled pro sdílení na sociálních sítích (1200x630, JPG kvůli kompatibilitě)
og = ImageOps.fit(hero, (1200, 630), Image.LANCZOS)
save_jpg(og, "og-image.jpg", quality=78)

# Maskot Dante (stránka O nás)
dante = load("dante1.jpg")
save_webp(resized(dante, 400), "dante-400.webp")
save_webp(resized(dante, 754), "dante-754.webp")

# Ukázka hotového kusu (stránka Služby), zobrazuje se max. 360 px
box = load("service-watch-box-2.jpg")
save_webp(resized(box, 400), "watch-box-400.webp")
save_webp(resized(box, 720), "watch-box-720.webp")

for f in sorted(list(OUT.iterdir()) + [ROOT / "favicon.ico"]):
    w, h = Image.open(f).size
    print(f"{f.relative_to(ROOT)}: {w}x{h}, {f.stat().st_size // 1024} kB")
