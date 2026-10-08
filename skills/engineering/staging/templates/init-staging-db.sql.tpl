-- ${PROJECT} — staging database init
-- Run once against the prod postgres container:
--   docker exec -i ${PROD_POSTGRES_CONTAINER} psql -U postgres < scripts/init-staging-db.sql
--
-- Replace :STAGING_PASSWORD: with the value from .env.staging DB_PASSWORD before running.

CREATE DATABASE ${PROJECT}_staging;
CREATE USER ${PROJECT}_staging_user WITH PASSWORD ':STAGING_PASSWORD:';
GRANT ALL PRIVILEGES ON DATABASE ${PROJECT}_staging TO ${PROJECT}_staging_user;

-- Optional: ensure schema-level grants for new tables created by migrations
\c ${PROJECT}_staging
GRANT ALL ON SCHEMA public TO ${PROJECT}_staging_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${PROJECT}_staging_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${PROJECT}_staging_user;
