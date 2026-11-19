CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TABLE "Task" (
 "id" UUID NOT NULL, "ownerId" UUID NOT NULL,
 "title" VARCHAR(160) NOT NULL, "description" VARCHAR(4000) NOT NULL DEFAULT '',
 "status" "TaskStatus" NOT NULL DEFAULT 'TODO', "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
 "dueAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Task_version_check" CHECK ("version" >= 1),
 CONSTRAINT "Task_title_check" CHECK (length(trim("title")) > 0)
);
CREATE INDEX "Task_ownerId_createdAt_idx" ON "Task"("ownerId", "createdAt");
