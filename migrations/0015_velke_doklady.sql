-- Větší doklady (PDF z Pages s obrázky): soubor nad 1,5 MB se uloží po částech (limit řádku D1 je 2 MB).
-- Data zůstávají v databázi D1 v EU. Malé soubory se ukládají jako dosud přímo v tabulce documents.
CREATE TABLE IF NOT EXISTS document_chunks (
  document_id TEXT NOT NULL,
  idx         INTEGER NOT NULL,
  data        BLOB NOT NULL,
  PRIMARY KEY (document_id, idx)
);
