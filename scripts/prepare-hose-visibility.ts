import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { classifySmallHoseProduct } from "../src/lib/shopHoseVisibility";
import type { ShopCurrencyCode } from "../src/lib/shopCurrencyDefaults";

const source = resolve("outputs/site-commerce-2026-10-03/hose-clamp-candidates.json");
const data = JSON.parse(readFileSync(source, "utf8"));
const rates = data.settings?.currencyRates as Record<ShopCurrencyCode, number>;
if (!rates?.EUR || !rates.USD || !rates.UAH) throw new Error("Source rates missing");
const entries = data.products.map((product: any) => ({ product, ...classifySmallHoseProduct(product, rates) }));
const selected = entries.filter((entry: any) => entry.hide);
const plan = { target: "https://onecompany.global", readAt: data.readAt, currencyRates: rates, sourceSha256: createHash("sha256").update(readFileSync(source)).digest("hex"), entries: selected.map((entry: any) => ({ id: entry.product.id, sku: entry.product.sku, slug: entry.product.slug, titleEn: entry.product.titleEn, maximumUsd: entry.maximumUsd, before: { isPublished: entry.product.isPublished, status: entry.product.status, catalogVersion: entry.product.catalogVersion } })) };
const planPath = resolve("outputs/site-commerce-2026-10-03/hide-plan.json");
writeFileSync(planPath, JSON.stringify(plan, null, 2));
writeFileSync(resolve("outputs/site-commerce-2026-10-03/hide-review.csv"), "sku,slug,title,maximum_usd,action,reason\n" + entries.map((entry: any) => [entry.product.sku, entry.product.slug, entry.product.titleEn, entry.maximumUsd, entry.hide ? "hide" : "skip", entry.reason].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
console.log(JSON.stringify({ selected: selected.length, skipped: entries.length - selected.length, reasons: Object.fromEntries([...new Set(entries.map((e: any) => e.reason))].map((reason) => [reason, entries.filter((e: any) => e.reason === reason).length])), planPath, brands: Object.fromEntries([...new Set(selected.map((e: any) => e.product.brand))].map((brand) => [brand, selected.filter((e: any) => e.product.brand === brand).length])) }));
