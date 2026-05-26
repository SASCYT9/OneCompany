import fetch from "node-fetch";

async function main() {
  const productId = 22677; // S-B10E10-APLT/1 for BMW M1000RR 2024
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
    console.error(`Error: ${res.statusText}`);
    return;
  }

  const data = await res.json();
  console.log("API Response keys:", Object.keys(data));
  if (data.Product) {
    console.log("Product keys:", Object.keys(data.Product));
    console.log("SalesId (SKU):", data.Product.SalesId);
    console.log("CommercialName:", data.Product.CommercialName);
  }
  console.log("Description:", data.Description);
  console.log("Features:", data.Features);
  console.log("TechnicalData keys:", data.TechnicalData ? Object.keys(data.TechnicalData) : "none");
  if (data.TechnicalData) {
    console.log("TechnicalData:", JSON.stringify(data.TechnicalData, null, 2));
  }
  console.log("Documentations:", data.Documentations);
}

main().catch(console.error);
