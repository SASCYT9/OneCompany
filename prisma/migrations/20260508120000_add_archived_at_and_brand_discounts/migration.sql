-- ====================================================================
-- Migration: add_archived_at_and_brand_discounts
-- Created: 2026-05-08
-- ====================================================================
--
-- Adds two pieces of customer-facing tooling:
--
-- 1. ShopCustomer.archivedAt (#45 soft-delete / archive)
--    Hides archived customers from default admin list and blocks login.
--    Preserves all order history.
--
-- 2. ShopCustomerBrandDiscount (#51 per-brand B2B discount override)
--    Per-customer per-brand discount % that overrides the global
--    ShopCustomer.b2bDiscountPercent for products in matching brand.
--
-- Apply:    npx prisma migrate deploy   (or `migrate dev` locally)
-- Rollback: drop the new column + table; this migration adds nothing
--           destructive to existing data.
-- ====================================================================

-- 1. Soft-delete column on ShopCustomer
ALTER TABLE "ShopCustomer" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "ShopCustomer_archivedAt_idx" ON "ShopCustomer"("archivedAt");

-- 2. Per-customer per-brand discount table
CREATE TABLE "ShopCustomerBrandDiscount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopCustomerBrandDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopCustomerBrandDiscount_customerId_brand_key"
  ON "ShopCustomerBrandDiscount"("customerId", "brand");
CREATE INDEX "ShopCustomerBrandDiscount_customerId_idx"
  ON "ShopCustomerBrandDiscount"("customerId");
CREATE INDEX "ShopCustomerBrandDiscount_brand_idx"
  ON "ShopCustomerBrandDiscount"("brand");

ALTER TABLE "ShopCustomerBrandDiscount"
  ADD CONSTRAINT "ShopCustomerBrandDiscount_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
