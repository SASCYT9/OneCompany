/**
 * POST /api/shop/forged/quote-request
 *
 * Public endpoint that turns a configurator submission into a draft
 * order (`ShopOrder.isDraft = true`) and notifies operations + the
 * customer.
 *
 * Why a draft order rather than a separate model:
 *   - The existing draft/quote machinery already handles tokens,
 *     expiry, customer-facing /quote/<token> endpoint, and the
 *     /admin/shop/drafts UI.
 *   - We discriminate forged orders by stamping
 *     `pricingSnapshot.kind === "forged-config"`. Reports and admin
 *     filters can branch on that without a Prisma migration.
 */

import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { fireEmailTrigger } from "@/lib/shopEmailEngine";
import { findForgedDesign, FORGED_BRAND_NAME } from "@/data/forgedDesigns";
import { estimateForgedSetPriceEur } from "@/lib/forged/pricing";
import { leadTimeFromConfig } from "@/lib/forged/leadTime";
import { validateQuoteRequest, type QuoteRequestPayload } from "@/lib/forged/configSchema";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";

export const runtime = "nodejs";

function tokenHex(): string {
  return randomBytes(24).toString("hex");
}

function generateOrderNumber(): string {
  // OF-<yyyymmdd>-<6-hex>; "OF" denotes One Company Forged
  const d = new Date();
  const ymd =
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  return `OF-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function ipHashFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  let body: Partial<QuoteRequestPayload> = {};
  try {
    body = (await req.json()) as Partial<QuoteRequestPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errs = validateQuoteRequest(body);
  if (errs.length > 0) {
    return NextResponse.json({ error: "Validation failed", errors: errs }, { status: 400 });
  }

  const payload = body as QuoteRequestPayload;
  const config = payload.config;
  const design = findForgedDesign(config.designSlug);
  if (!design) {
    return NextResponse.json({ error: "Unknown design" }, { status: 400 });
  }

  // Augment consent with server-side audit data
  const consent = {
    ...config.replicaConsent!,
    ipHashSha256Truncated: ipHashFromRequest(req),
  };

  const priceEur = estimateForgedSetPriceEur({
    designSlug: config.designSlug,
    diameter: config.diameter,
    widthFront: config.widthFront,
    widthRear: config.widthRear,
    material: config.material,
  });
  const leadRange = leadTimeFromConfig(config);

  const designName = design.nameEn;
  const isStaggered = config.widthFront !== config.widthRear;
  const halfPrice = Math.round((priceEur ?? 0) / 2);

  // Build line items: split staggered fitments into front/rear pairs so
  // operators see the line breakdown they expect in /admin/shop/drafts.
  const items = isStaggered
    ? [
        {
          productSlug: `forged-${design.slug}-front`,
          title: `${designName} — Front pair (${config.diameter}″ × ${config.widthFront}J ET${config.etFront})`,
          quantity: 1,
          price: halfPrice,
          total: halfPrice,
        },
        {
          productSlug: `forged-${design.slug}-rear`,
          title: `${designName} — Rear pair (${config.diameter}″ × ${config.widthRear}J ET${config.etRear})`,
          quantity: 1,
          price: halfPrice,
          total: halfPrice,
        },
      ]
    : [
        {
          productSlug: `forged-${design.slug}`,
          title: `${designName} — Set of 4 (${config.diameter}″ × ${config.widthFront}J ET${config.etFront})`,
          quantity: 1,
          price: priceEur ?? 0,
          total: priceEur ?? 0,
        },
      ];

  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const draftQuoteToken = tokenHex();
  const viewToken = tokenHex();
  const orderNumber = generateOrderNumber();
  const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const pricingSnapshot = {
    kind: "forged-config" as const,
    brand: FORGED_BRAND_NAME,
    designSlug: design.slug,
    designName,
    designFamily: design.family,
    isReplicaStyle: design.isReplicaStyle,
    estimateEur: priceEur,
    leadTimeWeeks: leadRange,
    config: {
      diameter: config.diameter,
      widthFront: config.widthFront,
      widthRear: config.widthRear,
      pcd: config.pcd,
      etFront: config.etFront,
      etRear: config.etRear,
      centreBore: config.centreBore,
      centreBoreCustom: config.centreBoreCustom,
      material: config.material,
      finish: config.finish,
      primaryColor: config.primaryColor,
      accentColor: config.accentColor,
      ocMonogramEngraving: config.ocMonogramEngraving,
      customerNote: config.customerNote,
      carPreviewMode: config.carPreviewMode,
      carLibrarySlug: config.carLibrarySlug,
      carPhotoUrl: config.carPhotoUrl,
    },
    replicaConsent: consent,
    submittedAt: new Date().toISOString(),
  };

  const internalNote = [
    `[forged-config] ${designName}`,
    `${config.diameter}″ ${config.widthFront}J/${config.widthRear}J ${config.pcd} ET${config.etFront}/${config.etRear}`,
    `Material: ${config.material}, finish: ${config.finish}, primary: ${config.primaryColor}${config.accentColor ? `, accent: ${config.accentColor}` : ""}`,
    config.carLibrarySlug ? `Car: library/${config.carLibrarySlug}` : "",
    config.carPhotoUrl ? `Car photo: ${config.carPhotoUrl}` : "",
    config.customerNote ? `Customer note: ${config.customerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let draft;
  try {
    draft = await prisma.shopOrder.create({
      data: {
        orderNumber,
        viewToken,
        status: "PENDING_REVIEW",
        email: payload.customer.email,
        customerName: payload.customer.fullName,
        phone: payload.customer.phone ?? null,
        customerGroupSnapshot: "B2C",
        currency: "EUR",
        subtotal,
        shippingCost: 0,
        taxAmount: 0,
        total: subtotal,
        shippingAddress: {} as object,

        ...({
          isDraft: true,
          draftQuoteToken,
          draftValidUntil: validUntil,
          internalNote,
          pricingSnapshot: pricingSnapshot as unknown as object,
        } as Record<string, unknown>),
        items: {
          create: items.map((it) => ({
            productSlug: it.productSlug,
            title: it.title,
            quantity: it.quantity,
            price: it.price,
            total: it.total,
          })),
        },
      },
    });
  } catch (e) {
    console.error("[forged] Draft create failed:", e);
    return NextResponse.json({ error: "Failed to record quote request" }, { status: 500 });
  }

  // Fire QUOTE_SENT to the customer (best-effort; failure must NOT block
  // the success path because the draft has already been created).
  try {
    await fireEmailTrigger("QUOTE_SENT", {
      recipient: payload.customer.email,
      currency: "EUR",
      orderTotal: Number(subtotal),
      entityType: "shop.order",
      entityId: draft.id,
      variables: {
        customerName: payload.customer.fullName,
        orderNumber,
        designName,
        diameter: config.diameter,
        material: config.material,
        finish: config.finish,
        estimateEur: priceEur ?? "",
        leadTimeMinWeeks: leadRange?.weeksMin ?? "",
        leadTimeMaxWeeks: leadRange?.weeksMax ?? "",
        quoteToken: draftQuoteToken,
        quoteUrl: `https://onecompany.global/${payload.locale ?? "en"}/shop/forged/quote/${draftQuoteToken}`,
      },
    });
  } catch (e) {
    console.error("[forged] QUOTE_SENT trigger failed (non-fatal):", e);
  }

  // Notify operations
  try {
    const settingsRecord = await getOrCreateShopSettings(prisma);
    const runtimeSettings = getShopSettingsRuntime(settingsRecord);
    const opsEmail = runtimeSettings.orderNotificationEmail;
    if (opsEmail) {
      await fireEmailTrigger("QUOTE_SENT", {
        recipient: opsEmail,
        currency: "EUR",
        orderTotal: Number(subtotal),
        entityType: "shop.order",
        entityId: draft.id,
        variables: {
          customerName: payload.customer.fullName,
          customerEmail: payload.customer.email,
          orderNumber,
          designName,
          adminUrl: `https://onecompany.global/admin/shop/drafts/${draft.id}`,
          internalNote,
        },
      });
    }
  } catch (e) {
    console.error("[forged] Ops notification failed (non-fatal):", e);
  }

  return NextResponse.json({
    id: draft.id,
    orderNumber,
    draftQuoteToken,
    estimateEur: priceEur,
  });
}
