-- Collegamento fra l'identità Clerk e l'utente interno di LibrePM.
--
-- Gemella di db/migration_mysql/V2__clerk_user_link.sql. Serve anche su SQLite
-- perché la entity `User` è una sola: senza la colonna, il profilo desktop
-- fallirebbe la validazione della mappatura.
--
-- Sul desktop la colonna resta vuota: non c'è nessun Clerk da cui farsi
-- riconoscere.

ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(255);

CREATE UNIQUE INDEX ux_users_clerk_user_id ON users (clerk_user_id);
