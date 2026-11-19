import "dotenv/config";
import { defineConfig } from "prisma/config";
const url =
  process.env.NODE_ENV === "test"
    ? (process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL)
    : (process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL);
if (process.env.NODE_ENV === "test") {
  if (!url) throw new Error("Test migration URL required");
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(target.hostname) ||
    !target.pathname.endsWith("_test")
  )
    throw new Error("Test migrations require a dedicated local _test database");
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: url ?? "postgresql://unused:unused@127.0.0.1:5432/unused",
  },
});
