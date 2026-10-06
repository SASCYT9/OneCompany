// Read-only production audit. Never writes catalog rows or changes rates.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('dotenv');
const { Client } = require('pg');
const arg = (key) => process.argv.find(x => x.startsWith(`--${key}=`))?.slice(key.length + 3);
const envPath = arg('env-path');
if (!envPath) throw new Error('An explicit read-only env-path is required');
const output = path.resolve(arg('out') || 'outputs/price-source-completion-2026-10-05');
const env = parse(fs.readFileSync(envPath));
const db = new Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL, connectionTimeoutMillis: 15000 });
const fields = ['priceEur','priceUsd','priceUah','compareAtEur','compareAtUsd','compareAtUah','priceEurB2b','priceUsdB2b','priceUahB2b','compareAtEurB2b','compareAtUsdB2b','compareAtUahB2b','priceEurEurope'];
const sourceFields = ['priceSourceCurrency','compareAtSourceCurrency','b2bPriceSourceCurrency','b2bCompareAtSourceCurrency'];
const predicate = process.argv.includes('--include-hidden') ? "p.status='ACTIVE'" : "p.\"isPublished\"=true AND p.status='ACTIVE'";
const priceLeaves = (raw, prefix='', found=[]) => {
  if (!raw || typeof raw !== 'object') return found;
  for (const [key,value] of Object.entries(raw)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (/price|currency|compare.?at/i.test(key)) found.push({ path: next, value });
    else if (value && typeof value === 'object') priceLeaves(value,next,found);
  }
  return found;
};
(async () => {
  await db.connect();
  await db.query('BEGIN READ ONLY');
  await db.query("SET LOCAL statement_timeout = '90s'");
  const columns = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ShopProduct'`);
  const hasSources = sourceFields.every(f=>columns.rows.some(c=>c.column_name===f));
  const cols = [...fields,...(hasSources?sourceFields:[])].map(f=>`p."${f}"`).join(',');
  const variantCols = [...fields,...(hasSources?sourceFields:[])].map(f=>`'${f}',v."${f}"`).join(',');
  const products = await db.query(`SELECT p.id,p.sku,p.slug,p.scope,p.brand,p.vendor,p."isPublished",p.status,p."catalogVersion"::text,p."updatedAt",${cols},
    COALESCE((SELECT jsonb_agg(jsonb_build_object('namespace',m.namespace,'key',m.key,'value',m.value)) FROM "ShopProductMetafield" m WHERE m."productId"=p.id AND (m.key ILIKE '%price%' OR m.key ILIKE '%currency%' OR m.key ILIKE '%source%' OR m.key ILIKE '%formula%')), '[]'::jsonb) metafields,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'isDefault',v."isDefault",'updatedAt',v."updatedAt",${variantCols}) ORDER BY v."isDefault" DESC,v.position,v.id) FROM "ShopProductVariant" v WHERE v."productId"=p.id), '[]'::jsonb) variants
    FROM "ShopProduct" p WHERE ${predicate} ORDER BY p.id`);
  const provenance = await db.query(`SELECT fp."productId",fp."variantId",fp."fieldPath",fp."canonicalField",fp."rawValue",fp."normalizedValue",fp."mappingStatus",s.key "sourceKey",r."sourceUpdatedAt",r."receivedAt" FROM "ShopCatalogFieldProvenance" fp JOIN "ShopCatalogSourceRecord" r ON r.id=fp."sourceRecordId" JOIN "ShopCatalogSource" s ON s.id=r."sourceId" JOIN "ShopProduct" p ON p.id=fp."productId" WHERE ${predicate} AND (fp."fieldPath" ILIKE '%price%' OR fp."canonicalField" ILIKE '%price%' OR fp."fieldPath" ILIKE '%currency%')`);
  const records = await db.query(`SELECT r.id,r."productId",r."variantId",r."recordKey",r."sourceRevision",r."rawPayload",s.key "sourceKey" FROM "ShopCatalogSourceRecord" r JOIN "ShopCatalogSource" s ON s.id=r."sourceId" JOIN "ShopProduct" p ON p.id=r."productId" WHERE ${predicate} AND r."rawPayload" IS NOT NULL`);
  const settings = await db.query(`SELECT "currencyRates" FROM "ShopSettings" WHERE key='shop'`);
  await db.query('COMMIT');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'catalog-before.json'),JSON.stringify({readAt:new Date().toISOString(),hasSourceColumns:hasSources,settings:settings.rows[0],rows:products.rows},null,2));
  fs.writeFileSync(path.join(output,'price-provenance.json'),JSON.stringify(provenance.rows,null,2));
  const prices = records.rows.map(({rawPayload,...record})=>({...record,prices:priceLeaves(rawPayload)}));
  fs.writeFileSync(path.join(output,'source-record-prices.json'),JSON.stringify(prices,null,2));
  console.log(JSON.stringify({mode:'READ_ONLY',products:products.rowCount,variants:products.rows.reduce((n,p)=>n+p.variants.length,0),priceProvenance:provenance.rowCount,sourceRecords:prices.length,sourceColumns:hasSources,sourceKinds:[...new Set(prices.map(r=>r.sourceKey))],output}));
})().catch(error=>{console.error(error.code || error.message);process.exitCode=1}).finally(()=>db.end());
