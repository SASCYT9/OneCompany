-- AlterEnum: add PENDING_PAYMENT to OrderStatus (for Stripe / payment flow)
-- PostgreSQL 9.1+: ADD VALUE; 15+: ADD VALUE IF NOT EXISTS
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable: ShopOrder - payment method and Stripe session id
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'FOP';
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;

-- AlterTable: ShopSettings - FOP details and payment provider toggles
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "fopCompanyName" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "fopIban" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "fopBankName" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "fopEdrpou" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "fopDetails" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "stripeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "whiteBitEnabled" BOOLEAN NOT NULL DEFAULT false;
