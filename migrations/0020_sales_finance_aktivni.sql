-- DT Sales a DT Finance: denní kontroly bez AI (zdarma). Jen čtou data a zapisují upozornění do přehledu Systém.
-- Zákazníkům nic neposílají, nic nemění. (Zadání Dante Time OS, body DT Sales a DT Business & Finance.)
UPDATE agent_roles SET active = 1, schedule = 'denně 8:00',
  purpose = 'Poptávky a zakázky: připomíná nevyřízené poptávky, nabídky bez reakce, zakázky po termínu a končící rezervace; návrhy odpovědí na pokyn majitele.',
  permissions = '{"samostatne":["číst poptávky, zakázky a objednávky","zapisovat připomínky","připravit návrh odpovědi (AI, jen na pokyn)"],"se_schvalenim":["odeslat zákazníkovi","slevy a přísliby","měnit ceny"]}'
  WHERE id = 'sales';
UPDATE agent_roles SET active = 1, schedule = 'denně 8:00',
  purpose = 'Doklady a ekonomika: hlídá doklady ke kontrole, hodinky bez nákupní ceny a neúplné údaje pro výpočet marže a zisku.',
  permissions = '{"samostatne":["číst náklady, doklady a prodeje","zapisovat upozornění","vytěžit doklad (AI, na pokyn)"],"se_schvalenim":["potvrdit nebo změnit doklad","faktury mimo standardní proces"]}'
  WHERE id = 'finance';
