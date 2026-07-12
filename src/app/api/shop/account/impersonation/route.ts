import { NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";

export async function GET() {
  const session = await getCurrentShopCustomerSession();
  if (!session?.impersonator) {
    return NextResponse.json({ active: false }, { status: 404 });
  }

  return NextResponse.json({
    active: true,
    customerEmail: session.email,
    customerName: session.name,
    adminEmail: session.impersonator.email,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
