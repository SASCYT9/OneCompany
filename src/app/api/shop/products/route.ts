import { NextRequest, NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import { serializePublicShopProduct } from "@/lib/shopPublicProducts";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";
import { prisma } from "@/lib/prisma";

const PUBLIC_RESULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    // The storefront no longer uses this list. In production it is a narrow,
    // rate-limited lookup instead of an unbounded dump of the whole catalogue;
    // local tooling (scripts/do88) still receives the full list.
    const productionListing = process.env.NODE_ENV === "production";
    const scope = request.nextUrl.searchParams.get("scope");
    const collectionHandle = request.nextUrl.searchParams.get("collection");
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (productionListing) {
      if (!collectionHandle && query.length < 2)
        return NextResponse.json(
          { error: "Specify a collection or a search query of at least 2 characters" },
          { status: 400 }
        );
      const allowed = await consumeRateLimit({
        keyParts: ["shop-products-list", getRequestIp(request.headers)],
        windowMs: 60_000,
        maxPerWindow: 30,
      });
      if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const [settings, session, products] = await Promise.all([
      getPublicShopSettingsRuntime(),
      getCurrentShopCustomerSession(),
      getShopProductsServer(),
    ]);
    const country = request.nextUrl.searchParams.get("country");
    const pricingContext = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: session?.customerId,
      customerGroup: session?.group,
      isAuthenticated: Boolean(session),
      customerB2BDiscountPercent: session?.b2bDiscountPercent,
      priceCountry: country,
    });

    const filtered = products.filter((product) => {
      if (scope && product.scope !== scope) {
        return false;
      }
      if (
        collectionHandle &&
        !(product.collections ?? []).some((collection) => collection.handle === collectionHandle)
      ) {
        return false;
      }
      if (query) {
        const haystack = [
          product.slug,
          product.brand,
          product.vendor,
          product.title.en,
          product.title.ua,
          product.category.en,
          product.category.ua,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });

    const visible = productionListing ? filtered.slice(0, PUBLIC_RESULT_LIMIT) : filtered;
    return NextResponse.json(
      visible.map((product) => serializePublicShopProduct(product, pricingContext)),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Shop products list", error);
    return NextResponse.json({ error: "Failed to list products" }, { status: 500 });
  }
}

export const runtime = "nodejs";
