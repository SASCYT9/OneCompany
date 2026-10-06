import { NextResponse } from "next/server";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";

export async function GET() {
  const settings = await getPublicShopSettingsRuntime();
  // Every storefront page refreshes rates on load and focus. Serve that from the
  // CDN; rates change daily and checkout always verifies a fresh server quote.
  return NextResponse.json(
    {
      currencyRates: settings.currencyRates,
      currencyRatesDate: settings.currencyRatesDate ?? null,
      updatedAt: settings.updatedAt,
    },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } }
  );
}
