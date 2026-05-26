import fetch from "node-fetch";

const params = [
  "modelYearId=7964",
  "modelYearId=7967",
  "modelYearId=8361",
  "yearId=7964",
  "yearId=7967",
  "yearId=8361",
  "ModelYearId=7964",
  "ModelYearId=7967",
  "ModelYearId=8361",
  "YearId=7964",
  "YearId=7967",
  "YearId=8361",
];

async function main() {
  const modelId = 1389;
  for (const p of params) {
    const url = `https://api2.akrapovic.com/en/products/motorcycle?ModelId=${modelId}&${p}`;
    console.log(`\nFetching: ${url}`);
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
      if (res.ok) {
        const data: any = await res.json();
        const items = data.Items || [];
        console.log(`  Found ${items.length} items`);
        // Print first 2 items
        items.slice(0, 2).forEach((item: any) => {
          console.log(
            `    - SKU: ${item.Product?.SalesId} | Year: ${item.ModelYear?.ModelYear} | ModelYearId: ${item.ModelYear?.ModelYearId}`
          );
        });
      } else {
        console.log(`  Failed: ${res.statusText}`);
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
