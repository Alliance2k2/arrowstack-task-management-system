> Historical context: use [2026-11-19 readiness](submission-readiness-20261119.md), [testing](testing-20261119.md) and [requirements comparison](requirements-comparison-20261119.md) for current status.

# Task 2 test evidence - 2026-11-18

| Check | Observed result |
| --- | --- |
| Backend/frontend npm ci and Prisma generation | Passed |
| Backend typecheck / build / lint / format:check | Passed |
| Backend tests | 36 passed, 4 files |
| Runner safety regression | 1 passed; rejects unrelated API listener |
| Frontend typecheck / build / lint / format:check | Passed |
| Edge browser suite | 5 passed |
| Two fresh migrations / status / drift | Applied / up to date / no difference |

Nine task integration cases verify authentication, validation/owner injection denial, persisted creation and audit events, cross-account list/detail/edit/delete/summary isolation, case-insensitive search and status/priority filtering, pagination/invalid IDs, overdue summary, versioned updates and concurrent stale-write rejection, deletion and audit. The other 27 cases adapt the Task 1 authentication/configuration/concurrency suite for this independent service.

Five browser scenarios verify registration/login, persisted CRUD/filter/reload/logout, responsive widths 375/768/1280/1536 and keyboard focus, failed save recovery, initial offline error, and expired-session clearing. Browser screenshots in evidence/task-workflow-desktop.png and evidence/task-workflow-mobile.png were generated from the real test flow and visually inspected. They are application evidence, not original internship dashboard screenshots.

Verified defects corrected during implementation: Task 2 refresh cookie was namespaced as tasks_refresh because cookies ignore ports; auth regressions include an unrelated Task 1 cookie. PATCH defaults cleared omitted fields (regression reproduced HIGH to MEDIUM and lost description; update schema now unwraps defaults); expired session retained registration mode (regression failed then passed after clearing mode); offline initial profile failure was silently hidden (now shown). A browser locator timeout was corrected to use the actual accessible combobox role. An interrupted install/test overlap was repaired and the incomplete run discarded; final results above come from clean sequential verification.

Commands from repository root after installing/building: backend quality scripts; NODE_ENV=test and private TEST_DATABASE_URL, then backend db:migrate, test and test:runner; PLAYWRIGHT_CHANNEL=msedge on Windows and `node scripts/verify-browser.mjs`. See README for test database safeguards. CI uses installed Chromium on Ubuntu.

## Verification environment and limits

2026-11-18, Windows, Node v24.20.0, PostgreSQL 18, Edge via Playwright. A new disposable cluster was created under the parent workspace .audit-postgres on 127.0.0.1:55440; existing development data/configuration were not changed. It uses trust authentication solely for isolated local QA and is stopped at audit end; production/native setup requires SCRAM passwords. Runtime QA roles have no superuser, role/database creation or public-schema CREATE privilege; table CRUD is granted explicitly. Test suites enforce local database names ending in _test and delete their contents.

Fresh migrations were applied successfully; `prisma migrate status` reports up to date and `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` reports ?No difference detected? for both projects. Database runs include PostgreSQL constraints and concurrent session/task operations, not mocked persistence. Browser runners start/stop owned servers; no development server was replaced. Sandbox process restrictions required approved execution outside the sandbox for builds/tests; those restrictions are not application test failures.

No Docker/Podman executable is available, so container build/start/readiness/shutdown are unverified. Compose/Dockerfiles were reviewed but execution is not claimed. CI workflows are configured locally, not run on GitHub. No live production, load, backup restore, external penetration test, complete accessibility certification or published demo is claimed.

## Dependency audit - current registry result

Live registry audits after fixing minimatch: backend production **0**, full backend **11 high**, full frontend **5 high**. The full findings are development-tool dependency chains rooted in picomatch ReDoS (GHSA-fc5q-39xc-vjpf); these are package counts, not sixteen independent root vulnerabilities. `npm view picomatch version` returned 4.0.7, still in the advisory affected range, so no patched release was available in the checked registry. The patched minimatch 11.0.9 override removed three moderate tooling findings; lint/build/tests were verified afterward. Do not blindly use audit --force to downgrade unrelated major tools.

Raw audit files: audit-backend-20261118.json, audit-production-20261118.json, audit-frontend-20261118.json. Sandboxed audit initially reported zero full findings; the live registry results supersede it and older reports. Production gates remain strict in CI; both full development audits are visible warning steps until the upstream tooling issue can be resolved. Static frontend output does not ship Vite/picomatch as browser runtime dependencies, but development/CI tools still have the disclosed exposure. Avoid untrusted glob patterns and update/retest when a patched release exists.

Final database privilege check: the complete backend suite also passed using its restricted audit runtime role (no superuser, database/role creation or schema CREATE). Frontend production npm audit --omit=dev separately returned zero findings; see audit-frontend-production-20261118.json. Compose and workflow YAML parsed successfully with expected services/job; this does not execute Docker or hosted CI.
