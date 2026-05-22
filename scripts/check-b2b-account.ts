/**
 * Diagnostic: check if b2b@gmail.com exists in the database and dump
 * everything relevant for B2B setup (group, discount, account, addresses,
 * brand-specific overrides, orders count).
 *
 * Read-only. Run with: npx tsx scripts/check-b2b-account.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "../src/lib/prisma";

const EMAIL = "b2b@gmail.com";

type RawCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyName: string | null;
  vatNumber: string | null;
  group: string;
  isActive: boolean;
  b2bDiscountPercent: any;
  preferredLocale: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function main() {
  // Use $queryRaw because schema has fields (archivedAt) that don't yet exist
  // in the actual prod DB column-set. We avoid db push per project hard rules.
  const rows = await prisma.$queryRaw<RawCustomer[]>`
    SELECT id, email, "firstName", "lastName", phone, "companyName", "vatNumber",
           "group"::text AS "group", "isActive", "b2bDiscountPercent",
           "preferredLocale", notes, "createdAt", "updatedAt"
    FROM "ShopCustomer"
    WHERE email = ${EMAIL}
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.log(`[check-b2b] NOT FOUND: no ShopCustomer with email=${EMAIL}`);
    const orphan = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "ShopOrder"
      WHERE LOWER(email) = ${EMAIL.toLowerCase()} AND "customerId" IS NULL
    `;
    console.log(`[check-b2b] orphan guest orders with this email: ${orphan[0]?.count ?? 0n}`);
    return;
  }

  const customer = rows[0];

  const accountRow = await prisma.$queryRaw<
    Array<{ id: string; lastLoginAt: Date | null; emailVerifiedAt: Date | null; createdAt: Date }>
  >`
    SELECT id, "lastLoginAt", "emailVerifiedAt", "createdAt"
    FROM "ShopCustomerAccount"
    WHERE "customerId" = ${customer.id}
    LIMIT 1
  `;

  const addresses = await prisma.$queryRaw<
    Array<{ id: string; label: string; city: string; country: string }>
  >`
    SELECT id, label, city, country FROM "ShopCustomerAddress"
    WHERE "customerId" = ${customer.id}
  `;

  let brandDiscounts: Array<{ brand: string; discountPct: any }> = [];
  try {
    brandDiscounts = await prisma.$queryRaw<Array<{ brand: string; discountPct: any }>>`
      SELECT brand, "discountPct" FROM "ShopCustomerBrandDiscount"
      WHERE "customerId" = ${customer.id}
    `;
  } catch (e: any) {
    if (e?.meta?.code === "42P01") {
      console.warn("[check-b2b] table ShopCustomerBrandDiscount missing in DB (drift).");
    } else throw e;
  }

  const orderCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "ShopOrder" WHERE "customerId" = ${customer.id}
  `;

  console.log("[check-b2b] FOUND:");
  console.log(
    JSON.stringify(
      {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        companyName: customer.companyName,
        vatNumber: customer.vatNumber,
        group: customer.group,
        isActive: customer.isActive,
        b2bDiscountPercent:
          customer.b2bDiscountPercent != null ? String(customer.b2bDiscountPercent) : null,
        preferredLocale: customer.preferredLocale,
        notes: customer.notes,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        hasAccount: accountRow.length > 0,
        lastLoginAt: accountRow[0]?.lastLoginAt ?? null,
        emailVerifiedAt: accountRow[0]?.emailVerifiedAt ?? null,
        addresses: addresses.length,
        brandDiscountsCount: brandDiscounts.length,
        brandDiscounts: brandDiscounts.map((d) => ({
          brand: d.brand,
          pct: String(d.discountPct),
        })),
        orders: Number(orderCount[0]?.count ?? 0n),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
