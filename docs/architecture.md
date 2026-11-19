# Architecture and scope decision - 2026-11-18

The original starter proposed a team/project membership design; that was a proposed enhancement, not implemented functionality or a supplied official task rubric. This release implements the requested personal task manager with strict account ownership. Team projects, invitations, assignees and boards are deferred. No existing working team feature was removed.

React/Vite - same-origin Express REST API - Prisma/pg - PostgreSQL. Authentication patterns are adapted from this owner's Task 1 implementation into this independent service. Databases, credentials and live accounts remain independent. Task 2 uses a tasks_refresh cookie, while Task 1 uses refresh. Cookie names must differ because cookies ignore ports, even on separate localhost origins. Keep separate origins/proxies for the two APIs and their configured Origin checks.

User has many Task, RefreshSession and AuditEvent rows. Task has UUID ownerId FK, bounded title/description, status enum, priority enum, nullable UTC deadline, timestamps and version >= 1. Index (ownerId, createdAt) supports account lists. SQL migrations create enums, constraints and foreign keys. Only the current owner can read/mutate a task; inaccessible IDs return 404. Public registration always creates USER. ADMIN account listing follows Task 1 current-role checks; ADMIN has no task ownership bypass.

Create/edit/delete and their audit records commit atomically. Conditional version updates prevent lost edits; concurrent stale writes return 409. Lists are bounded to 20 with deterministic ordering. Summary is account scoped; overdue excludes DONE. Summary counts can change during concurrent writes under PostgreSQL READ COMMITTED; they are a dashboard snapshot, not an accounting ledger.

Passwords use Argon2id. Access tokens remain in memory, refresh tokens in HttpOnly SameSite cookies and hashed in PostgreSQL. Issuer/audience/algorithm are allowlisted. Refresh rotation, absolute expiry, replay revocation and serialized family logout are covered by inherited regression tests. Logout revokes refresh sessions; issued access JWTs can remain usable until their ten-minute expiry. Browser auth mutations require exact Origin and custom header. Runtime role must have CRUD only; use separate migration credentials.

No email verification, password reset, MFA, notifications, team sharing or production operations are claimed. Deploy behind HTTPS with secure cookies, reviewed proxy/rate-limit configuration, backups and restore testing before production use.
