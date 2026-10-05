CREATE TABLE "ShopMonobankPaymentHistory" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "ccy" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "providerModifiedAt" TIMESTAMP(3),
  "finalAmount" INTEGER NOT NULL DEFAULT 0,
  "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopMonobankPaymentHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopMonobankPaymentHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopMonobankPaymentHistory_invoiceId_key" ON "ShopMonobankPaymentHistory"("invoiceId");
CREATE INDEX "ShopMonobankPaymentHistory_orderId_idx" ON "ShopMonobankPaymentHistory"("orderId");
