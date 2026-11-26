-- Nové doklady se ukládají jako text (base64) místo BLOB. Zápis i čtení BLOB v D1 převádí každý bajt na číslo,
-- což u 2MB faktury na bezplatném Cloudflare překračuje limit procesoru (chyba 503). Starší doklady zůstávají beze změny.
ALTER TABLE documents ADD COLUMN enc TEXT;
