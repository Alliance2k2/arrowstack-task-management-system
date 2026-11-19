// Smoke-test the actual Nginx -> container API -> PostgreSQL path.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = process.env.COMPOSE_BASE_URL ?? "http://127.0.0.1:8082";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const frontend = await fetch(origin);
assert.equal(frontend.status, 200);
assert.match(await frontend.text(), /id="root"/);
let token;
let cookie;
const header = "arrowstack-task-web";
async function call(path, method = "GET", data, expected = 200) {
  const response = await fetch(origin + "/api/v1" + path, {
    method,
    headers: {
      Origin: origin,
      "X-Requested-With": header,
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  const updated = response.headers.getSetCookie()[0];
  if (updated) cookie = updated.split(";")[0];
  return response.status === 204 ? null : response.json();
}
await call("/ready");
await call("/users/me", "GET", undefined, 401);
const credentials = {
  email: `compose-${randomBytes(8).toString("hex")}@example.test`,
  password: randomBytes(24).toString("hex"),
};
await call(
  "/auth/register",
  "POST",
  { ...credentials, name: "Container QA" },
  201,
);
token = (await call("/auth/login", "POST", credentials)).data.accessToken;
assert.equal((await call("/users/me")).data.user.email, credentials.email);
await call("/admin/users", "GET", undefined, 403);
const task = (
  await call(
    "/tasks",
    "POST",
    { title: "Container task", priority: "HIGH" },
    201,
  )
).data.task;
assert.equal(
  (await call("/tasks/" + task.id)).data.task.title,
  "Container task",
);
assert.equal(
  (await call("/tasks?search=Container&priority=HIGH")).data.total,
  1,
);
assert.equal((await call("/tasks/summary")).data.total, 1);
await call("/tasks/" + task.id, "PATCH", {
  version: task.version,
  status: "DONE",
});
await call(
  "/tasks/" + task.id,
  "PATCH",
  { version: task.version, title: "Stale" },
  409,
);
const ownerToken = token;
const ownerCookie = cookie;
const other = {
  email: `other-${randomBytes(8).toString("hex")}@example.test`,
  password: randomBytes(24).toString("hex"),
};
await call("/auth/register", "POST", { ...other, name: "Other QA" }, 201);
token = (await call("/auth/login", "POST", other)).data.accessToken;
await call("/tasks/" + task.id, "GET", undefined, 404);
await call("/tasks/" + task.id, "PATCH", { version: 2, title: "Denied" }, 404);
await call("/tasks/" + task.id, "DELETE", undefined, 404);
assert.equal((await call("/tasks")).data.total, 0);
await call("/auth/logout", "POST", undefined, 204);
token = ownerToken;
cookie = ownerCookie;
await call("/tasks/" + task.id, "DELETE", undefined, 204);
assert.equal((await call("/tasks/summary")).data.total, 0);
token = (await call("/auth/refresh", "POST")).data.accessToken;
await call("/users/me");
await call("/auth/logout", "POST", undefined, 204);
await call("/auth/refresh", "POST", undefined, 401);
console.log(
  "Container frontend, readiness, registration, login, profile, role denial, task CRUD, filtering, summaries, stale edits, ownership, refresh and logout passed.",
);
