const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTranslations() {
  const products = await prisma.shopProduct.findMany({
    where: { 
      bodyHtmlUa: { not: null, not: "" }
    },
    take: 3,
    orderBy: { updatedAt: "desc" },
    select: { titleEn: true, bodyHtmlEn: true, bodyHtmlUa: true }
  });

  products.forEach((p, i) => {
    console.log("\n================================");
    console.log(`[Item ${i + 1}] Title: ${p.titleEn}`);
    console.log("--- EN (Original) ---");
    console.log(p.bodyHtmlEn.substring(0, 500) + "...");
    console.log("\n--- UA (Translated) ---");
    console.log(p.bodyHtmlUa.substring(0, 500) + "...");
    console.log("================================");
  });
  
  await prisma.$disconnect();
}
checkTranslations().catch(console.error);
