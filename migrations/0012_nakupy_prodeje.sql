-- Dante Time OS – E3b v2: univerzální evidence nákupů a prodejů (úprava podle majitele 26. 11. 2026)
-- Nákupy z Aukra, AliExpressu, eBay, od soukromých osob…: screenshot / PDF / fotka → AI vyčte údaje → kontrola.
-- Historické faktury 2026 se importují do tabulky sales (nezasahují do číselné řady faktur systému).

-- Nákupy a náklady: měna, platforma, doprava, stav kontroly
ALTER TABLE costs ADD COLUMN platform TEXT;            -- aukro, aliexpress, ebay, vinted, soukrome…
ALTER TABLE costs ADD COLUMN currency TEXT NOT NULL DEFAULT 'CZK';
ALTER TABLE costs ADD COLUMN amount_orig REAL;         -- zaplaceno v původní měně (včetně dopravy)
ALTER TABLE costs ADD COLUMN fx_rate REAL;             -- kurz ČNB (Kč za 1 jednotku), lze upravit
ALTER TABLE costs ADD COLUMN shipping_czk INTEGER;     -- z toho doprava (informativně, je součástí amount_czk)
ALTER TABLE costs ADD COLUMN order_ref TEXT;           -- číslo objednávky / aukce (kontrola duplicit)
ALTER TABLE costs ADD COLUMN part_id TEXT;             -- nákup naskladněný jako díl
ALTER TABLE costs ADD COLUMN status TEXT NOT NULL DEFAULT 'potvrzeno' CHECK (status IN ('ke_kontrole','potvrzeno'));
ALTER TABLE costs ADD COLUMN source TEXT NOT NULL DEFAULT 'rucne';  -- rucne | ai
ALTER TABLE costs ADD COLUMN check_note TEXT;          -- co je potřeba ověřit
CREATE INDEX IF NOT EXISTS ix_costs_status ON costs(status);
CREATE INDEX IF NOT EXISTS ix_costs_order_ref ON costs(platform, order_ref);

-- Prodeje mimo e-shop a historické faktury (import). Faktury vystavené v systému jsou v tabulce invoices.
CREATE TABLE IF NOT EXISTS sales (
  id            TEXT PRIMARY KEY,
  number        TEXT,                         -- číslo faktury (z importu)
  issued_on     TEXT NOT NULL,                -- datum vystavení / prodeje (YYYY-MM-DD)
  buyer_name    TEXT,
  buyer_email   TEXT,
  buyer_address TEXT,
  items         TEXT,                         -- co bylo prodáno (text)
  total_czk     INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'CZK',
  amount_orig   REAL,
  fx_rate       REAL,
  payment_method TEXT,
  product_id    TEXT,                         -- prodané hodinky (pro marži)
  status        TEXT NOT NULL DEFAULT 'potvrzeno' CHECK (status IN ('ke_kontrole','potvrzeno')),
  source        TEXT NOT NULL DEFAULT 'rucne', -- rucne | import | ai
  check_note    TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sales_number ON sales(number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sales_date ON sales(issued_on);

-- Doklady: účel a výsledek vytěžení
ALTER TABLE documents ADD COLUMN purpose TEXT NOT NULL DEFAULT 'nakup';   -- nakup | prodej
ALTER TABLE documents ADD COLUMN sale_id TEXT;
ALTER TABLE documents ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'bez_ai'; -- bez_ai | ceka | hotovo | chyba | limit
ALTER TABLE documents ADD COLUMN ai_data TEXT;                             -- vyčtené údaje (JSON)

-- Kurzy ČNB (mezipaměť)
CREATE TABLE IF NOT EXISTS fx_rates (
  day   TEXT NOT NULL,
  code  TEXT NOT NULL,
  rate  REAL NOT NULL,      -- Kč za 1 jednotku měny
  PRIMARY KEY (day, code)
);

-- Role pro vytěžování dokladů a model AI (majitel může změnit v Ekonomice)
INSERT OR IGNORE INTO agent_roles (id, name, purpose, permissions, schedule, active) VALUES
 ('office', 'DT Doklady', 'Vyčte údaje ze screenshotů, PDF a faktur; nejisté údaje předá majiteli ke kontrole.',
  '{"samostatne":["číst nahrané doklady","připravit nákup nebo prodej ke kontrole","potvrdit spolehlivě rozpoznaný doklad"],"se_schvalenim":["mazat záznamy","měnit potvrzené údaje"]}', 'při nahrání dokladu', 1);
INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_model', 'claude-opus-5-5');
