-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateTable
CREATE TABLE "ShopShipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "serviceLevel" TEXT,
    "trackingNumber" TEXT NOT NULL,
    "trackingUrl" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'LABEL_CREATED',
    "notes" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopShipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopShipment_orderId_createdAt_idx" ON "ShopShipment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopShipment_status_idx" ON "ShopShipment"("status");

-- CreateIndex
CREATE INDEX "ShopShipment_trackingNumber_idx" ON "ShopShipment"("trackingNumber");

-- AddForeignKey
ALTER TABLE "ShopShipment"
ADD CONSTRAINT "ShopShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
