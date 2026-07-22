-- Forward-only reconciliation of schema objects that already exist in the
-- configured One Company database but were missing from committed migration
-- history.
--
-- Existing staging/production databases MUST pass scripts/operations/phase0-audit.ts
-- and then mark this migration applied with Prisma migrate resolve. Do not execute
-- this CREATE-heavy body against an existing database. Fresh databases execute it
-- normally, which makes migration replay reproduce prisma/schema.prisma.
--
-- This file intentionally contains no destructive table/column/type or row-removal
-- statements.

BEGIN;

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('CART', 'PRODUCT', 'COLLECTION', 'SHIPPING');

-- CreateEnum
CREATE TYPE "DiscountStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('WRONG_ITEM', 'DAMAGED', 'DEFECTIVE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'ORDERING_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnRefundMethod" AS ENUM ('STRIPE_REFUND', 'STORE_CREDIT', 'BANK_TRANSFER', 'REPLACEMENT', 'NONE');

-- CreateEnum
CREATE TYPE "EmailTrigger" AS ENUM ('ORDER_CREATED', 'ORDER_PAID', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'ORDER_STUCK_PENDING_PAYMENT_3D', 'ORDER_STUCK_PROCESSING_5D', 'CART_ABANDONED_24H', 'B2B_APPLICATION_SUBMITTED', 'B2B_APPROVED', 'B2B_REJECTED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REFUNDED', 'QUOTE_SENT', 'QUOTE_EXPIRING_24H', 'CUSTOMER_REGISTERED', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('RETURN_REFUND', 'GOODWILL', 'PROMOTIONAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('ACTIVE', 'PARTIALLY_USED', 'FULLY_USED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MAILCHIMP', 'META_ADS', 'GOOGLE_ADS', 'GOOGLE_ANALYTICS');

-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'PARTNERSHIP';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Status" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "Status" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ShopOrder" ADD COLUMN     "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "discountCode" TEXT,
ADD COLUMN     "discountSnapshot" JSONB,
ADD COLUMN     "draftQuoteToken" TEXT,
ADD COLUMN     "draftValidUntil" TIMESTAMP(3),
ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "invoiceGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "quoteAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "quoteDeclinedAt" TIMESTAMP(3),
ADD COLUMN     "quoteSentAt" TIMESTAMP(3),
ADD COLUMN     "shippingCalculatedCost" DOUBLE PRECISION,
ADD COLUMN     "ttnNumber" TEXT;

-- AlterTable
ALTER TABLE "ShopProduct" ADD COLUMN     "airtableRecordId" TEXT,
ADD COLUMN     "airtableSyncedAt" TIMESTAMP(3),
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "isDimensionsEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ShopProductVariant" ADD COLUMN     "airtableRecordId" TEXT,
ADD COLUMN     "airtableSyncedAt" TIMESTAMP(3),
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "isDimensionsEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "turn14Hash" TEXT,
ADD COLUMN     "turn14Id" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "appAccentColor" TEXT NOT NULL DEFAULT '#6366f1',
ADD COLUMN     "appAddress" TEXT DEFAULT 'Україна',
ADD COLUMN     "appAtomicDiscountPercent" DECIMAL(5,2) DEFAULT 7.00,
ADD COLUMN     "appCompanyName" TEXT DEFAULT 'OneCompany',
ADD COLUMN     "appContactEmail" TEXT DEFAULT 'info@onecompany.com.ua',
ADD COLUMN     "appContactPhone" TEXT,
ADD COLUMN     "appDarkMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "appDefaultLanguage" TEXT NOT NULL DEFAULT 'ua',
ADD COLUMN     "appDefaultMarkup" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "appLogoUrl" TEXT DEFAULT '/branding/one-company-logo.png',
ADD COLUMN     "appMetaDescription" TEXT,
ADD COLUMN     "appMetaTitle" TEXT DEFAULT 'OneCompany — Premium Tuning & Performance Parts',
ADD COLUMN     "appOgImage" TEXT DEFAULT '/branding/one-company-logo.png',
ADD COLUMN     "appShowPricesWithVat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appSoundEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brandShippingRules" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE "RequestRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ShopWarehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameUa" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "address2" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "contactName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopBrandLogistics" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "warehouseId" TEXT,
    "originZone" TEXT NOT NULL DEFAULT 'USA',
    "ratePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volumetricDivisor" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "volSurchargePerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopBrandLogistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopShippingZone" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT,
    "zoneCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelUa" TEXT NOT NULL,
    "ratePerKg" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "volSurchargePerKg" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "baseFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etaMinDays" INTEGER NOT NULL DEFAULT 7,
    "etaMaxDays" INTEGER NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopTaxRegionRule" (
    "id" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "regionNameUa" TEXT NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'VAT',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxLabel" TEXT,
    "taxLabelUa" TEXT,
    "customsDutyPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopTaxRegionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopInventoryLevel" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "stockedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "incomingQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopInventoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerPasswordSetupToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomerPasswordSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn14BrandMarkup" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "markupPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "syncMessage" TEXT,
    "syncProgress" INTEGER NOT NULL DEFAULT 0,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncTotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Turn14BrandMarkup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn14Item" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT false,
    "thumbnail" TEXT,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turn14Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn14Fitment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "submodel" TEXT,

    CONSTRAINT "Turn14Fitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMarkup" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "markupPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMarkup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCustomer" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "whoOwes" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,

    CONSTRAINT "CrmCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOrder" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "orderStatus" TEXT NOT NULL DEFAULT '',
    "paymentStatus" TEXT NOT NULL DEFAULT '',
    "orderDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fullCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tag" TEXT NOT NULL DEFAULT '',
    "allShipped" TEXT NOT NULL DEFAULT 'Нет',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,

    CONSTRAINT "CrmOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOrderItem" (
    "id" TEXT NOT NULL,
    "airtableId" TEXT NOT NULL,
    "positionNumber" INTEGER NOT NULL DEFAULT 0,
    "productName" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rrpPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientPricePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualSalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualSaleTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitPerItem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "productId" TEXT,
    "sku" TEXT,
    "imageUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,

    CONSTRAINT "CrmOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockProduct" (
    "id" TEXT NOT NULL,
    "distributor" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION,
    "retailPrice" DOUBLE PRECISION,
    "markupPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "thumbnail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn14_catalog_items" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "mfrPartNumber" TEXT,
    "productName" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "weight" DOUBLE PRECISION,
    "dealerPrice" DOUBLE PRECISION,
    "retailPrice" DOUBLE PRECISION,
    "rawAttributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turn14_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyStore" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDiscount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "scope" "DiscountScope" NOT NULL DEFAULT 'CART',
    "status" "DiscountStatus" NOT NULL DEFAULT 'DRAFT',
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT,
    "minOrderValue" DECIMAL(12,2),
    "customerGroups" JSONB,
    "productIds" JSONB,
    "collectionIds" JSONB,
    "excludeOnSale" BOOLEAN NOT NULL DEFAULT false,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "getDiscountPct" DECIMAL(5,2),
    "usageLimit" INTEGER,
    "usageLimitPerUser" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopDiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "email" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopDiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderReturn" (
    "id" TEXT NOT NULL,
    "rmaNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ReturnReason" NOT NULL DEFAULT 'OTHER',
    "reasonNote" TEXT,
    "refundMethod" "ReturnRefundMethod" NOT NULL DEFAULT 'NONE',
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "restockOnReceive" BOOLEAN NOT NULL DEFAULT true,
    "customerNote" TEXT,
    "adminNote" TEXT,
    "externalRefundId" TEXT,
    "refundedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "inTransitAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOrderReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "reason" "ReturnReason",
    "conditionNote" TEXT,
    "restockedAt" TIMESTAMP(3),
    "restockLocationId" TEXT,

    CONSTRAINT "ShopOrderReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "description" TEXT,
    "variables" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEmailRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "EmailTrigger" NOT NULL,
    "templateId" TEXT NOT NULL,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopEmailRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEmailSendLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "trigger" "EmailTrigger" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEntityNote" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopEntityNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopEntityTag" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEntityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerSegment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rulesJson" JSONB NOT NULL,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CreditType" NOT NULL DEFAULT 'GOODWILL',
    "status" "CreditStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(12,2) NOT NULL,
    "amountUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "relatedOrderId" TEXT,
    "relatedReturnId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomerCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerCreditRedemption" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "orderId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopCustomerCreditRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopIntegration" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "accountId" TEXT,
    "configuration" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "connectedBy" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestRateLimit_expiresAt_idx" ON "RequestRateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "RequestRateLimit_bucketStart_idx" ON "RequestRateLimit"("bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "ShopWarehouse_code_key" ON "ShopWarehouse"("code");

-- CreateIndex
CREATE INDEX "ShopWarehouse_isActive_sortOrder_idx" ON "ShopWarehouse"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ShopBrandLogistics_brandName_key" ON "ShopBrandLogistics"("brandName");

-- CreateIndex
CREATE INDEX "ShopBrandLogistics_brandName_idx" ON "ShopBrandLogistics"("brandName");

-- CreateIndex
CREATE INDEX "ShopBrandLogistics_isActive_idx" ON "ShopBrandLogistics"("isActive");

-- CreateIndex
CREATE INDEX "ShopBrandLogistics_warehouseId_idx" ON "ShopBrandLogistics"("warehouseId");

-- CreateIndex
CREATE INDEX "ShopShippingZone_warehouseId_idx" ON "ShopShippingZone"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopShippingZone_warehouseId_zoneCode_key" ON "ShopShippingZone"("warehouseId", "zoneCode");

-- CreateIndex
CREATE UNIQUE INDEX "ShopTaxRegionRule_regionCode_key" ON "ShopTaxRegionRule"("regionCode");

-- CreateIndex
CREATE INDEX "ShopTaxRegionRule_isActive_sortOrder_idx" ON "ShopTaxRegionRule"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ShopInventoryLevel_locationId_idx" ON "ShopInventoryLevel"("locationId");

-- CreateIndex
CREATE INDEX "ShopInventoryLevel_variantId_idx" ON "ShopInventoryLevel"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopInventoryLevel_variantId_locationId_key" ON "ShopInventoryLevel"("variantId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCustomerPasswordSetupToken_customerId_key" ON "ShopCustomerPasswordSetupToken"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCustomerPasswordSetupToken_tokenHash_key" ON "ShopCustomerPasswordSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ShopCustomerPasswordSetupToken_expiresAt_idx" ON "ShopCustomerPasswordSetupToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Turn14BrandMarkup_brandId_key" ON "Turn14BrandMarkup"("brandId");

-- CreateIndex
CREATE INDEX "Turn14BrandMarkup_brandName_idx" ON "Turn14BrandMarkup"("brandName");

-- CreateIndex
CREATE INDEX "Turn14Item_brand_idx" ON "Turn14Item"("brand");

-- CreateIndex
CREATE INDEX "Turn14Item_category_idx" ON "Turn14Item"("category");

-- CreateIndex
CREATE INDEX "Turn14Item_partNumber_idx" ON "Turn14Item"("partNumber");

-- CreateIndex
CREATE INDEX "Turn14Item_name_idx" ON "Turn14Item"("name");

-- CreateIndex
CREATE INDEX "Turn14Fitment_itemId_idx" ON "Turn14Fitment"("itemId");

-- CreateIndex
CREATE INDEX "Turn14Fitment_make_idx" ON "Turn14Fitment"("make");

-- CreateIndex
CREATE INDEX "Turn14Fitment_year_make_model_idx" ON "Turn14Fitment"("year", "make", "model");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMarkup_customerId_key" ON "CustomerMarkup"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMarkup_customerName_idx" ON "CustomerMarkup"("customerName");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCustomer_airtableId_key" ON "CrmCustomer"("airtableId");

-- CreateIndex
CREATE INDEX "CrmCustomer_name_idx" ON "CrmCustomer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOrder_airtableId_key" ON "CrmOrder"("airtableId");

-- CreateIndex
CREATE INDEX "CrmOrder_number_idx" ON "CrmOrder"("number");

-- CreateIndex
CREATE INDEX "CrmOrder_orderStatus_idx" ON "CrmOrder"("orderStatus");

-- CreateIndex
CREATE INDEX "CrmOrder_customerId_idx" ON "CrmOrder"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOrderItem_airtableId_key" ON "CrmOrderItem"("airtableId");

-- CreateIndex
CREATE INDEX "CrmOrderItem_orderId_idx" ON "CrmOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "CrmOrderItem_status_idx" ON "CrmOrderItem"("status");

-- CreateIndex
CREATE INDEX "StockProduct_distributor_idx" ON "StockProduct"("distributor");

-- CreateIndex
CREATE INDEX "StockProduct_brand_idx" ON "StockProduct"("brand");

-- CreateIndex
CREATE INDEX "StockProduct_name_idx" ON "StockProduct"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StockProduct_distributor_partNumber_key" ON "StockProduct"("distributor", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "turn14_catalog_items_partNumber_key" ON "turn14_catalog_items"("partNumber");

-- CreateIndex
CREATE INDEX "turn14_catalog_items_brandId_idx" ON "turn14_catalog_items"("brandId");

-- CreateIndex
CREATE INDEX "turn14_catalog_items_mfrPartNumber_idx" ON "turn14_catalog_items"("mfrPartNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyStore_shopDomain_key" ON "ShopifyStore"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ShopDiscount_code_key" ON "ShopDiscount"("code");

-- CreateIndex
CREATE INDEX "ShopDiscount_status_idx" ON "ShopDiscount"("status");

-- CreateIndex
CREATE INDEX "ShopDiscount_validFrom_validUntil_idx" ON "ShopDiscount"("validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "ShopDiscount_code_idx" ON "ShopDiscount"("code");

-- CreateIndex
CREATE INDEX "ShopDiscountRedemption_discountId_idx" ON "ShopDiscountRedemption"("discountId");

-- CreateIndex
CREATE INDEX "ShopDiscountRedemption_orderId_idx" ON "ShopDiscountRedemption"("orderId");

-- CreateIndex
CREATE INDEX "ShopDiscountRedemption_customerId_idx" ON "ShopDiscountRedemption"("customerId");

-- CreateIndex
CREATE INDEX "ShopDiscountRedemption_redeemedAt_idx" ON "ShopDiscountRedemption"("redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrderReturn_rmaNumber_key" ON "ShopOrderReturn"("rmaNumber");

-- CreateIndex
CREATE INDEX "ShopOrderReturn_orderId_idx" ON "ShopOrderReturn"("orderId");

-- CreateIndex
CREATE INDEX "ShopOrderReturn_status_idx" ON "ShopOrderReturn"("status");

-- CreateIndex
CREATE INDEX "ShopOrderReturn_rmaNumber_idx" ON "ShopOrderReturn"("rmaNumber");

-- CreateIndex
CREATE INDEX "ShopOrderReturn_createdAt_idx" ON "ShopOrderReturn"("createdAt");

-- CreateIndex
CREATE INDEX "ShopOrderReturnItem_returnId_idx" ON "ShopOrderReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ShopOrderReturnItem_orderItemId_idx" ON "ShopOrderReturnItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopEmailTemplate_key_key" ON "ShopEmailTemplate"("key");

-- CreateIndex
CREATE INDEX "ShopEmailTemplate_locale_idx" ON "ShopEmailTemplate"("locale");

-- CreateIndex
CREATE INDEX "ShopEmailTemplate_key_idx" ON "ShopEmailTemplate"("key");

-- CreateIndex
CREATE INDEX "ShopEmailRule_trigger_isActive_idx" ON "ShopEmailRule"("trigger", "isActive");

-- CreateIndex
CREATE INDEX "ShopEmailSendLog_trigger_createdAt_idx" ON "ShopEmailSendLog"("trigger", "createdAt");

-- CreateIndex
CREATE INDEX "ShopEmailSendLog_recipient_idx" ON "ShopEmailSendLog"("recipient");

-- CreateIndex
CREATE INDEX "ShopEmailSendLog_entityType_entityId_idx" ON "ShopEmailSendLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ShopEmailSendLog_status_idx" ON "ShopEmailSendLog"("status");

-- CreateIndex
CREATE INDEX "ShopEntityNote_entityType_entityId_idx" ON "ShopEntityNote"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ShopEntityNote_authorEmail_idx" ON "ShopEntityNote"("authorEmail");

-- CreateIndex
CREATE INDEX "ShopEntityNote_createdAt_idx" ON "ShopEntityNote"("createdAt");

-- CreateIndex
CREATE INDEX "ShopEntityTag_entityType_tag_idx" ON "ShopEntityTag"("entityType", "tag");

-- CreateIndex
CREATE INDEX "ShopEntityTag_tag_idx" ON "ShopEntityTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ShopEntityTag_entityType_entityId_tag_key" ON "ShopEntityTag"("entityType", "entityId", "tag");

-- CreateIndex
CREATE INDEX "ShopCustomerSegment_createdAt_idx" ON "ShopCustomerSegment"("createdAt");

-- CreateIndex
CREATE INDEX "ShopCustomerCredit_customerId_status_idx" ON "ShopCustomerCredit"("customerId", "status");

-- CreateIndex
CREATE INDEX "ShopCustomerCredit_currency_idx" ON "ShopCustomerCredit"("currency");

-- CreateIndex
CREATE INDEX "ShopCustomerCredit_expiresAt_idx" ON "ShopCustomerCredit"("expiresAt");

-- CreateIndex
CREATE INDEX "ShopCustomerCreditRedemption_creditId_idx" ON "ShopCustomerCreditRedemption"("creditId");

-- CreateIndex
CREATE INDEX "ShopCustomerCreditRedemption_orderId_idx" ON "ShopCustomerCreditRedemption"("orderId");

-- CreateIndex
CREATE INDEX "ShopCustomerCreditRedemption_redeemedAt_idx" ON "ShopCustomerCreditRedemption"("redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopIntegration_provider_key" ON "ShopIntegration"("provider");

-- CreateIndex
CREATE INDEX "ShopIntegration_provider_isActive_idx" ON "ShopIntegration"("provider", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_draftQuoteToken_key" ON "ShopOrder"("draftQuoteToken");

-- CreateIndex
CREATE INDEX "ShopOrder_discountCode_idx" ON "ShopOrder"("discountCode");

-- CreateIndex
CREATE INDEX "ShopOrder_isDraft_idx" ON "ShopOrder"("isDraft");

-- CreateIndex
CREATE INDEX "ShopOrderItem_productId_idx" ON "ShopOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ShopOrderItem_variantId_idx" ON "ShopOrderItem"("variantId");

-- CreateIndex
CREATE INDEX "ShopProduct_brand_idx" ON "ShopProduct"("brand");

-- CreateIndex
CREATE INDEX "ShopProduct_vendor_idx" ON "ShopProduct"("vendor");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductVariant_turn14Id_key" ON "ShopProductVariant"("turn14Id");

-- AddForeignKey
ALTER TABLE "ShopBrandLogistics" ADD CONSTRAINT "ShopBrandLogistics_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ShopWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopShippingZone" ADD CONSTRAINT "ShopShippingZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ShopWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopInventoryLevel" ADD CONSTRAINT "ShopInventoryLevel_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ShopWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopInventoryLevel" ADD CONSTRAINT "ShopInventoryLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCustomerPasswordSetupToken" ADD CONSTRAINT "ShopCustomerPasswordSetupToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turn14Fitment" ADD CONSTRAINT "Turn14Fitment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Turn14Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CrmCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrderItem" ADD CONSTRAINT "CrmOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopDiscountRedemption" ADD CONSTRAINT "ShopDiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "ShopDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderReturn" ADD CONSTRAINT "ShopOrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderReturnItem" ADD CONSTRAINT "ShopOrderReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ShopOrderReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopEmailRule" ADD CONSTRAINT "ShopEmailRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShopEmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopEmailSendLog" ADD CONSTRAINT "ShopEmailSendLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ShopEmailRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCustomerCredit" ADD CONSTRAINT "ShopCustomerCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCustomerCreditRedemption" ADD CONSTRAINT "ShopCustomerCreditRedemption_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "ShopCustomerCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
