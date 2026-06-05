import fs from "fs";
import path from "path";

// Define the function from urbanImageUtils
function stripQueryAndHash(url: string) {
  return url.split(/[?#]/, 1)[0] ?? url;
}

function isUrbanPlaceholderImage(url: string | null | undefined): boolean {
  const normalized = String(url ?? "")
    .trim()
    .toLowerCase();
  const normalizedPath = stripQueryAndHash(normalized);
  if (!normalized) return true;

  if (
    [
      "image-coming-soon",
      "coming-soon",
      "comingsoon",
      "placeholder",
      "no-image",
      "image_coming_soon",
      "gp-portal",
      "gpproducts",
    ].some((marker) => normalized.includes(marker))
  ) {
    return true;
  }

  if (
    normalized.includes("cdn.shopify.com/s/files/1/0733/4058/4242/files/gwagon_") &&
    normalizedPath.endsWith(".png")
  ) {
    return true;
  }

  if (
    normalizedPath.includes("cdn.shopify.com") &&
    /\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(
      normalizedPath
    )
  ) {
    return true;
  }

  // Also match gp-portal.eu domain placeholders with silhouette
  if (
    normalizedPath.includes("gp-portal.eu") &&
    /\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(
      normalizedPath
    )
  ) {
    return true;
  }

  return false;
}

function main() {
  const compPath = path.resolve(process.cwd(), 'archive', 'scratch', 'image-comparison.json');
  const comparison = JSON.parse(fs.readFileSync(compPath, 'utf8'));

  const targets = comparison.filter((item: any) => item.gpImage && item.dbId);
  console.log(`Found ${targets.length} targets.`);

  for (const target of targets) {
    const isPlaceholder = isUrbanPlaceholderImage(target.gpImage);
    console.log(`SKU: ${target.dbSku} - GP Image: ${target.gpImage} - Is Placeholder: ${isPlaceholder}`);
  }
}

main();
