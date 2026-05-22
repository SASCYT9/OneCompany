/**
 * Post-process price-comparison.json: detect false-positives where the scraper
 * landed on a generic / first-result page (same source URL for multiple
 * different SKUs of the same brand). Flip those rows from 'compared' → 'invalid-match'.
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "artifacts/qa-2026-05-13/data/price-comparison.json");

(async () => {
  const rows: any[] = JSON.parse(await fs.readFile(FILE, "utf8"));

  // group by brand, detect dup URLs
  const byBrand: Record<string, any[]> = {};
  for (const r of rows) (byBrand[r.brand] ??= []).push(r);

  for (const [brand, arr] of Object.entries(byBrand)) {
    const urlCounts: Record<string, number> = {};
    for (const r of arr)
      if (r.status === "compared" && r.sourceUrl)
        urlCounts[r.sourceUrl] = (urlCounts[r.sourceUrl] ?? 0) + 1;
    for (const r of arr) {
      if (r.status === "compared" && r.sourceUrl && urlCounts[r.sourceUrl] > 1) {
        r.status = "invalid-match";
        r.matchOk = false;
        r.note =
          `${r.note || ""} | scraper landed on same URL for ${urlCounts[r.sourceUrl]} different SKUs — likely first-search-result, not real match`.trim();
      }
    }
  }

  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");

  // re-emit CSV
  const csvPath = FILE.replace(/\.json$/, ".csv");
  const esc = (s: any) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const header =
    "brand,sku,slug,title,ourPriceUsd,ourPriceEur,sourceUrl,sourcePriceRaw,sourcePriceNum,sourceCurrency,deltaPct,matchOk,status,note";
  const lines = rows.map((r) =>
    [
      r.brand,
      esc(r.sku),
      esc(r.slug),
      esc(r.title),
      r.ourPriceUsd ?? "",
      r.ourPriceEur ?? "",
      esc(r.sourceUrl),
      esc(r.sourcePriceRaw ?? ""),
      r.sourcePriceNum ?? "",
      r.sourceCurrency ?? "",
      r.deltaPct != null ? r.deltaPct.toFixed(1) : "",
      r.matchOk,
      r.status,
      esc(r.note),
    ].join(",")
  );
  await fs.writeFile(csvPath, [header, ...lines].join("\n"), "utf8");

  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.status] = (tally[r.status] ?? 0) + 1;
  console.log("Adjusted tally:", tally);
})();
