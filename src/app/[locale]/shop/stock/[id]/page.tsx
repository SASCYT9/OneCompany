/**
 * Turn14 item detail page — `/[locale]/shop/stock/[id]`.
 *
 * Renders catalog data for items sourced from the Turn14 distributor
 * cache (`Turn14Item` table). These items don't live in our `ShopProduct`
 * catalog and therefore have no per-brand storefront page; this is the
 * single canonical detail page for them.
 *
 * SSR — fetches directly from prisma, applies B2B discount from the
 * current customer session, and renders with the same Porsche-Editorial
 * styling as the rest of the shop.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Warehouse } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { calcItemPrice } from "@/lib/shippingCalc";
import { buildNoIndexPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { isTurn14Enabled } from "@/lib/shopFeatureFlags";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: SupportedLocale; id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const item = await prisma.turn14Item.findUnique({
    where: { id },
    select: { brand: true, name: true },
  });
  const resolvedLocale = resolveLocale(locale);
  const title = item ? `${item.brand} · ${item.name}` : "B2B Catalog Item";
  const description = item
    ? `${item.brand} ${item.name} — B2B catalog item.`
    : "B2B catalog item details.";
  return buildNoIndexPageMetadata(resolvedLocale, `shop/stock/${id}`, {
    title,
    description,
  });
}

function formatPrice(amount: number | null | undefined, locale: string) {
  if (amount == null || amount <= 0) return null;
  return new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function StockItemDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const isUa = locale === "ua";

  // Turn14 integration is gated behind a feature flag — 404 when off so
  // nothing surfaces in the portal until we re-enable it.
  if (!isTurn14Enabled()) {
    notFound();
  }

  const item = await prisma.turn14Item.findUnique({
    where: { id },
    select: {
      id: true,
      partNumber: true,
      brand: true,
      name: true,
      category: true,
      subcategory: true,
      thumbnail: true,
      price: true,
      inStock: true,
      attributes: true,
    },
  });

  if (!item) {
    notFound();
  }

  // Pricing — apply customer B2B discount if logged in. Use the same
  // pipeline as /api/shop/stock/search so the dealer sees the exact same
  // figure on the detail page.
  const session = await getCurrentShopCustomerSession();
  const b2bDiscountPercent = session ? Number(session.b2bDiscountPercent || 0) : 0;
  const DEFAULT_MARKUP_PCT = 25;
  let markupPct = DEFAULT_MARKUP_PCT;
  try {
    const m = await prisma.turn14BrandMarkup.findFirst({
      where: { brandName: { equals: item.brand, mode: "insensitive" } },
      select: { markupPct: true },
    });
    if (m?.markupPct != null) markupPct = m.markupPct;
  } catch {
    // ignore — fall back to default markup
  }

  const basePrice = item.price || 0;
  let dealerPrice: number | null = null;
  let msrp: number | null = null;
  if (basePrice > 0) {
    const res = calcItemPrice({
      baseCostUsd: basePrice,
      markupPct,
      discountPct: b2bDiscountPercent,
      quantity: 1,
    });
    msrp = res.markedUpPrice;
    dealerPrice = res.unitPrice;
  }

  // Pull extra fields from the attributes JSON — these were captured at
  // sync time and live alongside the row.
  const attrs = (item.attributes ?? {}) as Record<string, any>;
  const description: string =
    typeof attrs.part_description === "string" ? attrs.part_description : "";
  const dimensions: Array<{
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
    box_number?: number;
  }> = Array.isArray(attrs.dimensions) ? attrs.dimensions : [];
  const warehouseAvail: Array<{ location_id?: string; can_place_order?: boolean }> = Array.isArray(
    attrs.warehouse_availability
  )
    ? attrs.warehouse_availability
    : [];
  const availableLocations = warehouseAvail.filter((w) => w.can_place_order).length;
  const mfrPartNumber: string | null = attrs.mfr_part_number || null;
  const barcode: string | null = attrs.barcode || null;
  const bornOn: string | null = attrs.born_on_date || null;

  const formattedDealer = formatPrice(dealerPrice, locale);
  const formattedMsrp = formatPrice(msrp, locale);

  return (
    <main className="min-h-screen bg-background text-foreground pb-32">
      {/* Breadcrumb */}
      <nav className="max-w-[1400px] mx-auto px-6 pt-24 pb-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Link
          href={`/${locale}/shop/stock`}
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isUa ? "Каталог" : "Catalog"}
        </Link>
        <span className="mx-3 text-muted-foreground/60">/</span>
        <span className="text-foreground">{item.brand}</span>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Image */}
        <div className="bg-surface-elevated rounded-[6px] border border-border overflow-hidden aspect-square flex items-center justify-center">
          {item.thumbnail ? (
            <ShopProductImage
              src={item.thumbnail}
              alt={item.name}
              width={900}
              height={900}
              className="w-full h-full object-contain p-12"
              unoptimized
            />
          ) : (
            <Package className="w-24 h-24 text-muted-foreground/30" />
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            {item.brand}
            {item.category && (
              <>
                <span className="mx-2 text-muted-foreground/40">·</span>
                {item.category}
              </>
            )}
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight text-foreground">
            {item.name}
          </h1>

          {description && (
            <p className="mt-5 text-base leading-relaxed text-foreground/85 max-w-prose whitespace-pre-line">
              {description}
            </p>
          )}

          {/* Spec rows */}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 max-w-md text-sm">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {isUa ? "Артикул" : "SKU"}
            </dt>
            <dd className="font-mono text-foreground">{item.partNumber}</dd>

            {mfrPartNumber && mfrPartNumber !== item.partNumber && (
              <>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "MPN" : "MPN"}
                </dt>
                <dd className="font-mono text-foreground">{mfrPartNumber}</dd>
              </>
            )}

            {item.subcategory && (
              <>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "Підкатегорія" : "Subcategory"}
                </dt>
                <dd className="text-foreground">{item.subcategory}</dd>
              </>
            )}

            {dimensions.length > 0 && (
              <>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "Розміри" : "Dimensions"}
                </dt>
                <dd className="text-foreground">
                  {dimensions
                    .map(
                      (d, i) =>
                        `#${d.box_number ?? i + 1}: ${d.length ?? "?"}×${d.width ?? "?"}×${d.height ?? "?"} in · ${d.weight ?? "?"} lb`
                    )
                    .join(" / ")}
                </dd>
              </>
            )}

            {barcode && (
              <>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "Штрих-код" : "Barcode"}
                </dt>
                <dd className="font-mono text-foreground">{barcode}</dd>
              </>
            )}

            {bornOn && (
              <>
                <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "Релізна дата" : "Born on"}
                </dt>
                <dd className="text-foreground">{bornOn}</dd>
              </>
            )}
          </dl>

          {/* Stock & warehouse info */}
          {warehouseAvail.length > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 self-start rounded-[4px] border border-border bg-card px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-foreground">
              <Warehouse className="w-3.5 h-3.5 text-primary" />
              {availableLocations > 0
                ? isUa
                  ? `${availableLocations} складів готові надіслати`
                  : `${availableLocations} warehouses ready to ship`
                : isUa
                  ? "На замовлення"
                  : "Special order"}
            </div>
          )}

          {/* Pricing + CTA */}
          <div className="mt-10 border-t border-border pt-6">
            {formattedDealer ? (
              <div className="flex items-end gap-6">
                {formattedMsrp && formattedMsrp !== formattedDealer && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {isUa ? "РРЦ" : "MSRP"}
                    </p>
                    <p className="text-lg text-muted-foreground line-through">{formattedMsrp}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-medium">
                    {isUa ? "Ваша ціна" : "Your price"}
                  </p>
                  <p className="text-4xl font-light tabular-nums text-foreground">
                    {formattedDealer}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isUa ? "Ціна" : "Pricing"}
                </p>
                <p className="text-2xl font-light text-foreground">
                  {isUa ? "За запитом" : "On request"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isUa
                    ? "Натисніть «Запит ціни» — менеджер пришле комерційну пропозицію впродовж робочого дня."
                    : 'Click "Request quote" — a manager will reply with pricing within one business day.'}
                </p>
              </div>
            )}

            <div className="mt-6">
              <AddToCartButton
                turn14Id={item.id}
                locale={locale}
                variant="default"
                redirect
                productName={item.name}
                label={
                  formattedDealer
                    ? isUa
                      ? "Додати до замовлення"
                      : "Add to order"
                    : isUa
                      ? "Запит ціни"
                      : "Request quote"
                }
                labelAdded={
                  formattedDealer
                    ? isUa
                      ? "У замовленні ✓"
                      : "In order ✓"
                    : isUa
                      ? "Запит надіслано ✓"
                      : "Quote requested ✓"
                }
                className="inline-flex items-center justify-center rounded-[4px] bg-primary text-primary-foreground px-8 py-4 text-[11px] uppercase tracking-[0.24em] font-medium hover:bg-primary/90 active:scale-95 transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
