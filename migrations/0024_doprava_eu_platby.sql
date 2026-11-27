-- Doprava po celé EU přes Zásilkovnu (Packeta) a příprava plateb kartou (zadání majitele 27. 11. 2026).
-- Jen přidává nová nastavení, žádná data se nemění. Prázdné = možnost se zákazníkům nezobrazí.
INSERT INTO settings (key, value) VALUES
  ('shipping_packeta_pickup_json', '{}'),   -- Packeta na výdejní místo mimo ČR, cena v Kč podle země, např. {"SK":129}
  ('shipping_packeta_home_json', '{}'),     -- Packeta na adresu včetně ČR, cena v Kč podle země, např. {"CZ":139,"SK":169}
  ('packeta_home_carriers_json', '{}'),     -- volitelně vlastní ID dopravce pro doručení na adresu, např. {"DE":111}
  ('ship_autonotify', '1')                  -- po založení zásilky rovnou označit odesláno a poslat zákazníkovi číslo zásilky
ON CONFLICT(key) DO NOTHING;
