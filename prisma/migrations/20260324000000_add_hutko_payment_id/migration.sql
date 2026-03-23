-- Add hutkoPaymentId column for Hutko payment gateway
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "hutkoPaymentId" TEXT;
