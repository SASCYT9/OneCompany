import { ShopVariantSkuText } from "./ShopVariantImageContext";

/** Part number chip under the product title; follows the chosen variant where the page tracks it. */
export function ShopProductTitleSku({ sku, isUa }: { sku: string; isUa: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
        {isUa ? "Артикул" : "Part number"}
      </span>
      <span className="min-w-0 break-all rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1 font-mono text-xs tracking-[0.04em] text-foreground/85">
        <ShopVariantSkuText fallbackSku={sku} />
      </span>
    </div>
  );
}
