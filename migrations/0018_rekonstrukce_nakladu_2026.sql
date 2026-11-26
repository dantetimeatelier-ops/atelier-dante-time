-- Rekonstrukce historických nákladů 2026 (požadavek majitele 26. 11. 2026)
-- Souhrnná PDF z AliExpressu a Temu → jednotlivé položky → kategorie → průměrné ceny dílů →
-- odhad materiálu prodaných hodinek (PRIM / OMEGA / ROLEX) → sklad, ztráty, ziskovost.
-- Zaplacené částky jsou SKUTEČNÉ výdaje. Přiřazení k hodinkám a hodnota zásob jsou ODHAD.
-- Nové nákupy od teď se evidují přesně v Nákupech a prodejích (tabulka costs) – tyto tabulky se nemíchají.

-- Import jednoho souhrnného PDF (soubor je v tabulce documents, purpose = 'souhrn')
CREATE TABLE IF NOT EXISTS recon_imports (
  document_id  TEXT PRIMARY KEY,
  platform     TEXT NOT NULL,                 -- aliexpress | temu | jine
  page_count   INTEGER,                       -- počet stran (zjistí AI při prvním čtení)
  pages_done   INTEGER NOT NULL DEFAULT 0,    -- přečteno stran
  lines_added  INTEGER NOT NULL DEFAULT 0,
  lines_dup    INTEGER NOT NULL DEFAULT 0,    -- položky přeskočené jako duplicitní
  status       TEXT NOT NULL DEFAULT 'ceka' CHECK (status IN ('ceka','cte_se','hotovo','chyba','rucne')),
  error        TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Jednotlivé položky nákupů. Doprava, slevy a vratky objednávky jsou rozpočítány na položky podle ceny.
CREATE TABLE IF NOT EXISTS recon_lines (
  id            TEXT PRIMARY KEY,
  document_id   TEXT,                         -- původní PDF (NULL = zadáno ručně)
  platform      TEXT NOT NULL DEFAULT 'jine',
  order_ref     TEXT,
  order_date    TEXT,                         -- YYYY-MM-DD
  seller        TEXT,
  title         TEXT NOT NULL,
  variant       TEXT,
  qty           REAL NOT NULL DEFAULT 1,      -- zakoupeno kusů
  refund_qty    REAL NOT NULL DEFAULT 0,      -- z toho vráceno (nepočítá se do skladu)
  currency      TEXT NOT NULL DEFAULT 'CZK',
  price_orig    REAL,                         -- cena položky (řádek celkem) v měně dokladu
  shipping_orig REAL NOT NULL DEFAULT 0,      -- podíl dopravy
  discount_orig REAL NOT NULL DEFAULT 0,      -- podíl slev a kupónů
  refund_orig   REAL NOT NULL DEFAULT 0,      -- vráceno penězi
  fx_rate       REAL,                         -- Kč za 1 jednotku (ČNB ke dni objednávky)
  amount_czk    INTEGER,                      -- skutečně zaplaceno po slevách a vratkách (Kč)
  purpose       TEXT NOT NULL DEFAULT 'nejasne' CHECK (purpose IN ('komponent','obaly','naradi','material','provoz','soukrome','nejasne')),
  component     TEXT,                         -- pouzdro, remen, naramek, strojek, cifernik, rucicky, sklo, korunka, krabicka, obal, jine
  family        TEXT,                         -- PRIM | OMEGA | ROLEX | NULL = univerzální / společné
  status        TEXT NOT NULL DEFAULT 'ke_kontrole' CHECK (status IN ('ke_kontrole','potvrzeno','nezapocitano')),
  source        TEXT NOT NULL DEFAULT 'ai',   -- ai | rucne
  edited        INTEGER NOT NULL DEFAULT 0,   -- 1 = ručně opraveno (AI už nepřepíše)
  ai_suggestion TEXT,                         -- původní návrh AI (JSON) pro kontrolu
  fingerprint   TEXT NOT NULL UNIQUE,         -- ochrana proti dvojímu importu
  check_note    TEXT,
  excluded_reason TEXT,                       -- proč se nezapočítává (duplicita, zrušená objednávka…)
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_recon_lines_status ON recon_lines(status, purpose);
CREATE INDEX IF NOT EXISTS ix_recon_lines_pool ON recon_lines(component, family);
CREATE INDEX IF NOT EXISTS ix_recon_lines_order ON recon_lines(platform, order_ref);
CREATE INDEX IF NOT EXISTS ix_recon_lines_doc ON recon_lines(document_id);

-- Kusovník: kolik kterých komponentů spotřebuje jeden kus daného typu (nastavuje majitel)
CREATE TABLE IF NOT EXISTS recon_recipes (
  family     TEXT NOT NULL,
  component  TEXT NOT NULL,
  qty        REAL NOT NULL DEFAULT 1,
  PRIMARY KEY (family, component)
);
-- Výchozí odhad: pouzdro, řemínek a krabička na kus. Dokud ho majitel nepotvrdí, je označen jako nepotvrzený.
INSERT OR IGNORE INTO recon_recipes (family, component, qty) VALUES
  ('PRIM','pouzdro',1),('PRIM','remen',1),('PRIM','krabicka',1),
  ('OMEGA','pouzdro',1),('OMEGA','remen',1),('OMEGA','krabicka',1),
  ('ROLEX','pouzdro',1),('ROLEX','remen',1),('ROLEX','krabicka',1);
INSERT OR IGNORE INTO settings (key, value) VALUES ('recon_recipes_confirmed', NULL);

-- Typ prodaných hodinek ke každé faktuře 2026 (zjištěno z modelu / položek, nebo ručně)
CREATE TABLE IF NOT EXISTS recon_sales (
  ref_kind    TEXT NOT NULL CHECK (ref_kind IN ('invoice','sale')),  -- faktura systému | importovaná faktura
  ref_id      TEXT NOT NULL,
  family      TEXT,                      -- PRIM | OMEGA | ROLEX | NULL = neurčeno
  is_watch    INTEGER NOT NULL DEFAULT 1, -- 0 = faktura nebyla za hodinky (servis…) → bez materiálu
  manual      INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (ref_kind, ref_id)
);

-- Poškozené součástky, odpad a inventura (fyzické spočítání zbývajících kusů)
CREATE TABLE IF NOT EXISTS recon_adjustments (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('poskozeno','odpad','inventura')),
  component  TEXT NOT NULL,
  family     TEXT,
  qty        REAL NOT NULL,
  adj_date   TEXT NOT NULL,
  note       TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
