# Internship requirement comparison - 2026-11-18

## Sources and interpretation

Reviewed 2026-11-18: original supplied internship handbook PDF (general rules p1, authentication-relevant shared standards pp2-3, employee-request scenario pp5-6) and offer-letter PDF (p1). The handbook describes exactly three different scenarios: B2B order management, employee service requests and SaaS analytics. The offer specifies two assigned tasks and two LinkedIn posts in its evaluation table, while its body requests weekly milestone summaries. The current owner request names authentication/JWT and task management and requests separate repositories.

No dashboard screenshot file or detailed portal rubric exists in this workspace. Task 1 docs reference an earlier conversation screenshot; that is inherited context, not a screenshot independently inspected in this audit. Do not claim portal requirements beyond the supplied titles/current instruction. Confirm the project-count/scenario and posting-cadence differences with the internship mentor before final submission. Personal task ownership is the Task 2 scope decision; the starter's team/project model was a recommendation, not an established official requirement.

O1 = supplied offer; O2 = handbook common standard; U = current user instruction/task titles; E = engineering enhancement. The PDFs are supplied source documents, not independently authenticated credentials. Private PDFs are intentionally outside the project repositories.

## Requirement-to-deliverable comparison

| Requirement | Authority | Task 1 evidence | Task 2 evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| Authentication and role access | U1 title / O2 | register/login, USER profile, ADMIN listing, denied-role tests | independent accounts/JWT plus same role checks and private task ownership | No unseen portal rubric claim |
| Task CRUD and ownership | U2 | Outside Task 1 | src/tasks.ts; tasks.test.ts and browser workflow | Team projects/assignment are optional deferred scope |
| Priority, status, deadline | U2 | Outside Task 1 | PostgreSQL enums, UTC timestamps, edit form/API tests | No reminder delivery requested/claimed |
| Search/filter and summaries | U2 | Outside Task 1 | owner-scoped title/description search; status/priority filters; totals/overdue | Offset pagination can move during concurrent creates |
| Responsive frontend | U | React browser suite at 320/390/768/1440 | React suite at 375/768/1280/1536; real desktop/mobile task screenshots | Automated checks are not accessibility certification |
| REST and validation/errors | O2 / U | OpenAPI, Zod, safe errors, outage cases | OpenAPI plus API guide, strict task validation, safe errors | No external penetration test |
| Relational DB/migrations | O2 / U | initial SQL on fresh PostgreSQL; migration status/diff | initial auth + Task SQL; FK/checks/index; status/diff | Existing owner dev DB remains untouched |
| Audit records | O2 | auth/session/denial events | auth and transactional create/update/delete events | No audit retention/monitoring service |
| Repeatable testing/evidence | O2 / U | 27 backend + runner + seven browser cases | 36 backend + runner + task browser cases | Hosted CI execution pending publication |
| Deployment configuration | O2; Docker stack recommendation / U | Dockerfile, Nginx, Compose, CI | independent Docker/Compose ports and four-table runtime grant, CI | Docker unavailable; containers unexecuted |
| README/decisions/limitations/demo | O1 / O2 / U | README, docs, demo-guide and current review | README, architecture, API guide, demo-guide and current review | Owner must record/explain demonstration |
| GitHub/version control | O1 / U | existing public remote is older; local review branch prepared | separate local repository; proposed arrowstack-task-management-system | Creation/push requires owner approval |
| LinkedIn evidence | O1 / U | docs/linkedin-draft.md | docs/linkedin-draft.md | Drafts only; no post or demo URL fabricated |
| Argon2id, refresh replay/concurrency, optimistic task edits | E | tested auth hardening | inherited auth regressions plus conditional task version updates | These exact mechanisms are not quoted official requirements |
