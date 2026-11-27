-- Jednotný systém pojmenování hodinek „DT – ZNAČKA model označení“ (rozhodnutí majitele R26, 27. 11. 2026).
-- Převede názvy všech hodinek (i prodaných – archiv), SEO titulky, výchozí popisky fotografií a digitální pasy.
-- Jméno modelu a evidenční číslo zůstávají beze změny, mění se jen tvar (předpona DT a značka velkými písmeny).
-- Vystavené faktury, objednávky a záznamy prohlídek se NEMĚNÍ (historické doklady).
-- Stejné pravidlo v kódu: src/shop/naming.mjs (dtName). Katalog v repozitáři se převádí při nasazení.

-- Popisky fotografií, které byly jen kopií názvu
UPDATE product_images SET alt = (SELECT CASE
    WHEN p.title LIKE 'DT – %' THEN p.title
    WHEN trim(COALESCE(p.brand, '')) <> '' AND lower(substr(trim(p.title), 1, length(trim(p.brand)))) = lower(trim(p.brand))
      AND (length(trim(p.title)) = length(trim(p.brand)) OR substr(trim(p.title), length(trim(p.brand)) + 1, 1) = ' ')
      THEN 'DT – ' || upper(trim(p.brand)) || substr(trim(p.title), length(trim(p.brand)) + 1)
    WHEN trim(COALESCE(p.brand, '')) <> '' THEN 'DT – ' || upper(trim(p.brand)) || ' ' || trim(p.title)
    ELSE 'DT – ' || trim(p.title) END FROM products p WHERE p.id = product_images.product_id)
WHERE alt IS NOT NULL AND alt = (SELECT p.title FROM products p WHERE p.id = product_images.product_id AND p.title NOT LIKE 'DT – %' AND NOT (p.title = 'Hodinky' AND trim(COALESCE(p.brand, '')) = ''));

-- Název a SEO titulek (SQLite počítá všechny výrazy ze starých hodnot)
UPDATE products SET
  seo_title = CASE WHEN seo_title IS NOT NULL AND seo_title <> '' AND substr(seo_title, 1, length(title)) = title
    THEN CASE
    WHEN title LIKE 'DT – %' THEN title
    WHEN trim(COALESCE(brand, '')) <> '' AND lower(substr(trim(title), 1, length(trim(brand)))) = lower(trim(brand))
      AND (length(trim(title)) = length(trim(brand)) OR substr(trim(title), length(trim(brand)) + 1, 1) = ' ')
      THEN 'DT – ' || upper(trim(brand)) || substr(trim(title), length(trim(brand)) + 1)
    WHEN trim(COALESCE(brand, '')) <> '' THEN 'DT – ' || upper(trim(brand)) || ' ' || trim(title)
    ELSE 'DT – ' || trim(title) END || substr(seo_title, length(title) + 1) ELSE seo_title END,
  title = CASE
    WHEN title LIKE 'DT – %' THEN title
    WHEN trim(COALESCE(brand, '')) <> '' AND lower(substr(trim(title), 1, length(trim(brand)))) = lower(trim(brand))
      AND (length(trim(title)) = length(trim(brand)) OR substr(trim(title), length(trim(brand)) + 1, 1) = ' ')
      THEN 'DT – ' || upper(trim(brand)) || substr(trim(title), length(trim(brand)) + 1)
    WHEN trim(COALESCE(brand, '')) <> '' THEN 'DT – ' || upper(trim(brand)) || ' ' || trim(title)
    ELSE 'DT – ' || trim(title) END
WHERE title NOT LIKE 'DT – %' AND NOT (title = 'Hodinky' AND trim(COALESCE(brand, '')) = '');

-- Přestavby: upozornění, že nejde o oficiální nový model původního výrobce
UPDATE products SET description_cs = description_cs || char(10) || char(10) || 'Jde o nezávislou přestavbu ateliéru Dante Time s využitím originálních historických komponentů, nikoli o oficiální nový model původního výrobce.'
WHERE kind = 'prestavba' AND description_cs IS NOT NULL AND trim(description_cs) <> '' AND instr(description_cs, 'nezávislou přestavbu ateliéru Dante Time') = 0;
UPDATE products SET description_en = description_en || char(10) || char(10) || 'This is an independent rebuild by Atelier Dante Time using original historic components, not an official new model of the original manufacturer.'
WHERE kind = 'prestavba' AND description_en IS NOT NULL AND trim(description_en) <> '' AND instr(description_en, 'independent rebuild by Atelier Dante Time') = 0;

-- Digitální pasy hodinek (živý záznam o kusu, ne účetní doklad)
UPDATE watch_passports SET title = CASE
    WHEN title LIKE 'DT – %' THEN title
    WHEN trim(COALESCE(brand, '')) <> '' AND lower(substr(trim(title), 1, length(trim(brand)))) = lower(trim(brand))
      AND (length(trim(title)) = length(trim(brand)) OR substr(trim(title), length(trim(brand)) + 1, 1) = ' ')
      THEN 'DT – ' || upper(trim(brand)) || substr(trim(title), length(trim(brand)) + 1)
    WHEN trim(COALESCE(brand, '')) <> '' THEN 'DT – ' || upper(trim(brand)) || ' ' || trim(title)
    ELSE 'DT – ' || trim(title) END WHERE title NOT LIKE 'DT – %';
