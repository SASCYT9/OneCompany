/**
 * Data Migration v3: Supabase → Prisma Postgres
 * Uses Prisma `select` on the OLD DB to only read schema-safe fields.
 * Skips relation fields and only reads scalar/enum fields from the Prisma schema.
 */
const { PrismaClient, Prisma } = require('@prisma/client');

const OLD_URL = "postgresql://postgres.zllvamstmtpjdbwtsfod:uhRYWhd0V80KEqgs@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";
const NEW_URL = "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_UYiagQHVUi02RCiZ1LQjW@db.prisma.io:5432/postgres?sslmode=require";

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } } });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_URL } } });

// Build a select object that only picks scalar fields from the Prisma DMMF
function buildSelect(modelName) {
  const dmmf = Prisma.dmmf;
  const model = dmmf.datamodel.models.find(m => m.name === modelName);
  if (!model) return null;
  const select = {};
  for (const field of model.fields) {
    if (field.kind === 'scalar' || field.kind === 'enum') {
      select[field.name] = true;
    }
  }
  return select;
}

// Table migration order: parents before children
const TABLES = [
  'Message', 'MessageReply',
  'TelegramUser', 'TelegramSession', 'TelegramConversation', 'TelegramAdmin',
  'AdminUser', 'AdminRole', 'AdminUserRole', 'AdminAuditLog',
  'ShopSettings', 'ShopCategory', 'ShopCollection',
  'ShopProduct', 'ShopProductVariant', 'ShopProductImage',
  'ShopCustomer',
  'ShopOrder', 'ShopOrderItem', 'ShopOrderEvent',
  'ShopBundle', 'ShopBundleItem',
  'ShopCart', 'ShopCartItem',
  'ShopShipment',
  'ShopImportJob', 'ShopImportRecord',
  'ShopB2BDiscountRule',
  'ShopPaymentMethod',
  'ShopRegionalPricingRule',
];

// Convert PascalCase model name to camelCase accessor
function toCamelCase(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

async function migrateTable(modelName) {
  const accessor = toCamelCase(modelName);
  
  if (!oldDb[accessor] || !newDb[accessor]) {
    console.log(`  ⏭  ${modelName} — not found`);
    return 0;
  }

  const select = buildSelect(modelName);
  if (!select) {
    console.log(`  ⏭  ${modelName} — no DMMF model`);
    return 0;
  }

  let data;
  try {
    data = await oldDb[accessor].findMany({ select });
  } catch (e) {
    console.log(`  ⏭  ${modelName} — read error: ${e.message?.substring(0, 80)}`);
    return 0;
  }

  if (data.length === 0) {
    console.log(`  ⬜ ${modelName} — empty`);
    return 0;
  }

  console.log(`  📦 ${modelName} — ${data.length} rows...`);

  // Use createMany for speed (skip duplicates)
  try {
    const result = await newDb[accessor].createMany({
      data: data,
      skipDuplicates: true,
    });
    console.log(`  ✅ ${modelName} — ${result.count}/${data.length} inserted`);
    return result.count;
  } catch (e) {
    // Fallback to one-by-one for tables with complex types
    console.log(`  ⚡ ${modelName} — createMany failed, going one-by-one...`);
    let ok = 0, err = 0;
    for (const row of data) {
      try {
        await newDb[accessor].create({ data: row });
        ok++;
      } catch (e2) {
        err++;
        if (err <= 2) console.log(`    ❌ ${e2.message?.substring(0, 100)}`);
      }
    }
    console.log(`  ✅ ${modelName} — ${ok}/${data.length} (${err} errors)`);
    return ok;
  }
}

async function main() {
  console.log('🚀 Data Migration v3: Supabase → Prisma Postgres');
  console.log('='.repeat(55));

  await oldDb.$connect();
  console.log('✅ Supabase connected');
  await newDb.$connect();
  console.log('✅ Prisma Postgres connected\n');

  let total = 0;
  const report = [];

  for (const table of TABLES) {
    const count = await migrateTable(table);
    total += count;
    report.push({ table, count });
  }

  console.log('\n' + '='.repeat(55));
  console.log('📊 FINAL REPORT:');
  for (const r of report) {
    if (r.count > 0) console.log(`  ✅ ${r.table.padEnd(28)} ${r.count} rows`);
  }
  console.log(`\n🎉 TOTAL: ${total} rows in new database`);

  await oldDb.$disconnect();
  await newDb.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
