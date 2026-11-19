# Arrowstack Task Manager

Publication authorized on 2026-11-19; see the [publication checkpoint](docs/publication-20261119.md) for current verification limits and the status of earlier reports.

Independent full stack internship Task 2: private task tracking with React, TypeScript/Express, PostgreSQL and Prisma. Register, sign in, create/edit/delete tasks, track status/priority/deadlines, search/filter, paginate, and view account summaries. Ownership is enforced by the API; concurrent stale edits return 409.

This completes the existing Express starter rather than replacing another task application. Authentication patterns were adapted from the owner's Task 1. Proposed team projects/invitations remain future enhancements. See [requirements matrix](docs/requirements.md), [test evidence](docs/testing.md), [API guide](docs/api-documentation.md), [architecture](docs/architecture.md), and [submission review](docs/submission-readiness.md).

## Prerequisites and database

Node.js 24, npm and PostgreSQL 18. Use a new database and independent roles/secrets, never Task 1's database. Follow [deployment](docs/deployment.md) to create `taskmanager` with migration owner and restricted runtime role. Examples contain placeholders only.

```powershell
npm ci --prefix backend
npm ci --prefix frontend
Copy-Item backend/.env.example backend/.env
Copy-Item backend/.env.migration.example backend/.env.migration
```

Edit ignored backend/.env: DATABASE_URL for restricted runtime, random JWT_SECRET (at least 48 characters), PORT=3002, WEB_ORIGIN=http://127.0.0.1:5175. Edit backend/.env.migration with MIGRATION_DATABASE_URL for owner. Generate a secret privately with `node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"`.

```powershell
cd backend
npm run db:generate
$env:DOTENV_CONFIG_PATH='.env.migration'
npm run db:migrate
Remove-Item Env:DOTENV_CONFIG_PATH
npm run build
npm start
```

After migration grant runtime CRUD on User, RefreshSession, AuditEvent and Task; see deployment guide. In a second terminal, from root: `npm run dev --prefix frontend`. Open http://127.0.0.1:5175 . Use 127.0.0.1 consistently. API runs on 3002. Swagger through frontend: `/api/docs/`. Both applications must run. Compile/restart backend after changes; backend dev watches compilation. No default credentials or demo admin exist. Register a password of at least 12 characters.

## Verification

Backend: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`. Frontend has the same commands. Install both apps before frontend lint/format, which share backend tooling.

Use a disposable **local database ending in _test**. Tests delete its users/tasks/sessions/audit records. In backend set NODE_ENV=test and TEST_DATABASE_URL privately, then run `npm run db:migrate`, `npm test`, `npm run test:runner`. Build backend first. From repository root, run `node scripts/verify-browser.mjs`; Windows Edge can be selected with PLAYWRIGHT_CHANNEL=msedge, otherwise install Chromium with `npx playwright install chromium` in frontend. Browser runner owns API 3003/UI 5176, requires child-process startup acknowledgment, and refuses unrelated API listeners. Remove test environment variables afterward.

CI is `.github/workflows/task2-qa.yml`: PostgreSQL service, migrations, type/lint/format/build, API/concurrency tests and browser workflow. Hosted execution awaits approval to publish. Full tooling audit remains visible separately from a strict production audit. See current advisory limits in test evidence.

## Docker local demonstration

Docker execution is unverified on this machine because Docker is not installed. Copy root .env.example to .env and replace all three placeholders with distinct random hex values. Run `docker compose config --quiet`, `docker compose up --build -d`, and `docker compose ps`. Open http://127.0.0.1:8082 . Only the frontend is published, on loopback. Migration job grants the four application tables to a restricted runtime role. Stop with `docker compose down`; adding -v destroys data. This Compose setup is HTTP/development; production needs HTTPS, backups, monitoring and reviewed proxy settings.

## Security and limits

Argon2id passwords; strict validation; current-user checks; short-lived allowlisted JWTs; hashed refresh tokens with rotation, replay revocation and absolute expiry; HttpOnly/SameSite cookies; exact-origin auth mutations; safe errors and atomic audit records. Tokens are never stored in browser storage. Issued JWTs can remain valid for ten minutes after logout. Run both projects on different origins. No password reset, email verification, MFA, team sharing, reminders or production deployment is claimed.

Proposed GitHub name: `Alliance2k2/arrowstack-task-management-system`. No remote creation or push is authorized yet. [Demo script](docs/demo-guide.md) and [LinkedIn draft](docs/linkedin-draft.md) are ready for owner review; neither is a published recording/post.
