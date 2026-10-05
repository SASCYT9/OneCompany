import { NextResponse } from "next/server";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";

export async function GET() {
  const settings = await getPublicShopSettingsRuntime();
  return NextResponse.json({ currencyRates: settings.currencyRates, currencyRatesDate: settings.currencyRatesDate ?? null, updatedAt: settings.updatedAt }, { headers: { "Cache-Control": "no-store" } });
}
