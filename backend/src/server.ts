import { app } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";

await db.$connect();
const server = app.listen(config.PORT, config.HOST);
server.once("listening", () => {
  console.log(`Authentication API listening on port ${config.PORT}`);
  // A test parent must identify its own listener, not trust another service on this port.
  if (process.connected) process.send?.({ type: "ready", port: config.PORT });
});
server.on("error", async () => {
  console.error(JSON.stringify({ event: "SERVER_START_FAILED" }));
  await db.$disconnect();
  process.exitCode = 1;
});
function shutdown() {
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
