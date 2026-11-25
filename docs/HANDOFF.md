# Předávací poznámky mezi agenty

Nejnovější záznam je nahoře. Formát je popsán v `AGENTS.md`, sekce 5.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy (optimalizace obrázků)
**Hotovo:** Originály přesunuty do `assets/originals/`, optimalizované
verze (WebP, správné rozměry, `srcset`, `loading="lazy"`) jsou v `img/`.
Generuje je skript `tools/optimize-images.py`. Nový favicon (`favicon.ico`,
32 px PNG, `apple-touch-icon`), náhled pro sociální sítě `img/og-image.jpg`
(1200×630). Hlavní stránka: obrázky z ~5,9 MB na ~70 kB (mobil) / ~170 kB
(desktop). Vzhled ověřen srovnávacími snímky na 375/768/1280 px.
**Rozpracováno:** nic.
**Další krok:** zbytek fáze 1 (robots.txt, sitemap, canonical, 404).
**Pozor na:** nové fotky vkládej do `assets/originals/` a přidej je do
skriptu. Do HTML nikdy neodkazuj přímo na originály.

---

## 2026-11-25 – Claude – claude/dante-time-web-management-7g6wuy
**Hotovo:** technický audit (`docs/AUDIT-2026-11.md`), plán vývoje
(`docs/ROADMAP.md`), pravidla `AGENTS.md`, záznam rozhodnutí
(`docs/DECISIONS.md`). Kód webu se neměnil.
**Rozpracováno:** nic.
**Další krok:** čeká se na schválení dokumentů majitelem a na rozhodnutí
R1–R7. Potom fáze 1 (optimalizace obrázků).
**Pozor na:** `logo.png` a `favicon.png` jsou totožné soubory (1,5 MB).
`privacy.html` a `reklamace.html` nejsou nikde prolinkované.
