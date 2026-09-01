import { NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { prisma } from "@/lib/prisma";

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

  const [system, customer] = await Promise.all([
    prisma.shopBrandB2bDiscount.findMany({
      select: { brand: true, discountPct: true },
      orderBy: { brand: "asc" },
    }),
    prisma.shopCustomerBrandDiscount.findMany({
      where: { customerId: session.customerId },
      select: { brand: true, discountPct: true },
      orderBy: { brand: "asc" },
    }),
  ]);

  return NextResponse.json(
    {
      customerId: session.customerId,
      system: system.map((row) => ({ brand: row.brand, discountPct: Number(row.discountPct) })),
      customer: customer.map((row) => ({ brand: row.brand, discountPct: Number(row.discountPct) })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
