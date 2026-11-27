-- Schválení majitele 27. 11. 2026 (R23): všechny hodinky pojištěné na plnou hodnotu, odeslání až při předání dopravci,
-- poplatky platební brány v nákladech hodinek. Jen přidává sloupce a nastavení, žádná data se nemažou.

-- Poplatek platební brány u objednávky (Kč), aby se do nákladů zapsal právě jednou
ALTER TABLE orders ADD COLUMN card_fee_czk INTEGER;

-- Do jaké hodnoty zboží dopravce odpovídá za škodu (Kč). Nad touto hodnotou se způsob dopravy zákazníkovi nenabídne.
-- Zdroje (ověřeno 27. 11. 2026, podrobně docs/PLATBY-A-DOPRAVA.md):
--  Zásilkovna: max. hodnota zásilky 20 000 Kč / 700 EUR (obchodní podmínky), za vyšší hodnotu odpovídá jen do 20 000 Kč
--  Balíkovna: šperky, drahé kovy „a podobné cennosti“ nad 5 000 Kč jen s doplňkovou službou Cenný obsah (Balíkovna plus);
--             hodinky nejsou výslovně uvedeny → bezpečně 5 000 Kč, dokud Česká pošta nepotvrdí jinak
--  Cenný balík / Balík Do ruky s Cenným obsahem (Česká pošta): udaná cena až 1 000 000 Kč
INSERT INTO settings (key, value) VALUES
  ('cover_packeta_czk', '20000'),        -- Zásilkovna v ČR (výdejní místo i adresa)
  ('cover_packeta_eu_eur', '700'),       -- Packeta do zahraničí (EUR)
  ('cover_balikovna_czk', '5000'),       -- Balíkovna (výdejní místo)
  ('cover_insured_czk', '1000000'),      -- pojištěná přeprava v ČR (Cenný balík)
  ('cover_insured_eu_czk', NULL)         -- pojištěná přeprava do EU: vyplní majitel podle zvoleného dopravce (prázdné = nenabízet)
ON CONFLICT(key) DO NOTHING;
