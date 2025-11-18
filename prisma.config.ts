import { defineConfig, env } from "prisma/config";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ? env("DATABASE_URL") : "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
