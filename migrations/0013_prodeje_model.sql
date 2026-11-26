-- Prodeje: model hodinek a výrobní číslo (z faktur „Model:“ a „Serial no:“) – podle majitele 26. 11. 2026
ALTER TABLE sales ADD COLUMN watch_model TEXT;
ALTER TABLE sales ADD COLUMN serial_ref TEXT;
