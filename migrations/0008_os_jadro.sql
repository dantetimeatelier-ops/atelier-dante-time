-- Dante Time OS – jádro (etapa E1, rozhodnutí R20)

-- Skutečné převzetí hodinek zákazníkem (od něj běží záruka i zákonná práva)
ALTER TABLE orders ADD COLUMN delivered_on TEXT;

-- Zákonná práva evidovaná odděleně od dobrovolné záruky
ALTER TABLE warranty_inspections ADD COLUMN liability_until TEXT;     -- zákonná práva z vadného plnění (24 měsíců)
ALTER TABLE warranty_inspections ADD COLUMN presumption_until TEXT;   -- domněnka vady při převzetí (12 měsíců)
ALTER TABLE warranty_inspections ADD COLUMN reminder_error TEXT;

-- Role (agenti) a jejich oprávnění. Oprávnění jsou zároveň vynucována v kódu (server/os.js).
CREATE TABLE IF NOT EXISTS agent_roles (
  id            TEXT PRIMARY KEY,            -- guardian, director, logistics, …
  name          TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  permissions   TEXT NOT NULL,               -- JSON: { "samostatne": [...], "se_schvalenim": [...] }
  schedule      TEXT,                        -- popis spouštění
  active        INTEGER NOT NULL DEFAULT 0,  -- 0 = připraveno v dalších etapách
  paused        INTEGER NOT NULL DEFAULT 0,
  paused_by     TEXT,
  paused_reason TEXT,
  paused_at     TEXT,
  last_run_at   TEXT,
  last_status   TEXT,
  last_summary  TEXT,
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Každý běh role (kdo, kdy, co zjistil, kolik stál)
CREATE TABLE IF NOT EXISTS agent_runs (
  id          TEXT PRIMARY KEY,
  role_id     TEXT NOT NULL,
  task        TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL DEFAULT 'running',   -- running | ok | warning | error | skipped
  summary     TEXT,
  cost_czk    REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_runs_role ON agent_runs(role_id, started_at);

-- Nálezy (hlavně DT Guardian): co je špatně a jak vážné
CREATE TABLE IF NOT EXISTS os_findings (
  id          TEXT PRIMARY KEY,
  role_id     TEXT NOT NULL,
  check_key   TEXT NOT NULL,                 -- identifikace kontroly (stejný problém se nezdvojuje)
  severity    TEXT NOT NULL,                 -- info | warning | critical
  title       TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_findings_open ON os_findings(check_key) WHERE resolved_at IS NULL;

-- Fronta schválení (návrhy rolí, které smí provést jen majitel)
CREATE TABLE IF NOT EXISTS approvals (
  id          TEXT PRIMARY KEY,
  role_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  payload     TEXT,
  status      TEXT NOT NULL DEFAULT 'ceka',  -- ceka | schvaleno | zamitnuto
  created_at  TEXT NOT NULL,
  decided_at  TEXT,
  decided_by  TEXT
);

-- Deník nákladů AI (limit v settings: ai_limit_czk)
CREATE TABLE IF NOT EXISTS ai_costs (
  id         TEXT PRIMARY KEY,
  role_id    TEXT NOT NULL,
  model      TEXT,
  tokens_in  INTEGER, tokens_out INTEGER,
  cost_czk   REAL NOT NULL,
  created_at TEXT NOT NULL
);

-- Přehled záloh databáze (samotná data jsou v soukromém úložišti KV)
CREATE TABLE IF NOT EXISTS backups (
  id         TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL,
  tables     INTEGER NOT NULL,
  rows       INTEGER NOT NULL,
  bytes      INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_limit_czk', '300'), ('os_last_tick', NULL), ('director_last_summary', NULL);

INSERT OR IGNORE INTO agent_roles (id, name, purpose, permissions, schedule, active) VALUES
 ('guardian', 'DT Guardian', 'Nezávislá kontrola všech rolí včetně Directora: data, ceny, faktury, dokumenty, bezpečnost, zálohy, náklady.',
  '{"samostatne":["číst všechna data","zapisovat nálezy","pozastavit kteroukoli roli"],"se_schvalenim":["obnovit pozastavenou roli (jen majitel)","měnit data"]}', 'každou hodinu', 1),
 ('director', 'DT Director', 'Koordinace, priority a stručné souhrny pro majitele e-mailem.',
  '{"samostatne":["číst přehledy","poslat souhrn majiteli"],"se_schvalenim":["výdaje","změny cen","změny webu a podmínek"]}', 'souhrn každé pondělí 7:00', 1),
 ('logistics', 'DT Logistics', 'Objednávky, expedice, převzetí, garanční prohlídky a jejich připomínky.',
  '{"samostatne":["posílat připomínky garančních prohlídek","upozorňovat na nevyřízené objednávky"],"se_schvalenim":["měnit stav objednávky","rušit objednávky"]}', 'denně 8:00', 1),
 ('developer', 'DT Developer', 'Web a administrace: opravy a nové funkce přes pull request s testy, nejdřív ve zkušební verzi.',
  '{"samostatne":["připravit změnu ve zkušební verzi","spustit testy"],"se_schvalenim":["zásadní změny ostrého webu"]}', 'při úkolu', 0),
 ('finance', 'DT Finance', 'Doklady, náklady, marže, podklady pro účetní.', '{"samostatne":["vytěžit doklad","spočítat marže"],"se_schvalenim":["faktury mimo standardní proces"]}', 'etapa E2–E3', 0),
 ('sales', 'DT Sales', 'Poptávky, návrhy odpovědí a nabídek, zájemci.', '{"samostatne":["připravit návrh odpovědi"],"se_schvalenim":["odeslat zákazníkovi","slevy a přísliby"]}', 'etapa E4', 0),
 ('marketing', 'DT Marketing', 'Obsah, plán publikací, analýza výsledků.', '{"samostatne":["připravit obsah"],"se_schvalenim":["publikovat","placená reklama"]}', 'etapa E6', 0),
 ('scout', 'DT Scout', 'Příležitosti k nákupu hodinek a dílů (upozornění, oficiální API, povolené zdroje).', '{"samostatne":["vyhodnotit nabídku"],"se_schvalenim":["jakýkoli nákup"]}', 'etapa E6', 0),
 ('innovation', 'DT Innovation', 'Týdenní hledání zlepšení podnikání, webu, marketingu a automatizace.', '{"samostatne":["analýza a návrhy"],"se_schvalenim":["realizace návrhů"]}', 'týdně (etapa E6)', 0);
