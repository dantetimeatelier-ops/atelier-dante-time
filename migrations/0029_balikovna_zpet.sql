-- Balíkovna zpět v nabídce i pro hodinky 9 000–15 000 Kč (výslovný pokyn majitele 27. 11. 2026: „vrať mi Balíkovnu“).
-- Limit 5 000 Kč z 0026 ji u běžných hodinek skrýval. Nový limit stejný jako u Zásilkovny (20 000 Kč); Rolexy dál jen
-- Cenná zásilka nebo osobní předání. Riziko (Poštovní podmínky Balíkovna, bod 6 – cennosti nad 5 000 Kč) majitel zná.
UPDATE shipping_methods SET max_value_czk = 20000, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  verification = 'Limit zvýšen na 20 000 Kč pokynem majitele (27. 11. 2026). Pozor: Poštovní podmínky Balíkovna 2026, bod 6 – cennosti nad 5 000 Kč jen se službou Cenný obsah, kterou výdejní místo nenabízí; při ztrátě může pošta odmítnout náhradu nad 5 000 Kč.'
WHERE id = 'balikovna';
