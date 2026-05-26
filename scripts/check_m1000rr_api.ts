import fetch from "node-fetch";

async function main() {
  const modelId = 1389; // BMW M 1000 RR
  const url = `https://api2.akrapovic.com/en/products/motorcycle?ModelId=${modelId}`;

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
  console.log(`Found ${data.Items ? data.Items.length : 0} items:`);
  if (data.Items) {
    data.Items.forEach((item: any) => {
      console.log(
        `- ProductId: ${item.Product?.ProductId} | SKU: ${item.Product?.SalesId} | CommercialName: ${item.Product?.CommercialName} | Year: ${item.ModelYear?.ModelYear}`
      );
    });
  }
}

main().catch(console.error);
