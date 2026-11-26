-- Bankovní spojení uložené přímo u objednávky a faktury.
-- Doklady tak zůstanou beze změny, i když se v budoucnu změní účet ateliéru (src/site.mjs).
ALTER TABLE orders ADD COLUMN bank_account TEXT;
ALTER TABLE orders ADD COLUMN bank_iban TEXT;
ALTER TABLE orders ADD COLUMN bank_bic TEXT;
ALTER TABLE invoices ADD COLUMN bank_account TEXT;
ALTER TABLE invoices ADD COLUMN bank_iban TEXT;
ALTER TABLE invoices ADD COLUMN bank_bic TEXT;
-- Vše, co existovalo před 25. 11. 2026 (změna na podnikatelský účet), bylo vystaveno na původní účet.
UPDATE orders SET bank_account = '2854824133/0800', bank_iban = 'CZ6308000000002854824133', bank_bic = 'GIBACZPX' WHERE bank_iban IS NULL;
UPDATE invoices SET bank_account = '2854824133/0800', bank_iban = 'CZ6308000000002854824133', bank_bic = 'GIBACZPX' WHERE bank_iban IS NULL;
