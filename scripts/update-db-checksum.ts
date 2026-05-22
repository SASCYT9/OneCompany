import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

async function main() {
  const prisma = new PrismaClient();
  try {
    const migrationPath = path.join(
      __dirname,
      "../prisma/migrations/20260415000000_remove_hutko_payment_id/migration.sql"
    );
    const content = fs.readFileSync(migrationPath, "utf8");
    const checksum = crypto.createHash("sha256").update(content).digest("hex");
    console.log("Calculated checksum:", checksum);

    const result = await prisma.$executeRawUnsafe(
      "UPDATE _prisma_migrations SET checksum = $1 WHERE migration_name = $2",
      checksum,
      "20260415000000_remove_hutko_payment_id"
    );
    console.log("Update result:", result);
  } catch (err) {
    console.error("Error updating checksum:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
