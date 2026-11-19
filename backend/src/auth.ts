import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { db } from "./db.js";
import { config } from "./config.js";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
// Serialize every refresh/logout/replay operation for one family across API processes.
async function lockFamily(tx: Prisma.TransactionClient, familyId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))::text`;
}

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const safeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});
export const signAccess = (userId: string) =>
  jwt.sign({}, config.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    issuer: "arrowstack-tasks",
    audience: "arrowstack-task-web",
    expiresIn: "10m",
  });
export function verifyAccess(token: string): string {
  const claims = jwt.verify(token, config.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "arrowstack-tasks",
    audience: "arrowstack-task-web",
  });
  if (typeof claims === "string" || !claims.sub)
    throw new ApiError(401, "Authentication required");
  return claims.sub;
}
const dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });
export async function register(input: {
  email: string;
  name: string;
  password: string;
}) {
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      await tx.auditEvent.create({
        data: { userId: user.id, action: "REGISTER" },
      });
      return safeUser(user);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(409, "Unable to create account with these details");
    throw error;
  }
}
export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  const valid = await argon2.verify(
    user?.passwordHash ?? (await dummyHash),
    password,
  );
  if (!user || !valid) {
    await db.auditEvent.create({
      data: { action: "LOGIN_FAILED", ...(user ? { userId: user.id } : {}) },
    });
    throw new ApiError(401, "Invalid email or password");
  }
  const raw = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await db.$transaction(async (tx) => {
    await tx.refreshSession.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: hashToken(raw),
        expiresAt,
      },
    });
    await tx.auditEvent.create({ data: { userId: user.id, action: "LOGIN" } });
  });
  return {
    user: safeUser(user),
    accessToken: signAccess(user.id),
    refreshToken: raw,
    expiresAt,
  };
}
export async function refresh(raw: string) {
  const nextRaw = randomBytes(48).toString("base64url");
  const result = await db.$transaction(async (tx) => {
    const old = await tx.refreshSession.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (!old) return null;
    await lockFamily(tx, old.familyId);
    // The following READ COMMITTED statement sees replacements committed before this lock.
    // Logout/replay revocation therefore cannot miss an in-flight replacement.
    const claimed = await tx.refreshSession.updateMany({
      where: { id: old.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await tx.refreshSession.updateMany({
        where: { familyId: old.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { userId: old.userId, action: "REFRESH_REJECTED" },
      });
      return null; // Return rather than throw so revocation commits.
    }
    await tx.refreshSession.create({
      data: {
        userId: old.userId,
        familyId: old.familyId,
        tokenHash: hashToken(nextRaw),
        expiresAt: old.expiresAt,
      },
    });
    await tx.auditEvent.create({
      data: { userId: old.userId, action: "REFRESH" },
    });
    return { userId: old.userId, expiresAt: old.expiresAt };
  });
  if (!result) throw new ApiError(401, "Session expired; please log in");
  return {
    accessToken: signAccess(result.userId),
    refreshToken: nextRaw,
    expiresAt: result.expiresAt,
  };
}
export async function logout(raw: string | undefined) {
  if (!raw) return;
  await db.$transaction(async (tx) => {
    const session = await tx.refreshSession.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (!session) return;
    await lockFamily(tx, session.familyId);
    await tx.refreshSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { userId: session.userId, action: "LOGOUT" },
    });
  });
}
