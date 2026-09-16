import { catalogBrochurePrice, type CatalogBrochureRequest } from "./catalogBrochure";
import { catalogImageSources } from "./catalogImageSources";
import type { CatalogBrochurePdfInput } from "./catalogBrochurePdf";
import { getBrandLogo } from "../brandLogos";
import { prisma } from "../prisma";

export type CatalogBrochureSnapshot = Omit<CatalogBrochurePdfInput, "generatedAt"> & {
  generatedAt: string;
};

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

function technicalDescription(
  product: {
    brand: string | null;
    sku: string | null;
    knowledge: null | {
      material: string | null;
      powerGainHp: number | null;
      torqueGainNm: number | null;
      installationType: string | null;
      makes: string[];
      models: string[];
      chassisCodes: string[];
    };
  },
  language: CatalogBrochureRequest["language"],
  fallback: string
) {
  const knowledge = product.knowledge;
  if (!knowledge) return fallback;
  const separator = " · ";
  const rows = [
    product.brand,
    knowledge.material,
    knowledge.makes.slice(0, 2).join(", "),
    knowledge.models.slice(0, 3).join(", "),
    knowledge.chassisCodes.slice(0, 4).join(", "),
    knowledge.powerGainHp ? `+${knowledge.powerGainHp} hp` : null,
    knowledge.torqueGainNm ? `+${knowledge.torqueGainNm} Nm` : null,
    knowledge.installationType,
  ].filter((value): value is string => Boolean(value?.trim()));
  if (!rows.length) return fallback;
  const prefix =
    language === "en"
      ? "Technical specification"
      : language === "ru"
        ? "Техническая конфигурация"
        : "Технічна конфігурація";
  return `${prefix}: ${rows.join(separator)}.`;
}

export function snapshotToPdfInput(snapshot: CatalogBrochureSnapshot): CatalogBrochurePdfInput {
  return { ...snapshot, generatedAt: new Date(snapshot.generatedAt) };
}

export async function resolveCatalogBrochureSnapshot(
  input: CatalogBrochureRequest,
  generatedAt = new Date()
): Promise<CatalogBrochureSnapshot> {
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
      knowledge: {
        select: {
          material: true,
          powerGainHp: true,
          torqueGainNm: true,
          installationType: true,
          makes: true,
          models: true,
          chassisCodes: true,
        },
      },
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
  if (products.length !== ids.length) throw new Error("CATALOG_PRODUCTS_UNAVAILABLE");

  const selectedBrand = input.brandName?.trim() || products[0]?.brand?.trim() || "";
  const brandLogoSrc =
    input.branding === "brand" && selectedBrand ? getBrandLogo(selectedBrand) : null;
  if (
    input.branding === "brand" &&
    (!brandLogoSrc || brandLogoSrc === "/branding/one-company-logo.svg")
  ) {
    throw new Error("CATALOG_BRAND_LOGO_MISSING");
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
    const requestedImages = entry.imageSources
      ? catalogImageSources(entry.imageSources).filter((source) => imageSources.includes(source))
      : [];
    const legacySelectedImage =
      requestedImage && imageSources.includes(requestedImage) ? requestedImage : null;
    const orderedImageSources = entry.imageSources
      ? requestedImages
      : legacySelectedImage
        ? [legacySelectedImage, ...imageSources.filter((source) => source !== legacySelectedImage)]
        : imageSources;
    const selectedImage = orderedImageSources[0] ?? imageSources[0] ?? null;
    const canonicalPrice = catalogBrochurePrice(
      {
        priceEur: decimal(variant?.priceEur) ?? decimal(product.priceEur),
        priceUsd: decimal(variant?.priceUsd) ?? decimal(product.priceUsd),
        priceUah: decimal(variant?.priceUah) ?? decimal(product.priceUah),
      },
      input.currency
    );
    const descriptionMode = entry.descriptionMode ?? "inherit";
    const description =
      descriptionMode === "custom" && entry.descriptionOverride?.trim()
        ? entry.descriptionOverride.trim()
        : descriptionMode === "technical"
          ? technicalDescription(product, input.language, localized.description)
          : localized.description;
    const allowedSources = new Set(orderedImageSources.length ? orderedImageSources : imageSources);
    const imageEdits = (entry.imageEdits ?? []).filter((edit) => allowedSources.has(edit.source));
    return {
      title: entry.titleOverride?.trim() || localized.title,
      description,
      sku: product.sku,
      brand: product.brand,
      image: selectedImage,
      imageSources: orderedImageSources.length ? orderedImageSources : imageSources.slice(0, 1),
      galleryLayout: entry.galleryLayout ?? "auto",
      pageTemplate: entry.pageTemplate ?? "editorial",
      descriptionMode,
      showSku: entry.showSku ?? true,
      showBrand: entry.showBrand ?? true,
      showPrice: entry.showPrice ?? true,
      imageEdits,
      price: entry.priceOverride == null ? canonicalPrice : entry.priceOverride,
    };
  });

  return {
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    language: input.language,
    currency: input.currency,
    layout: input.layout,
    photoMode: input.photoMode ?? "gallery",
    descriptionMode: input.descriptionMode ?? "full",
    branding: input.branding,
    brandLogoSrc,
    showPrice: input.showPrice,
    clientName: input.clientName?.trim() || null,
    clientCompany: input.clientCompany?.trim() || null,
    managerName: input.managerName?.trim() || null,
    managerPhone: input.managerPhone?.trim() || null,
    managerEmail: input.managerEmail?.trim() || null,
    personalNote: input.personalNote?.trim() || null,
    validUntil: input.validUntil?.trim() || null,
    showContactPage: input.showContactPage ?? false,
    generatedAt: generatedAt.toISOString(),
    items,
  };
}
