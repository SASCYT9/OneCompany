/**
 * Repro: try the exact prisma query that NextAuth's authorize() uses.
 * If this throws — login is broken at the DB layer regardless of password.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "../src/lib/prisma";
import { findCustomerAccountByEmail } from "../src/lib/shopCustomers";

async function main() {
  console.log('[repro] calling findCustomerAccountByEmail("b2b@gmail.com")...');
  try {
    const acc = await findCustomerAccountByEmail(prisma, "b2b@gmail.com");
    console.log(
      "[repro] OK. account:",
      acc ? { id: acc.id, customerEmail: acc.customer.email } : null
    );
  } catch (e: any) {
    console.error("[repro] FAILED:", e?.message ?? e);
    console.error("[repro] code:", e?.code, "meta:", e?.meta);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
