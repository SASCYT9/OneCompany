-- AlterEnum
-- (skipped in local dev: PARTNERSHIP already exists)

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


-- ALTER TYPE "Status" ADD VALUE 'IN_PROGRESS';
-- ALTER TYPE "Status" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "contactMethod" "ContactMethod",
ADD COLUMN     "userPhone" TEXT;

-- AlterTable
ALTER TABLE "Reply" ADD COLUMN     "sentVia" TEXT DEFAULT 'email';

-- AlterTable
ALTER TABLE "ShopOrder" ADD COLUMN     "customerGroupSnapshot" "CustomerGroup" NOT NULL DEFAULT 'B2C',
ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "ShopOrderItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "ShopProduct" ADD COLUMN     "compareAtEurB2b" DECIMAL(12,2),
ADD COLUMN     "compareAtUahB2b" DECIMAL(12,2),
ADD COLUMN     "compareAtUsdB2b" DECIMAL(12,2),
ADD COLUMN     "priceEurB2b" DECIMAL(12,2),
ADD COLUMN     "priceUahB2b" DECIMAL(12,2),
ADD COLUMN     "priceUsdB2b" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ShopProductVariant" ADD COLUMN     "compareAtEurB2b" DECIMAL(12,2),
ADD COLUMN     "compareAtUahB2b" DECIMAL(12,2),
ADD COLUMN     "compareAtUsdB2b" DECIMAL(12,2),
ADD COLUMN     "priceEurB2b" DECIMAL(12,2),
ADD COLUMN     "priceUahB2b" DECIMAL(12,2),
ADD COLUMN     "priceUsdB2b" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "TelegramUser" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'uk',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramConversation" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageId" INTEGER,
    "conversationType" TEXT NOT NULL DEFAULT 'general',
    "state" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAdmin" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT,
    "vatNumber" TEXT,
    "group" "CustomerGroup" NOT NULL DEFAULT 'B2C',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCart" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "customerId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productSlug" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUser_telegramId_key" ON "TelegramUser"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramUser_telegramId_idx" ON "TelegramUser"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_telegramId_key" ON "TelegramSession"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramSession_telegramId_idx" ON "TelegramSession"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramConversation_telegramId_idx" ON "TelegramConversation"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramConversation_chatId_idx" ON "TelegramConversation"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAdmin_telegramId_key" ON "TelegramAdmin"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramAdmin_telegramId_idx" ON "TelegramAdmin"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCustomer_email_key" ON "ShopCustomer"("email");

-- CreateIndex
CREATE INDEX "ShopCustomer_group_isActive_idx" ON "ShopCustomer"("group", "isActive");

-- CreateIndex
CREATE INDEX "ShopCustomer_createdAt_idx" ON "ShopCustomer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCustomerAccount_customerId_key" ON "ShopCustomerAccount"("customerId");

-- CreateIndex
CREATE INDEX "ShopCustomerAddress_customerId_idx" ON "ShopCustomerAddress"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCart_token_key" ON "ShopCart"("token");

-- CreateIndex
CREATE INDEX "ShopCart_customerId_idx" ON "ShopCart"("customerId");

-- CreateIndex
CREATE INDEX "ShopCart_expiresAt_idx" ON "ShopCart"("expiresAt");

-- CreateIndex
CREATE INDEX "ShopCartItem_cartId_idx" ON "ShopCartItem"("cartId");

-- CreateIndex
CREATE INDEX "ShopCartItem_productId_idx" ON "ShopCartItem"("productId");

-- CreateIndex
CREATE INDEX "ShopCartItem_variantId_idx" ON "ShopCartItem"("variantId");

-- CreateIndex
CREATE INDEX "ShopOrder_customerId_idx" ON "ShopOrder"("customerId");

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "TelegramUser"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramConversation" ADD CONSTRAINT "TelegramConversation_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "TelegramUser"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCustomerAccount" ADD CONSTRAINT "ShopCustomerAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCustomerAddress" ADD CONSTRAINT "ShopCustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCart" ADD CONSTRAINT "ShopCart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCartItem" ADD CONSTRAINT "ShopCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "ShopCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCartItem" ADD CONSTRAINT "ShopCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopCartItem" ADD CONSTRAINT "ShopCartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ShopCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrderItem" ADD CONSTRAINT "ShopOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

