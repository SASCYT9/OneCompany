import fetch from "node-fetch";

const paths = [
  "/en/products/motorcycle/22677/vehicles",
  "/en/products/motorcycle/22677/fitments",
  "/en/products/motorcycle/22677/models",
  "/en/products/motorcycle/22677/compatibility",
  "/en/products/motorcycle/22677/motorcycles",
  "/en/products/motorcycle/22677/years",
  "/en/products/motorcycle/22677/model-years",
  "/en/products/22677/vehicles",
  "/en/products/22677/fitments",
  "/en/products/22677/models",
];

async function main() {
  for (const p of paths) {
    const url = `https://api2.akrapovic.com${p}`;
    console.log(`Trying ${url}...`);
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
      console.log(`  Response: ${res.status} ${res.statusText}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Data snippet: ${text.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.log(`  Failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
