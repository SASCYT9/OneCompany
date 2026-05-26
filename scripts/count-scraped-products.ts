import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import Papa from "papaparse";

const prisma = new PrismaClient();

async function main() {
  const feedUrl = "https://feed.atomic-shop.ua/feed_tts.csv";
  console.log(`Downloading feed...`);
  const req = await fetch(feedUrl);
  const csvText = await req.text();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];
  const feedSkus = new Set(
    rows.map((row: any) =>
      String(row.mpn || "")
        .trim()
        .toLowerCase()
    )
  );

  const dbProducts = await prisma.shopProduct.findMany({
    where: {
      brand: {
        in: ["AKRAPOVIC", "OHLINS", "CSF", "ADRO"],
        mode: "insensitive",
      },
    },
    select: {
      sku: true,
      brand: true,
      scope: true,
    },
  });

  let notInFeedCount = 0;
  const brandCounts: Record<string, number> = {};
  const notInFeedList: any[] = [];

  for (const p of dbProducts) {
    const cleanSku = String(p.sku || "")
      .trim()
      .toLowerCase();
    if (!feedSkus.has(cleanSku)) {
      notInFeedCount++;
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
      notInFeedList.push(p);
    }
  }

  console.log(`\nTotal DB products for these brands: ${dbProducts.length}`);
  console.log(`Products NOT in CSV feed (will need live scraping): ${notInFeedCount}`);
  console.log("Breakdown by brand of scraped products:", brandCounts);
  console.log("Sample of products to scrape:", notInFeedList.slice(0, 10));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
