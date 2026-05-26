import fetch from "node-fetch";

async function main() {
  const url = `https://api2.akrapovic.com/en/products/motorcycle?ModelId=377`;
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
    console.error("Error fetching", res.statusText);
    return;
  }
  const data: any = await res.json();
  if (data.Items) {
    const item = data.Items.find((i: any) => i.Product?.SalesId === "S-B10SO8-CUBT");
    console.log("Raw S-B10SO8-CUBT item:", JSON.stringify(item, null, 2));
  }
}

main().catch(console.error);
