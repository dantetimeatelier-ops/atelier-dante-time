-- Dante Time OS – centrální fakturace (požadavek majitele 26. 11. 2026)
-- Nová číselná řada DT-RRRR-NNNN (každý rok od 0001), zdroj prodeje, druh dokladu, zálohy, dobropisy,
-- hodinky (model, výrobní číslo) a propojení se skladem. Dřívější faktury zůstávají beze změny.
ALTER TABLE invoices ADD COLUMN kind TEXT NOT NULL DEFAULT 'faktura';       -- faktura | zalohova | dobropis
ALTER TABLE invoices ADD COLUMN channel TEXT NOT NULL DEFAULT 'eshop';      -- eshop | vinted | aukro | instagram | facebook | osobne | zakazka | jine
ALTER TABLE invoices ADD COLUMN related_invoice_id TEXT;                    -- dobropis → původní faktura; vyúčtování → záloha
ALTER TABLE invoices ADD COLUMN advance_deducted INTEGER NOT NULL DEFAULT 0; -- odečtená uhrazená záloha (Kč)
ALTER TABLE invoices ADD COLUMN product_id TEXT;                            -- prodané hodinky ze skladu
ALTER TABLE invoices ADD COLUMN watch_model TEXT;
ALTER TABLE invoices ADD COLUMN serial_ref TEXT;
ALTER TABLE invoices ADD COLUMN sent_at TEXT;                               -- odesláno zákazníkovi e-mailem
CREATE INDEX IF NOT EXISTS ix_invoices_kind ON invoices(kind, cancelled_at);
CREATE INDEX IF NOT EXISTS ix_invoices_product ON invoices(product_id);
UPDATE invoices SET channel = 'zakazka' WHERE source = 'commission';
UPDATE invoices SET channel = 'jine' WHERE source = 'manual';
