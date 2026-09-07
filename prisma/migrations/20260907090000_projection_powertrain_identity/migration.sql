ALTER TABLE "ShopCatalogProjectionConstraint" ADD COLUMN "powertrainId" TEXT;
ALTER TABLE "ShopCatalogProjectionConstraint"
  ADD CONSTRAINT "ShopCatalogProjectionConstraint_powertrainId_fkey"
  FOREIGN KEY ("powertrainId") REFERENCES "VehiclePowertrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ShopCatalogProjectionConstraint_powertrainId_dimension_state_idx"
  ON "ShopCatalogProjectionConstraint"("powertrainId", "dimension", "state");
ALTER TABLE "ShopCatalogProjectionConstraint" DROP CONSTRAINT "ShopCatalogProjectionConstraint_shape_check";
ALTER TABLE "ShopCatalogProjectionConstraint" ADD CONSTRAINT "ShopCatalogProjectionConstraint_shape_check" CHECK (
  ("state" = 'EXACT' AND (
    ("valueKind" = 'text' AND "textValue" IS NOT NULL AND "powertrainId" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
    OR ("valueKind" = 'powertrain' AND "textValue" IS NOT NULL AND "powertrainId" IS NOT NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
    OR ("valueKind" = 'number' AND "textValue" IS NULL AND "powertrainId" IS NULL AND "numberValue" IS NOT NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
    OR ("valueKind" = 'boolean' AND "textValue" IS NULL AND "powertrainId" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NOT NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
    OR ("valueKind" = 'year_range' AND "textValue" IS NULL AND "powertrainId" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND ("yearFrom" IS NOT NULL OR "yearTo" IS NOT NULL))
  )) OR ("state" <> 'EXACT' AND "valueOrdinal" = 0 AND "valueKind" IS NULL AND "textValue" IS NULL AND "powertrainId" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
);

CREATE OR REPLACE FUNCTION catalog_v2_validate_projection_constraint_review() RETURNS trigger AS $$
BEGIN
  IF NEW."powertrainId" IS NOT NULL AND NEW."dimension" <> 'ENGINE' THEN
    RAISE EXCEPTION 'projected powertrain identity is only valid for ENGINE';
  END IF;
  IF NEW."powertrainId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "VehiclePowertrain" powertrain
    WHERE powertrain."id" = NEW."powertrainId" AND powertrain."code" = NEW."textValue"
  ) THEN
    RAISE EXCEPTION 'projected powertrain identity must preserve its canonical code label';
  END IF;
  IF NEW."dimension" = 'ENGINE' AND NEW."textValue" IS NOT NULL AND NEW."powertrainId" IS NULL AND NOT EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionClause" clause_row
    WHERE clause_row."targetKey" = NEW."targetKey" AND clause_row."clauseKey" = NEW."clauseKey"
      AND clause_row."productId" = NEW."productId" AND clause_row."sourceVersion" = NEW."sourceVersion"
      AND clause_row."verification" = 'NEEDS_REVIEW'
  ) THEN RAISE EXCEPTION 'projected unresolved ENGINE text requires NEEDS_REVIEW'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "ShopCatalogProjectionConstraint_engine_text_review" ON "ShopCatalogProjectionConstraint";
CREATE TRIGGER "ShopCatalogProjectionConstraint_engine_text_review"
  BEFORE INSERT OR UPDATE OF "targetKey", "clauseKey", "productId", "sourceVersion", "dimension", "textValue", "powertrainId"
  ON "ShopCatalogProjectionConstraint" FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_projection_constraint_review();

CREATE OR REPLACE FUNCTION catalog_v2_validate_projection_clause() RETURNS trigger AS $$
BEGIN
  IF NEW."verification" = 'VERIFIED' AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionPolicy" policy WHERE policy."targetKey" = NEW."targetKey" AND policy."productId" = NEW."productId" AND policy."sourceVersion" = NEW."sourceVersion" AND policy."mode" = 'NEEDS_REVIEW'
  ) THEN RAISE EXCEPTION 'projected NEEDS_REVIEW policy cannot contain VERIFIED clauses'; END IF;
  IF NEW."verification" <> 'NEEDS_REVIEW' AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionConstraint" constraint_row WHERE constraint_row."targetKey" = NEW."targetKey" AND constraint_row."clauseKey" = NEW."clauseKey" AND constraint_row."productId" = NEW."productId" AND constraint_row."sourceVersion" = NEW."sourceVersion" AND constraint_row."dimension" = 'ENGINE' AND constraint_row."textValue" IS NOT NULL AND constraint_row."powertrainId" IS NULL
  ) THEN RAISE EXCEPTION 'projected unresolved ENGINE text cannot be promoted beyond NEEDS_REVIEW'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
