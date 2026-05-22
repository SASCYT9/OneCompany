import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const migrations = await prisma.$queryRawUnsafe<any[]>(
      "SELECT id, checksum, finished_at, migration_name FROM _prisma_migrations ORDER BY finished_at ASC"
    );
    console.log("--- DB MIGRATIONS ---");
    console.log(JSON.stringify(migrations, null, 2));
  } catch (err) {
    console.error("Error querying migrations table:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
