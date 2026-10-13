import { Prisma, type PrismaClient } from "@prisma/client";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { normalizeShopBrandKey } from "@/lib/shopB2bBrandDiscounts";
import { isPlaceholderShopCustomerEmail } from "@/lib/shopCustomerEmail";

export type ShopB2bBrandOption = {
  /** Storefront brand as partners see it (Urban products → "Urban Automotive"). */
  brand: string;
  productCount: number;
};

export type ShopB2bBrandDiscountRow = {
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: string;
};

export type ShopB2bCustomerPricingTerms = {
  customerId: string;
  group: string;
  b2bDiscountPercent: number | null;
  defaultB2bDiscountPercent: number | null;
  systemBrandDiscounts: Array<{ brand: string; discountPct: number }>;
  customerBrandDiscounts: Array<{ brand: string; discountPct: number }>;
};

/**
 * Published storefront brands with product counts. Mirrors
 * `resolveShopProductBrand`, which is what discount rules are matched against,
 * so every option here is a brand a rule can actually hit.
 */
export async function listShopB2bBrands(prisma: PrismaClient): Promise<ShopB2bBrandOption[]> {
  const rows = await prisma.$queryRaw<Array<{ brand: string; productCount: number }>>(Prisma.sql`
    SELECT resolved.brand, COUNT(*)::int AS "productCount"
    FROM (
      SELECT CASE
          WHEN lower(trim(COALESCE(product."vendor", ''))) IN ('urban', 'urban automotive')
            OR 'urban-manufacturer:urban-automotive' = ANY(product."tags")
            OR lower(trim(product."slug")) LIKE 'urb-%'
            THEN 'Urban Automotive'
          ELSE trim(COALESCE(product."brand", product."vendor", ''))
        END AS brand
      FROM "ShopProduct" product
      WHERE product."isPublished" = true
    ) resolved
    WHERE resolved.brand <> ''
    GROUP BY resolved.brand
  `);

  // One option per case-insensitive key; the most used spelling wins.
  const byKey = new Map<string, ShopB2bBrandOption>();
  for (const row of rows) {
    const key = normalizeShopBrandKey(row.brand);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { brand: row.brand, productCount: row.productCount });
      continue;
    }
    byKey.set(key, {
      brand: row.productCount > current.productCount ? row.brand : current.brand,
      productCount: current.productCount + row.productCount,
    });
  }
  return [...byKey.values()].sort(
    (left, right) =>
      right.productCount - left.productCount || left.brand.localeCompare(right.brand, "en")
  );
}

function serializeDiscountRow(row: {
  brand: string;
  discountPct: Prisma.Decimal | number;
  notes: string | null;
  updatedAt: Date;
}): ShopB2bBrandDiscountRow {
  return {
    brand: row.brand,
    discountPct: Number(row.discountPct),
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function sanitizeShopB2bBrandDiscount(input: {
  brand?: unknown;
  discountPct?: unknown;
  notes?: unknown;
}) {
  const brand = String(input.brand ?? "").trim();
  const pct = Number(input.discountPct);
  if (!brand) throw new Error("BRAND_REQUIRED");
  if (input.discountPct === "" || input.discountPct == null || !Number.isFinite(pct)) {
    throw new Error("DISCOUNT_OUT_OF_RANGE");
  }
  if (pct < 0 || pct > 100) throw new Error("DISCOUNT_OUT_OF_RANGE");
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null;
  return { brand, discountPct: new Prisma.Decimal(pct.toFixed(2)), notes };
}

export async function listSystemBrandDiscounts(prisma: PrismaClient) {
  const rows = await prisma.shopBrandB2bDiscount.findMany({ orderBy: { brand: "asc" } });
  return rows.map(serializeDiscountRow);
}

/**
 * Saves a brand rule for every partner. A stored spelling that differs only in
 * case ("AKRAPOVIC" vs "Akrapovic") is updated in place so a brand never ends
 * up with two competing rules.
 */
export async function upsertSystemBrandDiscount(
  prisma: PrismaClient,
  input: { brand?: unknown; discountPct?: unknown; notes?: unknown }
) {
  const data = sanitizeShopB2bBrandDiscount(input);
  const existing = await prisma.shopBrandB2bDiscount.findFirst({
    where: { brand: { equals: data.brand, mode: "insensitive" } },
    select: { id: true },
  });
  const row = existing
    ? await prisma.shopBrandB2bDiscount.update({
        where: { id: existing.id },
        data: { brand: data.brand, discountPct: data.discountPct, notes: data.notes },
      })
    : await prisma.shopBrandB2bDiscount.create({ data });
  return serializeDiscountRow(row);
}

export async function deleteSystemBrandDiscount(prisma: PrismaClient, brand: string) {
  const result = await prisma.shopBrandB2bDiscount.deleteMany({
    where: { brand: { equals: brand.trim(), mode: "insensitive" } },
  });
  return result.count;
}

export type ShopB2bPartnerSummary = {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  /** CRM-imported address like `name@crm.onecompany.local`: nobody can sign in with it. */
  placeholderEmail: boolean;
  b2bDiscountPercent: number | null;
  brandDiscounts: Array<{ brand: string; discountPct: number }>;
  /** Has a password, i.e. can actually sign in and see partner prices. */
  canSignIn: boolean;
  lastLoginAt: string | null;
};

export async function listShopB2bPartners(prisma: PrismaClient): Promise<ShopB2bPartnerSummary[]> {
  const partners = await prisma.shopCustomer.findMany({
    where: { group: "B2B_APPROVED", archivedAt: null },
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      companyName: true,
      b2bDiscountPercent: true,
      account: { select: { lastLoginAt: true } },
      brandDiscounts: { select: { brand: true, discountPct: true }, orderBy: { brand: "asc" } },
    },
  });
  return partners.map((partner) => ({
    id: partner.id,
    name: [partner.firstName, partner.lastName].filter(Boolean).join(" ").trim() || partner.email,
    companyName: partner.companyName,
    email: partner.email,
    placeholderEmail: isPlaceholderShopCustomerEmail(partner.email),
    b2bDiscountPercent:
      partner.b2bDiscountPercent != null ? Number(partner.b2bDiscountPercent) : null,
    brandDiscounts: partner.brandDiscounts.map((row) => ({
      brand: row.brand,
      discountPct: Number(row.discountPct),
    })),
    canSignIn: Boolean(partner.account),
    lastLoginAt: partner.account?.lastLoginAt?.toISOString() ?? null,
  }));
}

/** Everything a manager needs to price an order line the way the partner sees it. */
export async function loadShopB2bCustomerPricingTerms(
  prisma: PrismaClient,
  customerId: string
): Promise<ShopB2bCustomerPricingTerms | null> {
  const customer = await prisma.shopCustomer.findUnique({
    where: { id: customerId },
    select: { id: true, group: true, b2bDiscountPercent: true },
  });
  if (!customer) return null;
  const [settingsRecord, system, own] = await Promise.all([
    getOrCreateShopSettings(prisma),
    prisma.shopBrandB2bDiscount.findMany({ select: { brand: true, discountPct: true } }),
    prisma.shopCustomerBrandDiscount.findMany({
      where: { customerId },
      select: { brand: true, discountPct: true },
    }),
  ]);
  const settings = getShopSettingsRuntime(settingsRecord);
  const plain = (rows: Array<{ brand: string; discountPct: Prisma.Decimal }>) =>
    rows.map((row) => ({ brand: row.brand, discountPct: Number(row.discountPct) }));
  return {
    customerId: customer.id,
    group: customer.group,
    b2bDiscountPercent:
      customer.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
    defaultB2bDiscountPercent: settings.defaultB2bDiscountPercent,
    systemBrandDiscounts: plain(system),
    customerBrandDiscounts: plain(own),
  };
}
