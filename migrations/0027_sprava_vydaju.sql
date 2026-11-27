-- Jednotná správa výdajů (požadavek majitele 27. 11. 2026). Jen přidává sloupce, data se nemění.
ALTER TABLE costs ADD COLUMN note TEXT;        -- poznámka k výdaji
ALTER TABLE costs ADD COLUMN updated_at TEXT;  -- poslední úprava
CREATE INDEX IF NOT EXISTS ix_documents_sale ON documents(sale_id);
