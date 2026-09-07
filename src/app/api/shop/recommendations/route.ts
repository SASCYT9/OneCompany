import { NextRequest, NextResponse } from "next/server";
import { extractProductFitment, isExcludedFromCrossShop } from "@/lib/crossShopFitment";
import { findCrossShopFitmentMatches } from "@/lib/crossShopFitment.server";
import {
  getShopProductBySlugServer,
  getShopRecommendationProductsServer,
} from "@/lib/shopCatalogServer";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug || slug.length > 300) return NextResponse.json({ groups: [] }, { status: 400 });
  const product = await getShopProductBySlugServer(slug);
  if (!product) return NextResponse.json({ groups: [] }, { status: 404 });
  const fitment = extractProductFitment(product);
  const groups =
    isExcludedFromCrossShop(product) || (!fitment.make && !fitment.chassisCodes.length)
      ? []
      : findCrossShopFitmentMatches(product, await getShopRecommendationProductsServer(), {
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
