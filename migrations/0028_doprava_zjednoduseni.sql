-- Zjednodušení dopravy (rozhodnutí majitele R25, 27. 11. 2026):
-- Zásilkovna + Balíkovna jako hlavní, u dražších hodinek Cenná zásilka České pošty (bez smlouvy) nebo osobní předání.
-- PPL a Balíkovna na adresu (vyžaduje Dohodu) se nepoužívají – vypnout, data zůstávají pro případné pozdější použití.

UPDATE shipping_methods SET status = 'vypnuto', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  verification = 'Nepoužívá se (rozhodnutí majitele R25 – bez nových firemních smluv). ' || COALESCE(verification, '')
WHERE id IN ('ppl_adresa', 'ppl_eu', 'balikovna_adresa') AND status != 'aktivni';

-- Cenná zásilka: podává se na kterékoli poště bez smlouvy, odpovědnost do výše udané ceny (max. 1 000 000 Kč),
-- předání jen proti podpisu. Bez dobírky – dražší hodinky jen s platbou předem.
UPDATE shipping_methods SET status = 'aktivni', cod_enabled = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  name_cs = 'Česká pošta – Cenná zásilka, pojištěno na plnou hodnotu',
  note_cs = 'Předání jen proti podpisu. Platba předem.',
  note_en = 'Delivered against signature only. Payment in advance.',
  verification = 'Poštovní podmínky a leták Cenná zásilka (ČP, 2026): bez smlouvy, udaná cena až 1 000 000 Kč, ČP odpovídá do výše udané ceny; nad 30 000 Kč udané ceny (obsah nad 10 000 Kč) zvláštní balení. Ceník od 1. 4. 2026: S 131 Kč, udaná cena do 30 000 Kč 14 Kč, každých dalších 10 000 Kč 14 Kč.'
WHERE id = 'pojistena' AND status = 'pripraveno';

UPDATE shipping_methods SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  verification = 'Poštovní podmínky Balíkovna 2026, bod 6: šperky, drahé kovy a obdobně cenné věci nad 5 000 Kč jen se službou Cenný obsah, kterou výdejní místo ani Balíkovna na adresu nenabízí → hodinky jen do 5 000 Kč.'
WHERE id = 'balikovna';

UPDATE shipping_methods SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  verification = 'Obchodní podmínky Zásilkovny čl. 2.1: max. hodnota zásilky i dobírky 20 000 Kč / 700 EUR, připojištění nelze. Bez měsíčního poplatku.'
WHERE id = 'zasilkovna';
