# REST API

Base `/api/v1`. JSON success `{data: ...}`; failure `{error:{message,fields?}}`. Dates are UTC ISO-8601. Swagger `/api/docs/`; machine contract `/api/openapi.json`. Open Swagger through the frontend proxy for matching Origin.

Auth POST `/auth/register`: `{name,email,password}` (12-128 character password); POST `/auth/login`: `{email,password}` returns user/accessToken and tasks_refresh cookie. POST `/auth/refresh` rotates cookie; POST `/auth/logout` returns 204. These four mutations require `Origin` matching WEB_ORIGIN and `X-Requested-With: arrowstack-task-web`. `/users/me` and tasks require `Authorization: Bearer <accessToken>`. `/admin/users?page=1` is ADMIN only.

| Method | Path | Input / response |
| --- | --- | --- |
| GET | /health | Process liveness |
| GET | /ready | Database readiness; 503 when unavailable |
| GET | /tasks | Optional search (title/description, case insensitive), status, priority, page (1?10000); `{items,total,page,pageSize:20}` |
| POST | /tasks | title (1?160 trimmed), description (0?4000), status TODO/IN_PROGRESS/DONE, priority LOW/MEDIUM/HIGH, dueAt ISO timestamp or null; 201 `{task}` |
| GET | /tasks/:id | Own `{task}`, 404 for another account |
| PATCH | /tasks/:id | Current integer version plus any task fields; `{task}` with incremented version; stale 409 |
| DELETE | /tasks/:id | Own task; 204, repeated delete 404 |
| GET | /tasks/summary | `{total,todo,inProgress,done,overdue}` for current account |

Create defaults: empty description, TODO, MEDIUM, null deadline. Unknown input fields and self-assigned owner/role are rejected. Missing authentication 401; invalid input/ID 400; forbidden admin 403; oversized JSON 413; login/register throttling 429; internal errors 500 with safe text. Pagination uses latest created task first with ID tiebreaker. Task mutations require bearer authorization, not cookies alone. Audit events store action and user ID without task contents/passwords/tokens.

Example create body: `{"title":"Prepare demo","priority":"HIGH","dueAt":"2026-12-01T18:00:00Z"}`. Example edit: `{"version":1,"status":"DONE","dueAt":null}`. On 409 fetch task again and reconcile the edit. Browser date input stores end of selected day in UTC.
