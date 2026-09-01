import { NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { prisma } from "@/lib/prisma";
import { loadShopBrandDiscountMaps } from "@/lib/shopPricingContext.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentShopCustomerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (session.group !== "B2B_APPROVED") {
    return NextResponse.json(
      { customerId: session.customerId, system: [], customer: [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const maps = await loadShopBrandDiscountMaps(prisma, session.customerId, session.group);
  const serialize = (values: ReadonlyMap<string, number> | undefined) =>
    [...(values ?? new Map()).entries()]
      .map(([brand, discountPct]) => ({ brand, discountPct }))
      .sort((left, right) => left.brand.localeCompare(right.brand, "en"));

  return NextResponse.json(
    {
      customerId: session.customerId,
      system: serialize(maps?.systemBrandDiscountMap),
      customer: serialize(maps?.customerBrandDiscountMap),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
