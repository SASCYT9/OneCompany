import { convertProforma } from "@/lib/admin/proformaCalculation";
import {
  getProformaRecipient,
  localizeProformaRecipient,
  localizeProformaCountry,
} from "@/lib/admin/proformaRecipients";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { renderOrderProforma } from "@/lib/admin/orderProforma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_READ);
    const { orderId } = await params;
    const [order, seller] = await Promise.all([
      prisma.shopOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          customer: { select: { companyName: true, vatNumber: true } },
        },
      }),
      prisma.shopSettings.findUnique({
        where: { key: "shop" },
        select: {
          currencyRates: true,
          fopCompanyName: true,
          fopIban: true,
          fopBankName: true,
          fopEdrpou: true,
          fopDetails: true,
          appCompanyName: true,
          appAddress: true,
          appContactEmail: true,
          appContactPhone: true,
        },
      }),
    ]);
    if (!order) return new NextResponse("Order not found", { status: 404 });
    const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "ua";
    const recipientId = request.nextUrl.searchParams.get("recipient");
    const recipient = getProformaRecipient(recipientId);
    if (recipientId && !recipient)
      return new NextResponse("Recipient not available", { status: 400 });
    const translatedRecipient = recipient ? localizeProformaRecipient(recipient, locale) : null;
    const selectedSeller = {
      ...seller,
      appAddress: localizeProformaCountry(seller?.appAddress, locale),
      fopCompanyName: translatedRecipient?.legalName ?? null,
      fopIban: recipient?.iban ?? null,
      fopEdrpou: recipient?.code ?? null,
      fopBankName: translatedRecipient?.bank ?? null,
      fopDetails: null,
      paymentPurpose: recipient?.purpose ?? null,
    };
    const targetCurrency = request.nextUrl.searchParams.get("currency") || order.currency;
    let displayOrder;
    try {
      displayOrder = convertProforma(
        {
          ...order,
          subtotal: Number(order.subtotal),
          shippingCost: Number(order.shippingCost),
          taxAmount: Number(order.taxAmount),
          total: Number(order.total),
          items: order.items.map((item) => ({
            ...item,
            price: Number(item.price),
            total: Number(item.total),
          })),
        },
        targetCurrency,
        seller?.currencyRates
      );
    } catch {
      return new NextResponse("Currency or exchange rate unavailable", { status: 400 });
    }
    if (request.nextUrl.searchParams.get("format") === "pdf") {
      if (!recipient) return new NextResponse("Choose a recipient first", { status: 400 });
      const { renderOrderProformaPdf } = await import("@/lib/admin/orderProformaPdf");
      const pdf = await renderOrderProformaPdf(displayOrder, selectedSeller, locale);
      const filename = `proforma-${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}-${targetCurrency}.pdf`;
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const html = renderOrderProforma(displayOrder, selectedSeller, locale, recipient?.id ?? null);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return new NextResponse("Unauthorized", { status: 401 });
    if (message === "FORBIDDEN") return new NextResponse("Forbidden", { status: 403 });
    console.error("Proforma render failed", error);
    return new NextResponse("Failed to render proforma", { status: 500 });
  }
}
