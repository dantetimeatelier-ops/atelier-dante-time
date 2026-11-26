-- Garanční prohlídky (záruční podmínky verze 1.1, rozhodnutí R18)
-- Jedna prohlídka na prodané hodinky. Vzniká automaticky při odeslání objednávky
-- (jen u objednávek podle podmínek 1.1 a novějších) nebo ručně v administraci.
CREATE TABLE IF NOT EXISTS warranty_inspections (
  id              TEXT PRIMARY KEY,
  order_id        TEXT,                         -- NULL = zadáno ručně (prodej mimo e-shop)
  product_id      TEXT,
  watch_title     TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'cs',
  terms_version   TEXT,
  handover_date   TEXT NOT NULL,                -- převzetí hodinek (YYYY-MM-DD)
  due_date        TEXT NOT NULL,                -- 12 měsíců od převzetí
  window_from     TEXT NOT NULL,                -- due − 30 dnů
  window_to       TEXT NOT NULL,                -- due + 30 dnů
  remind_on       TEXT NOT NULL,                -- kdy poslat připomínku
  status          TEXT NOT NULL DEFAULT 'planovana', -- planovana | objednana | hotova | zrusena
  reminder_sent_at TEXT,
  booked_for      TEXT,                         -- domluvený termín prohlídky
  done_on         TEXT,
  rate_s_day      REAL,                         -- odchylka chodu s/den
  amplitude_deg   INTEGER,                      -- amplituda (°)
  beat_error_ms   REAL,                         -- odchylka kroku (ms)
  result          TEXT,                         -- ok | zavada
  findings        TEXT,                         -- zjištění a provedené úkony
  price_czk       INTEGER,
  paid            INTEGER NOT NULL DEFAULT 0,
  warranty_until  TEXT,                         -- do kdy trvá záruka po prohlídce
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_wi_order_product ON warranty_inspections(order_id, product_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_wi_remind ON warranty_inspections(status, remind_on);
