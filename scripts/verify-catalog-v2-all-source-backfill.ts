import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { auditShopCatalogSelectorCoverageWithClient } from "../src/lib/shopCatalogSelectorCoverageAudit.server";
import type { CoverageNormalization } from "../src/lib/shopCatalogNormalizationCoverage";
import { buildShopCatalogBaselineProductEntry } from "../src/lib/shopCatalogBaseline";
import { buildAdroSourceRecordDraft } from "../src/lib/shopCatalogAdroNormalization";
import { persistAdroSourceRecordPageWithClient } from "../src/lib/shopCatalogAdroBackfill.server";
import { buildAkrapovicSourceRecordDraft } from "../src/lib/shopCatalogAkrapovicNormalization";
import { persistAkrapovicSourceRecordPageWithClient } from "../src/lib/shopCatalogAkrapovicBackfill.server";
import { buildBrabusSourceRecordDraft } from "../src/lib/shopCatalogBrabusNormalization";
import { persistBrabusSourceRecordPageWithClient } from "../src/lib/shopCatalogBrabusBackfill.server";
import { buildBurgerSourceRecordDraft } from "../src/lib/shopCatalogBurgerNormalization";
import { persistBurgerSourceRecordPageWithClient } from "../src/lib/shopCatalogBurgerBackfill.server";
import { buildCsfSourceRecordDraft } from "../src/lib/shopCatalogCsfNormalization";
import { persistCsfSourceRecordPageWithClient } from "../src/lib/shopCatalogCsfBackfill.server";
import { buildDo88SourceRecordDraft } from "../src/lib/shopCatalogDo88Normalization";
import { persistDo88SourceRecordPageWithClient } from "../src/lib/shopCatalogDo88Backfill.server";
import { buildEventuriSourceRecordDraft } from "../src/lib/shopCatalogEventuriNormalization";
import { persistEventuriSourceRecordPageWithClient } from "../src/lib/shopCatalogEventuriBackfill.server";
import { buildGirodiscSourceRecordDraft } from "../src/lib/shopCatalogGirodiscNormalization";
import { persistGirodiscSourceRecordPageWithClient } from "../src/lib/shopCatalogGirodiscBackfill.server";
import { buildIlmbergerSourceRecordDraft } from "../src/lib/shopCatalogIlmbergerNormalization";
import { persistIlmbergerSourceRecordPageWithClient } from "../src/lib/shopCatalogIlmbergerBackfill.server";
import { buildIpeSourceRecordDraft } from "../src/lib/shopCatalogIpeNormalization";
import { persistIpeSourceRecordPageWithClient } from "../src/lib/shopCatalogIpeBackfill.server";
import { buildOhlinsSourceRecordDraft } from "../src/lib/shopCatalogOhlinsNormalization";
import { persistOhlinsSourceRecordPageWithClient } from "../src/lib/shopCatalogOhlinsBackfill.server";
import { buildRaceChipSourceRecordDraft } from "../src/lib/shopCatalogRaceChipNormalization";
import { persistRaceChipSourceRecordPageWithClient } from "../src/lib/shopCatalogRaceChipBackfill.server";
import { buildRemusSourceRecordDraft } from "../src/lib/shopCatalogRemusNormalization";
import { persistRemusSourceRecordPageWithClient } from "../src/lib/shopCatalogRemusBackfill.server";
import { buildUrbanSourceRecordDraft } from "../src/lib/shopCatalogUrbanNormalization";
import { persistUrbanSourceRecordPageWithClient } from "../src/lib/shopCatalogUrbanBackfill.server";
import {
  buildBootmod3SourceRecordDraft,
  buildFiExhaustSupplementalSourceRecordDraft,
  buildGSportSourceRecordDraft,
  buildKwSuspensionsSupplementalSourceRecordDraft,
  buildSupplementalCatalogSourceRecordDraft,
} from "../src/lib/shopCatalogSupplementalNormalization";
import {
  persistBootmod3SourceRecordPageWithClient,
  persistFiExhaustSupplementalSourceRecordPageWithClient,
  persistGSportSourceRecordPageWithClient,
  persistKwSuspensionsSupplementalSourceRecordPageWithClient,
  persistRevozportSourceRecordPageWithClient,
} from "../src/lib/shopCatalogSupplementalBackfill.server";
import { loadSupplementalCatalogDrafts } from "./catalog-v2-supplemental-source";

type Snapshot = {
  id: string;
  slug: string;
  sku?: string | null;
  title?: { ua?: string; en?: string };
  image?: string | null;
  gallery?: string[];
  collections?: unknown[];
  variants?: Array<{
    id: string;
    sku?: string | null;
    title?: string;
    image?: string | null;
    isDefault?: boolean;
  }>;
  brand?: string;
  [key: string]: unknown;
};
type Draft = {
  provenance: unknown[];
  issues: unknown[];
  normalization: CoverageNormalization;
  sourceRecord: { recordKey: string; rawPayload: Snapshot };
};
type Persist = (
  client: PrismaClient,
  input: { drafts: readonly never[]; sourceKey?: string; sourceDisplayName?: string }
) => Promise<{
  inserted: number;
  idempotent: number;
  provenanceInserted: number;
  issuesInserted: number;
}>;
const builders = {
  adro: buildAdroSourceRecordDraft,
  akrapovic: buildAkrapovicSourceRecordDraft,
  bootmod3: buildBootmod3SourceRecordDraft,
  brabus: buildBrabusSourceRecordDraft,
  burger: buildBurgerSourceRecordDraft,
  csf: buildCsfSourceRecordDraft,
  do88: buildDo88SourceRecordDraft,
  eventuri: buildEventuriSourceRecordDraft,
  "fi-exhaust": buildFiExhaustSupplementalSourceRecordDraft,
  girodisc: buildGirodiscSourceRecordDraft,
  "g-sport": buildGSportSourceRecordDraft,
  ilmberger: buildIlmbergerSourceRecordDraft,
  ipe: buildIpeSourceRecordDraft,
  "kw-suspensions": buildKwSuspensionsSupplementalSourceRecordDraft,
  revozport: buildSupplementalCatalogSourceRecordDraft,
  ohlins: buildOhlinsSourceRecordDraft,
  racechip: buildRaceChipSourceRecordDraft,
  remus: buildRemusSourceRecordDraft,
  urban: buildUrbanSourceRecordDraft,
} as const;
const persisters = {
  adro: persistAdroSourceRecordPageWithClient,
  akrapovic: persistAkrapovicSourceRecordPageWithClient,
  bootmod3: persistBootmod3SourceRecordPageWithClient,
  brabus: persistBrabusSourceRecordPageWithClient,
  burger: persistBurgerSourceRecordPageWithClient,
  csf: persistCsfSourceRecordPageWithClient,
  do88: persistDo88SourceRecordPageWithClient,
  eventuri: persistEventuriSourceRecordPageWithClient,
  "fi-exhaust": persistFiExhaustSupplementalSourceRecordPageWithClient,
  girodisc: persistGirodiscSourceRecordPageWithClient,
  "g-sport": persistGSportSourceRecordPageWithClient,
  ilmberger: persistIlmbergerSourceRecordPageWithClient,
  ipe: persistIpeSourceRecordPageWithClient,
  "kw-suspensions": persistKwSuspensionsSupplementalSourceRecordPageWithClient,
  revozport: persistRevozportSourceRecordPageWithClient,
  ohlins: persistOhlinsSourceRecordPageWithClient,
  racechip: persistRaceChipSourceRecordPageWithClient,
  remus: persistRemusSourceRecordPageWithClient,
  urban: persistUrbanSourceRecordPageWithClient,
} as unknown as Record<string, Persist>;
function assertDatabaseUrl() {
  const value = process.env.CATALOG_ALL_SOURCE_GATE_DATABASE_URL?.trim();
  if (!value) throw new Error("CATALOG_ALL_SOURCE_GATE_DATABASE_URL is required");
  const url = new URL(value);
  if (
    !new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname) ||
    url.searchParams.get("application_name") !== "catalog-all-source-gate"
  )
    throw new Error(
      "All-source gate requires a localhost disposable database with application_name=catalog-all-source-gate"
    );
  return value;
}
function pages<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    output.push(values.slice(index, index + size));
  return output;
}
function snapshotMediaReferences(product: Snapshot) {
  return [
    ...new Set(
      [
        product.image,
        ...(product.gallery ?? []),
        ...(product.variants ?? []).map((variant) => variant.image),
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    ),
  ];
}
async function load() {
  const manifestPath = resolve("public", "catalog-fallback", "manifest.json"),
    manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      stores: Record<string, { file: string; count: number }>;
    },
    sources: Array<{ name: keyof typeof builders; products: Snapshot[]; revision: string }> = [],
    unsupportedSources: Array<{ name: string; records: number; revision: string }> = [];
  let manifestRecords = 0;
  for (const [name, descriptor] of Object.entries(manifest.stores)) {
    const raw = await readFile(resolve(dirname(manifestPath), descriptor.file), "utf8"),
      revision = createHash("sha256").update(raw).digest("hex").slice(0, 12),
      products = JSON.parse(raw) as Snapshot[];
    if (products.length !== descriptor.count || !descriptor.file.includes(`.${revision}.json`))
      throw new Error(`${name} immutable shard mismatch`);
    manifestRecords += products.length;
    if (name === "generic") {
      const sourceByBrand = new Map<string, keyof typeof builders>([
          ["bootmod3", "bootmod3"],
          ["eventuri", "eventuri"],
          ["fi exhaust", "fi-exhaust"],
          ["g-sport by gesi", "g-sport"],
          ["kw suspensions", "kw-suspensions"],
          ["revozport", "revozport"],
          ["remus", "remus"],
        ]),
        partitions = new Map<keyof typeof builders, Snapshot[]>(),
        unsupported = new Map<string, number>();
      for (const product of products) {
        const source = sourceByBrand.get(product.brand?.trim().toLowerCase() ?? "");
        if (!source) {
          const brand = product.brand || "<missing brand>";
          unsupported.set(brand, (unsupported.get(brand) ?? 0) + 1);
          continue;
        }
        const partition = partitions.get(source) ?? [];
        partition.push(product);
        partitions.set(source, partition);
      }
      for (const [brand, records] of unsupported)
        unsupportedSources.push({ name: brand, records, revision });
      for (const [partition, partitionProducts] of partitions) {
        sources.push({ name: partition, products: partitionProducts, revision });
      }
    } else if (Object.hasOwn(builders, name)) {
      sources.push({ name: name as keyof typeof builders, products, revision });
    } else unsupportedSources.push({ name, records: products.length, revision });
  }
  return {
    sources: sources.sort((left, right) => left.name.localeCompare(right.name)),
    unsupportedSources,
    manifestRecords,
  };
}
async function main() {
  const startedAt = Date.now(),
    commitSha = process.env.CATALOG_GATE_COMMIT_SHA?.trim().toLowerCase();
  if (!commitSha || !/^[a-f0-9]{40}$/.test(commitSha))
    throw new Error("CATALOG_GATE_COMMIT_SHA must be a full 40-character Git commit SHA");
  const client = new PrismaClient({ datasources: { db: { url: assertDatabaseUrl() } } }),
    { sources, unsupportedSources, manifestRecords } = await load(),
    products = sources.flatMap((source) => source.products),
    draftsBySource = new Map<string, Draft[]>();
  if (unsupportedSources.length)
    process.stdout.write(
      `[all-source-gate] UNVERIFIED sources (overall gate will fail): ${JSON.stringify(unsupportedSources)}\n`
    );
  try {
    for (const page of pages(products, 500))
      await client.shopProduct.createMany({
        data: page.map((product) => ({
          id: product.id,
          slug: product.slug,
          titleUa: product.title?.ua || product.slug,
          titleEn: product.title?.en || product.slug,
          brand: product.brand ?? null,
        })),
        skipDuplicates: true,
      });
    const variants = products.flatMap((product) =>
      (product.variants ?? []).map((variant) => ({
        id: variant.id,
        productId: product.id,
        title: variant.title || "Default",
        sku: variant.sku ?? null,
        isDefault: Boolean(variant.isDefault),
      }))
    );
    for (const page of pages(variants, 500))
      await client.shopProductVariant.createMany({ data: page, skipDuplicates: true });
    for (const source of sources) {
      const drafts = source.name === "revozport"
        ? await loadSupplementalCatalogDrafts("revozport") as Draft[]
        : source.products
            .map((product) => {
              const builder = builders[source.name] as unknown as (input: {
                product: Snapshot;
                sourceRevision: string;
              }) => Draft;
              return builder({ product, sourceRevision: source.revision });
            })
            .sort((left, right) => left.sourceRecord.recordKey.localeCompare(right.sourceRecord.recordKey));
      draftsBySource.set(source.name, drafts);
      let completed = 0;
      for (const page of pages(drafts, 50)) {
        await persisters[source.name]!(client, {
          drafts: page as never[],
          sourceKey: `gate-${source.name}`,
          sourceDisplayName: `Gate ${source.name}`,
        });
        completed += page.length;
        if (completed % 500 === 0 || completed === drafts.length)
          process.stdout.write(`[all-source-gate] ${source.name} ${completed}/${drafts.length}\n`);
      }
    }
    const initialBackfillMs = Date.now() - startedAt,
      expectedRecords = [...draftsBySource.values()].reduce(
        (sum, drafts) => sum + drafts.length,
        0
      ),
      expectedProvenance = [...draftsBySource.values()]
        .flat()
        .reduce((sum, draft) => sum + draft.provenance.length, 0),
      expectedIssues = [...draftsBySource.values()]
        .flat()
        .reduce((sum, draft) => sum + draft.issues.length, 0),
      expectedReview = [...draftsBySource.values()]
        .flat()
      .filter((draft) => draft.normalization.compatibilityPolicy
        ? draft.normalization.compatibilityPolicy.mode === "NEEDS_REVIEW"
        : draft.normalization.verification === "NEEDS_REVIEW").length;
    const counts = {
      sources: await client.shopCatalogSource.count({ where: { key: { startsWith: "gate-" } } }),
      records: await client.shopCatalogSourceRecord.count(),
      provenance: await client.shopCatalogFieldProvenance.count(),
      issues: await client.shopCatalogNormalizationIssue.count(),
      activePolicies: await client.shopCatalogCompatibilityPolicy.count({
        where: { isActive: true },
      }),
      reviewPolicies: await client.shopCatalogCompatibilityPolicy.count({
        where: { isActive: true, mode: "NEEDS_REVIEW" },
      }),
    };
    if (
      counts.sources !== sources.length ||
      counts.records !== expectedRecords ||
      counts.provenance !== expectedProvenance ||
      counts.issues !== expectedIssues ||
      counts.activePolicies !== expectedRecords ||
      counts.reviewPolicies !== expectedReview
    )
      throw new Error(
        `All-source persistence parity failed: ${JSON.stringify({ counts, expectedRecords, expectedProvenance, expectedIssues, expectedReview })}`
      );
    const persistedRecords = await client.shopCatalogSourceRecord.findMany({
      where: { source: { key: { startsWith: "gate-" } } },
      select: { recordKey: true, rawPayload: true, source: { select: { key: true } } },
    });
    const expectedCommerce = new Map(
      sources.flatMap((source) => {
        // Revozport's immutable source payload includes its SKU-bound V2
        // compatibility contract and row-level audit. Compare like-for-like
        // with the exact enriched payload persisted by the backfill adapter.
        const expectedProducts = source.name === "revozport"
          ? draftsBySource.get(source.name)!.map((draft) => draft.sourceRecord.rawPayload as Snapshot)
          : source.products;
        return expectedProducts.map((product) => {
          const entry = buildShopCatalogBaselineProductEntry(product);
          return [`gate-${source.name}:${entry.productId}`, entry] as const;
        });
      })
    );
    const persistedCommerce = new Map(
      persistedRecords.map((record) => {
        if (!record.rawPayload)
          throw new Error(`${record.source.key}:${record.recordKey} lost its inline raw payload`);
        const entry = buildShopCatalogBaselineProductEntry(record.rawPayload as Snapshot);
        return [`${record.source.key}:${entry.productId}`, entry] as const;
      })
    );
    if (persistedCommerce.size !== expectedCommerce.size)
      throw new Error(
        `Commerce snapshot count mismatch: ${persistedCommerce.size}/${expectedCommerce.size}`
      );
    for (const [key, expected] of expectedCommerce) {
      const actual = persistedCommerce.get(key);
      if (!actual || actual.hashes.full !== expected.hashes.full)
        throw new Error(`Lossless commerce snapshot parity failed for ${key}`);
    }
    const uaEnLocalizedProducts = products.filter(
      (product) => Boolean(product.title?.ua?.trim()) && Boolean(product.title?.en?.trim())
    ).length;
    if (uaEnLocalizedProducts !== expectedRecords)
      throw new Error(
        `UA/EN localization coverage failed: ${uaEnLocalizedProducts}/${expectedRecords}`
      );
    const canonicalShapeCounts = [...expectedCommerce.values()].reduce(
      (totals, entry) => ({
        media: totals.media + entry.counts.media,
        metafields: totals.metafields + entry.counts.metafields,
        collections: totals.collections + entry.counts.collections,
        options: totals.options + entry.counts.options,
        applications: totals.applications + entry.counts.applications,
        priceValues: totals.priceValues + entry.counts.priceValues,
      }),
      { media: 0, metafields: 0, collections: 0, options: 0, applications: 0, priceValues: 0 }
    );
    const legacySnapshotCounts = products.reduce(
      (totals, product) => {
        const media = snapshotMediaReferences(product);
        return {
          productsWithMedia: totals.productsWithMedia + Number(media.length > 0),
          mediaReferences: totals.mediaReferences + media.length,
          collectionMemberships: totals.collectionMemberships + (product.collections?.length ?? 0),
          variants: totals.variants + (product.variants?.length ?? 0),
        };
      },
      { productsWithMedia: 0, mediaReferences: 0, collectionMemberships: 0, variants: 0 }
    );
    const replayStartedAt = Date.now();
    let replayed = 0;
    for (const source of sources) {
      let sourceReplayed = 0;
      for (const page of pages(draftsBySource.get(source.name)!, 50)) {
        const result = await persisters[source.name]!(client, {
          drafts: page as never[],
          sourceKey: `gate-${source.name}`,
          sourceDisplayName: `Gate ${source.name}`,
        });
        if (
          result.inserted !== 0 ||
          result.idempotent !== page.length ||
          result.provenanceInserted !== 0 ||
          result.issuesInserted !== 0
        )
          throw new Error(`${source.name} replay was not idempotent`);
        replayed += page.length;
        sourceReplayed += page.length;
        if (
          sourceReplayed % 500 === 0 ||
          sourceReplayed === draftsBySource.get(source.name)!.length
        )
          process.stdout.write(
            `[all-source-gate] replay ${source.name} ${sourceReplayed}/${draftsBySource.get(source.name)!.length}\n`
          );
      }
    }
    const replayMs = Date.now() - replayStartedAt;
    const selectorCoverage = await auditShopCatalogSelectorCoverageWithClient(
      client,
      draftsBySource
    ).catch((error: unknown) => ({
      passed: false,
      aborted: true,
      error: error instanceof Error ? error.message : String(error),
    }));
    const report = {
      version: 5,
      passed: selectorCoverage.passed && unsupportedSources.length === 0,
      manifestRecords,
      unsupportedSources,
      selectorCoverage,
      commitSha,
      generatedAt: new Date().toISOString(),
      sources: sources.length,
      records: expectedRecords,
      variants: variants.length,
      provenance: expectedProvenance,
      issues: expectedIssues,
      reviewPolicies: expectedReview,
      activePolicies: counts.activePolicies,
      replayed,
      losslessCommerceSnapshots: persistedCommerce.size,
      uaEnLocalizedProducts,
      canonicalShapeCounts,
      legacySnapshotCounts,
      initialBackfillMs,
      replayMs,
      initialRecordsPerHour: Math.round((expectedRecords * 3_600_000) / initialBackfillMs),
      replayRecordsPerHour: Math.round((replayed * 3_600_000) / replayMs),
      elapsedMs: Date.now() - startedAt,
      fingerprint: createHash("sha256")
        .update(
          [...draftsBySource.entries()]
            .flatMap(([source, drafts]) =>
              drafts.map((draft) => `${source}:${draft.sourceRecord.recordKey}`)
            )
            .sort()
            .join("\n")
        )
        .digest("hex"),
    };
    const artifactDirectory = resolve("artifacts", "catalog-v2-all-source");
    await mkdir(artifactDirectory, { recursive: true });
    await writeFile(
      join(artifactDirectory, "catalog-v2-all-source-gate.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!selectorCoverage.passed)
      throw new Error("Selector coverage failed; see the commit-bound all-source gate report");
    if (unsupportedSources.length)
      throw new Error(
        "Some current manifest sources have no persistence coverage adapter; see unsupportedSources in the gate report"
      );
  } finally {
    await client.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
