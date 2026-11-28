-- Digitální pas i pro hodinky ze zakázek (servis, renovace, přestavba, zakázková výroba).
-- Pas se zakládá automaticky po přijetí zakázky; jedna zakázka = nejvýš jeden pas.
-- V pasu nikdy není jméno zákazníka ani cena (stejně jako u hodinek z katalogu).
ALTER TABLE watch_passports ADD COLUMN commission_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_passport_commission ON watch_passports(commission_id) WHERE commission_id IS NOT NULL;
