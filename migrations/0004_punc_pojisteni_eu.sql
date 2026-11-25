-- Puncovní úřad a pojištěná přeprava do jednotlivých zemí EU
INSERT INTO settings (key, value) VALUES
  ('punc_notified', '0'),               -- 1 = majitel oznámil Puncovnímu úřadu obchod s drahými kovy a e-shop (§ 35 zákona 539/1992 Sb.)
  ('shipping_eu_insured_json', '{}')    -- ceny pojištěné přepravy do zemí EU v Kč, např. {"SK":590,"DE":890}; jinak platí insured_eu_price_czk
ON CONFLICT(key) DO NOTHING;
