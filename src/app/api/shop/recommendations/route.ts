import { NextRequest, NextResponse } from "next/server";
import { extractProductFitment, isExcludedFromCrossShop } from "@/lib/crossShopFitment";
import { findCrossShopFitmentMatches } from "@/lib/crossShopFitment.server";
import {
  getShopProductBySlugServer,
  getShopRecommendationProductsForFitmentServer,
  getShopRecommendationProductsServer,
} from "@/lib/shopCatalogServer";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import {
  isShopCatalogReaderRequestEnabled,
  resolveShopCatalogReaderFlag,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug || slug.length > 300) return NextResponse.json({ groups: [] }, { status: 400 });
  const product = await getShopProductBySlugServer(slug);
  if (!product) return NextResponse.json({ groups: [] }, { status: 404 });
  const fitment = extractProductFitment(product);
  const canRecommend =
    !isExcludedFromCrossShop(product) && Boolean(fitment.make || fitment.chassisCodes.length);
  const candidateProducts = canRecommend
    ? (() => {
        const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
        return isShopCatalogReaderRequestEnabled(
          reader,
          request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER)
        )
          ? getShopRecommendationProductsForFitmentServer(fitment, product.id)
          : getShopRecommendationProductsServer();
      })()
    : Promise.resolve([]);
  const groups = !canRecommend
    ? []
    : findCrossShopFitmentMatches(product, await candidateProducts, {
        perBrand: 3,
        totalLimit: 24,
      });
  // Only public catalog card data; personalized pricing remains in the client.
  return NextResponse.json(
    { fitment, groups },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    }
  );
}
