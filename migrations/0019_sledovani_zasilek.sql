-- DT Logistics: poslední známý stav zásilky ze Zásilkovny (API packetStatus)
ALTER TABLE orders ADD COLUMN tracking_code INTEGER;      -- kód stavu Zásilkovny (7 = doručeno, 10 = vráceno odesílateli…)
ALTER TABLE orders ADD COLUMN tracking_status TEXT;       -- text stavu pro administraci
ALTER TABLE orders ADD COLUMN tracking_at TEXT;           -- kdy Zásilkovna stav zaznamenala
ALTER TABLE orders ADD COLUMN tracking_checked_at TEXT;   -- kdy jsme se naposledy ptali
