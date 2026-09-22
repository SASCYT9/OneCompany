import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { MonobankError } from "@/lib/shopMonobank";
import { prepareMonobankPayment, refreshMonobankPayment } from "@/lib/shopMonobankPayments";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  let body: { token?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const session = await getCurrentShopCustomerSession();
  if (!token && !session?.customerId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderNumber } = await params;
  const order = await prisma.shopOrder.findFirst({
    where: { orderNumber, ...(token ? { viewToken: token } : { customerId: session!.customerId }) },
    include: { monobankPayment: true },
  });
  if (!order || order.paymentMethod !== "MONOBANK")
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  try {
    if (order.monobankPayment?.invoiceId)
      await refreshMonobankPayment(prisma, order.monobankPayment);
    const redirectUrl = await prepareMonobankPayment(
      prisma,
      order.id,
      body.locale === "ua" ? "ua" : "en"
    );
    return NextResponse.json({ redirectUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof MonobankError ? error.code : "MONOBANK_PAYMENT_UNAVAILABLE";
    console.error("[Monobank payment]", code);
    return NextResponse.json({ error: code }, { status: 409 });
  }
}
