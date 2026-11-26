-- Fotografie k zakázkám: z atelieru (majitel) i od zákazníka (přiložené k poptávce na webu).
-- Soubory leží v soukromé části úložiště (klíče private/...), veřejná cesta /media je nevydává.
CREATE TABLE commission_photos (
  id TEXT PRIMARY KEY,
  commission_id TEXT,                     -- zakázka (u fotek z poptávky se doplní po vytvoření zakázky)
  inquiry_id TEXT,                        -- poptávka, ke které zákazník fotky přiložil
  source TEXT NOT NULL DEFAULT 'atelier' CHECK (source IN ('atelier','zakaznik')),
  key_large TEXT NOT NULL,
  key_small TEXT NOT NULL,
  width INTEGER, height INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_cphotos_commission ON commission_photos(commission_id, created_at);
CREATE INDEX idx_cphotos_inquiry ON commission_photos(inquiry_id);
