import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import {
  buildShopSettingsRuntimeFromPayload,
  normalizeShopSettingsPayload,
  type ShopCurrencyCode,
} from "@/lib/shopAdminSettings";
import { buildCheckoutSettingsPreview } from "@/lib/shopCheckout";

type PreviewRequestBody = {
  settings?: unknown;
  preview?: {
    currency?: string;
    subtotal?: number;
    itemCount?: number;
    items?: Array<{
      total?: number;
      quantity?: number;
      pricingBaseRegion?: "default" | "europe";
      brandName?: string | null;
      weightKg?: number | null;
      length?: number | null;
      width?: number | null;
      height?: number | null;
      shippingToUaUsd?: number | null;
    }>;
    shippingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      region?: string;
      postcode?: string;
      country?: string;
    };
  };
};

function normalizePreviewCurrency(value: unknown, fallback: ShopCurrencyCode) {
  const normalized = String(value ?? fallback)
    .trim()
    .toUpperCase();
  return (["EUR", "USD", "UAH"] as const).includes(normalized as ShopCurrencyCode)
    ? (normalized as ShopCurrencyCode)
    : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const body = (await request.json().catch(() => ({}))) as PreviewRequestBody;
    const payload = normalizeShopSettingsPayload(body.settings ?? {});
    const settings = buildShopSettingsRuntimeFromPayload(payload);
    const preview = body.preview ?? {};
    const shippingAddress = preview.shippingAddress ?? {};

    const quote = buildCheckoutSettingsPreview(settings, {
      currency: normalizePreviewCurrency(preview.currency, settings.defaultCurrency),
      subtotal: Number(preview.subtotal ?? 0),
      itemCount: Number(preview.itemCount ?? 1),
      items: Array.isArray(preview.items)
        ? preview.items.map((item) => ({
            total: Number(item.total ?? 0),
            quantity: Number(item.quantity ?? 1),
            pricingBaseRegion: item.pricingBaseRegion === "europe" ? "europe" : "default",
            brandName: item.brandName ?? null,
            weightKg: item.weightKg == null ? null : Number(item.weightKg),
            length: item.length == null ? null : Number(item.length),
            width: item.width == null ? null : Number(item.width),
            height: item.height == null ? null : Number(item.height),
            shippingToUaUsd: item.shippingToUaUsd == null ? null : Number(item.shippingToUaUsd),
          }))
        : undefined,
      shippingAddress: {
        line1: String(shippingAddress.line1 ?? "Preview line 1").trim() || "Preview line 1",
        line2: String(shippingAddress.line2 ?? "").trim() || undefined,
        city: String(shippingAddress.city ?? "Kyiv").trim() || "Kyiv",
        region: String(shippingAddress.region ?? "").trim() || undefined,
        postcode: String(shippingAddress.postcode ?? "").trim() || undefined,
        country: String(shippingAddress.country ?? "Ukraine").trim() || "Ukraine",
      },
    });

    return NextResponse.json(quote);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin shop settings preview", error);
    return NextResponse.json({ error: "Failed to build settings preview" }, { status: 500 });
  }
}
