-- Disposable CI database only. The value passed through psql is a synthetic test password.
CREATE ROLE librepm_app LOGIN PASSWORD :'runtime_password';
CREATE SCHEMA librepm AUTHORIZATION librepm_owner;
REVOKE ALL ON SCHEMA librepm FROM PUBLIC;
GRANT USAGE ON SCHEMA librepm TO librepm_app;
ALTER ROLE librepm_app SET search_path TO librepm;
ALTER DEFAULT PRIVILEGES FOR ROLE librepm_owner IN SCHEMA librepm
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO librepm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE librepm_owner IN SCHEMA librepm
    GRANT USAGE, SELECT ON SEQUENCES TO librepm_app;
