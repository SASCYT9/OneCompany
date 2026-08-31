import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const schema = fs.readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.join(
    repoRoot,
    "prisma",
    "migrations",
    "20260831120000_add_catalog_v2_canonical_foundation",
    "migration.sql"
  ),
  "utf8"
);
const fitmentReadMigration = fs.readFileSync(
  path.join(
    repoRoot,
    "prisma",
    "migrations",
    "20260831140000_optimize_catalog_projection_fitment_reads",
    "migration.sql"
  ),
  "utf8"
);

test("Catalog V2 fitment reads have a product-first case-insensitive index", () => {
  assert.match(fitmentReadMigration, /ShopCatalogProjectionConstraint_product_exact_text_idx/);
  assert.match(
    fitmentReadMigration,
    /"productId"[\s\S]*"dimension"[\s\S]*"state"[\s\S]*lower\("textValue"\)[\s\S]*"targetKey"[\s\S]*"clauseKey"/
  );
  assert.doesNotMatch(fitmentReadMigration, /DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE/i);
});

test("Catalog V2 schema is additive and keeps legacy product identity", () => {
  assert.match(schema, /model ShopProduct \{[\s\S]*?catalogVersion\s+BigInt\s+@default\(0\)/);
  assert.match(
    schema,
    /model ShopProduct \{[\s\S]*?publishedCatalogVersion\s+BigInt\s+@default\(0\)/
  );
  assert.match(schema, /model ShopProductVariant \{[\s\S]*?@@unique\(\[id, productId\]\)/);
  assert.match(
    migration,
    /ALTER TABLE "ShopProduct"[\s\S]*ADD COLUMN "brandId" TEXT[\s\S]*ADD COLUMN "catalogVersion" BIGINT NOT NULL DEFAULT 0/
  );
  assert.match(
    migration,
    /ALTER TABLE "VehicleGeneration"[\s\S]*ADD COLUMN "makeId" TEXT[\s\S]*ADD COLUMN "modelId" TEXT/
  );

  assert.doesNotMatch(
    migration,
    /^\s*(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|TRUNCATE\s+|DROP\s+(?:TABLE|COLUMN|TYPE))\b/im
  );
  assert.doesNotMatch(migration, /ALTER TABLE "ShopProduct"[\s\S]*ALTER COLUMN/);
  assert.doesNotMatch(migration, /ALTER TABLE "ShopProductVariant"[\s\S]*ADD COLUMN/);
});

test("source ledger is immutable, content-addressed, and never cascade-deleted", () => {
  for (const model of [
    "ShopCatalogSource",
    "ShopCatalogSourceRecord",
    "ShopCatalogSourceBinding",
    "ShopCatalogFieldProvenance",
    "ShopCatalogNormalizationIssue",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(migration, /ShopCatalogSourceRecord_payload_check/);
  assert.match(migration, /\("rawPayload" IS NULL\) <> \("blobRef" IS NULL\)/);
  assert.match(migration, /ShopCatalogSourceRecord_hash_check/);
  assert.match(migration, /ShopCatalogSourceRecord_supersedes_self_check/);
  assert.match(migration, /ShopCatalogSourceRecord_lineage/);
  assert.match(migration, /source record may only supersede the same source and record key/);
  assert.match(migration, /ShopCatalogSourceRecord_supersedesId_key/);
  assert.match(migration, /ShopCatalogSourceRecord_id_sourceId_key/);
  assert.match(
    migration,
    /ShopCatalogSourceBinding_sourceRecordId_sourceId_fkey[\s\S]*FOREIGN KEY \("sourceRecordId", "sourceId"\)[\s\S]*REFERENCES "ShopCatalogSourceRecord"\("id", "sourceId"\)/
  );
  assert.match(migration, /ShopCatalogSourceRecord_one_root_identity_idx/);
  assert.match(migration, /source record must supersede the current lineage tail/);
  assert.match(migration, /WITH RECURSIVE lineage/);
  assert.match(migration, /ShopCatalogSourceRecord_append_only/);
  assert.match(migration, /ShopCatalogSourceBinding_append_only/);
  assert.match(schema, /model ShopCatalogSourceBindingHead \{/);
  assert.match(migration, /ShopCatalogSourceBinding_revision_chain/);
  assert.match(migration, /ShopCatalogSourceBinding_target_exists/);
  assert.match(migration, /catalog_v2_validate_binding_target/);
  assert.match(migration, /catalog_v2_restrict_bound_target_identity_change/);
  for (const entity of [
    "ShopBrand",
    "VehicleMake",
    "VehicleModel",
    "VehicleGeneration",
    "VehiclePowertrain",
    "VehicleConfiguration",
  ]) {
    assert.match(
      migration,
      new RegExp(`FROM "${entity}" target WHERE target\\."id" = NEW\\."canonicalEntityId"`)
    );
  }
  for (const entity of [
    "ShopBrand",
    "VehicleMake",
    "VehicleModel",
    "VehicleGeneration",
    "VehiclePowertrain",
    "VehicleConfiguration",
  ]) {
    assert.match(migration, new RegExp(`${entity}_bound_identity_restrict`));
  }
  assert.match(migration, /ShopCatalogSourceBindingHead_latest_revision/);
  assert.match(migration, /ShopCatalogSourceBindingHead_no_delete/);
  assert.match(migration, /ShopCatalogSourceBinding_requires_head/);
  assert.match(migration, /latest binding revision must become head in the same transaction/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /'MAP', 'TOMBSTONE'/);
  assert.match(migration, /ShopCatalogSourceBinding_review_check/);
  assert.match(
    migration,
    /"decisionReason" IS NOT NULL[\s\S]*"reviewedById" IS NOT NULL[\s\S]*"reviewedAt" IS NOT NULL/
  );
  assert.match(migration, /binding head must reference the latest identity revision/);
  assert.match(migration, /ShopCatalogFieldProvenance_append_only/);
  assert.match(
    migration,
    /ShopCatalogCompatibilityPolicy_sourceRecordId_fkey[\s\S]*ON DELETE RESTRICT/
  );
  assert.match(
    migration,
    /ShopCatalogCompatibilityClause_sourceRecordId_fkey[\s\S]*ON DELETE RESTRICT/
  );
});

test("canonical taxonomy and source-scoped aliases cannot silently choose ambiguous targets", () => {
  for (const model of [
    "ShopBrand",
    "VehicleMake",
    "VehicleModel",
    "VehicleGeneration",
    "VehiclePowertrain",
    "VehicleConfiguration",
    "VehicleTaxonomyAlias",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }

  assert.match(migration, /VehicleTaxonomyAlias_sourceId_aliasKey_key/);
  assert.match(migration, /VehicleTaxonomyAlias_sourceId_entityType_scope_parentMakeId_idx/);
  assert.match(migration, /VehicleTaxonomyAlias_one_active_context_idx/);
  assert.match(migration, /VehicleTaxonomyAlias_target_check/);
  assert.match(migration, /VehicleTaxonomyAlias_context_check/);
  assert.match(migration, /VehicleTaxonomyAlias_context_consistency/);
  for (const entity of ["MAKE", "MODEL", "GENERATION", "POWERTRAIN", "CONFIGURATION"]) {
    assert.match(migration, new RegExp(`WHEN '${entity}'`));
  }
  assert.match(migration, /VehicleConfiguration_years_check/);
  assert.match(migration, /VehicleGeneration_model_requires_make_check/);
  assert.match(migration, /VehicleGeneration_modelId_makeId_fkey/);
  assert.match(migration, /VehicleConfiguration_taxonomy_chain/);
  assert.match(migration, /BETWEEN 1886 AND 2200/);
});

test("compatibility persists OR clauses, AND constraints, explicit states, and exact alternatives", () => {
  for (const dimension of [
    "SCOPE",
    "MAKE",
    "MODEL",
    "GENERATION",
    "CHASSIS",
    "YEAR",
    "ENGINE",
    "FUEL",
    "BODY_STYLE",
    "DRIVETRAIN",
    "TRANSMISSION",
    "MARKET",
    "OPF_GPF",
  ]) {
    assert.match(schema, new RegExp(`\\b${dimension}\\b`));
  }
  for (const state of ["EXACT", "ANY", "NOT_APPLICABLE", "UNKNOWN"]) {
    assert.match(schema, new RegExp(`\\b${state}\\b`));
  }

  assert.match(schema, /model ShopCatalogCompatibilityPolicy \{/);
  assert.match(schema, /model ShopCatalogCompatibilityClause \{/);
  assert.match(schema, /model ShopCatalogCompatibilityConstraint \{/);
  assert.match(schema, /model ShopCatalogCompatibilityValue \{/);
  assert.match(migration, /ShopCatalogCompatibilityPolicy_one_active_target_idx/);
  assert.match(migration, /ShopCatalogCompatibilityDimensionRule_default_check/);
  assert.match(migration, /ShopCatalogCompatibilityValue_shape_check/);
  assert.match(migration, /ShopCatalogCompatibilityValue_dimension_shape_check/);
  assert.match(migration, /ShopCatalogCompatibilityValue_constraintId_dimension_state_fkey/);
  assert.match(migration, /unresolved ENGINE text requires a NEEDS_REVIEW clause/);
  assert.match(migration, /ShopCatalogCompatibilityClause_verification_guard/);
  assert.match(migration, /unresolved ENGINE text cannot be promoted beyond NEEDS_REVIEW/);
  assert.match(migration, /ShopCatalogCompatibilityPolicy_review_mode_guard/);
  assert.match(migration, /ShopCatalogCompatibilityPolicy_self_parent_check/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /EXACT compatibility constraint % requires at least one value/);
});

test("product/variant pairs are protected by composite ownership foreign keys", () => {
  assert.match(migration, /ShopProductVariant_id_productId_key[\s\S]*\("id", "productId"\)/);

  for (const table of [
    "ShopCatalogSourceRecord",
    "ShopCatalogSourceBinding",
    "ShopCatalogFieldProvenance",
    "ShopCatalogNormalizationIssue",
    "ShopCatalogCompatibilityPolicy",
    "ShopCatalogProjectionSku",
    "ShopCatalogProjectionPolicy",
    "ShopCatalogProjectionClause",
    "ShopCatalogProjectionConstraint",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `${table}_variantId_productId_fkey[\\s\\S]*FOREIGN KEY \\(\"variantId\", \"productId\"\\)[\\s\\S]*REFERENCES \"ShopProductVariant\"\\(\"id\", \"productId\"\\)`
      )
    );
  }

  assert.match(
    migration,
    /ShopCatalogCompatibilityPolicy_variantId_productId_fkey[\s\S]*ON DELETE RESTRICT/
  );
  assert.doesNotMatch(
    migration,
    /ShopCatalogCompatibilityPolicy_variantId_productId_fkey[\s\S]{0,180}ON DELETE SET NULL/
  );
});

test("deferred exact-value validation uses valid trigger records and checks moved-from parents", () => {
  assert.match(
    migration,
    /catalog_v2_validate_constraint_values_from_constraint\(\)[\s\S]*NEW\."id"/
  );
  assert.match(
    migration,
    /catalog_v2_validate_constraint_values_from_value\(\)[\s\S]*OLD\."constraintId"[\s\S]*NEW\."constraintId" IS DISTINCT FROM OLD\."constraintId"/
  );
  assert.doesNotMatch(
    migration,
    /COALESCE\(NEW\."constraintId", OLD\."constraintId", NEW\."id", OLD\."id"\)/
  );
});

test("projection is bounded, versioned, parity-addressed, and indexed for keyset reads", () => {
  assert.match(schema, /model ShopCatalogProjection \{/);
  assert.match(schema, /canonicalRelationHash\s+String\s+@db\.VarChar\(64\)/);
  assert.match(migration, /"projectionVersion" = "catalogVersion"/);
  assert.match(migration, /ShopCatalogProjection_productId_locale_key/);
  assert.match(migration, /ShopCatalogProjection_locale_isPublished_statusKey_stableRa_idx/);
  assert.match(migration, /ShopCatalogProjection_searchText_trgm_idx/);
  assert.match(migration, /ShopCatalogProjection_searchText_fts_idx/);
  assert.match(migration, /ShopCatalogProjectionConstraint_dimension_state_textValue_p_idx/);
  assert.match(migration, /ShopCatalogProjectionConstraint_shape_check/);
  assert.match(migration, /ShopCatalogProjectionClause_targetKey_productId_sourceVers_fkey/);
  assert.match(migration, /ShopCatalogProjectionConstraint_targetKey_clauseKey_produc_fkey/);
  assert.match(migration, /ShopCatalogProjectionPolicy_parent_check/);
  assert.match(migration, /ShopCatalogProjectionPolicy_self_parent_check/);
  assert.match(migration, /ShopCatalogProjectionPolicy_review_mode_guard/);
  assert.match(migration, /ShopCatalogProjection_monotonic/);
  assert.match(migration, /catalog projectionVersion cannot regress/);
  assert.match(migration, /equal catalog projectionVersion cannot carry a different contentHash/);
});

test("revision and outbox contracts support ordered, recoverable publication", () => {
  assert.match(migration, /ShopCatalogProductRevision_append_only/);
  assert.match(migration, /ShopCatalogProductRevision_productId_version_key/);
  assert.match(migration, /ShopCatalogProductRevision_id_productId_version_key/);
  assert.match(migration, /ShopProduct_catalog_versions_check/);
  assert.match(migration, /"canonicalVersion" BIGINT NOT NULL/);
  assert.match(migration, /"revisionId" TEXT/);
  assert.match(
    migration,
    /ShopCatalogOutbox_revisionId_productId_canonicalVersion_fkey[\s\S]*FOREIGN KEY \("revisionId", "productId", "canonicalVersion"\)[\s\S]*REFERENCES "ShopCatalogProductRevision"\("id", "productId", "version"\)[\s\S]*ON DELETE RESTRICT/
  );
  assert.match(
    migration,
    /"entityType" = 'PRODUCT'[\s\S]*"productId" IS NOT NULL[\s\S]*"revisionId" IS NOT NULL/
  );
  assert.match(migration, /"maxAttempts" INTEGER NOT NULL DEFAULT 10/);
  assert.match(migration, /"lockedBy" TEXT/);
  assert.match(migration, /ShopCatalogOutbox_lifecycle_check/);
  assert.match(migration, /"status" = 'PROCESSING'[\s\S]*"lockedBy" IS NOT NULL/);
  assert.match(
    migration,
    /"status" IN \('COMPLETED', 'DEAD_LETTER'\)[\s\S]*"processedAt" IS NOT NULL/
  );
  assert.match(migration, /ShopCatalogOutbox_status_availableAt_id_idx/);
  assert.match(migration, /ShopCatalogOutbox_entityType_entityId_canonicalVersion_key/);
  assert.doesNotMatch(migration, /ShopCatalogOutbox_entityType_entityId_canonicalVersion_idx/);
  assert.match(migration, /ShopCatalogOutbox_event_immutable/);
  assert.match(migration, /ShopCatalogOutbox_revision_domains/);
  assert.match(
    migration,
    /PRODUCT outbox changeDomains must equal its immutable revision changeDomains/
  );
  assert.match(migration, /ShopCatalogProductRevision_product_version/);
  assert.match(migration, /ShopProduct_catalog_versions_monotonic/);
  assert.match(
    migration,
    /NEW\."catalogVersion" < OLD\."catalogVersion"[\s\S]*NEW\."publishedCatalogVersion" < OLD\."publishedCatalogVersion"[\s\S]*catalog versions cannot regress/
  );
});

test("per-target receipts are authoritative and cannot regress", () => {
  for (const target of ["CONTENT", "SEARCH", "PRICE", "INVENTORY", "SETTINGS"]) {
    assert.match(schema, new RegExp(`\\b${target}\\b`));
  }
  assert.match(schema, /model ShopCatalogPublicationReceipt \{/);
  assert.match(migration, /ShopCatalogPublicationReceipt_entityType_entityId_target_key/);
  assert.match(migration, /ShopCatalogPublicationReceipt_versions_check/);
  assert.match(migration, /ShopCatalogPublicationReceipt_appliedRevisionId_productId__fkey/);
  assert.match(migration, /ShopCatalogPublicationReceipt_monotonic/);
  assert.match(migration, /ShopCatalogPublicationReceipt_no_delete/);
  assert.match(migration, /ShopCatalogPublicationReceipt_product_version/);
  assert.match(migration, /appliedVersion cannot regress/);
  assert.match(migration, /catalog_v2_required_projection_targets/);
  for (const mapping of [
    "('CONTENT', 'CONTENT')",
    "('CONTENT', 'SEARCH')",
    "('MEDIA', 'CONTENT')",
    "('MEDIA', 'SEARCH')",
    "('FITMENT', 'SEARCH')",
    "('TAXONOMY', 'SEARCH')",
    "('PRICE', 'PRICE')",
    "('INVENTORY', 'INVENTORY')",
    "('SETTINGS', 'SETTINGS')",
  ]) {
    assert.ok(migration.includes(mapping), `missing change-domain mapping ${mapping}`);
  }
  assert.match(migration, /catalog_v2_required_projection_targets\(revision\."changeDomains"\)/);
  assert.doesNotMatch(migration, /enum_range\(NULL::"ShopCatalogProjectionTarget"\)/);
  assert.match(
    migration,
    /"status" = 'PUBLISHING' AND "processingVersion" IS NOT NULL AND "failedVersion" IS NULL/
  );
});
