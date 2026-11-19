import { afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL required");
const target = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Dedicated local _test database required");
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = randomBytes(64).toString("hex");
const { db } = await import("../src/db.js");
const auth = await import("../src/auth.js");
const emails: string[] = [];
afterAll(async () => {
  await db.auditEvent.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});
async function waitForLocks(observer: Client, count: number) {
  for (let i = 0; i < 100; i++) {
    const result = await observer.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
    );
    if (result.rows[0]!.count >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    "Concurrent operations did not reach the expected database lock barrier",
  );
}
async function session() {
  const email = `concurrency-${randomBytes(8).toString("hex")}@example.test`;
  emails.push(email);
  const password = randomBytes(24).toString("hex");
  await auth.register({ email, name: "Concurrency Learner", password });
  return { email, ...(await auth.login(email, password)) };
}
describe("family concurrency regression", () => {
  it("logout consumes a replacement committed by a queued refresh", async () => {
    const initial = await session();
    const blocker = new Client({ connectionString: databaseUrl });
    const observer = new Client({ connectionString: databaseUrl });
    let rotating: ReturnType<typeof auth.refresh> | undefined;
    let signingOut: ReturnType<typeof auth.logout> | undefined;
    try {
      await blocker.connect();
      await observer.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        'SELECT id FROM "RefreshSession" WHERE "tokenHash"=$1 FOR UPDATE',
        [auth.hashToken(initial.refreshToken)],
      );
      rotating = auth.refresh(initial.refreshToken);
      await waitForLocks(observer, 1);
      signingOut = auth.logout(initial.refreshToken);
      await waitForLocks(observer, 2);
      await blocker.query("COMMIT");
      const [replacement] = await Promise.all([rotating, signingOut]);
      expect(
        await db.refreshSession.count({
          where: { user: { email: initial.email }, revokedAt: null },
        }),
      ).toBe(0);
      await expect(
        auth.refresh(replacement.refreshToken),
      ).rejects.toMatchObject({ status: 401 });
    } finally {
      await blocker.query("ROLLBACK").catch(() => {});
      await Promise.allSettled([rotating, signingOut]);
      await blocker.end();
      await observer.end();
    }
  });
  it("refresh cannot revive a family when logout obtains its lock first", async () => {
    const initial = await session();
    const blocker = new Client({ connectionString: databaseUrl });
    const observer = new Client({ connectionString: databaseUrl });
    let signingOut: ReturnType<typeof auth.logout> | undefined;
    let rotating: Promise<unknown> | undefined;
    try {
      await blocker.connect();
      await observer.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [
          (
            await db.refreshSession.findUniqueOrThrow({
              where: { tokenHash: auth.hashToken(initial.refreshToken) },
            })
          ).familyId,
        ],
      );
      signingOut = auth.logout(initial.refreshToken);
      await waitForLocks(observer, 1);
      rotating = auth.refresh(initial.refreshToken).then(
        (value) => value,
        (error) => error,
      );
      await waitForLocks(observer, 2);
      await blocker.query("COMMIT");
      await signingOut;
      expect(await rotating).toMatchObject({ status: 401 });
      expect(
        await db.refreshSession.count({
          where: { user: { email: initial.email }, revokedAt: null },
        }),
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK").catch(() => {});
      await Promise.allSettled([signingOut, rotating]);
      await blocker.end();
      await observer.end();
    }
  });
});
