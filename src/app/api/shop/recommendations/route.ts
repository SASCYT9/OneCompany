import { NextRequest, NextResponse } from "next/server";
import { loadCrossShopRecommendations } from "@/lib/crossShopRecommendations.server";
import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug || slug.length > 300) return NextResponse.json({ groups: [] }, { status: 400 });
  const product = await getShopProductBySlugServer(slug);
  if (!product) return NextResponse.json({ groups: [] }, { status: 404 });
  const { fitment, groups } = await loadCrossShopRecommendations(
    product,
    request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER)
  );
  // Only public catalog card data; personalized pricing remains in the client.
  return NextResponse.json(
    { fitment, groups },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    }
  );
}
