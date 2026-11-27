-- Díly ze skladu použité v zakázce (požadavek majitele 27. 11. 2026). Jen přidává sloupec, data se nemění.
-- Díl patří buď k hodinkám (product_id), nebo k zakázce (commission_id) – nikdy k oběma.
ALTER TABLE parts ADD COLUMN commission_id TEXT;
CREATE INDEX IF NOT EXISTS ix_parts_commission ON parts(commission_id);
