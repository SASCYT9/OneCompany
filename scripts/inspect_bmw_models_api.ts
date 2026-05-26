import fetch from "node-fetch";

async function main() {
  const url = "https://api2.akrapovic.com/en/brands/44/models";
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
    console.error("Error fetching", res.statusText);
    return;
  }
  const data: any = await res.json();
  console.log(`Found ${data.length} models:`);
  data.forEach((item: any) => {
    const model = item.Model;
    if (
      model &&
      (model.ModelName.includes("1000") ||
        model.ModelName.includes("R 1300") ||
        model.ModelName.includes("GS") ||
        model.ModelName.includes("RR"))
    ) {
      console.log(`- ModelId: ${model.ModelId} | ModelName: ${model.ModelName}`);
    }
  });
}

main().catch(console.error);
