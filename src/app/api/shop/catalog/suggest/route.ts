import { NextRequest, NextResponse } from "next/server";

import {
  resolveShopCatalogReaderFlag,
  isShopCatalogReaderRequestEnabled,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import { queryShopCatalogSuggestions } from "@/lib/shopCatalogSuggestion.server";
import { observeShopCatalogRead, shopCatalogServerTiming } from "@/lib/shopCatalogReadTelemetry";

export async function GET(request: NextRequest) {
  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  if (!isShopCatalogReaderRequestEnabled(reader, request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER))) {
    return NextResponse.json({ error: "Not found", data: [] }, { status: 404 });
  }
  const params = request.nextUrl.searchParams;
  try {
    const locale = params.get("locale") === "en" ? "en" : "ua";
    const filters = { text: params.get("q") ?? "", scope: params.get("scope") };
    const read = await observeShopCatalogRead({
      operation: "suggestions",
      locale,
      filters,
      databaseQueriesUpperBound: 3,
      rows: (value) => value.length,
      execute: () => queryShopCatalogSuggestions({ locale, query: filters.text, scope: filters.scope }),
    });
    return NextResponse.json(
      { data: read.value },
      { headers: { "Cache-Control": "private, no-store, max-age=0", "Server-Timing": shopCatalogServerTiming(read.metric) } }
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json({ error: error.message, data: [] }, { status: 400 });
    }
    console.error("Catalog V2 suggestion query failed", error);
    return NextResponse.json({ error: "Suggestion query failed", data: [] }, { status: 500 });
  }
}

export const runtime = "nodejs";
