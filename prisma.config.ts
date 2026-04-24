import { defineConfig, env } from "prisma/config";
import * as dotenv from 'dotenv';

// Mirror the repo's runtime env layering for Prisma CLI commands.
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : (process.env.DATABASE_URL ? env("DATABASE_URL") : "postgresql://dummy:dummy@localhost:5432/dummy"),
  },
});
