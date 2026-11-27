-- Platby k fakturám: záloha, částečná platba, doplatek, přeplatek i vrácení peněz (záporná částka).
-- Chybně zadanou platbu nejde smazat beze stopy – zruší se s důvodem (historie zůstává).
CREATE TABLE invoice_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  amount_czk INTEGER NOT NULL,            -- kladná = přijato, záporná = vráceno zákazníkovi
  paid_on TEXT NOT NULL,                  -- datum úhrady (RRRR-MM-DD)
  method TEXT,                            -- bank_transfer, cash, card, cod…
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT,
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT
);
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_date ON invoice_payments(paid_on);
-- Storno s důvodem a autorem (neplátce DPH: storno faktury s uvedeným důvodem)
ALTER TABLE invoices ADD COLUMN cancel_reason TEXT;
ALTER TABLE invoices ADD COLUMN cancelled_by TEXT;
-- Dosavadní úhrady (jen datum úhrady) převést na platby v plné výši – stav ani součty se tím nemění
INSERT INTO invoice_payments (id, invoice_id, amount_czk, paid_on, method, note, created_by)
  SELECT lower(hex(randomblob(10))), id, total - COALESCE(advance_deducted, 0), substr(paid_at, 1, 10), payment_method, 'Úhrada z dřívější evidence', 'migrace'
  FROM invoices WHERE paid_at IS NOT NULL;
