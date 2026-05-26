import fetch from "node-fetch";

async function main() {
  const id = 22758; // Ducati Panigale V2
  const url = `https://api2.akrapovic.com/en/products/motorcycle/${id}`;
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
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
