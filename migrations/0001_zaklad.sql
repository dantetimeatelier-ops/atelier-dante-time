-- Atelier Dante Time – základní struktura databáze (Cloudflare D1 / SQLite)
-- Zákaznická data jsou jen zde, nikdy v repozitáři.

PRAGMA foreign_keys = ON;

-- Hodinky (každý řádek = jeden unikátní kus)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','available','reserved','sold','in_progress','archived')),
  title TEXT NOT NULL,
  brand TEXT, model TEXT, reference TEXT, year TEXT,
  movement TEXT, movement_type TEXT CHECK (movement_type IN ('manual','automatic') OR movement_type IS NULL),
  case_material TEXT, case_diameter_mm REAL, lug_width_mm REAL,
  crystal TEXT, water_resistance TEXT, dial TEXT, strap TEXT,
  condition TEXT,                         -- popis stavu
  service_done TEXT,                      -- provedené práce (servis, renovace)
  original_parts TEXT,                    -- deklarované originální díly (garance pravosti)
  replaced_parts TEXT,                    -- vyměněné / neoriginální díly
  accessories TEXT,                       -- příslušenství (krabička, doklady…)
  manufacturer_info TEXT,                 -- údaje o výrobci (nařízení GPSR)
  safety_info TEXT,                       -- bezpečnostní upozornění (GPSR)
  description_cs TEXT, description_en TEXT,
  seo_title TEXT, seo_description TEXT,
  price_czk INTEGER CHECK (price_czk IS NULL OR price_czk >= 0),
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  reserved_order_id TEXT,
  reserved_until TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT,
  sold_at TEXT
);
CREATE INDEX idx_products_status ON products(status, sort_order, published_at);

CREATE TABLE product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  key_large TEXT NOT NULL,     -- klíč v R2 (max. 2000 px)
  key_small TEXT NOT NULL,     -- klíč v R2 (max. 800 px)
  width INTEGER, height INTEGER,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_images_product ON product_images(product_id, sort_order);

-- Zákazníci
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT, phone TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Objednávky
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,            -- např. 2026-0001
  public_token TEXT NOT NULL UNIQUE,      -- tajný odkaz pro zákazníka
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','paid','shipped','completed','cancelled','expired','withdrawn')),
  mode TEXT NOT NULL CHECK (mode IN ('test','live')),
  customer_id TEXT REFERENCES customers(id),
  email TEXT NOT NULL, name TEXT NOT NULL, phone TEXT,
  billing_street TEXT, billing_city TEXT, billing_zip TEXT, billing_country TEXT DEFAULT 'CZ',
  company TEXT, company_ico TEXT, company_dic TEXT,
  shipping_method TEXT NOT NULL,          -- zasilkovna | balikovna | osobni
  pickup_point_id TEXT, pickup_point_name TEXT,
  payment_method TEXT NOT NULL,           -- bank_transfer | card
  items_total INTEGER NOT NULL,
  shipping_price INTEGER NOT NULL,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CZK',
  variable_symbol TEXT NOT NULL,
  customer_note TEXT,
  terms_version TEXT NOT NULL,            -- verze obchodních podmínek při objednávce
  terms_accepted_at TEXT NOT NULL,
  reserved_until TEXT,
  payment_ref TEXT,                       -- ID platby u brány
  invoice_number TEXT UNIQUE,
  invoice_issued_at TEXT,
  tracking_number TEXT,
  internal_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT, shipped_at TEXT, completed_at TEXT, cancelled_at TEXT
);
CREATE INDEX idx_orders_status ON orders(status, created_at);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  title TEXT NOT NULL,                    -- kopie názvu v okamžiku objednávky
  price_czk INTEGER NOT NULL
);
CREATE INDEX idx_items_order ON order_items(order_id);

-- Zakázky (servis, renovace, zakázková výroba, přestavby)
CREATE TABLE commissions (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,            -- např. Z-2026-001
  type TEXT NOT NULL CHECK (type IN ('servis','renovace','zakazkova_vyroba','prestavba')),
  status TEXT NOT NULL DEFAULT 'poptavka'
    CHECK (status IN ('poptavka','nabidka','prijato','v_praci','ceka_na_dily','hotovo','predano','zruseno')),
  customer_id TEXT REFERENCES customers(id),
  watch TEXT,                             -- popis hodinek zákazníka
  description TEXT,                       -- co se má udělat
  estimate_czk INTEGER,                   -- orientační cena
  deposit_czk INTEGER,                    -- záloha
  final_price_czk INTEGER,
  due_date TEXT,
  received_at TEXT, returned_at TEXT,
  internal_note TEXT,
  inquiry_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_commissions_status ON commissions(status, created_at);

-- Poptávky z webu
CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  message TEXT NOT NULL,
  lang TEXT,
  status TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','vyrizuje_se','vyrizena','spam')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_inquiries_status ON inquiries(status, created_at);

-- Odstoupení od smlouvy podané online (§ 1830a OZ, účinnost od 1. 1. 2027)
CREATE TABLE withdrawals (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  order_number TEXT NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL,
  items TEXT,
  statement TEXT NOT NULL,
  confirmation_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- E-maily (odchozí fronta; v testovacím režimu se jen ukládají)
CREATE TABLE emails (
  id TEXT PRIMARY KEY,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','stored')),
  provider_id TEXT, error TEXT,
  related TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT
);

-- Číselné řady (objednávky, faktury, zakázky)
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

-- Nastavení obchodu, které mění majitel v administraci
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Administrace
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,            -- PBKDF2-SHA256, base64
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  totp_secret TEXT NOT NULL,              -- base32
  last_totp_step INTEGER NOT NULL DEFAULT 0,  -- ochrana proti opakovanému použití kódu
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_agent TEXT
);

CREATE TABLE login_attempts (
  ip TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ok INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_login_attempts ON login_attempts(ip, at);

-- Záznam všech změn v administraci (kdo, co, kdy)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT, entity_id TEXT,
  details TEXT
);

-- Omezení počtu formulářů z jedné adresy (ochrana proti spamu)
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_rate_limits ON rate_limits(bucket, at);

INSERT INTO counters (name, value) VALUES ('order', 0), ('invoice', 0), ('commission', 0);

-- Výchozí nastavení. Ceny dopravy a údaje pro platby DOPLNÍ MAJITEL v administraci;
-- dokud nejsou vyplněny, daný způsob dopravy / platby se zákazníkům nenabízí.
INSERT INTO settings (key, value) VALUES
  ('shipping_zasilkovna_czk', NULL),
  ('shipping_balikovna_czk', NULL),
  ('shipping_osobni_enabled', '0'),
  ('reservation_hours_bank', '72'),
  ('reservation_minutes_card', '30'),
  ('terms_version', '2026-12-01-navrh');
