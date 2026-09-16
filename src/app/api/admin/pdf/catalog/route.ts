import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import {
  catalogBrochureContentDisposition,
  catalogBrochurePrice,
  validateCatalogBrochureRequest,
  type CatalogBrochureRequest,
} from "@/lib/admin/catalogBrochure";
import { catalogImageSources } from "@/lib/admin/catalogImageSources";
import { getBrandLogo } from "@/lib/brandLogos";
import { prisma } from "@/lib/prisma";

function decimal(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function editorialExcerpt(value: string | null | undefined, fallback: string, maxLength = 360) {
  const normalized = value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  const slice = normalized.slice(0, maxLength + 1);
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  if (lastSentence >= Math.floor(maxLength * 0.55)) return slice.slice(0, lastSentence + 1).trim();
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`;
}

function localizedProductText(
  product: {
    brand: string | null;
    titleUa: string;
    titleEn: string;
    shortDescUa: string | null;
    shortDescEn: string | null;
    longDescUa: string | null;
    longDescEn: string | null;
  },
  language: CatalogBrochureRequest["language"]
) {
  const brand = product.brand?.trim() || "OneCompany";
  if (language === "en") {
    const title = product.titleEn || product.titleUa;
    return {
      title,
      description: editorialExcerpt(
        product.longDescEn || product.shortDescEn || product.longDescUa || product.shortDescUa,
        `${brand} presents ${title}. Compatibility and final configuration are confirmed by a manager.`
      ),
    };
  }
  // The catalog currently stores Ukrainian and English editorial copy. Until Russian
  // copy is added to the product editor, Russian documents use the Ukrainian source text.
  const title = product.titleUa || product.titleEn;
  const fallback =
    language === "ru"
      ? `${brand} — премиальная позиция ${title}. Совместимость и итоговую комплектацию подтвердит менеджер.`
      : `${brand} — преміальна позиція ${title}. Сумісність та остаточну комплектацію підтвердить менеджер.`;
  return {
    title,
    description: editorialExcerpt(
      product.longDescUa || product.shortDescUa || product.longDescEn || product.shortDescEn,
      fallback
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const body = (await request.json()) as unknown;
    const error = validateCatalogBrochureRequest(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const input = body as CatalogBrochureRequest;
    const ids = input.items.map((item) => item.productId);
    const products = await prisma.shopProduct.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        brand: true,
        titleUa: true,
        titleEn: true,
        shortDescUa: true,
        shortDescEn: true,
        longDescUa: true,
        longDescEn: true,
        image: true,
        gallery: true,
        priceEur: true,
        priceUsd: true,
        priceUah: true,
        media: {
          where: { mediaType: "IMAGE" },
          orderBy: { position: "asc" },
          take: 8,
          select: { src: true },
        },
        variants: {
          orderBy: [{ isDefault: "desc" }, { position: "asc" }],
          take: 1,
          select: { image: true, priceEur: true, priceUsd: true, priceUah: true },
        },
      },
    });
    if (products.length !== ids.length) {
      return NextResponse.json(
        { error: "Один або кілька товарів більше недоступні." },
        { status: 409 }
      );
    }

    const selectedBrand = input.brandName?.trim() || products[0]?.brand?.trim() || "";
    const brandLogoSrc =
      input.branding === "brand" && selectedBrand ? getBrandLogo(selectedBrand) : null;
    if (
      input.branding === "brand" &&
      (!brandLogoSrc || brandLogoSrc === "/branding/one-company-logo.svg")
    ) {
      return NextResponse.json(
        { error: "Для вибраного бренду не знайдено логотип у медіа-каталозі." },
        { status: 409 }
      );
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const items = input.items.map((entry) => {
      const product = byId.get(entry.productId)!;
      const variant = product.variants[0] ?? null;
      const localized = localizedProductText(product, input.language);
      const gallery = Array.isArray(product.gallery)
        ? product.gallery.filter((value): value is string => typeof value === "string")
        : [];
      const imageSources = catalogImageSources([
        product.image,
        ...product.media.map((media) => media.src),
        variant?.image,
        ...gallery,
      ]);
      const requestedImage = catalogImageSources([entry.imageSource])[0] ?? null;
      const selectedImage =
        requestedImage && imageSources.includes(requestedImage)
          ? requestedImage
          : (imageSources[0] ?? null);
      const orderedImageSources = selectedImage
        ? [selectedImage, ...imageSources.filter((source) => source !== selectedImage)]
        : imageSources;
      const canonicalPrice = catalogBrochurePrice(
        {
          priceEur: decimal(variant?.priceEur) ?? decimal(product.priceEur),
          priceUsd: decimal(variant?.priceUsd) ?? decimal(product.priceUsd),
          priceUah: decimal(variant?.priceUah) ?? decimal(product.priceUah),
        },
        input.currency
      );
      const price = entry.priceOverride == null ? canonicalPrice : entry.priceOverride;
      return {
        title: localized.title,
        description: localized.description,
        sku: product.sku,
        brand: product.brand,
        image: selectedImage,
        imageSources: orderedImageSources,
        price,
      };
    });

    const { renderCatalogBrochurePdf } = await import("@/lib/admin/catalogBrochurePdf");
    const pdf = await renderCatalogBrochurePdf({
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      language: input.language,
      currency: input.currency,
      layout: input.layout,
      branding: input.branding,
      brandLogoSrc,
      showPrice: input.showPrice,
      generatedAt: new Date(),
      items,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": catalogBrochureContentDisposition(input.title),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin catalog PDF render failed", error);
    return NextResponse.json({ error: "Не вдалося сформувати PDF каталогу." }, { status: 500 });
  }
}
