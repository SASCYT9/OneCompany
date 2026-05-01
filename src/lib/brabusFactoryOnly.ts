import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let cached: Set<string> | null = null;

function loadFromDisk(): Set<string> {
  try {
    const path = resolve(process.cwd(), 'data/brabus-factory-only-skus.json');
    const raw = readFileSync(path, 'utf8');
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
  return loadFactoryOnlySkus().has(sku.toLowerCase());
}
