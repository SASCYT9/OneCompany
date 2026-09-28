#!/usr/bin/env node

import fs from 'node:fs';

const [resultsPath, candidatePath] = process.argv.slice(2);
if (!resultsPath || !candidatePath) {
  console.error('Usage: node merge-eu-product-content-review.mjs <results.json> <candidate.json>');
  process.exit(2);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const sourceBySku = new Map(results.products.map((item) => [item.requestedSku, item]));
let merged = 0;
let descriptionsMissing = 0;
let exactSku = 0;
let parentPageReview = 0;

for (const product of candidate.currentProducts) {
  const source = sourceBySku.get(product.sku);
  if (!source) continue;
  product.sourceDetailPageSku = source.pageSku || null;
  product.sourceDescriptionTitleEn = source.titleEn || null;
  product.sourceDescriptionUrl = source.sourceUrl;
  product.sourceDescriptionRetrievedAt = results.retrievedAt;
  product.sourceDescriptionSkuMatch = Boolean(source.skuMatch);
  product.sourceDescriptionBrandField = String(source.brand || '').trim() || null;
  const reasons = new Set(String(product.contentReviewReasons ?? '').split(';').filter(Boolean));
  if (source.skuMatch) reasons.delete('NO_UNIQUE_SOURCE_DETAIL');
  else reasons.add('SOURCE_PAGE_VARIANT_PARENT_REVIEW');
  if (source.descriptionEn?.trim()) {
    product.sourceDescriptionEn = source.descriptionEn.trim();
    reasons.delete('SOURCE_COPY_MISSING');
    merged += 1;
  } else {
    reasons.add('SOURCE_PAGE_HAS_NO_EXTRACTED_DESCRIPTION');
    descriptionsMissing += 1;
  }
  product.contentReviewReasons = [...reasons].join(';');
  if (source.skuMatch) exactSku += 1;
  else parentPageReview += 1;
}

candidate.descriptionAudit = {
  ...candidate.descriptionAudit,
  freshOfficialDetailPagesRequested: results.requested,
  freshOfficialDescriptionsFound: results.descriptionsFound,
  freshOfficialSkuEvidenceMatches: results.skuEvidenceMatches,
  freshOfficialDetailPageVariantParentReviews: parentPageReview,
  freshOfficialPagesWithoutDescription: descriptionsMissing,
  freshOfficialDescriptionsMerged: merged,
  freshOfficialSourceRetrievedAt: results.retrievedAt,
  currentLongDescriptionsEditedByMerge: 0,
  note: 'Fresh official source copy and provenance are added for review only. Storefront UA/EN copy and manufacturer scope are not approved or changed by this merge.',
};
fs.writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  sourceMode: results.sourceMode,
  retrievedAt: results.retrievedAt,
  requested: results.requested,
  freshOfficialDescriptionsFound: results.descriptionsFound,
  descriptionsMergedToCandidatePackage: merged,
  exactSkuRows: exactSku,
  parentPageVariantRowsForReview: parentPageReview,
  pagesWithoutDescription: descriptionsMissing,
  currentUaEnDescriptionsChanged: 0,
  manufacturerScopeChanged: 0,
}, null, 2));
