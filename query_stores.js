const { PrismaClient } = require("@prisma/client");

// Set DATABASE_URL directly to the DIRECT_URL from .env.production.local
process.env.DATABASE_URL =
  "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_FROHfqbr5iWnVhQO3xsp4@db.prisma.io:5432/postgres?sslmode=require";

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.shopifyStore.findMany();
  console.log("=== Shopify Stores from production.local ===");
  console.log(JSON.stringify(stores, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
