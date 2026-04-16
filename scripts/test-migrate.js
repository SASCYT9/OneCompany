const { PrismaClient, Prisma } = require('@prisma/client');

const OLD_URL = "postgresql://postgres.zllvamstmtpjdbwtsfod:uhRYWhd0V80KEqgs@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";
const NEW_URL = "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_UYiagQHVUi02RCiZ1LQjW@db.prisma.io:5432/postgres?sslmode=require";

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } } });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_URL } } });

function buildSelect(modelName) {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName);
  if (!model) return null;
  const select = {};
  for (const field of model.fields) {
    if (field.kind === 'scalar' || field.kind === 'enum') {
      select[field.name] = true;
    }
  }
  return select;
}

async function main() {
  await oldDb.$connect();
  await newDb.$connect();

  // Test 1: Show what fields DMMF gives us for ShopProduct
  const select = buildSelect('ShopProduct');
  console.log('ShopProduct select fields:', Object.keys(select));

  // Test 2: Read ONE product from old DB with select
  const [product] = await oldDb.shopProduct.findMany({ select, take: 1 });
  console.log('\nSample product keys:', Object.keys(product));
  console.log('Sample product:', JSON.stringify(product, null, 2).substring(0, 800));

  // Test 3: Try to insert it
  try {
    await newDb.shopProduct.create({ data: product });
    console.log('\n✅ Insert SUCCESS!');
  } catch (e) {
    console.log('\n❌ Insert FAILED:');
    console.log(e.message);
  }

  // Test AdminUser too
  console.log('\n--- AdminUser ---');
  const adminSelect = buildSelect('AdminUser');
  console.log('AdminUser select fields:', Object.keys(adminSelect));
  const [admin] = await oldDb.adminUser.findMany({ select: adminSelect, take: 1 });
  if (admin) {
    console.log('Admin keys:', Object.keys(admin));
    try {
      await newDb.adminUser.create({ data: admin });
      console.log('✅ Admin insert SUCCESS!');
    } catch (e) {
      console.log('❌ Admin insert FAILED:', e.message);
    }
  }

  await oldDb.$disconnect();
  await newDb.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
