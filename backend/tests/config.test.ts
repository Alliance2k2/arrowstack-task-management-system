import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
function check(extra: Record<string, string>) {
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./src/config.ts')"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DOTENV_CONFIG_QUIET: "true",
        NODE_ENV: "production",
        WEB_ORIGIN: "https://example.test",
        DATABASE_URL:
          "postgresql://app:testing-only@127.0.0.1:5432/config_test",
        JWT_SECRET: randomBytes(64).toString("hex"),
        ...extra,
      },
    },
  );
}
describe("configuration guards", () => {
  it("accepts explicit production configuration", () => {
    expect(check({}).status).toBe(0);
  });
  it("rejects public example and repetitive signing secrets", () => {
    for (const JWT_SECRET of [
      "REPLACE_WITH_AT_LEAST_48_RANDOM_CHARACTERS_GENERATED_LOCALLY",
      "x".repeat(64),
    ])
      expect(check({ JWT_SECRET }).status).not.toBe(0);
  });
  it("rejects insecure production origins and passwordless databases", () => {
    expect(check({ WEB_ORIGIN: "http://example.test" }).status).not.toBe(0);
    expect(
      check({ DATABASE_URL: "postgresql://app@127.0.0.1:5432/config_test" })
        .status,
    ).not.toBe(0);
  });
  it("rejects origins with paths", () => {
    expect(check({ WEB_ORIGIN: "https://example.test/path" }).status).not.toBe(
      0,
    );
  });
});
