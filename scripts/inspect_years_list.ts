import fetch from "node-fetch";

async function fetchYears(modelId: number) {
  const url = `https://api2.akrapovic.com/en/models/${modelId}/years`;
  console.log(`\nFetching years for model ${modelId} from ${url}...`);
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
    console.error("Failed", res.statusText);
    return;
  }
  const data: any = await res.json();
  data.forEach((item: any) => {
    console.log(
      `- ModelYearId: ${item.ModelYear?.ModelYearId} | Year: ${item.ModelYear?.ModelYear}`
    );
  });
}

async function main() {
  await fetchYears(1389);
  await fetchYears(1446);
}

main().catch(console.error);
