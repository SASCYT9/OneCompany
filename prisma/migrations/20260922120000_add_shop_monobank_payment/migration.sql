CREATE TABLE "ShopMonobankPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "checkoutKeyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "invoiceId" TEXT,
    "pageUrl" TEXT,
    "amount" INTEGER NOT NULL,
    "ccy" INTEGER NOT NULL DEFAULT 980,
    "status" TEXT NOT NULL DEFAULT 'new',
    "providerModifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopMonobankPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShopMonobankPayment_amount_check" CHECK ("amount" > 0 AND "ccy" = 980)
);

CREATE UNIQUE INDEX "ShopMonobankPayment_orderId_key" ON "ShopMonobankPayment"("orderId");
CREATE UNIQUE INDEX "ShopMonobankPayment_checkoutKeyHash_key" ON "ShopMonobankPayment"("checkoutKeyHash");
CREATE UNIQUE INDEX "ShopMonobankPayment_invoiceId_key" ON "ShopMonobankPayment"("invoiceId");
ALTER TABLE "ShopMonobankPayment" ADD CONSTRAINT "ShopMonobankPayment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
