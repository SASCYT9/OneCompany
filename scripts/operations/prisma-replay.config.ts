import path from "node:path";

import { defineConfig } from "prisma/config";

const databaseUrl = process.env.OPS_REPLAY_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("OPS_REPLAY_DATABASE_URL is required for local migration replay");
}

export default defineConfig({
  schema: path.resolve(
    process.cwd(),
    process.env.OPS_REPLAY_SCHEMA_PATH || path.join("prisma", "schema.prisma")
  ),
  migrations: {
    path: path.resolve(
      process.cwd(),
      process.env.OPS_REPLAY_MIGRATIONS_PATH || path.join("prisma", "migrations")
    ),
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
