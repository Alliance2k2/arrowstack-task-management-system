#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE arrowstack_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
GRANT CONNECT ON DATABASE arrowstack TO arrowstack_runtime;
GRANT USAGE ON SCHEMA public TO arrowstack_runtime;
SQL
