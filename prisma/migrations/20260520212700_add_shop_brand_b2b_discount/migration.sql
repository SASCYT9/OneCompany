-- ====================================================================
-- Migration: add_shop_brand_b2b_discount
-- Created: 2026-05-20
-- ====================================================================
--
-- Adds system-wide per-brand B2B discount table. Sits between the
-- per-customer-per-brand override (ShopCustomerBrandDiscount) and the
-- global per-customer discount (ShopCustomer.b2bDiscountPercent).
--
-- Resolved discount priority (highest → lowest):
--   1. ShopCustomerBrandDiscount   (per-customer per-brand)
--   2. ShopBrandB2bDiscount        (system-wide per-brand)   ← THIS
--   3. ShopCustomer.b2bDiscountPercent (per-customer global)
--
-- Editable via /admin/shop/brand-markups.
--
-- Apply:    npx prisma migrate deploy
-- Rollback: DROP TABLE "ShopBrandB2bDiscount";
-- ====================================================================

CREATE TABLE "ShopBrandB2bDiscount" (
    "id"           TEXT NOT NULL,
    "brand"        TEXT NOT NULL,
    "discountPct"  DECIMAL(5,2) NOT NULL,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopBrandB2bDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopBrandB2bDiscount_brand_key"
  ON "ShopBrandB2bDiscount"("brand");
