-- Dante Time OS – etapa E3b: doklady (účtenky a faktury od dodavatelů) bez AI (rozhodnutí R20)
-- Soubor je uložen v databázi D1 (region EU), přístup jen přes přihlášenou administraci.
-- Fotky se zmenšují v telefonu a zbaví se metadat (GPS). Duplicitní soubor se pozná podle otisku.
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  cost_id     TEXT,                          -- ke kterému nákladu doklad patří (může být později)
  kind        TEXT NOT NULL DEFAULT 'uctenka' CHECK (kind IN ('uctenka','faktura','smlouva','jiny')),
  filename    TEXT,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  sha256      TEXT NOT NULL UNIQUE,
  data        BLOB NOT NULL,
  note        TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_documents_cost ON documents(cost_id);
