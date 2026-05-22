/**
 * System-wide per-brand B2B discount overrides.
 *
 * Stored in the `ShopBrandB2bDiscount` table — one row per brand. Applies
 * to ALL B2B-approved customers unless overridden by a
 * per-customer-per-brand record in `ShopCustomerBrandDiscount`.
 *
 * Resolved-discount priority (highest → lowest):
 *   1. ShopCustomerBrandDiscount        (per-customer per-brand)
 *   2. ShopBrandB2bDiscount             (system-wide per-brand)   ← THIS
 *   3. ShopCustomer.b2bDiscountPercent  (per-customer global)
 *
 * Uses $queryRaw against the table directly so the module works even when
 * `prisma generate` hasn't been re-run (e.g. the Windows dev server
 * holding the query engine DLL locked).
 */

import type { PrismaClient } from "@prisma/client";

export type ShopBrandB2bDiscountRow = {
  id: string;
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: Date;
};

export type DiscountResolution = {
  pct: number;
  source: "customer-brand" | "system-brand" | "customer-global" | "none";
};

/** Lower-case + collapse whitespace for case-insensitive brand matching. */
export function normalizeBrandKey(brand: string | null | undefined): string {
  return String(brand ?? "")
    .trim()
    .toLowerCase();
}

// ─── CRUD ────────────────────────────────────────────────────────────────

export async function listBrandB2bDiscounts(
  prisma: PrismaClient
): Promise<ShopBrandB2bDiscountRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      brand: string;
      discountPct: string;
      notes: string | null;
      updatedAt: Date;
    }>
  >`
    SELECT id, brand, "discountPct"::text AS "discountPct", notes, "updatedAt"
    FROM "ShopBrandB2bDiscount"
    ORDER BY brand ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    discountPct: Number(r.discountPct),
    notes: r.notes,
    updatedAt: r.updatedAt,
  }));
}

export async function upsertBrandB2bDiscount(
  prisma: PrismaClient,
  input: { brand: string; discountPct: number; notes?: string | null }
): Promise<ShopBrandB2bDiscountRow> {
  const brand = String(input.brand ?? "").trim();
  if (!brand) throw new Error("BRAND_REQUIRED");
  const pct = Number(input.discountPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error("DISCOUNT_OUT_OF_RANGE");
  }
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null;
  const id = `bb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const pctStr = pct.toFixed(2);

  await prisma.$executeRaw`
    INSERT INTO "ShopBrandB2bDiscount" (id, brand, "discountPct", notes, "createdAt", "updatedAt")
    VALUES (${id}, ${brand}, ${pctStr}::decimal(5,2), ${notes}, NOW(), NOW())
    ON CONFLICT (brand) DO UPDATE
      SET "discountPct" = EXCLUDED."discountPct",
          notes         = EXCLUDED.notes,
          "updatedAt"   = NOW()
  `;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      brand: string;
      discountPct: string;
      notes: string | null;
      updatedAt: Date;
    }>
  >`
    SELECT id, brand, "discountPct"::text AS "discountPct", notes, "updatedAt"
    FROM "ShopBrandB2bDiscount"
    WHERE brand = ${brand}
    LIMIT 1
  `;
  const r = rows[0];
  return {
    id: r.id,
    brand: r.brand,
    discountPct: Number(r.discountPct),
    notes: r.notes,
    updatedAt: r.updatedAt,
  };
}

export async function deleteBrandB2bDiscount(prisma: PrismaClient, brand: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "ShopBrandB2bDiscount" WHERE brand = ${brand}`;
}

// ─── Batch lookup (perf-friendly for catalog queries) ────────────────────

/**
 * Builds a Map<lowercased-brand, discountPct> from all system-level rows.
 * Cache it once per request to avoid hitting the DB per product.
 */
export async function loadBrandDiscountMap(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ brand: string; discountPct: string }>>`
    SELECT brand, "discountPct"::text AS "discountPct" FROM "ShopBrandB2bDiscount"
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(normalizeBrandKey(r.brand), Number(r.discountPct));
  }
  return map;
}

/**
 * Per-customer per-brand overrides for the given customer.
 * Falls back to an empty Map when the table is missing (drift) or the
 * customer has no overrides.
 */
export async function loadCustomerBrandDiscountMap(
  prisma: PrismaClient,
  customerId: string | null | undefined
): Promise<Map<string, number>> {
  if (!customerId) return new Map();
  try {
    const rows = await prisma.$queryRaw<Array<{ brand: string; discountPct: string }>>`
      SELECT brand, "discountPct"::text AS "discountPct"
      FROM "ShopCustomerBrandDiscount"
      WHERE "customerId" = ${customerId}
    `;
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(normalizeBrandKey(r.brand), Number(r.discountPct));
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Resolve effective discount % for a (customer, brand) pair using
 * pre-loaded maps. Avoids per-item DB round trips.
 *
 * @param brand              Brand name (any case, will be normalized).
 * @param customerBrandMap   Per-customer per-brand overrides.
 * @param systemBrandMap     System-level per-brand discounts.
 * @param customerGlobalPct  Customer-level global B2B discount %.
 */
export function resolveBrandDiscount(
  brand: string | null | undefined,
  customerBrandMap: Map<string, number>,
  systemBrandMap: Map<string, number>,
  customerGlobalPct: number
): DiscountResolution {
  const key = normalizeBrandKey(brand);
  if (key) {
    const c = customerBrandMap.get(key);
    if (c != null) return { pct: c, source: "customer-brand" };
    const s = systemBrandMap.get(key);
    if (s != null) return { pct: s, source: "system-brand" };
  }
  if (customerGlobalPct > 0) {
    return { pct: customerGlobalPct, source: "customer-global" };
  }
  return { pct: 0, source: "none" };
}
