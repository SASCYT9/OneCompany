import { NextRequest, NextResponse } from "next/server";

import {
  resolveShopCatalogReaderFlag,
  isShopCatalogReaderRequestEnabled,
  SHOP_CATALOG_V2_READER_MODE_ENV,
} from "@/lib/shopCatalogReaderFlag.server";
import { SHOP_CATALOG_CANARY_REQUEST_HEADER } from "@/lib/shopCatalogCanary";
import { queryShopCatalogSuggestions } from "@/lib/shopCatalogSuggestion.server";

export async function GET(request: NextRequest) {
  const reader = resolveShopCatalogReaderFlag(process.env[SHOP_CATALOG_V2_READER_MODE_ENV]);
  if (!isShopCatalogReaderRequestEnabled(reader, request.headers.get(SHOP_CATALOG_CANARY_REQUEST_HEADER))) {
    return NextResponse.json({ error: "Not found", data: [] }, { status: 404 });
  }
  const params = request.nextUrl.searchParams;
  try {
    const data = await queryShopCatalogSuggestions({
      locale: params.get("locale") === "en" ? "en" : "ua",
      query: params.get("q") ?? "",
      scope: params.get("scope"),
    });
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
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
