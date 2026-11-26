-- Prodej do EU, platby v EUR, hmotnost drahého kovu, rozsah garance pravosti

-- Zákon č. 539/1992 Sb., o puncovnictví: na dokladu se u zboží z drahých kovů uvádí druh, hmotnost a ryzost
ALTER TABLE products ADD COLUMN precious_weight_g REAL;
-- Doživotní garance pravosti se vztahuje na deklarované originální strojky, ciferníky a ručičky
-- (seznam oddělený čárkou: strojek, cifernik, rucicky)
ALTER TABLE products ADD COLUMN authenticity_parts TEXT;

-- Měna platby (CZK / EUR) a přepočet v okamžiku objednávky
ALTER TABLE orders ADD COLUMN pay_currency TEXT NOT NULL DEFAULT 'CZK' CHECK (pay_currency IN ('CZK','EUR'));
ALTER TABLE orders ADD COLUMN pay_amount_cents INTEGER;      -- částka k úhradě v měně platby (haléře / centy)
ALTER TABLE orders ADD COLUMN eur_rate REAL;                 -- použitý kurz CZK za 1 EUR
ALTER TABLE invoices ADD COLUMN pay_currency TEXT NOT NULL DEFAULT 'CZK';
ALTER TABLE invoices ADD COLUMN pay_amount_cents INTEGER;
ALTER TABLE invoices ADD COLUMN eur_rate REAL;

INSERT INTO settings (key, value) VALUES
  ('eur_rate', NULL),                 -- kurz CZK/EUR pro platby v eurech (prázdné = platba v EUR se nenabízí)
  ('shipping_eu_json', '{}'),         -- ceny dopravy do zemí EU v Kč, např. {"SK":190,"DE":290}
  ('insured_threshold_czk', NULL),    -- od jaké ceny hodinek nabízet jen pojištěnou přepravu / osobní předání
  ('insured_price_czk', NULL),        -- cena pojištěné přepravy v ČR
  ('insured_eu_price_czk', NULL),     -- cena pojištěné přepravy do EU
  ('personal_handover_note', 'Osobní předání je možné pouze po předchozí individuální domluvě.')
ON CONFLICT(key) DO NOTHING;

UPDATE settings SET value = '1' WHERE key = 'shipping_osobni_enabled';

-- Ceny dopravy a dobírky v ČR podle majitele (25. 11. 2026)
UPDATE settings SET value = '99' WHERE key = 'shipping_zasilkovna_czk' AND value IS NULL;
UPDATE settings SET value = '79' WHERE key = 'shipping_balikovna_czk' AND value IS NULL;
UPDATE settings SET value = '49' WHERE key = 'cod_fee_czk' AND value IS NULL;
UPDATE settings SET value = '1' WHERE key = 'cod_enabled';

-- Jazyk objednávky (podle něj se posílají obchodní podmínky v e-mailu)
ALTER TABLE orders ADD COLUMN lang TEXT NOT NULL DEFAULT 'cs';
-- Verze podmínek se nově bere přímo z kódu (src/legal/common.mjs), stará hodnota v nastavení se nepoužívá
DELETE FROM settings WHERE key = 'terms_version';
