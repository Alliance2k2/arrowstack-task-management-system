import { Router } from "express";
import { z } from "zod";
import { db } from "./db.js";
import { ApiError, verifyAccess } from "./auth.js";

export const tasks = Router();
const id = z.string().uuid();
const fields = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).default(""),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    dueAt: z.iso.datetime().nullable().default(null),
  })
  .strict();
tasks.use(async (req, res, next) => {
  try {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ")) throw new Error();
    res.locals.ownerId = verifyAccess(header.slice(7));
  } catch {
    throw new ApiError(401, "Authentication required");
  }
  if (!(await db.user.findUnique({ where: { id: res.locals.ownerId } })))
    throw new ApiError(401, "Authentication required");
  next();
});
tasks.get("/summary", async (_req, res) => {
  const ownerId = res.locals.ownerId as string;
  const counts = await db.$transaction(async (tx) => {
    const [total, todo, inProgress, done, overdue] = await Promise.all([
      tx.task.count({ where: { ownerId } }),
      tx.task.count({ where: { ownerId, status: "TODO" } }),
      tx.task.count({ where: { ownerId, status: "IN_PROGRESS" } }),
      tx.task.count({ where: { ownerId, status: "DONE" } }),
      tx.task.count({
        where: { ownerId, status: { not: "DONE" }, dueAt: { lt: new Date() } },
      }),
    ]);
    return { total, todo, inProgress, done, overdue };
  });
  res.json({ data: counts });
});
tasks.get("/", async (req, res) => {
  const query = z
    .object({
      search: z.string().trim().max(160).optional(),
      status: fields.shape.status.unwrap().optional(),
      priority: fields.shape.priority.unwrap().optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .strict()
    .parse(req.query);
  const where = {
    ownerId: res.locals.ownerId as string,
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            {
              description: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (query.page - 1) * 20,
    }),
    db.task.count({ where }),
  ]);
  res.json({ data: { items, total, page: query.page, pageSize: 20 } });
});
tasks.post("/", async (req, res) => {
  const input = fields.parse(req.body);
  const task = await db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: { ...input, ownerId: res.locals.ownerId },
    });
    await tx.auditEvent.create({
      data: { userId: res.locals.ownerId, action: "TASK_CREATED" },
    });
    return task;
  });
  res.status(201).json({ data: { task } });
});
tasks.get("/:id", async (req, res) => {
  const task = await db.task.findFirst({
    where: { id: id.parse(req.params.id), ownerId: res.locals.ownerId },
  });
  if (!task) throw new ApiError(404, "Task not found");
  res.json({ data: { task } });
});
tasks.patch("/:id", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const { version, ...input } = z
    .object({
      title: fields.shape.title,
      description: fields.shape.description.unwrap(),
      status: fields.shape.status.unwrap(),
      priority: fields.shape.priority.unwrap(),
      dueAt: fields.shape.dueAt.unwrap(),
    })
    .partial()
    .extend({ version: z.number().int().min(1) })
    .strict()
    .parse(req.body);
  const task = await db.$transaction(async (tx) => {
    const current = await tx.task.findFirst({
      where: { id: taskId, ownerId: res.locals.ownerId },
    });
    if (!current) throw new ApiError(404, "Task not found");
    const changed = await tx.task.updateMany({
      where: { id: taskId, ownerId: res.locals.ownerId, version },
      data: { ...input, version: { increment: 1 } },
    });
    if (!changed.count)
      throw new ApiError(409, "Task changed; reload before editing");
    await tx.auditEvent.create({
      data: { userId: res.locals.ownerId, action: "TASK_UPDATED" },
    });
    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
  res.json({ data: { task } });
});
tasks.delete("/:id", async (req, res) => {
  const taskId = id.parse(req.params.id);
  await db.$transaction(async (tx) => {
    const removed = await tx.task.deleteMany({
      where: { id: taskId, ownerId: res.locals.ownerId },
    });
    if (!removed.count) throw new ApiError(404, "Task not found");
    await tx.auditEvent.create({
      data: { userId: res.locals.ownerId, action: "TASK_DELETED" },
    });
  });
  res.status(204).end();
});
