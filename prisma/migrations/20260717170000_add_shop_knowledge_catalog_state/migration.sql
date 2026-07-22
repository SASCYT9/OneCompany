CREATE TABLE "ShopKnowledgeCatalogState" (
    "id" TEXT NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "fingerprint" VARCHAR(64) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopKnowledgeCatalogState_pkey" PRIMARY KEY ("id")
);

WITH catalog AS (
    SELECT COALESCE(
        string_agg(
            knowledge."productId" || ':' ||
            knowledge."activeRevision"::text || ':' ||
            COALESCE(knowledge."contentHash", ''),
            '|' ORDER BY knowledge."productId"
        ),
        'empty'
    ) AS payload
    FROM "ShopProductKnowledge" knowledge
    WHERE knowledge."schemaVersion" >= 2
      AND knowledge."activeRevision" > 0
)
INSERT INTO "ShopKnowledgeCatalogState" (
    "id",
    "revision",
    "fingerprint",
    "updatedAt"
)
SELECT
    'active',
    0,
    md5(catalog.payload) || md5('one-ai-v2:' || catalog.payload),
    CURRENT_TIMESTAMP
FROM catalog;
