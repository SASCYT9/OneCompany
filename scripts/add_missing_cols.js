const { PrismaClient } = require('@prisma/client');

async function fix() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  
  try {
    const res = await prisma.$executeRawUnsafe(`
      ALTER TABLE "ShopProduct"
      ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "length" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "width" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "height" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "supplier" TEXT,
      ADD COLUMN IF NOT EXISTS "originCountry" TEXT,
      ADD COLUMN IF NOT EXISTS "airtableRecordId" TEXT,
      ADD COLUMN IF NOT EXISTS "airtableSyncedAt" TIMESTAMP(3);
    `);
    console.log('Altered columns!', res);
  } catch (e) {
    console.log('Error altering', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
fix();
