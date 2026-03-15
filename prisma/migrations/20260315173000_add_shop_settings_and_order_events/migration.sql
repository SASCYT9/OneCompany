DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'OrderStatus'
    ) THEN
        CREATE TYPE "OrderStatus" AS ENUM (
            'PENDING_REVIEW',
            'CONFIRMED',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED',
            'REFUNDED'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ShopSettings" (
    "key" TEXT NOT NULL,
    "b2bVisibilityMode" TEXT NOT NULL DEFAULT 'approved_only',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "enabledCurrencies" TEXT[] NOT NULL DEFAULT ARRAY['EUR', 'USD', 'UAH']::TEXT[],
    "currencyRates" JSONB NOT NULL DEFAULT '{"EUR":1,"USD":1,"UAH":1}',
    "shippingZones" JSONB NOT NULL DEFAULT '[]',
    "taxRegions" JSONB NOT NULL DEFAULT '[]',
    "orderNotificationEmail" TEXT,
    "b2bNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "ShopSettings" (
    "key",
    "b2bVisibilityMode",
    "defaultCurrency",
    "enabledCurrencies",
    "currencyRates",
    "shippingZones",
    "taxRegions",
    "createdAt",
    "updatedAt"
)
VALUES (
    'shop',
    'approved_only',
    'EUR',
    ARRAY['EUR', 'USD', 'UAH']::TEXT[],
    '{"EUR":1,"USD":1,"UAH":1}',
    '[]',
    '[]',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ShopOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "email" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "shippingAddress" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shippingCost" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "viewToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrder_orderNumber_key" ON "ShopOrder"("orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopOrder_viewToken_key" ON "ShopOrder"("viewToken");
CREATE INDEX IF NOT EXISTS "ShopOrder_orderNumber_idx" ON "ShopOrder"("orderNumber");
CREATE INDEX IF NOT EXISTS "ShopOrder_status_idx" ON "ShopOrder"("status");
CREATE INDEX IF NOT EXISTS "ShopOrder_createdAt_idx" ON "ShopOrder"("createdAt");

CREATE TABLE IF NOT EXISTS "ShopOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");

CREATE TABLE IF NOT EXISTS "ShopOrderStatusEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'admin',
    "actorName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopOrderStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopOrderStatusEvent_orderId_createdAt_idx" ON "ShopOrderStatusEvent"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopOrderStatusEvent_toStatus_idx" ON "ShopOrderStatusEvent"("toStatus");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ShopOrderItem_orderId_fkey'
    ) THEN
        ALTER TABLE "ShopOrderItem"
        ADD CONSTRAINT "ShopOrderItem_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ShopOrderStatusEvent_orderId_fkey'
    ) THEN
        ALTER TABLE "ShopOrderStatusEvent"
        ADD CONSTRAINT "ShopOrderStatusEvent_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
