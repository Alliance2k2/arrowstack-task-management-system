import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
  !new URL(url).pathname.endsWith("_test")
)
  throw new Error("Dedicated local _test database required");
process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(64).toString("hex");
process.env.WEB_ORIGIN = "http://127.0.0.1:5175";
const { app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { signAccess } = await import("../src/auth.js");
let alice = "",
  bob = "",
  taskId = "";
const call = (
  method: "get" | "post" | "patch" | "delete",
  path: string,
  token = alice,
) => {
  const client = request(app);
  return client[method]("/api/v1/tasks" + path).set(
    "Authorization",
    "Bearer " + token,
  );
};
beforeAll(async () => {
  await db.task.deleteMany();
  await db.auditEvent.deleteMany();
  await db.refreshSession.deleteMany();
  await db.user.deleteMany();
  const a = await db.user.create({
    data: {
      email: "alice@tasks.test",
      name: "Alice",
      passwordHash: "unused-test-fixture",
    },
  });
  const b = await db.user.create({
    data: {
      email: "bob@tasks.test",
      name: "Bob",
      passwordHash: "unused-test-fixture",
    },
  });
  alice = signAccess(a.id);
  bob = signAccess(b.id);
});
afterAll(async () => {
  await db.task.deleteMany();
  await db.auditEvent.deleteMany();
  await db.refreshSession.deleteMany();
  await db.user.deleteMany();
  await db.$disconnect();
});
describe("task workflow against PostgreSQL", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/tasks")).status).toBe(401);
  });
  it("rejects malformed, unknown and owner-controlled fields", async () => {
    for (const input of [
      { title: "" },
      { title: "Task", priority: "URGENT" },
      { title: "Task", dueAt: "tomorrow" },
      { title: "Task", ownerId: randomBytes(16).toString("hex") },
    ])
      expect((await call("post", "").send(input)).status).toBe(400);
  });
  it("creates a task with validated defaults and audit evidence", async () => {
    const response = await call("post", "").send({
      title: "Ship report",
      description: "Review evidence",
      priority: "HIGH",
      dueAt: "2026-01-01T12:00:00Z",
    });
    expect(response.status).toBe(201);
    taskId = response.body.data.task.id;
    expect(response.body.data.task).toMatchObject({
      status: "TODO",
      priority: "HIGH",
      version: 1,
    });
    expect(
      await db.auditEvent.count({ where: { action: "TASK_CREATED" } }),
    ).toBe(1);
  });
  it("isolates list, detail, edit, delete and summary from other accounts", async () => {
    expect((await call("get", "", bob)).body.data.total).toBe(0);
    expect((await call("get", "/summary", bob)).body.data.total).toBe(0);
    expect((await call("get", "/" + taskId, bob)).status).toBe(404);
    expect(
      (
        await call("patch", "/" + taskId, bob).send({
          version: 1,
          title: "Stolen",
        })
      ).status,
    ).toBe(404);
    expect((await call("delete", "/" + taskId, bob)).status).toBe(404);
  });
  it("reads, searches and filters tasks with bounded pagination", async () => {
    expect((await call("get", "/" + taskId)).body.data.task.title).toBe(
      "Ship report",
    );
    expect(
      (await call("get", "?search=REPORT&priority=HIGH&status=TODO")).body.data
        .total,
    ).toBe(1);
    expect((await call("get", "?status=DONE")).body.data.total).toBe(0);
    expect((await call("get", "?page=0")).status).toBe(400);
    expect((await call("get", "?status=INVALID")).status).toBe(400);
    expect((await call("get", "?page=2")).body.data.items).toEqual([]);
  });
  it("counts overdue work and excludes completed deadlines", async () => {
    expect((await call("get", "/summary")).body.data).toMatchObject({
      total: 1,
      todo: 1,
      overdue: 1,
    });
    expect(
      (
        await call("patch", "/" + taskId).send({
          version: 1,
          status: "DONE",
          dueAt: null,
        })
      ).body.data.task,
    ).toMatchObject({
      version: 2,
      status: "DONE",
      dueAt: null,
      priority: "HIGH",
      description: "Review evidence",
    });
    expect((await call("get", "/summary")).body.data).toMatchObject({
      done: 1,
      overdue: 0,
    });
  });
  it("rejects stale updates and races without losing edits", async () => {
    expect(
      (await call("patch", "/" + taskId).send({ version: 1, title: "stale" }))
        .status,
    ).toBe(409);
    const results = await Promise.all(
      ["One", "Two"].map((title) =>
        call("patch", "/" + taskId).send({ version: 2, title }),
      ),
    );
    expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
  });
  it("rejects invalid identifiers and missing tasks safely", async () => {
    expect((await call("get", "/invalid")).status).toBe(400);
    expect(
      (await call("get", "/00000000-0000-4000-8000-000000000000")).status,
    ).toBe(404);
  });
  it("deletes only the owned task and records the action", async () => {
    expect((await call("delete", "/" + taskId)).status).toBe(204);
    expect((await call("get", "/" + taskId)).status).toBe(404);
    expect(
      await db.auditEvent.count({ where: { action: "TASK_DELETED" } }),
    ).toBe(1);
  });
});
