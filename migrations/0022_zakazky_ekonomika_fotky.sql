-- Dante Time OS – zakázky: náklady, zálohy, faktury a fotografie (požadavek majitele 27. 11. 2026)
-- Pouze přidává sloupce a nastavení; existující data zůstávají beze změny.

-- Náklady: odhad vs. skutečnost, vlastní práce oddělená od zaplacených výdajů, upřesnění dílu
ALTER TABLE costs ADD COLUMN estimate INTEGER NOT NULL DEFAULT 0;   -- 1 = odhad (nezapočítává se do skutečných nákladů ani zisku)
ALTER TABLE costs ADD COLUMN own_work INTEGER NOT NULL DEFAULT 0;   -- 1 = vlastní práce v Kč (není zaplacený výdaj)
ALTER TABLE costs ADD COLUMN part_kind TEXT;                        -- strojek, pouzdro, řemínek, sklo… (upřesnění u dílů)
-- Dřívější záznamy „jen hodiny“ jsou vlastní práce
UPDATE costs SET own_work = 1 WHERE category = 'prace' AND COALESCE(amount_czk, 0) = 0 AND COALESCE(hours, 0) > 0;

-- Zakázka: datum přijetí zálohy bez zálohové faktury (např. hotově), hlavní fotografie
ALTER TABLE commissions ADD COLUMN deposit_received_on TEXT;
ALTER TABLE commissions ADD COLUMN main_photo_id TEXT;

-- Fotografie zakázky: fáze práce (pred | behem | po)
ALTER TABLE commission_photos ADD COLUMN phase TEXT;

CREATE INDEX IF NOT EXISTS ix_invoices_commission ON invoices(commission_id);

-- Automatické odeslání faktury po vystavení (výchozí stav vypnuto, zapíná majitel v Nastavení)
INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_autosend', '0');
