import fetch from "node-fetch";

async function main() {
  const productId = 22677;
  const url = `https://api2.akrapovic.com/en/products/motorcycle/${productId}`;
  console.log(`Fetching from ${url}...`);
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
    console.error("Failed to fetch", res.statusText);
    return;
  }
  const data = await res.json();
  // Strip out descriptions and technical data keys to keep output clean, but show other fields
  const cleanData = {
    ...data,
    Description: data.Description ? data.Description.substring(0, 100) + "..." : null,
    TechnicalData: data.TechnicalData ? Object.keys(data.TechnicalData) : null,
  };
  console.log(JSON.stringify(cleanData, null, 2));
}

main().catch(console.error);
