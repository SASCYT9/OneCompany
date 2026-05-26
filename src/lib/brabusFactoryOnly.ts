import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Cache the factory-only set in memory after first load. Module cache reset on HMR/restart.
let cached: Set<string> | null = null;

function loadFromDisk(): Set<string> {
  try {
    const path = resolve(process.cwd(), "data/brabus-factory-only-skus.json");
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as { skus?: string[] };
    const skus = Array.isArray(parsed.skus) ? parsed.skus : [];
    return new Set(skus.map((s) => s.toLowerCase()));
  } catch {
    return new Set();
  }
}

export function loadFactoryOnlySkus(): Set<string> {
  if (!cached) cached = loadFromDisk();
  return cached;
}

export function isFactoryOnlyProduct(sku: string | null | undefined): boolean {
  if (!sku) return false;
  const normalized = sku.toLowerCase();
  // Exception: Bentley GTC products (starts with bc634, contains bentley or is zm12-bc-pe) can be ordered
  if (
    normalized.startsWith("bc634") ||
    normalized.includes("bentley") ||
    normalized === "zm12-bc-pe"
  ) {
    return false;
  }
  return loadFactoryOnlySkus().has(normalized);
}
