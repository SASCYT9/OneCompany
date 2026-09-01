CREATE TABLE "ShopCatalogShadowAggregate" (
  "id" TEXT NOT NULL,
  "deploymentCommit" VARCHAR(40) NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "brandKey" VARCHAR(200) NOT NULL DEFAULT '',
  "categoryKey" VARCHAR(200) NOT NULL DEFAULT '',
  "sampledRequests" INTEGER NOT NULL DEFAULT 0,
  "mismatches" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "durationTotalMs" BIGINT NOT NULL DEFAULT 0,
  "durationMaxMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogShadowAggregate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogShadowAggregate_nonnegative_check" CHECK (
    "sampledRequests" >= 0 AND "mismatches" >= 0 AND "errors" >= 0
    AND "durationTotalMs" >= 0 AND "durationMaxMs" >= 0
  ),
  CONSTRAINT "ShopCatalogShadowAggregate_outcome_check" CHECK (
    "mismatches" + "errors" <= "sampledRequests"
  ),
  CONSTRAINT "ShopCatalogShadowAggregate_commit_check" CHECK (
    "deploymentCommit" ~ '^[0-9a-fA-F]{40}$'
  )
);

CREATE UNIQUE INDEX "ShopCatalogShadowAggregate_deploymentCommit_bucketStart_locale_brandKey_categoryKey_key"
  ON "ShopCatalogShadowAggregate"("deploymentCommit", "bucketStart", "locale", "brandKey", "categoryKey");
CREATE INDEX "ShopCatalogShadowAggregate_deploymentCommit_bucketStart_idx"
  ON "ShopCatalogShadowAggregate"("deploymentCommit", "bucketStart");
