-- Dante Time OS – etapa E2: sklad a ekonomika (rozhodnutí R20)
-- Interní údaje (nákupní ceny, náklady) jsou v samostatných tabulkách, ne u hodinek,
-- aby se nikdy nemohly dostat na veřejný web.

-- Náklady: nákup hodinek, díly, materiál, práce, doprava, poplatky i společné provozní náklady.
-- product_id / commission_id NULL = společný provozní náklad (krabičky, nářadí, reklama, hosting…)
CREATE TABLE IF NOT EXISTS costs (
  id            TEXT PRIMARY KEY,
  product_id    TEXT,
  commission_id TEXT,
  category      TEXT NOT NULL CHECK (category IN ('nakup','dil','material','prace','doprava','poplatky','reklama','provoz','jine')),
  description   TEXT NOT NULL,
  amount_czk    INTEGER NOT NULL DEFAULT 0,   -- částka v Kč (u práce lze nechat 0 a vyplnit hodiny)
  hours         REAL,                         -- odpracované hodiny (práce)
  cost_date     TEXT NOT NULL,                -- datum nákladu (YYYY-MM-DD)
  supplier      TEXT,
  document_ref  TEXT,                         -- číslo dokladu / odkaz na doklad (etapa E3)
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_costs_product ON costs(product_id);
CREATE INDEX IF NOT EXISTS ix_costs_commission ON costs(commission_id);
CREATE INDEX IF NOT EXISTS ix_costs_date ON costs(cost_date);

-- Sklad dílů (strojky, ciferníky, ručičky, pouzdra, skla, řemínky…)
CREATE TABLE IF NOT EXISTS parts (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('strojek','cifernik','rucicky','pouzdro','sklo','remen','naramek','korunka','krabicka','jine')),
  title         TEXT NOT NULL,
  brand         TEXT,
  caliber       TEXT,
  original      INTEGER NOT NULL DEFAULT 0,   -- 1 = originální díl značky
  condition     TEXT,
  qty           INTEGER NOT NULL DEFAULT 1,
  unit_cost_czk INTEGER,
  purchase_date TEXT,
  supplier      TEXT,
  status        TEXT NOT NULL DEFAULT 'skladem' CHECK (status IN ('skladem','pouzito','prodano','vyrazeno')),
  product_id    TEXT,                         -- ve kterých hodinkách je díl použit
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_parts_status ON parts(status, kind);

-- Hodinová sazba pro výpočet nákladů na práci (nastaví majitel; prázdné = práce se počítá jen v Kč)
INSERT OR IGNORE INTO settings (key, value) VALUES ('labor_rate_czk', NULL), ('revenue_goal_czk', '2000000');
