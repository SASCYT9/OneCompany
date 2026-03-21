ALTER TABLE "ShopSettings"
ADD COLUMN "regionalPricingRules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "showTaxesIncludedNotice" BOOLEAN NOT NULL DEFAULT false;
