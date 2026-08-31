import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { RaceChipSourceRecordDraft } from "./shopCatalogRaceChipNormalization";
import { persistRaceChipCompatibilityInTransaction } from "./shopCatalogRaceChipCompatibility.server";

export const RACECHIP_BACKFILL_PAGE_LIMIT = 50;

export type RaceChipBackfillPageResult = {
  sourceId: string;
  received: number;
  inserted: number;
  idempotent: number;
  provenanceInserted: number;
  issuesInserted: number;
  nextRecordKey: string | null;
};

function assertDraftPage(drafts: readonly RaceChipSourceRecordDraft[]) {
  if (drafts.length < 1 || drafts.length > RACECHIP_BACKFILL_PAGE_LIMIT) {
    throw new TypeError(`RaceChip backfill page must contain 1-${RACECHIP_BACKFILL_PAGE_LIMIT} records`);
  }
  const keys = drafts.map((draft) => draft.sourceRecord.recordKey);
  if (new Set(keys).size !== keys.length) throw new TypeError("RaceChip backfill page has duplicate record keys");
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index - 1]!.localeCompare(keys[index]!) >= 0) {
      throw new TypeError("RaceChip backfill page must be sorted by record key");
    }
  }
}

function jsonValue(value: unknown, label: string): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError(`${label} is not JSON serializable`);
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function sortedSignatures(values: readonly string[]) {
  return [...values].sort().join("\n");
}

export async function persistRaceChipSourceRecordPageWithClient(
  client: PrismaClient,
  input: {
    drafts: readonly RaceChipSourceRecordDraft[];
    sourceKey?: string;
    sourceDisplayName?: string;
    reviewedById?: string;
  }
): Promise<RaceChipBackfillPageResult> {
  assertDraftPage(input.drafts);
  const sourceKey = (input.sourceKey ?? "racechip-snapshot-v1").trim().toLowerCase();
  if (!sourceKey || sourceKey.length > 200) throw new TypeError("Invalid RaceChip source key");

  return client.$transaction(
    async (tx) => {
      const source = await tx.shopCatalogSource.upsert({
        where: { key: sourceKey },
        create: {
          key: sourceKey,
          displayName: input.sourceDisplayName?.trim() || "RaceChip immutable snapshot",
          kind: "LEGACY_SNAPSHOT",
          priority: 50,
        },
        update: {},
      });
      const productIds = [...new Set(input.drafts.map((draft) => draft.normalization.productId))];
      const products = await tx.shopProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, variants: { select: { id: true } } },
      });
      const variantOwner = new Map<string, string>();
      for (const product of products) {
        for (const variant of product.variants) variantOwner.set(variant.id, product.id);
      }
      if (products.length !== productIds.length) throw new Error("RaceChip page references missing products");
      for (const draft of input.drafts) {
        if (variantOwner.get(draft.normalization.variantId) !== draft.normalization.productId) {
          throw new Error(`RaceChip variant ${draft.normalization.variantId} has invalid ownership`);
        }
      }

      let inserted = 0;
      let idempotent = 0;
      let provenanceInserted = 0;
      let issuesInserted = 0;
      for (const draft of input.drafts) {
        const recordInput = draft.sourceRecord;
        const existing = await tx.shopCatalogSourceRecord.findUnique({
          where: {
            sourceId_recordKey_sourceRevision: {
              sourceId: source.id,
              recordKey: recordInput.recordKey,
              sourceRevision: recordInput.sourceRevision,
            },
          },
          select: {
            id: true,
            payloadHash: true,
            productId: true,
            variantId: true,
            fieldProvenance: {
              select: {
                fieldPath: true,
                ordinal: true,
                mappingStatus: true,
                canonicalEntityType: true,
                canonicalEntityId: true,
                canonicalField: true,
                mapperVersion: true,
                productId: true,
                variantId: true,
              },
            },
            issues: { select: { issueKey: true, code: true, rawPath: true } },
          },
        });
        if (existing) {
          if (
            existing.payloadHash !== recordInput.payloadHash ||
            existing.productId !== draft.normalization.productId ||
            existing.variantId !== draft.normalization.variantId ||
            sortedSignatures(
              existing.fieldProvenance.map((entry) =>
                [entry.fieldPath, entry.ordinal, entry.mappingStatus, entry.canonicalEntityType, entry.canonicalEntityId, entry.canonicalField, entry.mapperVersion, entry.productId, entry.variantId].join("\u0000")
              )
            ) !==
              sortedSignatures(
                draft.provenance.map((entry) =>
                  [entry.fieldPath, entry.ordinal, entry.mappingStatus, entry.canonicalEntityType, entry.canonicalEntityId, entry.canonicalField, entry.mapperVersion, entry.productId, entry.variantId].join("\u0000")
                )
              ) ||
            sortedSignatures(existing.issues.map((issue) => [issue.issueKey, issue.code, issue.rawPath].join("\u0000"))) !==
              sortedSignatures(draft.issues.map((issue) => [issue.issueKey, issue.code, issue.rawPath].join("\u0000")))
          ) {
            throw new Error(`RaceChip immutable replay conflict for ${recordInput.recordKey}`);
          }
          await persistRaceChipCompatibilityInTransaction({
            tx,
            sourceId: source.id,
            sourceRecordId: existing.id,
            payloadHash: existing.payloadHash,
            normalization: draft.normalization,
          });
          idempotent += 1;
          continue;
        }

        const previousRecord = await tx.shopCatalogSourceRecord.findFirst({
          where: { sourceId: source.id, recordKey: recordInput.recordKey, supersededBy: null },
          select: { id: true },
        });
        const record = await tx.shopCatalogSourceRecord.create({
          data: {
            sourceId: source.id,
            recordKey: recordInput.recordKey,
            sourceRevision: recordInput.sourceRevision,
            rawPayload: jsonValue(recordInput.rawPayload, "rawPayload"),
            payloadHash: recordInput.payloadHash,
            productId: draft.normalization.productId,
            variantId: draft.normalization.variantId,
            supersedesId: previousRecord?.id ?? null,
          },
        });

        const head = await tx.shopCatalogSourceBindingHead.findUnique({
          where: {
            sourceId_entityType_externalKey: {
              sourceId: source.id,
              entityType: "VARIANT",
              externalKey: recordInput.recordKey,
            },
          },
          include: { currentBinding: true },
        });
        const bindingId = randomUUID();
        const reviewedById = input.reviewedById?.trim() || null;
        if (head && !reviewedById) {
          throw new Error(
            `RaceChip binding revision for ${recordInput.recordKey} requires reviewedById`
          );
        }
        await tx.shopCatalogSourceBinding.create({
          data: {
            id: bindingId,
            sourceId: source.id,
            sourceRecordId: record.id,
            entityType: "VARIANT",
            externalKey: recordInput.recordKey,
            bindingVersion: (head?.currentBinding.bindingVersion ?? 0) + 1,
            action: "MAP",
            canonicalEntityId: draft.normalization.variantId,
            productId: draft.normalization.productId,
            variantId: draft.normalization.variantId,
            supersedesId: head?.currentBindingId ?? null,
            decisionReason: "exact immutable RaceChip product and default-variant identity",
            reviewedById: head ? reviewedById : null,
            reviewedAt: head ? new Date() : null,
          },
        });
        if (head) {
          await tx.shopCatalogSourceBindingHead.update({
            where: { id: head.id },
            data: { currentBindingId: bindingId },
          });
        } else {
          await tx.shopCatalogSourceBindingHead.create({
            data: {
              sourceId: source.id,
              entityType: "VARIANT",
              externalKey: recordInput.recordKey,
              currentBindingId: bindingId,
            },
          });
        }

        const provenance = await tx.shopCatalogFieldProvenance.createMany({
          data: draft.provenance.map((entry) => ({
            sourceRecordId: record.id,
            fieldPath: entry.fieldPath,
            ordinal: entry.ordinal,
            rawValue: jsonValue(entry.rawValue, `${entry.fieldPath}.rawValue`),
            canonicalEntityType: entry.canonicalEntityType,
            canonicalEntityId: entry.canonicalEntityId,
            canonicalField: entry.canonicalField,
            normalizedValue: jsonValue(entry.normalizedValue, `${entry.fieldPath}.normalizedValue`),
            mappingStatus: entry.mappingStatus,
            mapperVersion: entry.mapperVersion,
            confidence: entry.confidence,
            reason: entry.reason,
            productId: entry.productId,
            variantId: entry.variantId,
          })),
        });
        const issues = await tx.shopCatalogNormalizationIssue.createMany({
          data: draft.issues.map((issue) => ({
            sourceRecordId: record.id,
            productId: draft.normalization.productId,
            variantId: draft.normalization.variantId,
            issueKey: issue.issueKey,
            code: issue.code,
            rawPath: issue.rawPath,
            details: jsonValue(issue.details, `${issue.issueKey}.details`),
          })),
        });
        if (provenance.count !== draft.provenance.length || issues.count !== draft.issues.length) {
          throw new Error(`RaceChip evidence persistence count mismatch for ${recordInput.recordKey}`);
        }
        await persistRaceChipCompatibilityInTransaction({
          tx,
          sourceId: source.id,
          sourceRecordId: record.id,
          payloadHash: recordInput.payloadHash,
          normalization: draft.normalization,
        });
        inserted += 1;
        provenanceInserted += provenance.count;
        issuesInserted += issues.count;
      }
      return {
        sourceId: source.id,
        received: input.drafts.length,
        inserted,
        idempotent,
        provenanceInserted,
        issuesInserted,
        nextRecordKey: input.drafts.at(-1)?.sourceRecord.recordKey ?? null,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
  );
}
