import type { NextRequest } from "next/server";
import { searchShopStock } from "@/lib/shopStockSearch.server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return searchShopStock(request);
}
