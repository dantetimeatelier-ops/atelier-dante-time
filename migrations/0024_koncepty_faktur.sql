-- Koncepty faktur: rozpracovaná faktura se uloží bez čísla (číslo dostane až při vystavení).
CREATE TABLE invoice_drafts (
  id TEXT PRIMARY KEY,
  commission_id TEXT,
  buyer_name TEXT,
  total_czk INTEGER,
  data TEXT NOT NULL,                     -- obsah formuláře (JSON)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_invoice_drafts_commission ON invoice_drafts(commission_id);
-- Adresa zákazníka u zakázky – předvyplní se do faktury
ALTER TABLE commissions ADD COLUMN contact_street TEXT;
ALTER TABLE commissions ADD COLUMN contact_city TEXT;
ALTER TABLE commissions ADD COLUMN contact_zip TEXT;
