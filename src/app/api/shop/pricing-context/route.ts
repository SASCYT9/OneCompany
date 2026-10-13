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

  // The viewer's own pricing identity. An admin "log in as customer" overlay
  // is invisible to the client-side NextAuth session, so the storefront hook
  // takes group and discount from here while impersonating.
  const viewer = {
    customerId: session.customerId,
    group: session.group,
    b2bDiscountPercent: session.b2bDiscountPercent,
    impersonating: Boolean(session.impersonator),
  };

  if (session.group !== "B2B_APPROVED") {
    return NextResponse.json(
      { ...viewer, system: [], customer: [] },
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
      ...viewer,
      system: serialize(maps?.systemBrandDiscountMap),
      customer: serialize(maps?.customerBrandDiscountMap),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
