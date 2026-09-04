"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, Plus, Save, Trash2, Wand2 } from "lucide-react";

import {
  AdminEditorSection,
  AdminInlineAlert,
  AdminPage,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { AdminCollapsibleSection } from "@/components/admin/AdminCollapsibleSection";
import { AdminEditorTopBar } from "@/components/admin/AdminEditorTopBar";
import {
  AdminCheckboxField as CheckboxField,
  AdminInputField as InputField,
  AdminSelectField as SelectField,
  AdminTextareaField as TextareaField,
} from "@/components/admin/AdminFormFields";
import styles from "./productEditor.module.css";
import { stripStorefrontTags, type ShopProductStorefront } from "@/lib/shopProductStorefront";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { AdminActivityTimeline } from "@/components/admin/AdminActivityTimeline";
import { AdminNotes } from "@/components/admin/AdminNotes";
import { AdminTagInput } from "@/components/admin/AdminTagInput";
import { AdminProductVariantCard } from "./AdminProductVariantCard";
import { ProductMediaUpload } from "./ProductMediaUpload";
import { productEditorSlug as slugify } from "@/lib/admin/productEditorSlug";

type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type ProductMediaType = "IMAGE" | "VIDEO" | "EXTERNAL_VIDEO";
type InventoryPolicy = "DENY" | "CONTINUE";
type ProductStorefront = ShopProductStorefront;

type MediaFormItem = {
  id?: string;
  src: string;
  altText: string;
  position: string;
  mediaType: ProductMediaType;
};

type OptionFormItem = {
  id?: string;
  name: string;
  position: string;
  valuesText: string;
};

type VariantFormItem = {
  id?: string;
  title: string;
  sku: string;
  position: string;
  option1Value: string;
  option1LinkedTo: string;
  option2Value: string;
  option2LinkedTo: string;
  option3Value: string;
  option3LinkedTo: string;
  grams: string;
  inventoryTracker: string;
  inventoryQty: string;
  inventoryPolicy: InventoryPolicy;
  fulfillmentService: string;
  priceEur: string;
  priceEurEurope: string;
  priceUsd: string;
  priceUah: string;
  priceEurB2b: string;
  priceUsdB2b: string;
  priceUahB2b: string;
  compareAtEur: string;
  compareAtUsd: string;
  compareAtUah: string;
  compareAtEurB2b: string;
  compareAtUsdB2b: string;
  compareAtUahB2b: string;
  requiresShipping: boolean;
  taxable: boolean;
  barcode: string;
  image: string;
  weightUnit: string;
  taxCode: string;
  costPerItem: string;
  isDefault: boolean;
  weight: string;
  length: string;
  width: string;
  height: string;
  isDimensionsEstimated: boolean;
};

type MetafieldFormItem = {
  id?: string;
  namespace: string;
  key: string;
  value: string;
  valueType: string;
};

type CollectionOption = {
  id: string;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand: string | null;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: number;
  productsCount?: number;
};

type CategoryOption = {
  id: string;
  slug: string;
  titleUa: string;
  titleEn: string;
  isPublished: boolean;
  sortOrder: number;
  parent: {
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
  } | null;
  productsCount?: number;
  childrenCount?: number;
};

type VariantBulkState = {
  inventoryQty: string;
  priceEur: string;
  priceEurEurope: string;
  priceUsd: string;
  priceUah: string;
  priceEurB2b: string;
  priceUsdB2b: string;
  priceUahB2b: string;
  compareAtEur: string;
  compareAtUsd: string;
  compareAtUah: string;
  compareAtEurB2b: string;
  compareAtUsdB2b: string;
  compareAtUahB2b: string;
  image: string;
};

type ProductFormState = {
  slug: string;
  sku: string;
  scope: "auto" | "moto";
  storefront: ProductStorefront;
  brand: string;
  vendor: string;
  productType: string;
  productCategory: string;
  categoryId: string;
  tagsText: string;
  collectionIds: string[];
  status: ProductStatus;
  titleUa: string;
  titleEn: string;
  categoryUa: string;
  categoryEn: string;
  shortDescUa: string;
  shortDescEn: string;
  longDescUa: string;
  longDescEn: string;
  bodyHtmlUa: string;
  bodyHtmlEn: string;
  leadTimeUa: string;
  leadTimeEn: string;
  stock: "inStock" | "preOrder";
  collectionUa: string;
  collectionEn: string;
  priceEur: string;
  priceEurEurope: string;
  priceUsd: string;
  priceUah: string;
  priceEurB2b: string;
  priceUsdB2b: string;
  priceUahB2b: string;
  compareAtEur: string;
  compareAtUsd: string;
  compareAtUah: string;
  compareAtEurB2b: string;
  compareAtUsdB2b: string;
  compareAtUahB2b: string;
  image: string;
  seoTitleUa: string;
  seoTitleEn: string;
  seoDescriptionUa: string;
  seoDescriptionEn: string;
  isPublished: boolean;
  publishedAt: string;
  gallery: unknown;
  highlights: unknown;
  media: MediaFormItem[];
  options: OptionFormItem[];
  variants: VariantFormItem[];
  metafields: MetafieldFormItem[];
  weight: string;
  length: string;
  width: string;
  height: string;
  isDimensionsEstimated: boolean;
};

const DEFAULT_RATES = { EUR: 1, USD: 1.152174, UAH: 53 };

type ProductResponse = {
  id: string;
  slug: string;
  sku: string | null;
  scope: string;
  storefront: ProductStorefront;
  brand: string | null;
  vendor: string | null;
  productType: string | null;
  productCategory: string | null;
  categoryId: string | null;
  category: CategoryOption | null;
  tags: string[];
  collectionIds: string[];
  collections: CollectionOption[];
  status: ProductStatus;
  titleUa: string;
  titleEn: string;
  categoryUa: string | null;
  categoryEn: string | null;
  shortDescUa: string | null;
  shortDescEn: string | null;
  longDescUa: string | null;
  longDescEn: string | null;
  bodyHtmlUa: string | null;
  bodyHtmlEn: string | null;
  leadTimeUa: string | null;
  leadTimeEn: string | null;
  stock: "inStock" | "preOrder";
  collectionUa: string | null;
  collectionEn: string | null;
  priceEur: number | null;
  priceEurEurope: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceEurB2b: number | null;
  priceUsdB2b: number | null;
  priceUahB2b: number | null;
  compareAtEur: number | null;
  compareAtUsd: number | null;
  compareAtUah: number | null;
  compareAtEurB2b: number | null;
  compareAtUsdB2b: number | null;
  compareAtUahB2b: number | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  isDimensionsEstimated: boolean;
  image: string | null;
  seoTitleUa: string | null;
  seoTitleEn: string | null;
  seoDescriptionUa: string | null;
  seoDescriptionEn: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  gallery: unknown;
  highlights: unknown;
  media: Array<{
    id: string;
    src: string;
    altText: string | null;
    position: number;
    mediaType: ProductMediaType;
  }>;
  options: Array<{ id: string; name: string; position: number; values: string[] }>;
  variants: Array<{
    id: string;
    title: string | null;
    sku: string | null;
    position: number;
    option1Value: string | null;
    option1LinkedTo: string | null;
    option2Value: string | null;
    option2LinkedTo: string | null;
    option3Value: string | null;
    option3LinkedTo: string | null;
    grams: number | null;
    inventoryTracker: string | null;
    inventoryQty: number;
    inventoryPolicy: InventoryPolicy;
    fulfillmentService: string | null;
    priceEur: number | null;
    priceEurEurope: number | null;
    priceUsd: number | null;
    priceUah: number | null;
    priceEurB2b: number | null;
    priceUsdB2b: number | null;
    priceUahB2b: number | null;
    compareAtEur: number | null;
    compareAtUsd: number | null;
    compareAtUah: number | null;
    compareAtEurB2b: number | null;
    compareAtUsdB2b: number | null;
    compareAtUahB2b: number | null;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    isDimensionsEstimated: boolean;
    requiresShipping: boolean;
    taxable: boolean;
    barcode: string | null;
    image: string | null;
    weightUnit: string | null;
    taxCode: string | null;
    costPerItem: number | null;
    isDefault: boolean;
  }>;
  metafields: Array<{
    id: string;
    namespace: string;
    key: string;
    value: string;
    valueType: string;
  }>;
};

type CatalogPublicationStatus = {
  version: string;
  status: "SAVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";
  tracked: boolean;
  pendingTargets: string[];
  failedTargets: string[];
  maxVersionLag: string;
  lastError: string | null;
};

function stringNumber(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function commaList(value: string[]): string {
  return value.join(", ");
}

function cleanArrayText(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function emptyMedia(position = 1): MediaFormItem {
  return { src: "", altText: "", position: String(position), mediaType: "IMAGE" };
}

function emptyOption(position = 1): OptionFormItem {
  return { name: "", position: String(position), valuesText: "" };
}

function emptyVariant(position = 1): VariantFormItem {
  return {
    title: position === 1 ? "Default Title" : "",
    sku: "",
    position: String(position),
    option1Value: "",
    option1LinkedTo: "",
    option2Value: "",
    option2LinkedTo: "",
    option3Value: "",
    option3LinkedTo: "",
    grams: "",
    inventoryTracker: "",
    inventoryQty: "0",
    inventoryPolicy: "CONTINUE",
    fulfillmentService: "",
    priceEur: "",
    priceEurEurope: "",
    priceUsd: "",
    priceUah: "",
    priceEurB2b: "",
    priceUsdB2b: "",
    priceUahB2b: "",
    compareAtEur: "",
    compareAtUsd: "",
    compareAtUah: "",
    compareAtEurB2b: "",
    compareAtUsdB2b: "",
    compareAtUahB2b: "",
    requiresShipping: true,
    taxable: true,
    barcode: "",
    image: "",
    weightUnit: "",
    taxCode: "",
    costPerItem: "",
    isDefault: position === 1,
    weight: "",
    length: "",
    width: "",
    height: "",
    isDimensionsEstimated: false,
  };
}

function emptyMetafield(): MetafieldFormItem {
  return { namespace: "custom", key: "", value: "", valueType: "single_line_text_field" };
}

function createEmptyVariantBulk(): VariantBulkState {
  return {
    inventoryQty: "",
    priceEur: "",
    priceEurEurope: "",
    priceUsd: "",
    priceUah: "",
    priceEurB2b: "",
    priceUsdB2b: "",
    priceUahB2b: "",
    compareAtEur: "",
    compareAtUsd: "",
    compareAtUah: "",
    compareAtEurB2b: "",
    compareAtUsdB2b: "",
    compareAtUahB2b: "",
    image: "",
  };
}

function skuSegment(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function mediaPreviewable(item: MediaFormItem) {
  return item.mediaType === "IMAGE" && item.src.trim();
}

function normalizeMediaOrder(items: MediaFormItem[]): MediaFormItem[] {
  return items.map((item, index) => ({
    ...item,
    position: String(index + 1),
  }));
}

function optionDefinitions(options: OptionFormItem[]) {
  return [...options]
    .sort((a, b) => (intOrNull(a.position) ?? 0) - (intOrNull(b.position) ?? 0))
    .map((item) => ({
      name: item.name.trim(),
      values: cleanArrayText(item.valuesText),
    }))
    .filter((item) => item.name);
}

function variantOptionValues(variant: VariantFormItem, optionCount = 3): string[] {
  return [variant.option1Value, variant.option2Value, variant.option3Value]
    .slice(0, optionCount)
    .map((value) => value.trim())
    .filter(Boolean);
}

function variantKey(values: string[]): string {
  return values.map((value) => value.trim().toLowerCase()).join("||");
}

function cartesianProduct<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>(
    (combinations, values) =>
      combinations.flatMap((combination) => values.map((value) => [...combination, value])),
    [[]]
  );
}

function createEmptyForm(): ProductFormState {
  return {
    slug: "",
    sku: "",
    scope: "auto",
    storefront: "main",
    brand: "",
    vendor: "",
    productType: "",
    productCategory: "",
    categoryId: "",
    tagsText: "",
    collectionIds: [],
    status: "DRAFT",
    titleUa: "",
    titleEn: "",
    categoryUa: "",
    categoryEn: "",
    shortDescUa: "",
    shortDescEn: "",
    longDescUa: "",
    longDescEn: "",
    bodyHtmlUa: "",
    bodyHtmlEn: "",
    leadTimeUa: "",
    leadTimeEn: "",
    stock: "inStock",
    collectionUa: "",
    collectionEn: "",
    priceEur: "",
    priceEurEurope: "",
    priceUsd: "",
    priceUah: "",
    priceEurB2b: "",
    priceUsdB2b: "",
    priceUahB2b: "",
    compareAtEur: "",
    compareAtUsd: "",
    compareAtUah: "",
    compareAtEurB2b: "",
    compareAtUsdB2b: "",
    compareAtUahB2b: "",
    image: "",
    seoTitleUa: "",
    seoTitleEn: "",
    seoDescriptionUa: "",
    seoDescriptionEn: "",
    isPublished: false,
    publishedAt: "",
    gallery: null,
    highlights: null,
    media: [emptyMedia()],
    options: [],
    variants: [emptyVariant()],
    metafields: [],
    weight: "",
    length: "",
    width: "",
    height: "",
    isDimensionsEstimated: false,
  };
}

function productToForm(product: ProductResponse): ProductFormState {
  return {
    slug: product.slug,
    sku: product.sku ?? "",
    scope: product.scope === "moto" ? "moto" : "auto",
    storefront: product.storefront ?? "main",
    brand: product.brand ?? "",
    vendor: product.vendor ?? "",
    productType: product.productType ?? "",
    productCategory: product.productCategory ?? "",
    categoryId: product.categoryId ?? "",
    tagsText: commaList(stripStorefrontTags(product.tags)),
    collectionIds: product.collectionIds ?? product.collections.map((collection) => collection.id),
    status: product.status,
    titleUa: product.titleUa,
    titleEn: product.titleEn,
    categoryUa: product.categoryUa ?? "",
    categoryEn: product.categoryEn ?? "",
    shortDescUa: product.shortDescUa ?? "",
    shortDescEn: product.shortDescEn ?? "",
    longDescUa: product.longDescUa ?? "",
    longDescEn: product.longDescEn ?? "",
    bodyHtmlUa: product.bodyHtmlUa ?? "",
    bodyHtmlEn: product.bodyHtmlEn ?? "",
    leadTimeUa: product.leadTimeUa ?? "",
    leadTimeEn: product.leadTimeEn ?? "",
    stock: product.stock,
    collectionUa: product.collectionUa ?? "",
    collectionEn: product.collectionEn ?? "",
    priceEur: stringNumber(product.priceEur),
    priceEurEurope: stringNumber(product.priceEurEurope),
    priceUsd: stringNumber(product.priceUsd),
    priceUah: stringNumber(product.priceUah),
    priceEurB2b: stringNumber(product.priceEurB2b),
    priceUsdB2b: stringNumber(product.priceUsdB2b),
    priceUahB2b: stringNumber(product.priceUahB2b),
    compareAtEur: stringNumber(product.compareAtEur),
    compareAtUsd: stringNumber(product.compareAtUsd),
    compareAtUah: stringNumber(product.compareAtUah),
    compareAtEurB2b: stringNumber(product.compareAtEurB2b),
    compareAtUsdB2b: stringNumber(product.compareAtUsdB2b),
    compareAtUahB2b: stringNumber(product.compareAtUahB2b),
    weight: stringNumber(product.weight),
    length: stringNumber(product.length),
    width: stringNumber(product.width),
    height: stringNumber(product.height),
    isDimensionsEstimated: Boolean(product.isDimensionsEstimated),
    image: product.image ?? "",
    seoTitleUa: product.seoTitleUa ?? "",
    seoTitleEn: product.seoTitleEn ?? "",
    seoDescriptionUa: product.seoDescriptionUa ?? "",
    seoDescriptionEn: product.seoDescriptionEn ?? "",
    isPublished: product.isPublished,
    publishedAt: product.publishedAt ?? "",
    gallery: product.gallery,
    highlights: product.highlights,
    media: product.media.length
      ? product.media.map((item) => ({
          id: item.id,
          src: item.src,
          altText: item.altText ?? "",
          position: String(item.position),
          mediaType: item.mediaType,
        }))
      : [emptyMedia()],
    options: product.options.map((item) => ({
      id: item.id,
      name: item.name,
      position: String(item.position),
      valuesText: commaList(item.values),
    })),
    variants: product.variants.length
      ? product.variants.map((item) => ({
          id: item.id,
          title: item.title ?? "",
          sku: item.sku ?? "",
          position: String(item.position),
          option1Value: item.option1Value ?? "",
          option1LinkedTo: item.option1LinkedTo ?? "",
          option2Value: item.option2Value ?? "",
          option2LinkedTo: item.option2LinkedTo ?? "",
          option3Value: item.option3Value ?? "",
          option3LinkedTo: item.option3LinkedTo ?? "",
          grams: stringNumber(item.grams),
          inventoryTracker: item.inventoryTracker ?? "",
          inventoryQty: String(item.inventoryQty ?? 0),
          inventoryPolicy: item.inventoryPolicy,
          fulfillmentService: item.fulfillmentService ?? "",
          priceEur: stringNumber(item.priceEur),
          priceEurEurope: stringNumber(item.priceEurEurope),
          priceUsd: stringNumber(item.priceUsd),
          priceUah: stringNumber(item.priceUah),
          priceEurB2b: stringNumber(item.priceEurB2b),
          priceUsdB2b: stringNumber(item.priceUsdB2b),
          priceUahB2b: stringNumber(item.priceUahB2b),
          compareAtEur: stringNumber(item.compareAtEur),
          compareAtUsd: stringNumber(item.compareAtUsd),
          compareAtUah: stringNumber(item.compareAtUah),
          compareAtEurB2b: stringNumber(item.compareAtEurB2b),
          compareAtUsdB2b: stringNumber(item.compareAtUsdB2b),
          compareAtUahB2b: stringNumber(item.compareAtUahB2b),
          requiresShipping: item.requiresShipping,
          taxable: item.taxable,
          weight: stringNumber(item.weight),
          length: stringNumber(item.length),
          width: stringNumber(item.width),
          height: stringNumber(item.height),
          isDimensionsEstimated: Boolean(item.isDimensionsEstimated),
          barcode: item.barcode ?? "",
          image: item.image ?? "",
          weightUnit: item.weightUnit ?? "",
          taxCode: item.taxCode ?? "",
          costPerItem: stringNumber(item.costPerItem),
          isDefault: item.isDefault,
        }))
      : [emptyVariant()],
    metafields: product.metafields.map((item) => ({
      id: item.id,
      namespace: item.namespace,
      key: item.key,
      value: item.value,
      valueType: item.valueType,
    })),
  };
}

function decimalOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
  const parsed = decimalOrNull(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function buildPayload(form: ProductFormState) {
  return {
    slug: form.slug,
    sku: form.sku || null,
    scope: form.scope,
    storefront: form.storefront,
    brand: form.brand || null,
    vendor: form.vendor || null,
    productType: form.productType || null,
    productCategory: form.productCategory || null,
    categoryId: form.categoryId || null,
    tags: cleanArrayText(form.tagsText),
    collectionIds: form.collectionIds,
    status: form.status,
    titleUa: form.titleUa,
    titleEn: form.titleEn,
    categoryUa: form.categoryUa || null,
    categoryEn: form.categoryEn || null,
    shortDescUa: form.shortDescUa || null,
    shortDescEn: form.shortDescEn || null,
    longDescUa: form.longDescUa || null,
    longDescEn: form.longDescEn || null,
    bodyHtmlUa: form.bodyHtmlUa || null,
    bodyHtmlEn: form.bodyHtmlEn || null,
    leadTimeUa: form.leadTimeUa || null,
    leadTimeEn: form.leadTimeEn || null,
    stock: form.stock,
    collectionUa: form.collectionUa || null,
    collectionEn: form.collectionEn || null,
    priceEur: decimalOrNull(form.priceEur),
    priceEurEurope: decimalOrNull(form.priceEurEurope),
    priceUsd: decimalOrNull(form.priceUsd),
    priceUah: decimalOrNull(form.priceUah),
    priceEurB2b: decimalOrNull(form.priceEurB2b),
    priceUsdB2b: decimalOrNull(form.priceUsdB2b),
    priceUahB2b: decimalOrNull(form.priceUahB2b),
    compareAtEur: decimalOrNull(form.compareAtEur),
    compareAtUsd: decimalOrNull(form.compareAtUsd),
    compareAtUah: decimalOrNull(form.compareAtUah),
    compareAtEurB2b: decimalOrNull(form.compareAtEurB2b),
    compareAtUsdB2b: decimalOrNull(form.compareAtUsdB2b),
    compareAtUahB2b: decimalOrNull(form.compareAtUahB2b),
    weight: decimalOrNull(form.weight),
    length: decimalOrNull(form.length),
    width: decimalOrNull(form.width),
    height: decimalOrNull(form.height),
    isDimensionsEstimated: Boolean(form.isDimensionsEstimated),
    image: form.image || null,
    seoTitleUa: form.seoTitleUa || null,
    seoTitleEn: form.seoTitleEn || null,
    seoDescriptionUa: form.seoDescriptionUa || null,
    seoDescriptionEn: form.seoDescriptionEn || null,
    isPublished: form.isPublished,
    publishedAt: form.publishedAt || null,
    gallery: form.gallery,
    highlights: form.highlights,
    media: form.media
      .filter((item) => item.src.trim())
      .map((item, index) => ({
        id: item.id,
        src: item.src.trim(),
        altText: item.altText.trim() || undefined,
        position: intOrNull(item.position) ?? index + 1,
        mediaType: item.mediaType,
      })),
    options: form.options
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        id: item.id,
        name: item.name.trim(),
        position: intOrNull(item.position) ?? index + 1,
        values: cleanArrayText(item.valuesText),
      })),
    variants: form.variants
      .filter(
        (item) =>
          item.title.trim() ||
          item.sku.trim() ||
          item.option1Value.trim() ||
          item.option2Value.trim() ||
          item.option3Value.trim()
      )
      .map((item, index) => ({
        id: item.id,
        title: item.title.trim() || null,
        sku: item.sku.trim() || null,
        position: intOrNull(item.position) ?? index + 1,
        option1Value: item.option1Value.trim() || null,
        option1LinkedTo: item.option1LinkedTo.trim() || null,
        option2Value: item.option2Value.trim() || null,
        option2LinkedTo: item.option2LinkedTo.trim() || null,
        option3Value: item.option3Value.trim() || null,
        option3LinkedTo: item.option3LinkedTo.trim() || null,
        grams: intOrNull(item.grams),
        inventoryTracker: item.inventoryTracker.trim() || null,
        inventoryQty: intOrNull(item.inventoryQty) ?? 0,
        inventoryPolicy: item.inventoryPolicy,
        fulfillmentService: item.fulfillmentService.trim() || null,
        priceEur: decimalOrNull(item.priceEur),
        priceEurEurope: decimalOrNull(item.priceEurEurope),
        priceUsd: decimalOrNull(item.priceUsd),
        priceUah: decimalOrNull(item.priceUah),
        priceEurB2b: decimalOrNull(item.priceEurB2b),
        priceUsdB2b: decimalOrNull(item.priceUsdB2b),
        priceUahB2b: decimalOrNull(item.priceUahB2b),
        compareAtEur: decimalOrNull(item.compareAtEur),
        compareAtUsd: decimalOrNull(item.compareAtUsd),
        compareAtUah: decimalOrNull(item.compareAtUah),
        compareAtEurB2b: decimalOrNull(item.compareAtEurB2b),
        compareAtUsdB2b: decimalOrNull(item.compareAtUsdB2b),
        compareAtUahB2b: decimalOrNull(item.compareAtUahB2b),
        weight: decimalOrNull(item.weight),
        length: decimalOrNull(item.length),
        width: decimalOrNull(item.width),
        height: decimalOrNull(item.height),
        isDimensionsEstimated: Boolean(item.isDimensionsEstimated),
        requiresShipping: item.requiresShipping,
        taxable: item.taxable,
        barcode: item.barcode.trim() || null,
        image: item.image.trim() || null,
        weightUnit: item.weightUnit.trim() || null,
        taxCode: item.taxCode.trim() || null,
        costPerItem: decimalOrNull(item.costPerItem),
        isDefault: item.isDefault,
      })),
    metafields: form.metafields
      .filter((item) => item.namespace.trim() && item.key.trim())
      .map((item) => ({
        id: item.id,
        namespace: item.namespace.trim(),
        key: item.key.trim(),
        value: item.value,
        valueType: item.valueType.trim() || "single_line_text_field",
      })),
  };
}

type AdminProductEditorProps = {
  productId?: string;
};

export default function AdminProductEditor({ productId }: AdminProductEditorProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const isEditing = Boolean(productId);
  const [loading, setLoading] = useState(isEditing);
  const [productLoaded, setProductLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [autoConvert, setAutoConvert] = useState<boolean>(true);
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
  const [availableCollections, setAvailableCollections] = useState<CollectionOption[]>([]);
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);
  const [variantBulk, setVariantBulk] = useState<VariantBulkState>(createEmptyVariantBulk());
  const [hardDeleting, setHardDeleting] = useState(false);
  const [language, setLanguage] = useState<"Ua" | "En">("Ua");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [savedForm, setSavedForm] = useState(() => JSON.stringify(createEmptyForm()));
  const isDirty = JSON.stringify(form) !== savedForm;

  useEffect(() => {
    if (!isDirty && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, uploading]);

  useEffect(() => {
    if (!isDirty && !uploading) return;
    const guard = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      const href = link?.getAttribute("href");
      if (!link || !href || href.startsWith("#") || link.target === "_blank") return;
      event.preventDefault();
      event.stopPropagation();
      if (uploading) {
        toast.error("Дочекайтеся завершення завантаження файлів");
        return;
      }
      void confirm({
        title: "Залишити незбережені зміни?",
        description: "Зміни цього товару ще не збережено.",
        confirmLabel: "Перейти без збереження",
        tone: "warning",
      }).then((ok) => {
        if (ok) router.push(href);
      });
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [isDirty, uploading, confirm, router, toast]);
  const [publicationVersion, setPublicationVersion] = useState<string | null>(null);
  const [publication, setPublication] = useState<CatalogPublicationStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await fetch("/api/admin/shop/categories");
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Failed to load categories");
        }
        if (!cancelled) {
          setAvailableCategories(Array.isArray(data) ? (data as CategoryOption[]) : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((current) => current || (loadError as Error).message);
        }
      }
    }

    async function loadCollections() {
      try {
        const response = await fetch("/api/admin/shop/collections");
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || "Failed to load collections");
        }
        if (!cancelled) {
          setAvailableCollections(Array.isArray(data) ? (data as CollectionOption[]) : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((current) => current || (loadError as Error).message);
        }
      }
    }

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/shop/products/editor-context");
        const data = await response.json();
        if (response.ok && data.currencyRates && !cancelled) {
          setRates(data.currencyRates);
        }
      } catch (loadError) {
        console.error("Failed to load shop settings for currency rates:", loadError);
      }
    }

    void loadCategories();
    void loadCollections();
    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/shop/products/${productId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to load product");
        }
        if (!cancelled) {
          setForm(productToForm(data as ProductResponse));
          setSavedForm(JSON.stringify(productToForm(data as ProductResponse)));
          setProductLoaded(true);
          setSlugTouched(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    async function refreshPublication() {
      const suffix = publicationVersion ? `?version=${encodeURIComponent(publicationVersion)}` : "";
      try {
        const response = await fetch(`/api/admin/shop/products/${productId}/publication${suffix}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to read publication status");
        if (cancelled) return;
        const next = data as CatalogPublicationStatus;
        setPublication(next);
        if (next.tracked && next.status !== "PUBLISHED" && next.status !== "FAILED") {
          timer = setTimeout(refreshPublication, 1_000);
        }
      } catch (statusError) {
        if (!cancelled && (statusError as Error).name !== "AbortError") {
          console.error("Failed to refresh catalog publication status:", statusError);
          timer = setTimeout(refreshPublication, 3_000);
        }
      }
    }

    void refreshPublication();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [productId, publicationVersion]);

  const updateField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (autoConvert) {
        const valStr = String(value);
        const priceTrios = [
          ["priceEur", "priceUsd", "priceUah"],
          ["compareAtEur", "compareAtUsd", "compareAtUah"],
          ["priceEurB2b", "priceUsdB2b", "priceUahB2b"],
          ["compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
        ] as const;

        for (const [eurKey, usdKey, uahKey] of priceTrios) {
          if (key === eurKey || key === usdKey || key === uahKey) {
            const val = parseFloat(valStr);
            if (isNaN(val) || val <= 0) {
              next[eurKey] = valStr;
              next[usdKey] = "";
              next[uahKey] = "";
            } else {
              const usdRate = rates.USD || 1.152174;
              const uahRate = rates.UAH || 53;

              if (key === eurKey) {
                next[usdKey] = String(Math.round(val * usdRate * 100) / 100);
                next[uahKey] = String(Math.round(val * uahRate));
              } else if (key === usdKey) {
                const inEur = val / usdRate;
                next[eurKey] = String(Math.round(inEur * 100) / 100);
                next[uahKey] = String(Math.round(inEur * uahRate));
              } else if (key === uahKey) {
                const inEur = val / uahRate;
                next[eurKey] = String(Math.round(inEur * 100) / 100);
                next[usdKey] = String(Math.round(inEur * usdRate * 100) / 100);
              }
            }
            break;
          }
        }
      }

      if ((key === "titleEn" || key === "titleUa") && !slugTouched) {
        const base =
          key === "titleEn" ? String(value || current.titleUa) : String(current.titleEn || value);
        next.slug = slugify(base);
      }
      return next;
    });
    if (key === "slug") {
      setSlugTouched(true);
    }
  };

  const updateVariantBulkField = (key: keyof VariantBulkState, value: string) => {
    setVariantBulk((current) => {
      const next = { ...current, [key]: value };
      if (autoConvert) {
        const val = parseFloat(value);
        const priceTrios = [
          ["priceEur", "priceUsd", "priceUah"],
          ["compareAtEur", "compareAtUsd", "compareAtUah"],
          ["priceEurB2b", "priceUsdB2b", "priceUahB2b"],
          ["compareAtEurB2b", "compareAtUsdB2b", "compareAtUahB2b"],
        ] as const;

        for (const [eurKey, usdKey, uahKey] of priceTrios) {
          if (key === eurKey || key === usdKey || key === uahKey) {
            if (isNaN(val) || val <= 0) {
              next[eurKey] = value;
              next[usdKey] = "";
              next[uahKey] = "";
            } else {
              const usdRate = rates.USD || 1.152174;
              const uahRate = rates.UAH || 53;
              if (key === eurKey) {
                next[usdKey] = String(Math.round(val * usdRate * 100) / 100);
                next[uahKey] = String(Math.round(val * uahRate));
              } else if (key === usdKey) {
                const inEur = val / usdRate;
                next[eurKey] = String(Math.round(inEur * 100) / 100);
                next[uahKey] = String(Math.round(inEur * uahRate));
              } else if (key === uahKey) {
                const inEur = val / uahRate;
                next[eurKey] = String(Math.round(inEur * 100) / 100);
                next[usdKey] = String(Math.round(inEur * usdRate * 100) / 100);
              }
            }
            break;
          }
        }
      }
      return next;
    });
  };

  const updateListItem = <
    K extends "media" | "options" | "variants" | "metafields",
    T extends ProductFormState[K][number],
  >(
    key: K,
    index: number,
    patch: Partial<T>
  ) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? ({ ...item, ...patch } as ProductFormState[K][number]) : item
      ),
    }));
  };

  const removeListItem = (key: "media" | "options" | "variants" | "metafields", index: number) => {
    setForm((current) => {
      if (key === "variants") {
        const nextItems = current.variants.filter((_, itemIndex) => itemIndex !== index);
        if (nextItems.length === 0) {
          return { ...current, variants: [emptyVariant()] };
        }
        return {
          ...current,
          variants: nextItems.map((item, itemIndex) => ({
            ...item,
            isDefault: nextItems.some((candidate) => candidate.isDefault)
              ? item.isDefault
              : itemIndex === 0,
          })),
        };
      }
      if (key === "media") {
        const removedItem = current.media[index];
        const removedSource = removedItem?.src.trim() ?? "";
        const nextItems = current.media.filter((_, itemIndex) => itemIndex !== index);
        const nextPrimaryImage =
          removedSource && current.image.trim() === removedSource
            ? (nextItems.find((item) => item.src.trim())?.src ?? "")
            : current.image;
        const nextVariants = current.variants.map((item) =>
          removedSource && item.image.trim() === removedSource ? { ...item, image: "" } : item
        );

        if (nextItems.length === 0) {
          return {
            ...current,
            image: nextPrimaryImage,
            media: [emptyMedia()],
            variants: nextVariants,
          };
        }
        return {
          ...current,
          image: nextPrimaryImage,
          media: normalizeMediaOrder(nextItems),
          variants: nextVariants,
        };
      }
      if (key === "options") {
        return {
          ...current,
          options: current.options.filter((_, itemIndex) => itemIndex !== index),
        };
      }
      return {
        ...current,
        metafields: current.metafields.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const addMedia = () => {
    setForm((current) => ({
      ...current,
      media: [...current.media, emptyMedia(current.media.length + 1)],
    }));
  };

  const addOption = () => {
    setForm((current) => ({
      ...current,
      options: [...current.options, emptyOption(current.options.length + 1)],
    }));
  };

  const addVariant = () => {
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants.map((item) => ({ ...item })),
        emptyVariant(current.variants.length + 1),
      ],
    }));
  };

  const addMetafield = () => {
    setForm((current) => ({ ...current, metafields: [...current.metafields, emptyMetafield()] }));
  };

  const setDefaultVariant = (index: number) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item, itemIndex) => ({
        ...item,
        isDefault: itemIndex === index,
      })),
    }));
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.media.length) {
        return current;
      }
      const nextMedia = [...current.media];
      const [moved] = nextMedia.splice(index, 1);
      nextMedia.splice(targetIndex, 0, moved);
      return {
        ...current,
        media: normalizeMediaOrder(nextMedia),
      };
    });
  };

  const updateMediaSource = (index: number, value: string) => {
    setForm((current) => {
      const previous = current.media[index];
      if (!previous) {
        return current;
      }

      const previousSource = previous.src.trim();
      const nextSource = value.trim();

      return {
        ...current,
        image: current.image.trim() === previousSource ? nextSource : current.image,
        media: current.media.map((item, itemIndex) =>
          itemIndex === index ? { ...item, src: value } : item
        ),
        variants: current.variants.map((variant) =>
          variant.image.trim() === previousSource ? { ...variant, image: nextSource } : variant
        ),
      };
    });
  };

  const handleHardDelete = async () => {
    if (!productId) return;
    const ok = await confirm({
      tone: "warning",
      title: "Архівувати цей товар?",
      description:
        "Товар буде знято з публікації та переведено в ARCHIVED. Це безпечніше за безповоротне видалення — товар можна відновити пізніше.",
      confirmLabel: "Архівувати товар",
    });
    if (!ok) return;

    setHardDeleting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/products/${productId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || "Не вдалося архівувати товар";
        toast.error("Не вдалося архівувати товар", msg);
        throw new Error(msg);
      }
      setSuccess("Товар архівовано.");
      toast.success("Товар архівовано");
      router.push("/admin/shop");
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setHardDeleting(false);
    }
  };

  const setPrimaryImageFromMedia = (index: number) => {
    const item = form.media[index];
    if (!item?.src.trim()) {
      return;
    }
    setForm((current) => ({
      ...current,
      image: item.src.trim(),
    }));
    setSuccess("Primary image updated from media.");
  };

  const toggleCollection = (collectionId: string) => {
    setForm((current) => ({
      ...current,
      collectionIds: current.collectionIds.includes(collectionId)
        ? current.collectionIds.filter((id) => id !== collectionId)
        : [...current.collectionIds, collectionId],
    }));
  };

  const applyBulkVariantFields = () => {
    const hasPayload = Object.values(variantBulk).some((value) => value.trim());
    if (!hasPayload) {
      setError("Fill at least one bulk field before applying it to variants.");
      return;
    }

    setError("");
    setSuccess("");
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item) => ({
        ...item,
        inventoryQty: variantBulk.inventoryQty.trim() || item.inventoryQty,
        priceEur: variantBulk.priceEur.trim() || item.priceEur,
        priceEurEurope: variantBulk.priceEurEurope.trim() || item.priceEurEurope,
        priceUsd: variantBulk.priceUsd.trim() || item.priceUsd,
        priceUah: variantBulk.priceUah.trim() || item.priceUah,
        priceEurB2b: variantBulk.priceEurB2b.trim() || item.priceEurB2b,
        priceUsdB2b: variantBulk.priceUsdB2b.trim() || item.priceUsdB2b,
        priceUahB2b: variantBulk.priceUahB2b.trim() || item.priceUahB2b,
        compareAtEur: variantBulk.compareAtEur.trim() || item.compareAtEur,
        compareAtUsd: variantBulk.compareAtUsd.trim() || item.compareAtUsd,
        compareAtUah: variantBulk.compareAtUah.trim() || item.compareAtUah,
        compareAtEurB2b: variantBulk.compareAtEurB2b.trim() || item.compareAtEurB2b,
        compareAtUsdB2b: variantBulk.compareAtUsdB2b.trim() || item.compareAtUsdB2b,
        compareAtUahB2b: variantBulk.compareAtUahB2b.trim() || item.compareAtUahB2b,
        image: variantBulk.image.trim() || item.image,
      })),
    }));
    setSuccess("Bulk variant fields applied.");
  };

  const applyProductPricingToVariants = () => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item) => ({
        ...item,
        priceEur: current.priceEur || item.priceEur,
        priceEurEurope: current.priceEurEurope || item.priceEurEurope,
        priceUsd: current.priceUsd || item.priceUsd,
        priceUah: current.priceUah || item.priceUah,
        priceEurB2b: current.priceEurB2b || item.priceEurB2b,
        priceUsdB2b: current.priceUsdB2b || item.priceUsdB2b,
        priceUahB2b: current.priceUahB2b || item.priceUahB2b,
        compareAtEur: current.compareAtEur || item.compareAtEur,
        compareAtUsd: current.compareAtUsd || item.compareAtUsd,
        compareAtUah: current.compareAtUah || item.compareAtUah,
        compareAtEurB2b: current.compareAtEurB2b || item.compareAtEurB2b,
        compareAtUsdB2b: current.compareAtUsdB2b || item.compareAtUsdB2b,
        compareAtUahB2b: current.compareAtUahB2b || item.compareAtUahB2b,
      })),
    }));
    setSuccess("Top-level pricing copied to variants.");
  };

  const copyDefaultVariantSettings = () => {
    const source = form.variants.find((item) => item.isDefault) ?? form.variants[0];
    if (!source) {
      return;
    }

    setForm((current) => ({
      ...current,
      variants: current.variants.map((item, index) =>
        current.variants[index]?.isDefault
          ? item
          : {
              ...item,
              inventoryPolicy: source.inventoryPolicy,
              inventoryTracker: source.inventoryTracker,
              fulfillmentService: source.fulfillmentService,
              requiresShipping: source.requiresShipping,
              taxable: source.taxable,
              weightUnit: source.weightUnit,
              grams: source.grams,
              taxCode: source.taxCode,
              costPerItem: source.costPerItem,
              image: item.image || source.image,
            }
      ),
    }));
    setSuccess("Default variant operational settings copied to all variants.");
  };

  const generateVariantsFromOptions = () => {
    const definitions = optionDefinitions(form.options);
    if (!definitions.length) {
      setError("Add at least one option with values before generating variants.");
      return;
    }
    if (definitions.length > 3) {
      setError("Up to 3 option groups are supported in this editor.");
      return;
    }
    if (definitions.some((definition) => definition.values.length === 0)) {
      setError("Each option must have at least one value before generating variants.");
      return;
    }

    const combinations = cartesianProduct(definitions.map((definition) => definition.values));
    if (!combinations.length) {
      setError("No option combinations were produced.");
      return;
    }
    if (combinations.length > 200) {
      setError("This option set would create more than 200 variants. Narrow the values first.");
      return;
    }

    const currentDefault = form.variants.find((item) => item.isDefault) ?? form.variants[0];
    const existingByKey = new Map(
      form.variants.map((variant) => [
        variantKey(variantOptionValues(variant, definitions.length)),
        variant,
      ])
    );
    const baseSku = form.sku.trim() || currentDefault?.sku.trim() || "";

    const nextVariants = combinations.map((values, index) => {
      const existing = existingByKey.get(variantKey(values));
      const baseVariant = existing
        ? { ...existing }
        : {
            ...emptyVariant(index + 1),
            inventoryPolicy: currentDefault?.inventoryPolicy ?? "CONTINUE",
            inventoryTracker: currentDefault?.inventoryTracker ?? "",
            fulfillmentService: currentDefault?.fulfillmentService ?? "",
            requiresShipping: currentDefault?.requiresShipping ?? true,
            taxable: currentDefault?.taxable ?? true,
            weightUnit: currentDefault?.weightUnit ?? "",
            grams: currentDefault?.grams ?? "",
            taxCode: currentDefault?.taxCode ?? "",
            costPerItem: currentDefault?.costPerItem ?? "",
            priceEur: currentDefault?.priceEur ?? form.priceEur,
            priceEurEurope: currentDefault?.priceEurEurope ?? form.priceEurEurope,
            priceUsd: currentDefault?.priceUsd ?? form.priceUsd,
            priceUah: currentDefault?.priceUah ?? form.priceUah,
            priceEurB2b: currentDefault?.priceEurB2b ?? form.priceEurB2b,
            priceUsdB2b: currentDefault?.priceUsdB2b ?? form.priceUsdB2b,
            priceUahB2b: currentDefault?.priceUahB2b ?? form.priceUahB2b,
            compareAtEur: currentDefault?.compareAtEur ?? form.compareAtEur,
            compareAtUsd: currentDefault?.compareAtUsd ?? form.compareAtUsd,
            compareAtUah: currentDefault?.compareAtUah ?? form.compareAtUah,
            compareAtEurB2b: currentDefault?.compareAtEurB2b ?? form.compareAtEurB2b,
            compareAtUsdB2b: currentDefault?.compareAtUsdB2b ?? form.compareAtUsdB2b,
            compareAtUahB2b: currentDefault?.compareAtUahB2b ?? form.compareAtUahB2b,
            image: currentDefault?.image ?? "",
            sku:
              baseSku && values.length
                ? `${baseSku}-${values.map(skuSegment).filter(Boolean).join("-")}`
                : (currentDefault?.sku ?? ""),
          };

      return {
        ...baseVariant,
        title: values.join(" / "),
        position: String(index + 1),
        option1Value: values[0] ?? "",
        option1LinkedTo: definitions[0]?.name ?? "",
        option2Value: values[1] ?? "",
        option2LinkedTo: definitions[1]?.name ?? "",
        option3Value: values[2] ?? "",
        option3LinkedTo: definitions[2]?.name ?? "",
        isDefault: existing?.isDefault ?? index === 0,
      };
    });

    if (!nextVariants.some((item) => item.isDefault) && nextVariants[0]) {
      nextVariants[0].isDefault = true;
    }

    setForm((current) => ({
      ...current,
      variants: nextVariants,
    }));
    setError("");
    setSuccess(
      `Generated ${nextVariants.length} variants from ${definitions.length} option groups.`
    );
  };

  const handleEstimateDimensionsAI = async () => {
    try {
      const targetTitle = form.titleEn || form.titleUa;
      if (!targetTitle) {
        setError("Необхідно вказати хоча б одну назву товару (En/Ua) для ШІ");
        return;
      }
      setSaving(true);
      setError("");
      setSuccess("Генерація габаритів через ШІ...");
      const res = await fetch("/api/admin/shop/ai/estimate-dimensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: targetTitle,
          brand: form.brand,
          sku: form.sku,
          categoryName: availableCategories.find((c) => c.id === form.categoryId)?.titleEn,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Помилка при генерації габаритів");
      }
      const e = data.estimate;
      setForm((prev) => ({
        ...prev,
        weight: e.weight != null ? String(e.weight) : prev.weight,
        length: e.length != null ? String(e.length) : prev.length,
        width: e.width != null ? String(e.width) : prev.width,
        height: e.height != null ? String(e.height) : prev.height,
        isDimensionsEstimated: true,
      }));
      setSuccess(`Габарити успішно згенеровано! (Модель: ${e.model || "AI"})`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || uploading || !productLoaded) return;
    if (!form.titleUa.trim() && !form.titleEn.trim()) {
      setError("Вкажіть назву товару українською або англійською.");
      document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        productId ? `/api/admin/shop/products/${productId}` : "/api/admin/shop/products",
        {
          method: productId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(form)),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || "Save failed";
        toast.error("Could not save product", msg);
        throw new Error(msg);
      }
      if (!productId && data.id) {
        toast.success("Product created", form.titleUa || form.titleEn || form.slug);
        router.push(`/admin/shop/${data.id}`);
        return;
      }
      if (productId) {
        setForm(productToForm(data as ProductResponse));
        setSavedForm(JSON.stringify(productToForm(data as ProductResponse)));
        const catalog = data.catalog as { version?: string; status?: "SAVED" } | undefined;
        if (catalog?.version) {
          setPublicationVersion(catalog.version);
          setPublication({
            version: catalog.version,
            status: "SAVED",
            tracked: true,
            pendingTargets: [],
            failedTargets: [],
            maxVersionLag: "0",
            lastError: null,
          });
        }
        setSuccess("Збережено. Публікація перевіряється окремо.");
        toast.success("Product saved", "Catalog publication is being verified");
      }
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminPage>
        <div className="text-sm text-zinc-400">Завантаження товару…</div>
      </AdminPage>
    );
  }

  if (!productLoaded) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || "Не вдалося завантажити товар."}</AdminInlineAlert>
        <button
          type="button"
          className="mt-4 rounded-lg border px-4 py-2"
          onClick={() => window.location.reload()}
        >
          Спробувати знову
        </button>
      </AdminPage>
    );
  }

  const productDisplayTitle =
    form.titleUa || form.titleEn || form.slug || (isEditing ? "Без назви" : "Новий товар");

  return (
    <AdminPage wide className={styles.editor}>
      <form onSubmit={handleSubmit}>
        <fieldset disabled={saving || uploading} className={styles.fieldset}>
          <AdminEditorTopBar
            className={styles.topbar}
            unsavedChanges={isDirty}
            backHref="/admin/shop"
            backLabel="Каталог"
            eyebrow={isEditing ? "Редагування товару" : "Новий товар"}
            title={productDisplayTitle}
            status={
              <div className="hidden sm:flex flex-wrap items-center gap-1.5">
                <AdminStatusBadge
                  tone={
                    form.status === "ACTIVE"
                      ? "success"
                      : form.status === "ARCHIVED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {form.status === "ACTIVE"
                    ? "Активний"
                    : form.status === "DRAFT"
                      ? "Чернетка"
                      : "В архіві"}
                </AdminStatusBadge>
                {form.isPublished ? null : (
                  <AdminStatusBadge tone="warning">Прихований</AdminStatusBadge>
                )}
              </div>
            }
            actions={
              <>
                {isDirty && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      void confirm({
                        title: "Скасувати зміни?",
                        description: "Повернемо всі поля до останнього збереженого стану.",
                        confirmLabel: "Скасувати зміни",
                        tone: "warning",
                      }).then((ok) => {
                        if (ok) {
                          setForm(JSON.parse(savedForm) as ProductFormState);
                          setSuccess("");
                          setError("");
                        }
                      });
                    }}
                  >
                    Скинути зміни
                  </button>
                )}
                <Link
                  href="/admin/shop"
                  className="hidden sm:inline-flex items-center gap-2 border border-white/10 bg-white/3 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/6"
                >
                  Скасувати
                </Link>
                <button
                  type="submit"
                  disabled={saving || uploading || (isEditing && !isDirty)}
                  className="inline-flex items-center gap-2 bg-linear-to-b from-blue-500 to-blue-700 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Зберігаємо…" : isEditing ? "Зберегти" : "Створити"}
                </button>
              </>
            }
          />

          <nav className={styles.jumpNav} aria-label="Розділи товару">
            <a href="#overview">Товар</a>
            <a href="#media">Медіа</a>
            <a href="#pricing">Ціни</a>
            <a href="#variants">Варіанти · {form.variants.length}</a>
            <a href="#seo">Пошукова видача</a>
            <a href="#publication">Публікація</a>
          </nav>
          {error ? (
            <div className="mb-4">
              <AdminInlineAlert tone="error">{error}</AdminInlineAlert>
            </div>
          ) : null}
          {success ? (
            <div className="mb-4">
              <AdminInlineAlert tone="success">{success}</AdminInlineAlert>
            </div>
          ) : null}
          {publication?.tracked && (publication.status !== "PUBLISHED" || success) && (
            <div className="mb-4" role="status">
              <AdminInlineAlert tone={publication.status === "FAILED" ? "error" : "success"}>
                {publication.status === "PUBLISHED"
                  ? "Останні збережені зміни опубліковано в магазині."
                  : publication.status === "FAILED"
                    ? "Зміни збережено, але публікація не завершилась. Перевірте стан каталогу."
                    : "Зміни збережено. Оновлюємо товар у магазині…"}
              </AdminInlineAlert>
            </div>
          )}

          <div className={styles.layout}>
            <div className="min-w-0 space-y-5">
              <AdminEditorSection
                id="overview"
                title="Товар"
                description="Назва та опис, які бачитиме покупець."
              >
                <div className={styles.language} role="group" aria-label="Мова контенту">
                  <button
                    type="button"
                    aria-pressed={language === "Ua"}
                    onClick={() => setLanguage("Ua")}
                  >
                    Українська
                  </button>
                  <button
                    type="button"
                    aria-pressed={language === "En"}
                    onClick={() => setLanguage("En")}
                  >
                    English
                  </button>
                </div>
                <div className="space-y-4">
                  <InputField
                    label={language === "Ua" ? "Назва товару · UA *" : "Назва товару · EN *"}
                    value={form[`title${language}`]}
                    onChange={(value) => updateField(`title${language}`, value)}
                    placeholder="Наприклад, карбоновий спойлер для Defender"
                  />
                  <TextareaField
                    label="Короткий опис"
                    value={form[`shortDesc${language}`]}
                    onChange={(value) => updateField(`shortDesc${language}`, value)}
                    rows={3}
                  />
                  <TextareaField
                    label="Повний опис"
                    value={form[`longDesc${language}`]}
                    onChange={(value) => updateField(`longDesc${language}`, value)}
                    rows={7}
                  />
                  <details className={styles.details}>
                    <summary>
                      {form[`bodyHtml${language}`]
                        ? "Редагувати наявний форматований опис (HTML)"
                        : "Додати форматований опис (HTML)"}
                    </summary>
                    <p>Окремий форматований опис. Зміни текстового опису вище не змінюють HTML.</p>
                    <TextareaField
                      label="HTML"
                      value={form[`bodyHtml${language}`]}
                      onChange={(value) => updateField(`bodyHtml${language}`, value)}
                      rows={10}
                      mono
                    />
                  </details>
                </div>
              </AdminEditorSection>
              <AdminEditorSection
                id="media"
                title="Медіа"
                description="Порядок зображень та відео у вітрині для цього товару."
              >
                <ProductMediaUpload
                  busy={uploading}
                  onBusyChange={setUploading}
                  onUploaded={(url, mediaType) => {
                    setForm((current) => ({
                      ...current,
                      image: current.image || (mediaType === "IMAGE" ? url : ""),
                      media: [
                        ...current.media,
                        {
                          src: url,
                          altText: "",
                          position: String(current.media.length + 1),
                          mediaType,
                        },
                      ],
                    }));
                  }}
                />
                <div className="mb-4">
                  <InputField
                    label="Головне фото · URL"
                    value={form.image}
                    onChange={(value) => updateField("image", value)}
                    placeholder="https://..."
                  />
                </div>
                <div className={styles.mediaGrid}>
                  {form.media.map((item, index) => (
                    <details key={item.id ?? `media-${index}`} className={styles.mediaCard}>
                      <summary>
                        {mediaPreviewable(item) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.src}
                            alt={item.altText || `Зображення ${index + 1}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className={styles.mediaPlaceholder}>Фото або відео</span>
                        )}
                        <span>
                          {form.image === item.src && item.src
                            ? "Головне фото"
                            : `Медіа ${index + 1}`}{" "}
                          · Редагувати
                        </span>
                      </summary>
                      <div className={styles.mediaFields}>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-white">Media #{index + 1}</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveMedia(index, -1)}
                              aria-label={`Перемістити медіа ${index + 1} раніше`}
                              disabled={index === 0}
                              className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMedia(index, 1)}
                              aria-label={`Перемістити медіа ${index + 1} пізніше`}
                              disabled={index === form.media.length - 1}
                              className="rounded-none border border-white/15 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrimaryImageFromMedia(index)}
                              disabled={!item.src.trim()}
                              className="rounded-none border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5 disabled:opacity-40"
                            >
                              Зробити головним
                            </button>
                            <button
                              type="button"
                              onClick={() => removeListItem("media", index)}
                              aria-label={`Видалити медіа ${index + 1}`}
                              className="rounded-none border border-blue-500/30 bg-blue-950/20 p-2 text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-950/40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-4 ">
                          <div className="grid gap-4 ">
                            <div className="">
                              <InputField
                                label="URL джерела"
                                value={item.src}
                                onChange={(value) => updateMediaSource(index, value)}
                              />
                            </div>
                            <InputField
                              label="Альт текст"
                              value={item.altText}
                              onChange={(value) =>
                                updateListItem("media", index, { altText: value })
                              }
                            />
                            <InputField
                              label="Позиція"
                              type="number"
                              value={item.position}
                              onChange={(value) =>
                                updateListItem("media", index, { position: value })
                              }
                            />
                            <SelectField
                              label="Тип медіа"
                              value={item.mediaType}
                              onChange={(value) =>
                                updateListItem("media", index, {
                                  mediaType: value as ProductMediaType,
                                })
                              }
                              options={[
                                { label: "Image", value: "IMAGE" },
                                { label: "Hosted video", value: "VIDEO" },
                                { label: "External video", value: "EXTERNAL_VIDEO" },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    </details>
                  ))}
                  <button
                    type="button"
                    onClick={addMedia}
                    className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    <Plus className="h-4 w-4" />
                    Додати медіа
                  </button>
                </div>
              </AdminEditorSection>

              <AdminEditorSection
                id="pricing"
                title="Ціни"
                description="Базові ціни для карток у магазині, пошуку та як дефолт для варіантів (B2C і B2B)."
              >
                <div className="mb-4 rounded-none border border-white/10 bg-zinc-950/40 p-4">
                  <CheckboxField
                    label="Автоматичний перерахунок цін за курсом"
                    checked={autoConvert}
                    onChange={setAutoConvert}
                    helper={`При зміні однієї валюти інші оновлюються автоматично. Курс: 1 EUR = ${rates.USD} USD = ${rates.UAH} UAH`}
                  />
                </div>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Ціна EUR"
                    type="number"
                    step="0.01"
                    value={form.priceEur}
                    onChange={(value) => updateField("priceEur", value)}
                  />
                  <InputField
                    label="Європа · EUR без ПДВ"
                    type="number"
                    step="0.01"
                    value={form.priceEurEurope}
                    onChange={(value) => updateField("priceEurEurope", value)}
                  />
                  <InputField
                    label="Ціна USD"
                    type="number"
                    step="0.01"
                    value={form.priceUsd}
                    onChange={(value) => updateField("priceUsd", value)}
                  />
                  <InputField
                    label="Ціна UAH"
                    type="number"
                    step="0.01"
                    value={form.priceUah}
                    onChange={(value) => updateField("priceUah", value)}
                  />
                  <InputField
                    label="Ціна до знижки EUR"
                    type="number"
                    step="0.01"
                    value={form.compareAtEur}
                    onChange={(value) => updateField("compareAtEur", value)}
                  />
                  <InputField
                    label="Ціна до знижки USD"
                    type="number"
                    step="0.01"
                    value={form.compareAtUsd}
                    onChange={(value) => updateField("compareAtUsd", value)}
                  />
                  <InputField
                    label="Ціна до знижки UAH"
                    type="number"
                    step="0.01"
                    value={form.compareAtUah}
                    onChange={(value) => updateField("compareAtUah", value)}
                  />
                </div>
                <details className={styles.details}>
                  <summary>Оптові ціни · B2B</summary>
                  <div className="grid gap-4 md:grid-cols-3">
                    <InputField
                      label="B2B (опт) EUR"
                      type="number"
                      step="0.01"
                      value={form.priceEurB2b}
                      onChange={(value) => updateField("priceEurB2b", value)}
                    />
                    <InputField
                      label="B2B (опт) USD"
                      type="number"
                      step="0.01"
                      value={form.priceUsdB2b}
                      onChange={(value) => updateField("priceUsdB2b", value)}
                    />
                    <InputField
                      label="B2B (опт) UAH"
                      type="number"
                      step="0.01"
                      value={form.priceUahB2b}
                      onChange={(value) => updateField("priceUahB2b", value)}
                    />
                    <InputField
                      label="B2B порівн. EUR"
                      type="number"
                      step="0.01"
                      value={form.compareAtEurB2b}
                      onChange={(value) => updateField("compareAtEurB2b", value)}
                    />
                    <InputField
                      label="B2B порівн. USD"
                      type="number"
                      step="0.01"
                      value={form.compareAtUsdB2b}
                      onChange={(value) => updateField("compareAtUsdB2b", value)}
                    />
                    <InputField
                      label="B2B порівн. UAH"
                      type="number"
                      step="0.01"
                      value={form.compareAtUahB2b}
                      onChange={(value) => updateField("compareAtUahB2b", value)}
                    />
                  </div>
                </details>
              </AdminEditorSection>

              <AdminCollapsibleSection
                id="dimensions"
                title="Габарити та вага"
                description="Використовуються для розрахунку об'ємної ваги та доставки, якщо поточний варіант не має власних значень."
              >
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleEstimateDimensionsAI}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-none bg-zinc-800/40 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-700/50 disabled:opacity-50 transition-colors"
                  >
                    <Wand2 className="size-4" /> 🪄 Згенерувати габарити через ШІ
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <InputField
                    label="Вага (кг)"
                    type="number"
                    step="0.01"
                    value={form.weight}
                    onChange={(value) => updateField("weight", value)}
                  />
                  <InputField
                    label="Довжина (см)"
                    type="number"
                    step="0.1"
                    value={form.length}
                    onChange={(value) => updateField("length", value)}
                  />
                  <InputField
                    label="Ширина (см)"
                    type="number"
                    step="0.1"
                    value={form.width}
                    onChange={(value) => updateField("width", value)}
                  />
                  <InputField
                    label="Висота (см)"
                    type="number"
                    step="0.1"
                    value={form.height}
                    onChange={(value) => updateField("height", value)}
                  />
                </div>
                <div className="mt-4 flex items-center">
                  <CheckboxField
                    label="Орієнтовні габарити (згенеровано ШІ / потребують перевірки)"
                    checked={form.isDimensionsEstimated}
                    onChange={(value) => updateField("isDimensionsEstimated", value)}
                  />
                </div>
              </AdminCollapsibleSection>

              <AdminEditorSection
                id="stock"
                title="Наявність і доставка"
                description="Загальна доступність товару. Кількість одиниць задається у варіантах нижче."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <InputField
                    label="Базовий SKU"
                    value={form.sku}
                    onChange={(value) => updateField("sku", value)}
                  />
                  <SelectField
                    label="Наявність"
                    value={form.stock}
                    onChange={(value) => updateField("stock", value as ProductFormState["stock"])}
                    options={[
                      { label: "У наявності", value: "inStock" },
                      { label: "Під замовлення", value: "preOrder" },
                    ]}
                  />
                  <InputField
                    label="Термін постачання · UA"
                    value={form.leadTimeUa}
                    onChange={(value) => updateField("leadTimeUa", value)}
                  />
                  <InputField
                    label="Термін постачання · EN"
                    value={form.leadTimeEn}
                    onChange={(value) => updateField("leadTimeEn", value)}
                  />
                </div>
              </AdminEditorSection>
              <AdminCollapsibleSection
                id="options"
                title="Опції"
                description="Набори опцій (наприклад, колір / розмір), з яких формуються варіанти."
              >
                <div className="space-y-4">
                  {form.options.map((item, index) => (
                    <div
                      key={item.id ?? `option-${index}`}
                      className="grid gap-4 rounded-none border border-white/10 bg-black/40 p-4 md:grid-cols-4"
                    >
                      <InputField
                        label="Назва"
                        value={item.name}
                        onChange={(value) => updateListItem("options", index, { name: value })}
                      />
                      <InputField
                        label="Позиція"
                        type="number"
                        value={item.position}
                        onChange={(value) => updateListItem("options", index, { position: value })}
                      />
                      <div className="md:col-span-2">
                        <InputField
                          label="Values"
                          value={item.valuesText}
                          onChange={(value) =>
                            updateListItem("options", index, { valuesText: value })
                          }
                          placeholder="Front, Rear, Full Kit"
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeListItem("options", index)}
                          className="rounded-none border border-blue-500/30 bg-blue-950/20 p-2 text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    <Plus className="h-4 w-4" />
                    Додати опцію
                  </button>
                </div>
              </AdminCollapsibleSection>

              <AdminEditorSection
                id="variants"
                title="Варіанти"
                description="Ціни, залишки та опції на рівні SKU. Один варіант завжди має залишатися основним."
              >
                <div className="space-y-4">
                  <details className={styles.details}>
                    <summary>Масове редагування варіантів</summary>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-50">
                          Інструменти варіантів
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          Змінюйте ціни та залишки одразу для всіх варіантів.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={generateVariantsFromOptions}
                          className="inline-flex items-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-blue-500/30 hover:bg-blue-500/6 hover:text-blue-300"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Створити з опцій
                        </button>
                        <button
                          type="button"
                          onClick={applyProductPricingToVariants}
                          className="inline-flex items-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-white/15 hover:bg-white/6"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Копіювати ціни товару
                        </button>
                        <button
                          type="button"
                          onClick={copyDefaultVariantSettings}
                          className="inline-flex items-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-white/15 hover:bg-white/6"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Копіювати основні налаштування
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <InputField
                        label="Масово inventory qty"
                        type="number"
                        value={variantBulk.inventoryQty}
                        onChange={(value) =>
                          setVariantBulk((current) => ({ ...current, inventoryQty: value }))
                        }
                      />
                      <InputField
                        label="Масово price EUR"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceEur}
                        onChange={(value) => updateVariantBulkField("priceEur", value)}
                      />
                      <InputField
                        label="Масово Europe net EUR"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceEurEurope}
                        onChange={(value) => updateVariantBulkField("priceEurEurope", value)}
                      />
                      <InputField
                        label="Масово price USD"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceUsd}
                        onChange={(value) => updateVariantBulkField("priceUsd", value)}
                      />
                      <InputField
                        label="Масово price UAH"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceUah}
                        onChange={(value) => updateVariantBulkField("priceUah", value)}
                      />
                      <InputField
                        label="Масово B2B EUR"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceEurB2b}
                        onChange={(value) => updateVariantBulkField("priceEurB2b", value)}
                      />
                      <InputField
                        label="Масово B2B USD"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceUsdB2b}
                        onChange={(value) => updateVariantBulkField("priceUsdB2b", value)}
                      />
                      <InputField
                        label="Масово B2B UAH"
                        type="number"
                        step="0.01"
                        value={variantBulk.priceUahB2b}
                        onChange={(value) => updateVariantBulkField("priceUahB2b", value)}
                      />
                      <InputField
                        label="Масово compare-at EUR"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtEur}
                        onChange={(value) => updateVariantBulkField("compareAtEur", value)}
                      />
                      <InputField
                        label="Масово compare-at USD"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtUsd}
                        onChange={(value) => updateVariantBulkField("compareAtUsd", value)}
                      />
                      <InputField
                        label="Масово compare-at UAH"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtUah}
                        onChange={(value) => updateVariantBulkField("compareAtUah", value)}
                      />
                      <InputField
                        label="Масово B2B порівн. EUR"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtEurB2b}
                        onChange={(value) => updateVariantBulkField("compareAtEurB2b", value)}
                      />
                      <InputField
                        label="Масово B2B порівн. USD"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtUsdB2b}
                        onChange={(value) => updateVariantBulkField("compareAtUsdB2b", value)}
                      />
                      <InputField
                        label="Масово B2B порівн. UAH"
                        type="number"
                        step="0.01"
                        value={variantBulk.compareAtUahB2b}
                        onChange={(value) => updateVariantBulkField("compareAtUahB2b", value)}
                      />
                      <InputField
                        label="Масово image URL"
                        value={variantBulk.image}
                        onChange={(value) =>
                          setVariantBulk((current) => ({ ...current, image: value }))
                        }
                        placeholder="https://..."
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
                      <div className="text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-300">
                          {optionDefinitions(form.options).reduce(
                            (count, definition) => count * Math.max(definition.values.length, 1),
                            1
                          )}
                        </span>{" "}
                        комбінацій із поточних опцій
                      </div>
                      <button
                        type="button"
                        onClick={applyBulkVariantFields}
                        className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Застосувати до всіх варіантів
                      </button>
                    </div>
                  </details>
                  <div className="space-y-3">
                    {form.variants.map((item, index) => (
                      <AdminProductVariantCard
                        key={item.id ?? `variant-${index}`}
                        variant={item}
                        index={index}
                        totalVariants={form.variants.length}
                        defaultOpen={false}
                        mediaOptions={form.media
                          .filter((mediaItem) => mediaItem.src.trim())
                          .map((mediaItem) => ({
                            src: mediaItem.src,
                            label: mediaItem.altText || mediaItem.src,
                          }))}
                        onUpdate={(patch) => updateListItem("variants", index, patch)}
                        onRemove={() => removeListItem("variants", index)}
                        onSetDefault={() => setDefaultVariant(index)}
                        rates={rates}
                        autoConvert={autoConvert}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-2 rounded-none border border-white/8 bg-white/3 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-blue-500/30 hover:bg-blue-500/6 hover:text-blue-300"
                  >
                    <Plus className="h-4 w-4" />
                    Додати варіант
                  </button>
                </div>
              </AdminEditorSection>

              <div className={styles.searchPreview}>
                <span>Попередній вигляд у пошуку</span>
                <p>onecompany.global › {form.slug || "назва-товару"}</p>
                <h3>{form.seoTitleUa || form.titleUa || "Назва товару"}</h3>
                <p>
                  {form.seoDescriptionUa ||
                    form.shortDescUa ||
                    "Додайте опис, щоб покупці розуміли, що ви пропонуєте."}
                </p>
              </div>
              <AdminCollapsibleSection
                id="seo"
                title="SEO та пошук"
                description="Налаштуйте заголовок і опис для пошукових систем."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <InputField
                    label="SEO заголовок (EN)"
                    value={form.seoTitleEn}
                    onChange={(value) => updateField("seoTitleEn", value)}
                  />
                  <InputField
                    label="SEO заголовок (UA)"
                    value={form.seoTitleUa}
                    onChange={(value) => updateField("seoTitleUa", value)}
                  />
                  <TextareaField
                    label="SEO description (EN)"
                    value={form.seoDescriptionEn}
                    onChange={(value) => updateField("seoDescriptionEn", value)}
                    rows={3}
                  />
                  <TextareaField
                    label="SEO description (UA)"
                    value={form.seoDescriptionUa}
                    onChange={(value) => updateField("seoDescriptionUa", value)}
                    rows={3}
                  />
                </div>
              </AdminCollapsibleSection>

              <AdminCollapsibleSection
                id="metafields"
                title="Мета‑поля"
                description="Додаткові характеристики та дані інтеграцій."
              >
                <div className="space-y-4">
                  {form.metafields.map((item, index) => (
                    <div
                      key={item.id ?? `metafield-${index}`}
                      className="rounded-none border border-white/10 bg-black/40 p-4"
                    >
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeListItem("metafields", index)}
                          className="rounded-none border border-blue-500/30 bg-blue-950/20 p-2 text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <InputField
                          label="Namespace"
                          value={item.namespace}
                          onChange={(value) =>
                            updateListItem("metafields", index, { namespace: value })
                          }
                        />
                        <InputField
                          label="Key"
                          value={item.key}
                          onChange={(value) => updateListItem("metafields", index, { key: value })}
                        />
                        <InputField
                          label="Value type"
                          value={item.valueType}
                          onChange={(value) =>
                            updateListItem("metafields", index, { valueType: value })
                          }
                        />
                      </div>
                      <div className="mt-4">
                        <TextareaField
                          label="Value"
                          value={item.value}
                          onChange={(value) => updateListItem("metafields", index, { value })}
                          rows={4}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMetafield}
                    className="inline-flex items-center gap-2 rounded-none border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    <Plus className="h-4 w-4" />
                    Додати мета‑поле
                  </button>
                </div>
              </AdminCollapsibleSection>

              {isEditing && productId && (
                <AdminCollapsibleSection
                  id="activity"
                  title="Активність та нотатки"
                  description="Внутрішні нотатки адміна, теги та аудит-трейл змін цього товару."
                >
                  <div className="space-y-5">
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Tags
                      </h3>
                      <AdminTagInput
                        entityType="shop.product"
                        entityId={productId}
                        suggestions={[
                          "featured",
                          "new-arrival",
                          "clearance",
                          "discontinued",
                          "staff-pick",
                          "bestseller",
                        ]}
                      />
                    </div>
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Notes
                      </h3>
                      <AdminNotes entityType="shop.product" entityId={productId} />
                    </div>
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Audit timeline
                      </h3>
                      <AdminActivityTimeline
                        entityType="shop.product"
                        entityId={productId}
                        emptyTitle="No activity logged yet"
                        emptyDescription="Edits to fields, status changes and bulk updates will appear here."
                      />
                    </div>
                  </div>
                </AdminCollapsibleSection>
              )}

              {isEditing && (
                <AdminCollapsibleSection
                  id="danger-zone"
                  title="Небезпечні дії"
                  description="Безпечне зняття товару з публікації та переведення в архів. Жорстке видалення більше не є дією за замовчуванням."
                >
                  <div className="rounded-none border border-blue-500/40 bg-red-900/10 p-4 space-y-2">
                    <p className="text-xs text-red-200">
                      Архівація залишає товар у базі, але прибирає його з публікації. Це зберігає
                      історію варіантів, цін і привʼязок до колекцій та дозволяє повернути товар без
                      відновлення з бекапу.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleHardDelete()}
                      disabled={hardDeleting}
                      className="inline-flex items-center gap-2 rounded-none border border-blue-500/40 bg-blue-950/40 px-4 py-2 text-sm font-medium text-white hover:bg-blue-950/40 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {hardDeleting ? "Архівуємо…" : "Архівувати товар"}
                    </button>
                  </div>
                </AdminCollapsibleSection>
              )}
            </div>

            <aside className={styles.sidebar}>
              <AdminEditorSection
                id="publication"
                title="Публікація"
                description="Доступність товару для покупців."
              >
                <div className="space-y-4">
                  <SelectField
                    label="Статус товару"
                    value={form.status}
                    onChange={(value) => updateField("status", value as ProductStatus)}
                    options={[
                      { label: "Активний", value: "ACTIVE" },
                      { label: "Чернетка", value: "DRAFT" },
                      { label: "В архіві", value: "ARCHIVED" },
                    ]}
                  />
                  <CheckboxField
                    label="Показувати в магазині"
                    checked={form.isPublished}
                    onChange={(value) => updateField("isPublished", value)}
                  />
                  <p className="text-xs text-zinc-400">
                    {form.isPublished
                      ? "Товар доступний на вітрині після збереження та публікації."
                      : "Товар прихований від покупців."}
                  </p>
                </div>
              </AdminEditorSection>
              <AdminEditorSection
                id="organization"
                title="Організація"
                description="Де покупці знайдуть цей товар."
              >
                <div className="space-y-4">
                  <InputField
                    label="Бренд"
                    value={form.brand}
                    onChange={(value) => updateField("brand", value)}
                  />
                  <InputField
                    label="Постачальник"
                    value={form.vendor}
                    onChange={(value) => updateField("vendor", value)}
                  />
                  <InputField
                    label="Тип товару"
                    value={form.productType}
                    onChange={(value) => updateField("productType", value)}
                  />
                  <SelectField
                    label="Категорія"
                    value={form.categoryId}
                    onChange={(value) => updateField("categoryId", value)}
                    options={[
                      { label: "Без категорії", value: "" },
                      ...availableCategories.map((category) => ({
                        label: `${category.titleEn || category.titleUa || category.slug}${category.parent ? ` · ${category.parent.titleEn || category.parent.titleUa}` : ""}`,
                        value: category.id,
                      })),
                    ]}
                  />
                  <SelectField
                    label="Напрям"
                    value={form.scope}
                    onChange={(value) => updateField("scope", value as ProductFormState["scope"])}
                    options={[
                      { label: "Auto", value: "auto" },
                      { label: "Moto", value: "moto" },
                    ]}
                  />
                  <SelectField
                    label="Вітрина"
                    value={form.storefront}
                    onChange={(value) => updateField("storefront", value as ProductStorefront)}
                    options={[
                      { label: "Main", value: "main" },
                      { label: "Urban", value: "urban" },
                      { label: "Brabus", value: "brabus" },
                    ]}
                  />
                  <InputField
                    label="Теги товару"
                    value={form.tagsText}
                    onChange={(value) => updateField("tagsText", value)}
                    placeholder="urban, defender, widetrack"
                  />
                </div>
              </AdminEditorSection>
              <AdminEditorSection
                id="collections"
                title="Колекції"
                description="Додайте товар до потрібних добірок."
              >
                <p className="mb-3 text-xs text-zinc-400">Вибрано: {form.collectionIds.length}</p>
                <button
                  type="button"
                  className={styles.secondary}
                  aria-expanded={collectionsExpanded}
                  onClick={() => setCollectionsExpanded(!collectionsExpanded)}
                >
                  Змінити колекції
                </button>
                {collectionsExpanded && (
                  <div className="mt-4 space-y-3">
                    <InputField
                      label="Пошук колекції"
                      value={collectionSearch}
                      onChange={setCollectionSearch}
                      placeholder="Назва або бренд"
                    />
                    <div className={styles.collectionList}>
                      {availableCollections
                        .filter((c) =>
                          `${c.titleUa} ${c.titleEn} ${c.brand || ""}`
                            .toLocaleLowerCase()
                            .includes(collectionSearch.toLocaleLowerCase())
                        )
                        .map((c) => (
                          <CheckboxField
                            key={c.id}
                            label={c.titleUa || c.titleEn || c.handle}
                            checked={form.collectionIds.includes(c.id)}
                            onChange={() => toggleCollection(c.id)}
                          />
                        ))}
                      {!availableCollections.length && <p>Колекцій поки немає.</p>}
                    </div>
                  </div>
                )}
                <div className="mt-3 space-y-2 text-xs text-zinc-300">
                  {availableCollections
                    .filter((c) => form.collectionIds.includes(c.id))
                    .map((c) => (
                      <div key={c.id}>{c.titleUa || c.titleEn}</div>
                    ))}
                </div>
                <Link
                  href="/admin/shop/collections"
                  className="mt-4 inline-block text-xs text-blue-300"
                >
                  Керувати колекціями ↗
                </Link>
              </AdminEditorSection>
              <AdminCollapsibleSection
                id="legacy"
                title="Додаткові поля"
                description="Адреса сторінки та поля імпортованого каталогу."
              >
                <div className="space-y-4">
                  <InputField
                    label="Категорія товару"
                    value={form.productCategory}
                    onChange={(value) => updateField("productCategory", value)}
                  />
                  <InputField
                    label="Категорія (UA)"
                    value={form.categoryUa}
                    onChange={(value) => updateField("categoryUa", value)}
                  />
                  <InputField
                    label="Категорія (EN)"
                    value={form.categoryEn}
                    onChange={(value) => updateField("categoryEn", value)}
                  />
                  <InputField
                    label="Адреса сторінки (slug) *"
                    value={form.slug}
                    onChange={(value) => updateField("slug", value)}
                    mono
                  />
                  <InputField
                    label="Handle колекції · EN"
                    value={form.collectionEn}
                    onChange={(value) => updateField("collectionEn", value)}
                  />
                  <InputField
                    label="Handle колекції · UA"
                    value={form.collectionUa}
                    onChange={(value) => updateField("collectionUa", value)}
                  />
                </div>
              </AdminCollapsibleSection>
            </aside>
          </div>
          <div className={styles.bottomBar}>
            <button
              type="submit"
              disabled={saving || uploading || (isEditing && !isDirty)}
              className="inline-flex items-center gap-2 rounded-none bg-linear-to-b from-blue-500 to-blue-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Зберігаємо…" : isEditing ? "Зберегти" : "Створити"}
            </button>
            <Link
              href="/admin/shop"
              className="rounded-none border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
            >
              Скасувати
            </Link>
          </div>
        </fieldset>
      </form>
    </AdminPage>
  );
}
