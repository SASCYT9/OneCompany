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
  const brands = new Set(rows.map((row: any) => row.brand).filter(Boolean));
  console.log("Brands in feed:", Array.from(brands));
}

main().catch(console.error);
