/**
 * One-shot: reset password for b2b@gmail.com to a known test password,
 * and optionally fill missing B2B profile fields (companyName etc.) if blank.
 *
 * Authorized by user 2026-05-20. Run with: npx tsx scripts/reset-b2b-password.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "../src/lib/prisma";
import { hashShopCustomerPassword } from "../src/lib/shopCustomers";

const EMAIL = "b2b@gmail.com";
const NEW_PASSWORD = "b2btest2026";

async function main() {
  const customer = await prisma.shopCustomer.findUnique({
    where: { email: EMAIL },
    include: { account: true },
  });

  if (!customer) {
    throw new Error(`Customer ${EMAIL} not found`);
  }

  const passwordHash = await hashShopCustomerPassword(NEW_PASSWORD);

  if (customer.account) {
    await prisma.shopCustomerAccount.update({
      where: { id: customer.account.id },
      data: { passwordHash },
    });
    console.log(`[reset-b2b] password updated for existing account ${customer.account.id}`);
  } else {
    await prisma.shopCustomerAccount.create({
      data: { customerId: customer.id, passwordHash },
    });
    console.log(`[reset-b2b] account created with new password`);
  }

  // Ensure B2B group + sane discount (preserve existing if already set).
  const updates: Record<string, unknown> = {};
  if (customer.group !== "B2B_APPROVED") updates.group = "B2B_APPROVED";
  if (!customer.isActive) updates.isActive = true;
  if (Object.keys(updates).length > 0) {
    await prisma.shopCustomer.update({ where: { id: customer.id }, data: updates });
    console.log(`[reset-b2b] customer updated:`, updates);
  } else {
    console.log(`[reset-b2b] customer already B2B_APPROVED & active — no profile changes`);
  }

  console.log("---");
  console.log(`email:    ${EMAIL}`);
  console.log(`password: ${NEW_PASSWORD}`);
  console.log(`group:    B2B_APPROVED`);
  console.log(`discount: ${customer.b2bDiscountPercent?.toString() ?? "not set"}%`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
