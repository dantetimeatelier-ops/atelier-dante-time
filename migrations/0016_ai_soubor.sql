-- Doklad se při nahrání rovnou předá AI (Files API, smaže se nejpozději za hodinu). Čtení AI pak nemusí
-- načítat velký soubor z databáze – to na bezplatném Cloudflare překračovalo limit procesoru (chyba 503).
ALTER TABLE documents ADD COLUMN ai_file_id TEXT;
