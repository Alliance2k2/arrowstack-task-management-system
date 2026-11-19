> Current container verification: [2026-11-19 test evidence](testing-20261119.md). Hosted fresh-stack build, migration, smoke and shutdown checks pass.

# Operation and deployment preparation

## Native roles

In a private PostgreSQL administrator session, replace placeholders and create a database-owning migrator and restricted runtime role:

```sql
CREATE ROLE taskmanager_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'REPLACE_PRIVATELY';
CREATE ROLE taskmanager_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'REPLACE_WITH_DIFFERENT_VALUE';
CREATE DATABASE taskmanager OWNER taskmanager_owner;
```

Configure SCRAM authentication in pg_hba.conf, not trust. Apply migrations as the owner, then, connected to taskmanager, grant:

```sql
GRANT CONNECT ON DATABASE taskmanager TO taskmanager_runtime;
GRANT USAGE ON SCHEMA public TO taskmanager_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "User", "RefreshSession", "AuditEvent", "Task" TO taskmanager_runtime;
```

Do not grant superuser, schema CREATE, or migration-table access to runtime. Future tables need deliberate grants. Use percent-encoded passwords in URLs.

## Environment

backend/.env contains runtime DATABASE_URL, random JWT_SECRET, NODE_ENV, HOST, PORT, WEB_ORIGIN. backend/.env.migration contains MIGRATION_DATABASE_URL, loaded explicitly for CLI only. Both are ignored; neither belongs in the browser or Git. See README for startup/install commands. Remove DOTENV_CONFIG_PATH after migration before starting the API. Never reset an existing database.

HOST defaults to loopback. Production requires HTTPS WEB_ORIGIN and a password-bearing database URL; production enables Secure cookies. Validate server authentication/proxy/network rules too. /health is liveness; /ready returns 503 on SQL failure. SIGINT/SIGTERM closes listener/Prisma with a ten-second bound.

## Docker - verified in hosted CI

Fresh-stack build/start/smoke/shutdown passed on hosted Ubuntu CI; see container-evidence-20261119.txt and current testing report. Docker is unavailable locally. On a Docker-enabled host:

1. Copy root .env.example to .env; set different random hex POSTGRES_PASSWORD, APP_DB_PASSWORD and JWT_SECRET.
2. Run `docker compose config --quiet` without printing resolved secrets.
3. Run `docker compose build --no-cache` and `docker compose up -d`.
4. Inspect `docker compose ps` and redacted `docker compose logs migration backend frontend`.
5. Require database healthy, migration exit 0, backend healthy, and frontend http://127.0.0.1:8082 reachable.
6. Exercise registration/login, task CRUD, account isolation, renewal, logout and errors through the proxy.
7. Run `docker compose down` and verify shutdown. Do not use -v unless intentionally deleting all database data.

A new volume bootstrap creates a restricted role. A separate migration job applies SQL and grants application-table access; runtime image omits dev tools and migration credentials. Existing volumes do not rerun bootstrap: manually provision compatible roles/grants; never delete data to fix credentials. Changing .env does not rotate existing database passwords.

Only frontend port 8082 is published on loopback; Compose is local HTTP/development only. Production still needs HTTPS termination, production environment, controlled migration, network restrictions, reviewed images, shared limits/trusted proxy settings, monitoring, backups and tested restores. No production infrastructure or public deployment was created.

For a container-only administrator demo, privately set host ADMIN_EMAIL and ADMIN_PASSWORD, then run `docker compose exec -e ADMIN_EMAIL -e ADMIN_PASSWORD backend npm run admin:create`. Do not place password values in the command or recording. Remove the host variables afterward. The container administrator-provisioning command itself was not exercised by the smoke suite; administrator authorization is covered by native/hosted API and browser tests.
