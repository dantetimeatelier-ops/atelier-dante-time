-- Dante Time OS – etapa E3: digitální pas hodinek a certifikát pravosti (rozhodnutí R20)
-- Pas je veřejně ověřitelný přes QR kód, ale NEOBSAHUJE žádné údaje o zákazníkovi
-- (jméno, e-mail, adresa ani cenu). Jen identifikaci hodinek a jejich historii.
CREATE TABLE IF NOT EXISTS watch_passports (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,         -- náhodný kód v QR (nelze uhodnout)
  product_id    TEXT,
  title         TEXT NOT NULL,
  brand         TEXT, model TEXT, reference TEXT, year TEXT,
  movement      TEXT,
  case_material TEXT,
  hallmark      TEXT,
  serial_ref    TEXT,                         -- na veřejné stránce zobrazeno jen zkráceně
  authenticity_parts TEXT,                    -- strojek,cifernik,rucicky (doživotní garance pravosti)
  original_parts TEXT,
  replaced_parts TEXT,
  issued_on     TEXT NOT NULL,                -- datum vystavení certifikátu (YYYY-MM-DD)
  status        TEXT NOT NULL DEFAULT 'platny' CHECK (status IN ('platny','zruseny')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_passport_product ON watch_passports(product_id) WHERE product_id IS NOT NULL;

-- Historie hodinek v pasu (renovace, servis, garanční prohlídka, předání dalšímu majiteli…)
CREATE TABLE IF NOT EXISTS passport_events (
  id          TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES watch_passports(id) ON DELETE CASCADE,
  event_date  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('renovace','servis','prohlidka','predani','overeni','jine')),
  text_cs     TEXT NOT NULL,
  text_en     TEXT,
  public      INTEGER NOT NULL DEFAULT 1,
  ref         TEXT,                           -- interní odkaz (např. warranty:<id>), aby se nic nezdvojilo
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_passport_events ON passport_events(passport_id, event_date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_passport_event_ref ON passport_events(ref) WHERE ref IS NOT NULL;
