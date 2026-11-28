-- Originalita hodinek v zakázce: prestavba (nové pouzdro a řemínek, jinak originál) / original (vše originální) / vlastni.
ALTER TABLE commissions ADD COLUMN parts_preset TEXT;
-- Zakázky, kde už byly díly vyplněné ručně, zůstanou na vlastním nastavení.
UPDATE commissions SET parts_preset = 'vlastni' WHERE authenticity_parts IS NOT NULL OR replaced_parts IS NOT NULL OR original_parts IS NOT NULL;
