import "dotenv/config";
import { z } from "zod";

const environment = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) => /^postgres(ql)?:/.test(value),
        "PostgreSQL URL required",
      ),
    JWT_SECRET: z
      .string()
      .min(48)
      .refine(
        (value) =>
          !/replace|change.?me|example|placeholder/i.test(value) &&
          new Set(value).size >= 12,
        "Generate a random secret; placeholders and repetitive values are forbidden",
      ),
    WEB_ORIGIN: z.string().url().default("http://127.0.0.1:5175"),
  })
  .safeParse(process.env);
if (!environment.success)
  throw new Error(
    "Invalid environment: " +
      environment.error.issues
        .map((i) => i.path.join(".") + ": " + i.message)
        .join("; "),
  );
export const config = environment.data;
if (
  config.NODE_ENV === "production" &&
  !config.WEB_ORIGIN.startsWith("https://")
) {
  throw new Error("Production WEB_ORIGIN requires HTTPS");
}

const webOrigin = new URL(config.WEB_ORIGIN);
if (
  webOrigin.origin !== config.WEB_ORIGIN ||
  !["http:", "https:"].includes(webOrigin.protocol)
)
  throw new Error(
    "WEB_ORIGIN must be an HTTP(S) origin without a path or trailing slash",
  );
if (config.NODE_ENV === "production" && !new URL(config.DATABASE_URL).password)
  throw new Error("Production database requires password authentication");
