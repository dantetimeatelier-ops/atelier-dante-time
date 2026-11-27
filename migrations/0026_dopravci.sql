-- Správa dopravců v administraci (schváleno majitelem 27. 11. 2026, R24).
-- Každý způsob dopravy = jeden řádek: ceny podle zemí, příplatek podle hodnoty, dobírka, maximální krytá hodnota,
-- výluky (drahé kovy), automatizace (štítek, sledování) a náklad dopravce pro výpočet zisku.
-- Stav: aktivni = zákazníci vidí · pripraveno = nastaveno, ale zákazníkům skryto (neověřené podmínky) · vypnuto.
-- Jen přidává tabulku a sloupce; stávající nastavení dopravy se převezmou, nic se nemaže.
CREATE TABLE IF NOT EXISTS shipping_methods (
  id                    TEXT PRIMARY KEY,          -- shodné s orders.shipping_method
  provider              TEXT NOT NULL,             -- packeta | balikovna | ceska_posta | ppl | osobni | jiny
  kind                  TEXT NOT NULL DEFAULT 'adresa' CHECK (kind IN ('vydejni_misto','adresa','osobni')),
  name_cs               TEXT NOT NULL,
  name_en               TEXT NOT NULL,
  note_cs               TEXT,
  note_en               TEXT,
  status                TEXT NOT NULL DEFAULT 'pripraveno' CHECK (status IN ('aktivni','pripraveno','vypnuto')),
  sort_order            INTEGER NOT NULL DEFAULT 100,
  prices_json           TEXT NOT NULL DEFAULT '{}', -- cena pro zákazníka v Kč podle země {"CZ":99,"SK":129}; země bez ceny = nedoručujeme
  value_free_czk        INTEGER NOT NULL DEFAULT 0, -- hodnota zboží v ceně bez příplatku
  value_step_czk        INTEGER NOT NULL DEFAULT 10000, -- příplatek za každých započatých … Kč nad value_free
  value_step_price_czk  INTEGER NOT NULL DEFAULT 0, -- … ve výši (zákazník)
  max_value_czk         INTEGER,                   -- max. krytá hodnota v ČR (prázdné = bez limitu)
  max_value_abroad_czk  INTEGER,                   -- max. krytá hodnota do zahraničí
  excluded_metals       TEXT NOT NULL DEFAULT '',  -- materiály pouzdra, které dopravce nepřepraví (zlato,stribro,platina)
  cod_enabled           INTEGER NOT NULL DEFAULT 0,
  cod_fee_czk           INTEGER NOT NULL DEFAULT 0, -- příplatek za dobírku pro zákazníka
  cod_max_czk           INTEGER,                   -- max. výše dobírky
  cost_json             TEXT NOT NULL DEFAULT '{}', -- náklad dopravce v Kč podle země (pro zisk)
  cost_step_price_czk   INTEGER NOT NULL DEFAULT 0, -- náklad za každý krok hodnoty (připojištění)
  cost_cod_czk          INTEGER NOT NULL DEFAULT 0, -- náklad dopravce za dobírku
  label_api             TEXT,                      -- packeta = štítek přes API Zásilkovny (zdarma), jinak ručně
  tracking              TEXT,                      -- packeta | cpost | ppl (odkaz) | NULL
  verification          TEXT,                      -- co je ověřeno / zdroj podmínek
  updated_at            TEXT
);

-- Náklad dopravy u objednávky (odhad z nastavení dopravce, majitel ho může opravit) → náklady hodinek
ALTER TABLE orders ADD COLUMN shipping_cost_czk INTEGER;

-- Převzetí stávajícího nastavení (ceny 99 / 79 Kč, Packeta po EU, osobní předání, pojištěná přeprava)
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, max_value_czk, max_value_abroad_czk, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_cod_czk, label_api, tracking, verification)
VALUES (
  'zasilkovna', 'packeta', 'vydejni_misto', 'Zásilkovna – výdejní místo nebo Z-BOX', 'Packeta – pickup point or Z-BOX', NULL, NULL,
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_zasilkovna_czk') IS NOT NULL THEN 'aktivni' ELSE 'pripraveno' END, 10,
  json_set(COALESCE((SELECT value FROM settings WHERE key = 'shipping_packeta_pickup_json'), '{}'), '$.CZ', CAST((SELECT value FROM settings WHERE key = 'shipping_zasilkovna_czk') AS INTEGER)),
  20000, 17000, 1, COALESCE(CAST((SELECT value FROM settings WHERE key = 'cod_fee_czk') AS INTEGER), 0), 20000,
  '{"CZ":91,"SK":110}', 25, 'packeta', 'packeta',
  'Obchodní podmínky Zásilkovny: max. hodnota zásilky 20 000 Kč / 700 EUR, připojištění nelze. Ceník pro firmy od 1. 9. 2026 (bez měsíčního poplatku).'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, max_value_czk, max_value_abroad_czk, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_cod_czk, label_api, tracking, verification)
VALUES (
  'zasilkovna_adresa', 'packeta', 'adresa', 'Zásilkovna – doručení na adresu', 'Packeta – home delivery', 'Doručí kurýr na vaši adresu.', 'Delivered by courier to your address.',
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_packeta_home_json') NOT IN ('{}', '') THEN 'aktivni' ELSE 'pripraveno' END, 20,
  COALESCE(NULLIF((SELECT value FROM settings WHERE key = 'shipping_packeta_home_json'), '{}'), '{"CZ":139,"SK":169}'),
  20000, 17000, 1, COALESCE(CAST((SELECT value FROM settings WHERE key = 'cod_fee_czk') AS INTEGER), 0), 20000,
  '{"CZ":130}', 25, 'packeta', 'packeta',
  'Obchodní podmínky Zásilkovny: max. hodnota zásilky 20 000 Kč / 700 EUR. Dopravce na adresu v zahraničí podle seznamu Packeta.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, max_value_czk, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_cod_czk, label_api, tracking, verification)
VALUES (
  'balikovna', 'balikovna', 'vydejni_misto', 'Balíkovna – výdejní místo', 'Balíkovna – pickup point', NULL, NULL,
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_balikovna_czk') IS NOT NULL THEN 'aktivni' ELSE 'pripraveno' END, 30,
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_balikovna_czk') IS NOT NULL THEN json_object('CZ', CAST((SELECT value FROM settings WHERE key = 'shipping_balikovna_czk') AS INTEGER)) ELSE '{}' END,
  5000, 1, COALESCE(CAST((SELECT value FROM settings WHERE key = 'cod_fee_czk') AS INTEGER), 0), 100000,
  '{"CZ":89}', 19, NULL, 'cpost',
  'Podmínky Balíkovny 2026: cennosti nad 5 000 Kč jen s Cenným obsahem, který na výdejní místo nejde → max. 5 000 Kč, dokud Česká pošta nepotvrdí, že hodinky nejsou cennost.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, value_free_czk, value_step_czk, value_step_price_czk, max_value_czk, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_step_price_czk, cost_cod_czk, label_api, tracking, verification)
VALUES (
  'balikovna_adresa', 'balikovna', 'adresa', 'Balíkovna na adresu – pojištěno na plnou hodnotu', 'Czech Post home delivery – insured for the full value', 'Cenný obsah, předání proti podpisu.', 'Valuable contents service, delivered against signature.',
  'pripraveno', 40, '{"CZ":179}', 50000, 10000, 17, 1000000, 0, 36, 100000,
  '{"CZ":149}', 17, 36, NULL, 'cpost',
  'Firemní ceník Balíkovny od 1. 11. 2026: na adresu S 99 Kč, Cenný obsah 50 Kč, hodnota nad 50 000 Kč 17 Kč / 10 000 Kč, krytí až 1 000 000 Kč. Vyžaduje bezplatnou písemnou Dohodu. ČEKÁ NA DOHODU A POTVRZENÍ PRO HODINKY.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, value_free_czk, value_step_czk, value_step_price_czk, max_value_czk, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_step_price_czk, cost_cod_czk, label_api, tracking, verification)
VALUES (
  'pojistena', 'ceska_posta', 'adresa', 'Česká pošta – Cenná zásilka, pojištěno na plnou hodnotu', 'Czech Post – insured valuable parcel', 'Předání proti podpisu.', 'Delivered against signature.',
  'pripraveno', 50,
  CASE WHEN (SELECT value FROM settings WHERE key = 'insured_price_czk') IS NOT NULL THEN json_object('CZ', CAST((SELECT value FROM settings WHERE key = 'insured_price_czk') AS INTEGER)) ELSE '{"CZ":190}' END,
  30000, 10000, 14, 1000000, 0, 0, 100000,
  '{"CZ":145}', 14, 0, NULL, 'cpost',
  'Ceník České pošty od 1. 4. 2026: Cenná zásilka S 131 Kč, udaná cena do 30 000 Kč 14 Kč, každých dalších 10 000 Kč 14 Kč, až 1 000 000 Kč, bez smlouvy. ČEKÁ NA POTVRZENÍ PRO HODINKY.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, value_free_czk, value_step_czk, value_step_price_czk, max_value_czk, excluded_metals, cod_enabled, cod_fee_czk, cod_max_czk, cost_json, cost_step_price_czk, label_api, tracking, verification)
VALUES (
  'ppl_adresa', 'ppl', 'adresa', 'PPL – doručení na adresu, pojištěno na plnou hodnotu', 'PPL – home delivery, insured for the full value', 'Předání proti podpisu.', 'Delivered against signature.',
  'pripraveno', 60, '{"CZ":290}', 50000, 50000, 90, 500000, 'zlato,stribro,platina', 0, 0, NULL,
  '{"CZ":250}', 90, NULL, 'ppl',
  'Ceník PPL od 1. 11. 2026: Parcel CZ Private 2 kg 189 Kč bez DPH, krytí 50 000 Kč v ceně, zvýšená odpovědnost do 100 000 Kč 72 Kč, do 250 000 Kč 364 Kč, do 500 000 Kč 730 Kč. Výluka drahé kovy a kameny. ČEKÁ NA POTVRZENÍ PRO HODINKY.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, value_free_czk, value_step_czk, value_step_price_czk, max_value_abroad_czk, excluded_metals, cost_json, cost_step_price_czk, label_api, tracking, verification)
VALUES (
  'ppl_eu', 'ppl', 'adresa', 'PPL – doručení na adresu, pojištěno na plnou hodnotu', 'PPL – home delivery, insured for the full value', 'Předání proti podpisu.', 'Delivered against signature.',
  'pripraveno', 70, '{"SK":420,"DE":420,"PL":420,"AT":930,"HU":930}', 100000, 150000, 740, 250000, 'zlato,stribro,platina',
  '{"SK":370,"DE":370,"PL":370,"AT":875,"HU":875}', 736, NULL, 'ppl',
  'PPL Parcel Connect (ceník od 1. 11. 2026): Slovensko 2 kg 305 Kč bez DPH, zóna 2 (AT, HU) 722 Kč; krytí 100 000 Kč v ceně, 100 001–250 000 Kč za 608 Kč bez DPH. Výluka drahé kovy a kameny. ČEKÁ NA POTVRZENÍ PRO HODINKY.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, max_value_abroad_czk, verification)
VALUES (
  'eu', 'jiny', 'adresa', 'Doprava do zahraničí – doručení na adresu', 'International delivery to your address', 'Dopravce podle cílové země (Zásilkovna a její partneři).', 'Carrier depends on the destination country (Packeta and its partners).',
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_eu_json') NOT IN ('{}', '') THEN 'aktivni' ELSE 'vypnuto' END, 80,
  COALESCE((SELECT value FROM settings WHERE key = 'shipping_eu_json'), '{}'), 17000,
  'Původní obecná doprava do EU (Zásilkovna a partneři): limit 700 EUR.'
);
INSERT OR IGNORE INTO shipping_methods (id, provider, kind, name_cs, name_en, note_cs, note_en, status, sort_order, prices_json, verification)
VALUES (
  'osobni', 'osobni', 'osobni', 'Osobní předání po předchozí domluvě', 'Personal handover by prior arrangement', 'Pouze po předchozí individuální domluvě. Nemáme kamennou prodejnu.', 'Only by prior individual arrangement. We have no retail shop.',
  CASE WHEN (SELECT value FROM settings WHERE key = 'shipping_osobni_enabled') = '0' THEN 'vypnuto' ELSE 'aktivni' END, 90, '{"*":0}',
  'Zdarma, jen po domluvě (rozhodnutí majitele).'
);

-- Automatický štítek Zásilkovny po zaplacení (API zdarma) – připraveno, vypnuto do rozhodnutí majitele
INSERT INTO settings (key, value) VALUES ('auto_label', '0'), ('label_weight_kg', '0.5') ON CONFLICT(key) DO NOTHING;
