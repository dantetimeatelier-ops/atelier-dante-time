-- Balíkovna do 50 000 Kč (výslovný pokyn majitele 27. 11. 2026, 19:26: „U Balíkovny nastav 50 000“).
-- Riziko (Poštovní podmínky Balíkovna, bod 6 – cennosti nad 5 000 Kč jen s Cenným obsahem) majitel zná.
UPDATE shipping_methods SET max_value_czk = 50000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  verification = 'Limit 50 000 Kč pokynem majitele (27. 11. 2026). Pozor: Poštovní podmínky Balíkovna 2026, bod 6 – cennosti nad 5 000 Kč jen se službou Cenný obsah, kterou výdejní místo nenabízí; při ztrátě může pošta odmítnout náhradu nad 5 000 Kč.'
WHERE id = 'balikovna';
