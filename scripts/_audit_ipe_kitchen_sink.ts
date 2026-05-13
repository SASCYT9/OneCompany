import { config } from "dotenv";
config({ path: ".env.local" });
config();
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

function resolveSnapshotDir(): string {
  const root = path.join(process.cwd(), "artifacts", "ipe-import");
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(root, name, "match-manifest.json")))
    .sort()
    .reverse();
  return path.join(root, dirs[0]);
}

(async () => {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  const parsed = JSON.parse(
    fs.readFileSync("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8")
  );
  const snap = JSON.parse(
    fs.readFileSync(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8")
  );
  const settings = await p.shopSettings.findFirst();
  const rates = (settings?.currencyRates ?? {}) as Record<string, number>;
  const ratesUSD = Number(rates.USD ?? 1);
  const ratesUAH = Number(rates.UAH ?? 1);
  const ratesEUR = Number(rates.EUR ?? 1);
  const usdToUah = ratesUAH / ratesUSD;
  const usdToEur = ratesEUR / ratesUSD;

  // Excel SKU set
  const excelSkus = new Set<string>();
  for (const r of parsed.items) if (r.sku) excelSkus.add(r.sku);

  // iPE Shopify handle set
  const snapHandles = new Set<string>(snap.products.map((p: any) => p.handle));

  const products = await p.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: {
      variants: { orderBy: { position: "asc" } },
      options: { orderBy: { position: "asc" } },
      media: { orderBy: { position: "asc" } },
    },
    orderBy: { slug: "asc" },
  });

  type Issue = { slug: string; severity: "high" | "med" | "low"; category: string; detail: string };
  const issues: Issue[] = [];
  const push = (slug: string, severity: Issue["severity"], category: string, detail: string) =>
    issues.push({ slug, severity, category, detail });

  for (const prod of products) {
    const handle = prod.slug.replace(/^ipe-/, "");

    // 1. Published product with no variants
    if (prod.isPublished && prod.variants.length === 0) {
      push(prod.slug, "high", "no-variants", "product is published but has 0 variants");
    }

    // 2. Published product with no priceUsd
    if (prod.isPublished && (prod.priceUsd == null || Number(prod.priceUsd) <= 0)) {
      push(prod.slug, "high", "null-top-price", `published with priceUsd=${prod.priceUsd}`);
    }

    // 3. UAH/EUR consistency vs USD using current rates (allow 0.5% tolerance)
    if (prod.priceUsd != null && prod.priceUah != null) {
      const usd = Number(prod.priceUsd);
      const expectedUah = usd * usdToUah;
      const actualUah = Number(prod.priceUah);
      if (Math.abs(actualUah - expectedUah) > expectedUah * 0.01) {
        push(
          prod.slug,
          "med",
          "uah-out-of-sync",
          `priceUah=${actualUah} but priceUsd=${usd} × ${usdToUah.toFixed(2)} ≈ ${expectedUah.toFixed(2)}`
        );
      }
    }
    if (prod.priceUsd != null && prod.priceEur != null) {
      const usd = Number(prod.priceUsd);
      const expectedEur = usd * usdToEur;
      const actualEur = Number(prod.priceEur);
      if (Math.abs(actualEur - expectedEur) > expectedEur * 0.01) {
        push(
          prod.slug,
          "med",
          "eur-out-of-sync",
          `priceEur=${actualEur} but priceUsd=${usd} × ${usdToEur.toFixed(2)} ≈ ${expectedEur.toFixed(2)}`
        );
      }
    }

    // 4. compareAtUsd <= priceUsd (negative or zero discount)
    if (prod.priceUsd != null && prod.compareAtUsd != null) {
      const p1 = Number(prod.priceUsd);
      const c1 = Number(prod.compareAtUsd);
      if (c1 > 0 && c1 <= p1) {
        push(prod.slug, "med", "compareAt-not-higher", `priceUsd=${p1} compareAtUsd=${c1}`);
      }
    }

    // 5. Top-level priceUsd vs default variant
    const defVariant = prod.variants.find((v) => v.isDefault) ?? prod.variants[0];
    if (defVariant && defVariant.priceUsd != null && prod.priceUsd != null) {
      const dvUsd = Number(defVariant.priceUsd);
      const ppUsd = Number(prod.priceUsd);
      if (Math.abs(dvUsd - ppUsd) > 0.01) {
        push(
          prod.slug,
          "med",
          "top-vs-default-mismatch",
          `product.priceUsd=${ppUsd} ≠ defaultVariant.priceUsd=${dvUsd}`
        );
      }
    }

    // 6. Variants without isDefault flag AND without position=1 → ambiguous default
    if (prod.variants.length > 0 && !prod.variants.some((v) => v.isDefault)) {
      push(prod.slug, "low", "no-isDefault", "no variant has isDefault=true");
    }
    // Multiple isDefault
    const defCount = prod.variants.filter((v) => v.isDefault).length;
    if (defCount > 1) {
      push(prod.slug, "med", "multi-isDefault", `${defCount} variants have isDefault=true`);
    }

    // 7. Position gaps (e.g., 1, 2, 4 instead of 1, 2, 3)
    if (prod.variants.length > 0) {
      const positions = prod.variants.map((v) => v.position).sort((a, b) => a - b);
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] !== i + 1) {
          push(
            prod.slug,
            "low",
            "position-gap",
            `expected ${i + 1} at index ${i}, got ${positions[i]}; positions=[${positions.join(",")}]`
          );
          break;
        }
      }
    }

    // 8. Variant priceUsd <= 0 or null
    for (const v of prod.variants) {
      if (v.priceUsd == null || Number(v.priceUsd) <= 0) {
        push(
          prod.slug,
          "high",
          "variant-null-price",
          `variant id=${v.id} (${v.option1Value ?? "-"}/${v.option2Value ?? "-"}) priceUsd=${v.priceUsd}`
        );
      }
    }

    // 9. Variant SKU starting with IPE- (synthetic)
    for (const v of prod.variants) {
      if (v.sku?.startsWith("IPE-")) {
        push(prod.slug, "low", "synthetic-sku", `variant sku=${v.sku}`);
      }
    }

    // 10. Variant SKU not in Excel parsed list
    for (const v of prod.variants) {
      if (v.sku && !v.sku.startsWith("IPE-") && !excelSkus.has(v.sku)) {
        push(prod.slug, "high", "sku-not-in-excel", `variant sku=${v.sku} not found in 2026 Excel`);
      }
    }

    // 11. Variant optionXValue references a value NOT in ShopProductOption.values
    for (let i = 0; i < prod.options.length; i++) {
      const opt = prod.options[i];
      const optValues = new Set(opt.values);
      for (const v of prod.variants) {
        const val = i === 0 ? v.option1Value : i === 1 ? v.option2Value : v.option3Value;
        if (val && !optValues.has(val)) {
          push(
            prod.slug,
            "med",
            "variant-value-not-in-axis",
            `variant ${v.position} option${i + 1}Value="${val}" not in axis "${opt.name}" values=[${opt.values.join("|")}]`
          );
        }
      }
    }

    // 12. Variant uses option3Value but only 2 (or 1) axis is defined
    for (const v of prod.variants) {
      const usedAxes = [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).length;
      if (usedAxes > prod.options.length) {
        push(
          prod.slug,
          "med",
          "variant-orphan-axis",
          `variant uses ${usedAxes} option values but product defines only ${prod.options.length} axes`
        );
      }
    }

    // 13. Multi-variant product where all variants share same SKU (informational; just flag)
    if (prod.variants.length > 1) {
      const uniqueSkus = new Set(prod.variants.map((v) => v.sku).filter(Boolean));
      const uniquePrices = new Set(
        prod.variants.map((v) => v.priceUsd?.toString()).filter(Boolean)
      );
      if (uniqueSkus.size === 1 && uniquePrices.size === 1 && prod.variants.length > 1) {
        const opts = prod.variants.map((v) =>
          [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(" | ")
        );
        const uniqueOpts = new Set(opts);
        if (uniqueOpts.size > 1) {
          push(
            prod.slug,
            "high",
            "flat-price-flat-sku",
            `${prod.variants.length} variants but only 1 unique SKU and 1 unique price (options differ but pricing+SKU don't)`
          );
        }
      }
    }

    // 14. Product has no images
    if (prod.isPublished && prod.media.length === 0 && !prod.image) {
      push(prod.slug, "low", "no-images", "no media + no image");
    }

    // 15. iPE product with brand mismatch (should be "iPE exhaust")
    if (prod.brand && !/iPE/i.test(prod.brand)) {
      push(prod.slug, "low", "brand-mismatch", `brand="${prod.brand}" (expected to contain "iPE")`);
    }

    // 16. iPE product without ipe- slug prefix
    if (!prod.slug.startsWith("ipe-")) {
      push(prod.slug, "low", "slug-prefix-missing", "slug doesn't start with ipe-");
    }
  }

  // Print grouped
  const byCategory: Record<string, Issue[]> = {};
  for (const i of issues) {
    if (!byCategory[i.category]) byCategory[i.category] = [];
    byCategory[i.category].push(i);
  }

  console.log(`\n=== iPE kitchen-sink audit (${products.length} products) ===`);
  console.log(
    `Currency rates: USD=${ratesUSD} UAH=${ratesUAH} EUR=${ratesEUR} | 1USD=${usdToUah.toFixed(2)}UAH = ${usdToEur.toFixed(2)}EUR`
  );
  console.log(`\nTotal issues found: ${issues.length}\n`);

  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
  for (const [cat, list] of sortedCategories) {
    const high = list.filter((i) => i.severity === "high").length;
    const med = list.filter((i) => i.severity === "med").length;
    const low = list.filter((i) => i.severity === "low").length;
    console.log(`[${cat}] ${list.length} total  (high=${high} med=${med} low=${low})`);
    for (const i of list.slice(0, 6)) {
      console.log(`  ${i.severity.toUpperCase().padEnd(4)} ${i.slug}  — ${i.detail}`);
    }
    if (list.length > 6) console.log(`  ... and ${list.length - 6} more`);
    console.log("");
  }

  await p.$disconnect();
})();
