-- One Company Operations: versioned Markdown knowledge base.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "OpsKnowledgeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "OpsKnowledgeArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMarkdown" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "category" TEXT NOT NULL,
    "brandKey" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "searchText" TEXT NOT NULL DEFAULT '',
    "status" "OpsKnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedRevision" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "OpsKnowledgeArticle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsKnowledgeArticle_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "OpsKnowledgeArticle_published_revision_check" CHECK (
        "publishedRevision" IS NULL OR "publishedRevision" > 0
    ),
    CONSTRAINT "OpsKnowledgeArticle_title_check" CHECK (NULLIF(BTRIM("title"), '') IS NOT NULL),
    CONSTRAINT "OpsKnowledgeArticle_content_check" CHECK (NULLIF(BTRIM("contentMarkdown"), '') IS NOT NULL)
);

CREATE TABLE "OpsKnowledgeRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "OpsKnowledgeStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "contentMarkdown" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brandKey" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "changeNote" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsKnowledgeRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsKnowledgeRevision_revision_positive_check" CHECK ("revision" > 0)
);

CREATE TABLE "OpsTaskKnowledgeLink" (
    "taskId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsTaskKnowledgeLink_pkey" PRIMARY KEY ("taskId", "articleId")
);

CREATE UNIQUE INDEX "OpsKnowledgeArticle_slug_key" ON "OpsKnowledgeArticle"("slug");
CREATE INDEX "OpsKnowledgeArticle_status_locale_category_idx" ON "OpsKnowledgeArticle"("status", "locale", "category");
CREATE INDEX "OpsKnowledgeArticle_brandKey_status_idx" ON "OpsKnowledgeArticle"("brandKey", "status");
CREATE INDEX "OpsKnowledgeArticle_updatedAt_idx" ON "OpsKnowledgeArticle"("updatedAt");
CREATE INDEX "OpsKnowledgeArticle_searchText_trgm_idx"
    ON "OpsKnowledgeArticle" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "OpsKnowledgeArticle_searchText_fts_idx"
    ON "OpsKnowledgeArticle" USING GIN (to_tsvector('simple', "searchText"));

CREATE UNIQUE INDEX "OpsKnowledgeRevision_articleId_revision_key"
    ON "OpsKnowledgeRevision"("articleId", "revision");
CREATE INDEX "OpsKnowledgeRevision_articleId_createdAt_idx"
    ON "OpsKnowledgeRevision"("articleId", "createdAt");
CREATE INDEX "OpsTaskKnowledgeLink_articleId_idx"
    ON "OpsTaskKnowledgeLink"("articleId");

ALTER TABLE "OpsKnowledgeArticle"
    ADD CONSTRAINT "OpsKnowledgeArticle_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OpsProject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsKnowledgeArticle_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsKnowledgeArticle_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsKnowledgeRevision"
    ADD CONSTRAINT "OpsKnowledgeRevision_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "OpsKnowledgeArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsKnowledgeRevision_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OpsTaskKnowledgeLink"
    ADD CONSTRAINT "OpsTaskKnowledgeLink_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTaskKnowledgeLink_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "OpsKnowledgeArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "OpsKnowledgeRevision_append_only"
BEFORE UPDATE OR DELETE ON "OpsKnowledgeRevision"
FOR EACH ROW EXECUTE FUNCTION ops_reject_append_only_mutation();
