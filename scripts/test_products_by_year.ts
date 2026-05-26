import fetch from "node-fetch";

async function testYear(modelId: number, yearId: number, year: number) {
  // Test both YearId and ModelYearId parameters
  const urls = [
    `https://api2.akrapovic.com/en/products/motorcycle?ModelId=${modelId}&ModelYearId=${yearId}`,
    `https://api2.akrapovic.com/en/products/motorcycle?ModelId=${modelId}&YearId=${yearId}`,
  ];

  for (const url of urls) {
    console.log(`\nFetching ${year} (Id: ${yearId}) from ${url}...`);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          Origin: "https://www.akrapovic.com",
          Referer: "https://www.akrapovic.com/",
        },
      });
      if (!res.ok) {
        console.log(`  Failed: ${res.statusText}`);
        continue;
      }
      const data: any = await res.json();
      const items = data.Items || [];
      console.log(`  Found ${items.length} items:`);
      items.forEach((item: any) => {
        console.log(
          `    - SKU: ${item.Product?.SalesId} | Name: ${item.Product?.CommercialName} | Item Year: ${item.ModelYear?.ModelYear}`
        );
      });
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function main() {
  // Test years for BMW M 1000 RR (ModelId: 1389)
  // 2021: 7964
  // 2024: 7967
  // 2026: 8361
  await testYear(1389, 7964, 2021);
  await testYear(1389, 7967, 2024);
  await testYear(1389, 8361, 2026);
}

main().catch(console.error);
