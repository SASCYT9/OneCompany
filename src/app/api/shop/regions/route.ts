/**
 * GET /api/shop/regions?country=DE&locale=ua
 * States / regions / oblasts the checkout offers for one country.
 */
import { NextRequest, NextResponse } from "next/server";
import { getShopCountryRegions } from "@/lib/shopCountryRegions.server";

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(country)) {
    return NextResponse.json({ error: "country must be an ISO 3166-1 alpha-2 code" }, { status: 400 });
  }
  const locale = req.nextUrl.searchParams.get("locale") === "ua" ? "ua" : "en";
  return NextResponse.json(
    { regions: getShopCountryRegions(country, locale) },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" } }
  );
}
