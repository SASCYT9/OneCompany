CREATE TABLE "CatalogPresentationShare" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogPresentationShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogPresentationShare_tokenHash_key" ON "CatalogPresentationShare"("tokenHash");
CREATE INDEX "CatalogPresentationShare_createdById_createdAt_idx" ON "CatalogPresentationShare"("createdById", "createdAt");
CREATE INDEX "CatalogPresentationShare_expiresAt_idx" ON "CatalogPresentationShare"("expiresAt");

ALTER TABLE "CatalogPresentationShare"
ADD CONSTRAINT "CatalogPresentationShare_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
