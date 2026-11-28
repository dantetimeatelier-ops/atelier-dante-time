-- Údaje pasu se vyplňují v zakázce a pas se z nich přepisuje (originální díly s garancí, popis, vyměněné díly).
ALTER TABLE commissions ADD COLUMN authenticity_parts TEXT;
ALTER TABLE commissions ADD COLUMN original_parts TEXT;
ALTER TABLE commissions ADD COLUMN replaced_parts TEXT;
-- Co už bylo ručně vyplněno v pasu zakázky, převezme zakázka (aby se uložením zakázky nic neztratilo).
UPDATE commissions SET
  authenticity_parts = (SELECT w.authenticity_parts FROM watch_passports w WHERE w.commission_id = commissions.id),
  original_parts = (SELECT w.original_parts FROM watch_passports w WHERE w.commission_id = commissions.id),
  replaced_parts = (SELECT w.replaced_parts FROM watch_passports w WHERE w.commission_id = commissions.id)
WHERE id IN (SELECT commission_id FROM watch_passports WHERE commission_id IS NOT NULL);
