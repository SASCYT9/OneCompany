const fs = require("fs");
const path = require("path");

// Manually load DATABASE_URL from .env.local
try {
  const envContent = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      process.env.DATABASE_URL = match[1].trim();
    }
  }
} catch (e) {
  console.error("Could not load .env.local file:", e.message);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: {
      brand: "Brabus",
      OR: [{ titleEn: { contains: "Bentley" } }, { titleUa: { contains: "Bentley" } }],
    },
    select: {
      slug: true,
      titleEn: true,
      titleUa: true,
      image: true,
    },
  });
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
