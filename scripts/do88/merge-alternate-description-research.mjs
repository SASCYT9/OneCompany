#!/usr/bin/env node

import fs from 'node:fs';

const [researchPath, candidatePath] = process.argv.slice(2);
if (!researchPath || !candidatePath) {
  console.error('Usage: node merge-alternate-description-research.mjs <research.json> <candidate.json>');
  process.exit(2);
}

const research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
let merged = 0;
for (const evidence of research.products) {
  const product = candidate.currentProducts.find((item) => item.sku === evidence.sku);
  if (!product) throw new Error(`Candidate SKU not found: ${evidence.sku}`);
  if (product.curatedDescriptionUa || product.curatedDescriptionEn) {
    throw new Error(`Refusing to overwrite an existing curated description: ${evidence.sku}`);
  }
  product.curatedDescriptionUa = evidence.descriptionUa;
  product.curatedDescriptionEn = evidence.descriptionEn;
  product.alternateDescriptionEvidence = {
    method: 'reviewed_exact_sku_external_corroboration',
    verifiedFacts: evidence.verifiedFacts,
    sources: evidence.sources,
    sourceConflict: evidence.sourceConflict ?? null,
    unsupportedClaimsExcluded: evidence.unsupportedClaimsExcluded,
    reviewedAt: research.generatedAt,
  };
  const reasons = new Set(String(product.contentReviewReasons ?? '').split(';').filter(Boolean));
  reasons.add('ALTERNATE_SOURCE_COPY_AVAILABLE_REVIEW_BEFORE_USE');
  product.contentReviewReasons = [...reasons].join(';');
  merged += 1;
}

candidate.descriptionAudit = {
  ...candidate.descriptionAudit,
  alternateSourceBilingualDrafts: merged,
  alternateSourceResearchArtifact: 'do88-alternate-description-research-2026-09-28.json',
  currentLongDescriptionsEditedByAlternateSourceMerge: 0,
  note: 'Alternate-source bilingual drafts and source evidence are for review only; current UA/EN storefront copy, manufacturer scope, and Production data are not changed by this merge.',
};
fs.writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  productsMerged: merged,
  productCopyChanged: 0,
  productionWritesPerformed: 0,
  conflictingOfficialSourceCopy: research.products.filter((product) => product.sourceConflict).map((product) => product.sku),
}, null, 2));
