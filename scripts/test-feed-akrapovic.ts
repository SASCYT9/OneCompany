import Papa from "papaparse";

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
  const inStockRows = rows.filter(
    (row: any) =>
      row.brand &&
      String(row.brand).toLowerCase().includes("akrap") &&
      parseInt(row.stock || "0", 10) > 0
  );

  console.log(`Found ${inStockRows.length} in-stock Akrapovic products in feed:`);
  for (const row of inStockRows.slice(0, 5)) {
    console.log(`SKU: ${row.mpn} | Stock: ${row.stock} | Title: ${row.title}`);
  }
}

main().catch(console.error);
