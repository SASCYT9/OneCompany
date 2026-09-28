#!/usr/bin/env node

import fs from 'node:fs';

const [candidatePath, outputCsvPath, olderCopyCsvPath, rewriteCandidatePath] = process.argv.slice(2);
if (!candidatePath || !outputCsvPath) {
  console.error('Usage: node rebuild-product-content-review.mjs <candidate.json> <output.csv> [older-source-review.csv]');
  process.exit(2);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function loadCsvMap(path) {
  if (!path || !fs.existsSync(path)) return new Map();
  const [rawHeaders, ...rows] = parseCsv(fs.readFileSync(path, 'utf8'));
  const headers = rawHeaders.map((header, i) => i === 0 ? header.replace(/^\uFEFF/, '') : header);
  const index = new Map(headers.map((header, i) => [header, i]));
  return new Map(rows.filter((row) => row[index.get('sku')]).map((row) => [row[index.get('sku')], Object.fromEntries(headers.map((header, i) => [header, row[i] ?? '']))]));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function titleSimilarity(a, b) {
  const left = new Set(String(a ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const right = new Set(String(b ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!left.size || !right.size) return '';
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return (overlap / Math.max(left.size, right.size)).toFixed(2);
}

const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const olderCopies = loadCsvMap(olderCopyCsvPath);
const rewriteProducts = rewriteCandidatePath
  ? new Map(JSON.parse(fs.readFileSync(rewriteCandidatePath, 'utf8')).products.map((product) => [product.sku, product]))
  : new Map();
const headers = [
  'sku','slug','title_ua','title_en','manufacturer_scope','source_sku','source_url','source_brand_evidence','source_copy_en_chars','current_copy_ua_chars','current_copy_en_chars','current_option_axes','current_variants','curated_rich_translation','review_reasons','current_description_ua','current_description_en','official_source_description_en','curated_description_ua','curated_description_en','supplier_title_en','source_title_similarity','official_minus_current_en_chars','sku_specific_enrichment_available','description_review_status','unsupported_product_origin_claim','category_template_narrative','older_source_snapshot','older_source_url','older_source_description_en','older_source_key_features_en','older_source_fitment','older_source_oe_refs','alternate_source_evidence'
];

const rows = [headers];
for (const product of candidate.currentProducts) {
  const old = olderCopies.get(product.sku) ?? {};
  const rewrite = rewriteProducts.get(product.sku);
  const currentUa = product.currentLongDescription?.ua ?? '';
  const currentEn = product.currentLongDescription?.en ?? '';
  const sourceCopy = product.sourceDescriptionEn ?? '';
  const reasons = new Set(String(product.contentReviewReasons ?? '').split(';').filter(Boolean));
  if (product.sourceDescriptionSkuMatch === true) reasons.delete('NO_UNIQUE_SOURCE_DETAIL');
  if (product.sourceDescriptionSkuMatch === false) reasons.add('SOURCE_PAGE_VARIANT_PARENT_REVIEW');
  if (product.sourceDescriptionSkuMatch === true && sourceCopy) reasons.delete('SOURCE_COPY_MISSING');
  const status = product.sourceDescriptionSkuMatch === false
    ? 'SOURCE_PAGE_VARIANT_PARENT_REVIEW'
    : product.alternateDescriptionEvidence
      ? 'ALTERNATE_SOURCE_BILINGUAL_DRAFT_REVIEW_REQUIRED'
      : rewrite
      ? 'BILINGUAL_SOURCE_BACKED_DRAFT_REVIEW_REQUIRED'
      : sourceCopy
      ? product.sourceDescriptionSkuMatch === true ? 'FRESH_OFFICIAL_SOURCE_COPY_REVIEW_BEFORE_REWRITE' : 'OFFICIAL_SOURCE_COPY_EXISTING_REVIEW_BEFORE_REWRITE'
      : old.older_source_description_en ? 'OLDER_SOURCE_COPY_AVAILABLE_REFRESH_BEFORE_REWRITE' : 'CURRENT_SOURCE_COPY_MISSING';
  const row = {
    sku: product.sku,
    slug: product.slug,
    title_ua: product.title?.ua ?? '',
    title_en: product.title?.en ?? '',
    manufacturer_scope: product.manufacturerDecision ?? '',
    source_sku: product.sourceDetailPageSku ?? product.supplierSku ?? '',
    source_url: product.sourceDescriptionUrl ?? product.supplierUrl ?? '',
    source_brand_evidence: product.sourceDescriptionBrandField === 'do88' ? 'structured_brand_do88_not_manufacturer_proof' : (product.sourceDescriptionBrandField ?? product.manufacturerEvidence ?? ''),
    source_copy_en_chars: sourceCopy.length,
    current_copy_ua_chars: currentUa.length,
    current_copy_en_chars: currentEn.length,
    current_option_axes: JSON.stringify(product.currentOptions ?? []),
    current_variants: JSON.stringify((product.currentVariants ?? []).map(({ sku, title, optionValues }) => ({ sku, title, optionValues }))),
    curated_rich_translation: Boolean(product.curatedDescriptionUa || product.curatedDescriptionEn || rewrite),
    review_reasons: [...reasons].join(';'),
    current_description_ua: currentUa,
    current_description_en: currentEn,
    official_source_description_en: sourceCopy,
    curated_description_ua: rewrite?.proposedDescription?.ua ?? product.curatedDescriptionUa ?? '',
    curated_description_en: rewrite?.proposedDescription?.en ?? product.curatedDescriptionEn ?? '',
    supplier_title_en: product.sourceDescriptionTitleEn ?? rewrite?.supplierTitleEn ?? '',
    source_title_similarity: titleSimilarity(product.title?.en, product.sourceDescriptionTitleEn ?? rewrite?.supplierTitleEn),
    official_minus_current_en_chars: sourceCopy ? sourceCopy.length - currentEn.length : '',
    sku_specific_enrichment_available: Boolean(product.curatedDescriptionUa || product.curatedDescriptionEn || rewrite),
    description_review_status: status,
    unsupported_product_origin_claim: /(?:origin|походження):\s*(?:sweden|швеція)/i.test(`${currentUa}\n${currentEn}`),
    category_template_narrative: /(?:Модельне рішення зі|Vehicle-specific .* solution for)/i.test(`${currentUa}\n${currentEn}`),
    older_source_snapshot: old.older_source_snapshot ?? '',
    older_source_url: old.older_source_url ?? '',
    older_source_description_en: old.older_source_description_en ?? '',
    older_source_key_features_en: old.older_source_key_features_en ?? '',
    older_source_fitment: old.older_source_fitment ?? '',
    older_source_oe_refs: old.older_source_oe_refs ?? '',
    alternate_source_evidence: JSON.stringify(product.alternateDescriptionEvidence ?? null),
  };
  rows.push(headers.map((header) => row[header] ?? ''));
}

fs.writeFileSync(outputCsvPath, `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({
  rebuiltFromCandidateProducts: candidate.currentProducts.length,
  rowsWrittenExcludingHeader: rows.length - 1,
  olderSourceRowsJoined: olderCopies.size,
  bilingualRewriteDraftsJoined: rewriteProducts.size,
  outputCsvPath,
  sourceDescriptionsPresent: candidate.currentProducts.filter((product) => Boolean(product.sourceDescriptionEn)).length,
}, null, 2));
