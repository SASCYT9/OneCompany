import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildBrabusProductSlug,
  buildBrabusSeoDescription,
  cleanBrabusHtmlDescription,
  cleanBrabusPlainText,
  cleanBrabusTitle,
  hasBrabusDescriptionArtifacts,
  hasBrabusGermanResidualInDescription,
  hasBrabusGermanResidualInTitle,
  hasBrabusHtmlEntities,
  isLikelyBrabusOverviewProductLike,
  scoreBrabusProductCandidateLike,
  stripHtmlTags,
} from '../src/lib/brabusCatalogCleanup';

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');
const deleteOverview = process.argv.includes('--delete-overview');

type BrabusRow = Prisma.ShopProductGetPayload<{
  include: {
    variants: {
      select: {
        id: true;
        sku: true;
        image: true;
        isDefault: true;
      };
    };
  };
}>;

type PlannedUpdate = {
  id: string;
  slug: string;
  data: Prisma.ShopProductUpdateInput;
};

type DuplicatePlan = {
  sku: string;
  canonicalId: string;
  canonicalSlug: string;
  donorIds: string[];
  donorSlugs: string[];
  donorVariantIds: string[];
  canonicalDefaultVariantId: string | null;
};

type OverviewPlan = {
  id: string;
  slug: string;
  sku: string | null;
  variantIds: string[];
};

function extractGallery(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function dedupeStrings(values: Array<string | null | undefined>) {
  const unique = new Set<string>();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function normalizeSkuKey(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeProduct(row: BrabusRow) {
  const cleanTitleUa = cleanBrabusTitle('ua', row.titleUa) || row.titleUa;
  const cleanTitleEn = cleanBrabusTitle('en', row.titleEn) || row.titleEn;
  const shouldFixTitleUa = Boolean(row.titleUa) && row.titleUa !== cleanTitleUa;
  const shouldFixTitleEn = Boolean(row.titleEn) && row.titleEn !== cleanTitleEn;
  const titleUa = shouldFixTitleUa ? cleanTitleUa : row.titleUa;
  const titleEn = shouldFixTitleEn ? cleanTitleEn : row.titleEn;

  const cleanShortDescUa = cleanBrabusPlainText('ua', row.shortDescUa);
  const cleanShortDescEn = cleanBrabusPlainText('en', row.shortDescEn);
  const shouldFixShortDescUa = Boolean(row.shortDescUa) && row.shortDescUa !== cleanShortDescUa;
  const shouldFixShortDescEn = Boolean(row.shortDescEn) && row.shortDescEn !== cleanShortDescEn;
  const shortDescUa = shouldFixShortDescUa ? (cleanShortDescUa || null) : row.shortDescUa;
  const shortDescEn = shouldFixShortDescEn ? (cleanShortDescEn || null) : row.shortDescEn;

  const cleanedBodyHtmlUa = cleanBrabusHtmlDescription('ua', row.bodyHtmlUa);
  const cleanedBodyHtmlEn = cleanBrabusHtmlDescription('en', row.bodyHtmlEn);
  const cleanedLongDescUa = cleanBrabusHtmlDescription('ua', row.longDescUa);
  const cleanedLongDescEn = cleanBrabusHtmlDescription('en', row.longDescEn);
  const shouldFixBodyUa = Boolean(row.bodyHtmlUa) && row.bodyHtmlUa !== cleanedBodyHtmlUa;
  const shouldFixBodyEn = Boolean(row.bodyHtmlEn) && row.bodyHtmlEn !== cleanedBodyHtmlEn;
  const shouldFixLongUa = Boolean(row.longDescUa) && row.longDescUa !== cleanedLongDescUa;
  const shouldFixLongEn = Boolean(row.longDescEn) && row.longDescEn !== cleanedLongDescEn;
  const bodyHtmlUa = shouldFixBodyUa ? (cleanedBodyHtmlUa || null) : row.bodyHtmlUa;
  const bodyHtmlEn = shouldFixBodyEn ? (cleanedBodyHtmlEn || null) : row.bodyHtmlEn;
  const longDescUa = shouldFixLongUa ? (cleanedLongDescUa || null) : row.longDescUa;
  const longDescEn = shouldFixLongEn ? (cleanedLongDescEn || null) : row.longDescEn;

  const desiredSeoDescriptionUa = buildBrabusSeoDescription('ua', {
    longHtml: longDescUa || bodyHtmlUa,
    shortText: shortDescUa,
    title: titleUa,
  });
  const desiredSeoDescriptionEn = buildBrabusSeoDescription('en', {
    longHtml: longDescEn || bodyHtmlEn,
    shortText: shortDescEn,
    title: titleEn,
  });
  const seoDescriptionUa =
    !row.seoDescriptionUa || hasBrabusHtmlEntities(row.seoDescriptionUa) || hasBrabusDescriptionArtifacts(row.seoDescriptionUa) || hasBrabusGermanResidualInDescription(row.seoDescriptionUa)
      ? desiredSeoDescriptionUa || row.seoDescriptionUa
      : row.seoDescriptionUa;
  const seoDescriptionEn =
    !row.seoDescriptionEn || hasBrabusHtmlEntities(row.seoDescriptionEn) || hasBrabusDescriptionArtifacts(row.seoDescriptionEn) || hasBrabusGermanResidualInDescription(row.seoDescriptionEn)
      ? desiredSeoDescriptionEn || row.seoDescriptionEn
      : row.seoDescriptionEn;

  return {
    slug: row.slug,
    titleUa,
    titleEn,
    shortDescUa: shortDescUa || null,
    shortDescEn: shortDescEn || null,
    bodyHtmlUa: bodyHtmlUa || null,
    bodyHtmlEn: bodyHtmlEn || null,
    longDescUa: longDescUa || null,
    longDescEn: longDescEn || null,
    seoTitleUa: titleUa !== row.titleUa ? titleUa : row.seoTitleUa,
    seoTitleEn: titleEn !== row.titleEn ? titleEn : row.seoTitleEn,
    seoDescriptionUa: seoDescriptionUa || null,
    seoDescriptionEn: seoDescriptionEn || null,
    image: row.image ?? null,
    gallery: extractGallery(row.gallery),
  };
}

function scoreTitleCandidate(locale: 'ua' | 'en', value: string | null | undefined) {
  const cleaned = cleanBrabusTitle(locale, value);
  if (!cleaned) return { cleaned: '', score: Number.NEGATIVE_INFINITY };
  let score = cleaned.length;
  if (hasBrabusHtmlEntities(value)) score -= 20;
  if (hasBrabusGermanResidualInTitle(cleaned)) score -= 50;
  return { cleaned, score };
}

function scorePlainCandidate(locale: 'ua' | 'en', value: string | null | undefined) {
  const cleaned = cleanBrabusPlainText(locale, value);
  if (!cleaned) return { cleaned: '', score: Number.NEGATIVE_INFINITY };
  let score = cleaned.length;
  if (hasBrabusHtmlEntities(value)) score -= 20;
  if (hasBrabusDescriptionArtifacts(value)) score -= 100;
  if (hasBrabusGermanResidualInDescription(cleaned)) score -= 40;
  return { cleaned, score };
}

function scoreHtmlCandidate(locale: 'ua' | 'en', value: string | null | undefined) {
  const cleaned = cleanBrabusHtmlDescription(locale, value);
  const plain = stripHtmlTags(cleaned);
  if (!plain) return { cleaned: '', score: Number.NEGATIVE_INFINITY };
  let score = plain.length;
  if (cleaned.includes('<p>')) score += 15;
  if (hasBrabusHtmlEntities(value)) score -= 20;
  if (hasBrabusDescriptionArtifacts(value)) score -= 100;
  if (hasBrabusGermanResidualInDescription(plain)) score -= 40;
  return { cleaned, score };
}

function pickBestTitle(locale: 'ua' | 'en', values: Array<string | null | undefined>, fallback: string) {
  let best = { cleaned: fallback, score: Number.NEGATIVE_INFINITY };
  for (const value of values) {
    const candidate = scoreTitleCandidate(locale, value);
    if (candidate.score > best.score) best = candidate;
  }
  return best.cleaned || fallback;
}

function pickBestPlain(locale: 'ua' | 'en', values: Array<string | null | undefined>) {
  let best = { cleaned: '', score: Number.NEGATIVE_INFINITY };
  for (const value of values) {
    const candidate = scorePlainCandidate(locale, value);
    if (candidate.score > best.score) best = candidate;
  }
  return best.cleaned || null;
}

function pickBestHtml(locale: 'ua' | 'en', values: Array<string | null | undefined>) {
  let best = { cleaned: '', score: Number.NEGATIVE_INFINITY };
  for (const value of values) {
    const candidate = scoreHtmlCandidate(locale, value);
    if (candidate.score > best.score) best = candidate;
  }
  return best.cleaned || null;
}

function scoreImage(url: string | null | undefined) {
  const normalized = String(url ?? '').trim();
  if (!normalized) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (normalized.startsWith('http')) score += 100;
  else if (normalized.startsWith('/brabus-images/')) score += 40;
  else if (normalized.startsWith('/')) score += 20;
  if (!/420x|540x/i.test(normalized)) score += 15;
  return score;
}

function pickPrimaryImage(group: BrabusRow[]) {
  let best = { url: '', score: Number.NEGATIVE_INFINITY };
  for (const product of group) {
    const score = scoreImage(product.image);
    if (score > best.score) {
      best = { url: String(product.image ?? '').trim(), score };
    }
  }
  return best.url || String(group[0]?.image ?? '').trim() || null;
}

function buildMergedGallery(primaryImage: string | null, group: BrabusRow[]) {
  const fromProducts = group.flatMap((product) => extractGallery(product.gallery));
  const gallery = dedupeStrings([primaryImage, ...fromProducts]).slice(0, 8);
  return gallery.length > 1 ? gallery : null;
}

function diffProduct(row: BrabusRow, next: ReturnType<typeof normalizeProduct> & {
  image?: string | null;
  gallery?: string[] | null;
}) {
  const data: Prisma.ShopProductUpdateInput = {};

  const assign = <K extends keyof typeof next>(key: K, current: unknown, desired: (typeof next)[K]) => {
    const currentValue = current == null ? null : current;
    const desiredValue = desired == null || desired === '' ? null : desired;
    if (JSON.stringify(currentValue) !== JSON.stringify(desiredValue)) {
      (data as Record<string, unknown>)[key] = desiredValue;
    }
  };

  assign('slug', row.slug, next.slug);
  assign('titleUa', row.titleUa, next.titleUa);
  assign('titleEn', row.titleEn, next.titleEn);
  assign('shortDescUa', row.shortDescUa, next.shortDescUa);
  assign('shortDescEn', row.shortDescEn, next.shortDescEn);
  assign('bodyHtmlUa', row.bodyHtmlUa, next.bodyHtmlUa);
  assign('bodyHtmlEn', row.bodyHtmlEn, next.bodyHtmlEn);
  assign('longDescUa', row.longDescUa, next.longDescUa);
  assign('longDescEn', row.longDescEn, next.longDescEn);
  assign('seoTitleUa', row.seoTitleUa, next.seoTitleUa);
  assign('seoTitleEn', row.seoTitleEn, next.seoTitleEn);
  assign('seoDescriptionUa', row.seoDescriptionUa, next.seoDescriptionUa);
  assign('seoDescriptionEn', row.seoDescriptionEn, next.seoDescriptionEn);
  assign('image', row.image, next.image ?? null);
  assign('gallery', extractGallery(row.gallery), next.gallery ?? null);

  return data;
}

function buildMergedCanonical(group: BrabusRow[], canonical: BrabusRow) {
  const canonicalSlug = buildBrabusProductSlug(canonical.sku);
  const mergedTitleUa = pickBestTitle('ua', group.map((product) => product.titleUa), canonical.titleUa);
  const mergedTitleEn = pickBestTitle('en', group.map((product) => product.titleEn), canonical.titleEn);
  const mergedShortUa = pickBestPlain('ua', group.map((product) => product.shortDescUa));
  const mergedShortEn = pickBestPlain('en', group.map((product) => product.shortDescEn));
  const mergedLongUa = pickBestHtml('ua', group.flatMap((product) => [product.longDescUa, product.bodyHtmlUa]));
  const mergedLongEn = pickBestHtml('en', group.flatMap((product) => [product.longDescEn, product.bodyHtmlEn]));
  const mergedImage = pickPrimaryImage(group);
  const mergedGallery = buildMergedGallery(mergedImage, group);

  return {
    slug: canonicalSlug,
    titleUa: mergedTitleUa,
    titleEn: mergedTitleEn,
    shortDescUa: mergedShortUa,
    shortDescEn: mergedShortEn,
    bodyHtmlUa: mergedLongUa,
    bodyHtmlEn: mergedLongEn,
    longDescUa: mergedLongUa,
    longDescEn: mergedLongEn,
    seoTitleUa: mergedTitleUa,
    seoTitleEn: mergedTitleEn,
    seoDescriptionUa: buildBrabusSeoDescription('ua', {
      longHtml: mergedLongUa,
      shortText: mergedShortUa,
      title: mergedTitleUa,
    }) || null,
    seoDescriptionEn: buildBrabusSeoDescription('en', {
      longHtml: mergedLongEn,
      shortText: mergedShortEn,
      title: mergedTitleEn,
    }) || null,
    image: mergedImage,
    gallery: mergedGallery,
  };
}

function auditProducts(products: Array<{
  sku?: string | null;
  slug: string;
  titleUa: string;
  titleEn: string;
  shortDescUa?: string | null;
  shortDescEn?: string | null;
  longDescUa?: string | null;
  longDescEn?: string | null;
  bodyHtmlUa?: string | null;
  bodyHtmlEn?: string | null;
  seoDescriptionUa?: string | null;
  seoDescriptionEn?: string | null;
  priceEur?: number | string | null;
  priceUsd?: number | string | null;
  priceUah?: number | string | null;
}>) {
  const bySku = new Map<string, typeof products>();
  for (const product of products) {
    const key = normalizeSkuKey(product.sku);
    if (!key) continue;
    const list = bySku.get(key) ?? [];
    list.push(product);
    bySku.set(key, list);
  }

  return {
    total: products.length,
    duplicateSkuGroups: [...bySku.values()].filter((list) => list.length > 1).length,
    titleEntityCount: products.filter((product) => hasBrabusHtmlEntities(product.titleUa) || hasBrabusHtmlEntities(product.titleEn)).length,
    titleGermanCount: products.filter((product) => hasBrabusGermanResidualInTitle(product.titleUa) || hasBrabusGermanResidualInTitle(product.titleEn)).length,
    descArtifactsCount: products.filter((product) =>
      [product.shortDescUa, product.shortDescEn, product.longDescUa, product.longDescEn, product.bodyHtmlUa, product.bodyHtmlEn, product.seoDescriptionUa, product.seoDescriptionEn]
        .some((value) => hasBrabusDescriptionArtifacts(value))
    ).length,
    descGermanCount: products.filter((product) =>
      [product.shortDescUa, product.shortDescEn, product.longDescUa, product.longDescEn, product.bodyHtmlUa, product.bodyHtmlEn]
        .some((value) => hasBrabusGermanResidualInDescription(stripHtmlTags(value)))
    ).length,
    overviewishCount: products.filter((product) =>
      isLikelyBrabusOverviewProductLike({
        sku: product.sku,
        titleEn: product.titleEn,
        priceEur: product.priceEur,
        priceUsd: product.priceUsd,
        priceUah: product.priceUah,
      })
    ).length,
  };
}

function logJson(label: string, value: unknown) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      OR: [{ brand: 'Brabus' }, { vendor: 'Brabus' }],
      isPublished: true,
    },
    include: {
      variants: {
        select: {
          id: true,
          sku: true,
          image: true,
          isDefault: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const baseUpdates = new Map<string, PlannedUpdate>();
  const normalizedById = new Map<string, ReturnType<typeof normalizeProduct> & {
    id: string;
    sku: string | null;
    priceEur: Prisma.Decimal | null;
    priceUsd: Prisma.Decimal | null;
    priceUah: Prisma.Decimal | null;
  }>();

  for (const row of rows) {
    const normalized = normalizeProduct(row);
    normalizedById.set(row.id, {
      id: row.id,
      sku: row.sku,
      priceEur: row.priceEur,
      priceUsd: row.priceUsd,
      priceUah: row.priceUah,
      ...normalized,
    });

    const diff = diffProduct(row, normalized);
    if (Object.keys(diff).length > 0) {
      baseUpdates.set(row.id, { id: row.id, slug: row.slug, data: diff });
    }
  }

  const groups = new Map<string, BrabusRow[]>();
  for (const row of rows) {
    const sku = normalizeSkuKey(row.sku);
    if (!sku) continue;
    const list = groups.get(sku) ?? [];
    list.push(row);
    groups.set(sku, list);
  }

  const duplicatePlans: DuplicatePlan[] = [];
  const donorIds = new Set<string>();
  const donorIdToCanonical = new Map<string, string>();
  const canonicalOverrides = new Map<string, ReturnType<typeof buildMergedCanonical>>();

  for (const [sku, group] of groups.entries()) {
    if (group.length < 2) continue;
    const canonicalSlug = buildBrabusProductSlug(sku);
    const canonical =
      group.find((product) => product.slug === canonicalSlug) ??
      [...group].sort((a, b) => {
        const scoreA = scoreBrabusProductCandidateLike({
          sku: a.sku,
          slug: a.slug,
          titleEn: a.titleEn,
          titleUa: a.titleUa,
          image: a.image,
          gallery: extractGallery(a.gallery),
          priceEur: a.priceEur?.toNumber?.() ?? a.priceEur,
          priceUsd: a.priceUsd?.toNumber?.() ?? a.priceUsd,
          priceUah: a.priceUah?.toNumber?.() ?? a.priceUah,
        });
        const scoreB = scoreBrabusProductCandidateLike({
          sku: b.sku,
          slug: b.slug,
          titleEn: b.titleEn,
          titleUa: b.titleUa,
          image: b.image,
          gallery: extractGallery(b.gallery),
          priceEur: b.priceEur?.toNumber?.() ?? b.priceEur,
          priceUsd: b.priceUsd?.toNumber?.() ?? b.priceUsd,
          priceUah: b.priceUah?.toNumber?.() ?? b.priceUah,
        });
        return scoreB - scoreA;
      })[0];

    const donors = group.filter((product) => product.id !== canonical.id);
    const mergedCanonical = buildMergedCanonical(group, canonical);
    canonicalOverrides.set(canonical.id, mergedCanonical);

    const diff = diffProduct(canonical, mergedCanonical);
    if (Object.keys(diff).length > 0) {
      baseUpdates.set(canonical.id, { id: canonical.id, slug: canonical.slug, data: diff });
    }

    const canonicalDefaultVariantId =
      canonical.variants.find((variant) => variant.isDefault)?.id ??
      canonical.variants[0]?.id ??
      null;

    duplicatePlans.push({
      sku,
      canonicalId: canonical.id,
      canonicalSlug: mergedCanonical.slug,
      donorIds: donors.map((product) => product.id),
      donorSlugs: donors.map((product) => product.slug),
      donorVariantIds: donors.flatMap((product) => product.variants.map((variant) => variant.id)),
      canonicalDefaultVariantId,
    });

    for (const donor of donors) {
      donorIds.add(donor.id);
      donorIdToCanonical.set(donor.id, canonical.id);
    }
  }

  const overviewPlans: OverviewPlan[] = rows
    .filter((row) => !donorIds.has(row.id))
    .filter((row) =>
      isLikelyBrabusOverviewProductLike({
        sku: row.sku,
        titleEn: row.titleEn,
        priceEur: row.priceEur?.toNumber?.() ?? row.priceEur,
        priceUsd: row.priceUsd?.toNumber?.() ?? row.priceUsd,
        priceUah: row.priceUah?.toNumber?.() ?? row.priceUah,
      })
    )
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      variantIds: row.variants.map((variant) => variant.id),
    }));
  const overviewDeleteIds = new Set(overviewPlans.map((plan) => plan.id));

  const beforeAudit = auditProducts(rows.map((row) => ({
    sku: row.sku,
    slug: row.slug,
    titleUa: row.titleUa,
    titleEn: row.titleEn,
    shortDescUa: row.shortDescUa,
    shortDescEn: row.shortDescEn,
    longDescUa: row.longDescUa,
    longDescEn: row.longDescEn,
    bodyHtmlUa: row.bodyHtmlUa,
    bodyHtmlEn: row.bodyHtmlEn,
    seoDescriptionUa: row.seoDescriptionUa,
    seoDescriptionEn: row.seoDescriptionEn,
    priceEur: row.priceEur?.toNumber?.() ?? row.priceEur,
    priceUsd: row.priceUsd?.toNumber?.() ?? row.priceUsd,
    priceUah: row.priceUah?.toNumber?.() ?? row.priceUah,
  })));

  const afterRows = rows
    .filter((row) => !donorIds.has(row.id))
    .filter((row) => !deleteOverview || !overviewDeleteIds.has(row.id))
    .map((row) => {
      const override = canonicalOverrides.get(row.id);
      const normalized = normalizedById.get(row.id);
      return {
        sku: row.sku,
        slug: override ? override.slug : normalized ? normalized.slug : row.slug,
        titleUa: override ? override.titleUa : normalized ? normalized.titleUa : row.titleUa,
        titleEn: override ? override.titleEn : normalized ? normalized.titleEn : row.titleEn,
        shortDescUa: override ? override.shortDescUa : normalized ? normalized.shortDescUa : row.shortDescUa,
        shortDescEn: override ? override.shortDescEn : normalized ? normalized.shortDescEn : row.shortDescEn,
        longDescUa: override ? override.longDescUa : normalized ? normalized.longDescUa : row.longDescUa,
        longDescEn: override ? override.longDescEn : normalized ? normalized.longDescEn : row.longDescEn,
        bodyHtmlUa: override ? override.bodyHtmlUa : normalized ? normalized.bodyHtmlUa : row.bodyHtmlUa,
        bodyHtmlEn: override ? override.bodyHtmlEn : normalized ? normalized.bodyHtmlEn : row.bodyHtmlEn,
        seoDescriptionUa: override ? override.seoDescriptionUa : normalized ? normalized.seoDescriptionUa : row.seoDescriptionUa,
        seoDescriptionEn: override ? override.seoDescriptionEn : normalized ? normalized.seoDescriptionEn : row.seoDescriptionEn,
        priceEur: row.priceEur?.toNumber?.() ?? row.priceEur,
        priceUsd: row.priceUsd?.toNumber?.() ?? row.priceUsd,
        priceUah: row.priceUah?.toNumber?.() ?? row.priceUah,
      };
    });
  const afterAudit = auditProducts(afterRows);
  const remainingArtifactSamples = afterRows
    .filter((product) =>
      [product.shortDescUa, product.shortDescEn, product.longDescUa, product.longDescEn, product.bodyHtmlUa, product.bodyHtmlEn, product.seoDescriptionUa, product.seoDescriptionEn]
        .some((value) => hasBrabusDescriptionArtifacts(value))
    )
    .slice(0, 12)
    .map((product) => ({ sku: product.sku, slug: product.slug }));
  const remainingGermanSamples = afterRows
    .filter((product) =>
      [product.shortDescUa, product.shortDescEn, product.longDescUa, product.longDescEn, product.bodyHtmlUa, product.bodyHtmlEn]
        .some((value) => hasBrabusGermanResidualInDescription(stripHtmlTags(value)))
    )
    .slice(0, 12)
    .map((product) => ({ sku: product.sku, slug: product.slug }));
  const remainingOverviewSamples = afterRows
    .filter((product) =>
      isLikelyBrabusOverviewProductLike({
        sku: product.sku,
        titleEn: product.titleEn,
        priceEur: product.priceEur,
        priceUsd: product.priceUsd,
        priceUah: product.priceUah,
      })
    )
    .slice(0, 12)
    .map((product) => ({ sku: product.sku, slug: product.slug, titleEn: product.titleEn }));
  const updateFieldFrequency: Record<string, number> = {};
  for (const update of baseUpdates.values()) {
    for (const key of Object.keys(update.data)) {
      updateFieldFrequency[key] = (updateFieldFrequency[key] ?? 0) + 1;
    }
  }

  console.log('Brabus cleanup mode:', applyChanges ? 'APPLY' : 'DRY RUN');
  console.log('Delete overview pages:', deleteOverview ? 'YES' : 'NO');
  logJson('Before audit', beforeAudit);
  logJson('After audit (simulated)', afterAudit);
  logJson('Planned product updates', {
    updateCount: baseUpdates.size,
    updateFieldFrequency,
    duplicateGroups: duplicatePlans.length,
    duplicateRowsToDelete: [...donorIds].length,
    overviewRowsToDelete: deleteOverview ? overviewPlans.length : 0,
    remainingArtifactSamples,
    remainingGermanSamples,
    remainingOverviewSamples,
    sampleDuplicatePlans: duplicatePlans.slice(0, 20),
  });

  if (!applyChanges) {
    await prisma.$disconnect();
    return;
  }

  for (const update of baseUpdates.values()) {
    await prisma.shopProduct.update({
      where: { id: update.id },
      data: update.data,
    });
  }

  for (const plan of duplicatePlans) {
    if (plan.donorIds.length === 0) continue;

    await prisma.shopCartItem.updateMany({
      where: {
        OR: [
          { productId: { in: plan.donorIds } },
          { variantId: { in: plan.donorVariantIds } },
        ],
      },
      data: {
        productId: plan.canonicalId,
        productSlug: plan.canonicalSlug,
        ...(plan.canonicalDefaultVariantId ? { variantId: plan.canonicalDefaultVariantId } : {}),
      },
    });

    await prisma.shopOrderItem.updateMany({
      where: {
        OR: [
          { productId: { in: plan.donorIds } },
          { variantId: { in: plan.donorVariantIds } },
        ],
      },
      data: {
        productId: plan.canonicalId,
        productSlug: plan.canonicalSlug,
        ...(plan.canonicalDefaultVariantId ? { variantId: plan.canonicalDefaultVariantId } : {}),
      },
    });

    await prisma.shopBundleItem.updateMany({
      where: {
        OR: [
          { componentProductId: { in: plan.donorIds } },
          { componentVariantId: { in: plan.donorVariantIds } },
        ],
      },
      data: {
        componentProductId: plan.canonicalId,
        ...(plan.canonicalDefaultVariantId ? { componentVariantId: plan.canonicalDefaultVariantId } : {}),
      },
    });
  }

  if (donorIds.size > 0) {
    await prisma.shopProduct.deleteMany({
      where: { id: { in: [...donorIds] } },
    });
  }

  if (deleteOverview && overviewPlans.length > 0) {
    const overviewVariantIds = overviewPlans.flatMap((plan) => plan.variantIds);

    const bundleRefs = await prisma.shopBundleItem.count({
      where: {
        OR: [
          { componentProductId: { in: overviewPlans.map((plan) => plan.id) } },
          { componentVariantId: { in: overviewVariantIds } },
        ],
      },
    });

    if (bundleRefs > 0) {
      throw new Error(`Refusing to delete overview products because ${bundleRefs} bundle references still exist.`);
    }

    await prisma.shopCartItem.updateMany({
      where: {
        OR: [
          { productId: { in: overviewPlans.map((plan) => plan.id) } },
          { variantId: { in: overviewVariantIds } },
        ],
      },
      data: {
        productId: null,
        variantId: null,
      },
    });

    await prisma.shopOrderItem.updateMany({
      where: {
        OR: [
          { productId: { in: overviewPlans.map((plan) => plan.id) } },
          { variantId: { in: overviewVariantIds } },
        ],
      },
      data: {
        productId: null,
        variantId: null,
      },
    });

    await prisma.shopProduct.deleteMany({
      where: { id: { in: overviewPlans.map((plan) => plan.id) } },
    });
  }

  console.log('\nCleanup applied successfully.');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
