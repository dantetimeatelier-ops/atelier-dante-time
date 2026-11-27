-- Zakázky i bez e-mailu (zákazníci z Instagramu apod.): jméno a kontakt přímo u zakázky.
-- Je-li vyplněn e-mail, zákazník se dál ukládá do tabulky customers jako dosud.
ALTER TABLE commissions ADD COLUMN contact_name TEXT;
ALTER TABLE commissions ADD COLUMN contact_info TEXT;   -- např. Instagram @jmeno, telefon
