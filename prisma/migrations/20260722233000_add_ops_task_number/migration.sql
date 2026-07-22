CREATE SEQUENCE "OpsTask_number_seq" START WITH 1001;

ALTER TABLE "OpsTask"
ADD COLUMN "number" INTEGER;

WITH numbered AS (
  SELECT "id", 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS "number"
  FROM "OpsTask"
)
UPDATE "OpsTask" AS task
SET "number" = numbered."number"
FROM numbered
WHERE task."id" = numbered."id";

SELECT setval(
  '"OpsTask_number_seq"',
  GREATEST(COALESCE((SELECT MAX("number") FROM "OpsTask"), 1000), 1000),
  true
);

ALTER TABLE "OpsTask"
ALTER COLUMN "number" SET DEFAULT nextval('"OpsTask_number_seq"'),
ALTER COLUMN "number" SET NOT NULL;

ALTER SEQUENCE "OpsTask_number_seq" OWNED BY "OpsTask"."number";

CREATE UNIQUE INDEX "OpsTask_number_key" ON "OpsTask"("number");
