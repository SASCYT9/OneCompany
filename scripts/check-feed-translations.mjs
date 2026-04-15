import { config } from 'dotenv';
import pg from 'pg';
config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

// Find products where bodyHtmlEn contains Ukrainian text (copied from feed)
const { rows } = await pool.query(`
  SELECT 
    COUNT(*) as total_active,
    COUNT(CASE WHEN "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' 
               AND "bodyHtmlEn" ~ '[іїєґ]' THEN 1 END) as en_has_ukrainian,
    COUNT(CASE WHEN "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' 
               AND "bodyHtmlUa" IS NOT NULL AND "bodyHtmlUa" != ''
               AND "bodyHtmlEn" = "bodyHtmlUa" THEN 1 END) as en_equals_ua,
    COUNT(CASE WHEN "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' 
               AND NOT "bodyHtmlEn" ~ '[іїєґ]' THEN 1 END) as en_is_english,
    COUNT(CASE WHEN ("bodyHtmlEn" IS NULL OR "bodyHtmlEn" = '') 
               AND "bodyHtmlUa" IS NOT NULL AND "bodyHtmlUa" != '' THEN 1 END) as only_ua
  FROM "ShopProduct" WHERE status='ACTIVE'
`);

console.log('📊 Feed Translation Analysis:');
console.log(JSON.stringify(rows[0], null, 2));

// Sample some problematic ones
const { rows: samples } = await pool.query(`
  SELECT brand, "titleEn", LEFT("bodyHtmlEn", 150) as en_sample
  FROM "ShopProduct" 
  WHERE status='ACTIVE' 
    AND "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' 
    AND "bodyHtmlEn" ~ '[іїєґ]'
  ORDER BY brand
  LIMIT 5
`);

console.log('\n📋 Sample EN fields with Ukrainian text:');
for (const s of samples) {
  console.log(`  ${s.brand} — ${s.titleEn}`);
  console.log(`  EN field: ${s.en_sample}...`);
  console.log('');
}

await pool.end();
