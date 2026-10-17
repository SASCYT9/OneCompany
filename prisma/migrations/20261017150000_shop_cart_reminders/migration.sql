-- Abandoned-cart reminders: checkout opt-in per cart, plus a durable unsubscribe list.
-- Additive only: no existing table or row changes.
-- CreateTable
CREATE TABLE "ShopCartReminder" (
    "cartId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ua',
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "country" TEXT,
    "token" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCartReminder_pkey" PRIMARY KEY ("cartId")
);

-- CreateTable
CREATE TABLE "ShopEmailSuppression" (
    "email" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEmailSuppression_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopCartReminder_token_key" ON "ShopCartReminder"("token");

-- CreateIndex
CREATE INDEX "ShopCartReminder_handledAt_consentAt_idx" ON "ShopCartReminder"("handledAt", "consentAt");

-- CreateIndex
CREATE INDEX "ShopCartReminder_email_idx" ON "ShopCartReminder"("email");

-- AddForeignKey
ALTER TABLE "ShopCartReminder" ADD CONSTRAINT "ShopCartReminder_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "ShopCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

