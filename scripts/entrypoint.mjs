import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migration = spawn(process.execPath, [path.join(directory, "init-db.mjs")], { stdio: "inherit", env: process.env });

migration.on("exit", (code) => {
  if (code !== 0) process.exit(code || 1);
  const app = spawn("npm", ["run", "start"], { stdio: "inherit", env: process.env });
  process.on("SIGTERM", () => app.kill("SIGTERM"));
  process.on("SIGINT", () => app.kill("SIGINT"));
  app.on("exit", (appCode) => process.exit(appCode ?? 1));
});

