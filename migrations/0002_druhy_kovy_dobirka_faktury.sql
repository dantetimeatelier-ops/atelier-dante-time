-- Druh hodinek, materiál pouzdra a punc, dobírka, obecné faktury

-- Druh kusu: originální hodinky (renovované / po servisu), přestavba, sestava z dílů
ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'original'
  CHECK (kind IN ('original','prestavba','sestava'));
-- Materiál pouzdra: rozhoduje o povinnostech podle zákona o puncovnictví
ALTER TABLE products ADD COLUMN case_metal TEXT
  CHECK (case_metal IS NULL OR case_metal IN ('ocel','mosaz','chrom','pozlaceno','zlato','stribro','platina','titan','jine'));
ALTER TABLE products ADD COLUMN hallmark TEXT;        -- ryzost a puncovní značka (u drahých kovů povinné)
ALTER TABLE products ADD COLUMN plating TEXT;         -- popis pozlacení (např. „pozlaceno 20 µm“)
ALTER TABLE products ADD COLUMN authenticity_note TEXT; -- jak byly originální díly ověřeny
ALTER TABLE products ADD COLUMN serial_ref TEXT;      -- identifikace hodinek pro garanci pravosti (číslo pouzdra / strojku)

-- Dobírka
ALTER TABLE orders ADD COLUMN cod_fee INTEGER NOT NULL DEFAULT 0;

-- Faktury vystavené z administrace (k objednávkám, zakázkám i ručně)
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('order','commission','manual')),
  order_id TEXT REFERENCES orders(id),
  commission_id TEXT REFERENCES commissions(id),
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('test','live')),
  buyer_name TEXT NOT NULL,
  buyer_company TEXT, buyer_ico TEXT, buyer_dic TEXT,
  buyer_street TEXT, buyer_city TEXT, buyer_zip TEXT,
  buyer_email TEXT,
  items TEXT NOT NULL,                 -- JSON: [{ "text": "…", "price": 1234 }]
  total INTEGER NOT NULL,
  payment_method TEXT NOT NULL,        -- bank_transfer | card | cod | cash
  issued_at TEXT NOT NULL,
  taxable_date TEXT,                   -- datum uskutečnění plnění
  due_date TEXT,
  paid_at TEXT,
  variable_symbol TEXT,
  note TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_invoices_issued ON invoices(issued_at);

INSERT INTO settings (key, value) VALUES
  ('cod_enabled', '0'),
  ('cod_fee_czk', NULL),
  ('admin_setup_hash', NULL)
ON CONFLICT(key) DO NOTHING;
