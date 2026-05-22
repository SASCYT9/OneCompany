import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null; applied_steps_count: number }>
  >`
    SELECT migration_name, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    ORDER BY migration_name DESC
    LIMIT 10
  `;
  console.log("Last 10 prod migrations:");
  for (const r of rows)
    console.log(
      `  ${r.finished_at ? "✓" : "✗"} ${r.migration_name} (steps: ${r.applied_steps_count})`
    );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
