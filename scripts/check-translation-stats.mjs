import { config } from 'dotenv';
import pg from 'pg';
config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });

const { rows } = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' THEN 1 END) as has_en,
    COUNT(CASE WHEN "bodyHtmlUa" IS NOT NULL AND "bodyHtmlUa" != '' THEN 1 END) as has_ua,
    COUNT(CASE WHEN "bodyHtmlEn" IS NOT NULL AND "bodyHtmlEn" != '' AND ("bodyHtmlUa" IS NULL OR "bodyHtmlUa" = '') THEN 1 END) as needs_translation
  FROM "ShopProduct" WHERE status='ACTIVE'
`);
console.log('📊 Translation Stats:', JSON.stringify(rows[0], null, 2));
await pool.end();
