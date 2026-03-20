'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Plus, Save, Trash2, Upload, Wand2 } from 'lucide-react';

type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type ProductMediaType = 'IMAGE' | 'VIDEO' | 'EXTERNAL_VIDEO';
type InventoryPolicy = 'DENY' | 'CONTINUE';

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

type ShopLibraryMediaItem = {
  id: string;
  kind: 'image' | 'video' | 'other';
  filename: string;
  url: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  usageCount: number;
  usage: {
    productPrimaryImages: number;
    productMedia: number;
    variantImages: number;
  };
};

type VariantBulkState = {
  inventoryQty: string;
  priceEur: string;
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
  storeKey: string;
  slug: string;
  sku: string;
  scope: 'auto' | 'moto';
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
  stock: 'inStock' | 'preOrder';
  collectionUa: string;
  collectionEn: string;
  priceEur: string;
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
};

type ProductResponse = {
  id: string;
  storeKey: string;
  slug: string;
  sku: string | null;
  scope: string;
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
  stock: 'inStock' | 'preOrder';
  collectionUa: string | null;
  collectionEn: string | null;
  priceEur: number | null;
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
  image: string | null;
  seoTitleUa: string | null;
  seoTitleEn: string | null;
  seoDescriptionUa: string | null;
  seoDescriptionEn: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  gallery: unknown;
  highlights: unknown;
  media: Array<{ id: string; src: string; altText: string | null; position: number; mediaType: ProductMediaType }>;
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
    requiresShipping: boolean;
    taxable: boolean;
    barcode: string | null;
    image: string | null;
    weightUnit: string | null;
    taxCode: string | null;
    costPerItem: number | null;
    isDefault: boolean;
  }>;
  metafields: Array<{ id: string; namespace: string; key: string; value: string; valueType: string }>;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stringNumber(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

function commaList(value: string[]): string {
  return value.join(', ');
}

function cleanArrayText(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function emptyMedia(position = 1): MediaFormItem {
  return { src: '', altText: '', position: String(position), mediaType: 'IMAGE' };
}

function emptyOption(position = 1): OptionFormItem {
  return { name: '', position: String(position), valuesText: '' };
}

function emptyVariant(position = 1): VariantFormItem {
  return {
    title: position === 1 ? 'Default Title' : '',
    sku: '',
    position: String(position),
    option1Value: '',
    option1LinkedTo: '',
    option2Value: '',
    option2LinkedTo: '',
    option3Value: '',
    option3LinkedTo: '',
    grams: '',
    inventoryTracker: '',
    inventoryQty: '0',
    inventoryPolicy: 'CONTINUE',
    fulfillmentService: '',
    priceEur: '',
    priceUsd: '',
    priceUah: '',
    priceEurB2b: '',
    priceUsdB2b: '',
    priceUahB2b: '',
    compareAtEur: '',
    compareAtUsd: '',
    compareAtUah: '',
    compareAtEurB2b: '',
    compareAtUsdB2b: '',
    compareAtUahB2b: '',
    requiresShipping: true,
    taxable: true,
    barcode: '',
    image: '',
    weightUnit: '',
    taxCode: '',
    costPerItem: '',
    isDefault: position === 1,
  };
}

function emptyMetafield(): MetafieldFormItem {
  return { namespace: 'custom', key: '', value: '', valueType: 'single_line_text_field' };
}

function createEmptyVariantBulk(): VariantBulkState {
  return {
    inventoryQty: '',
    priceEur: '',
    priceUsd: '',
    priceUah: '',
    priceEurB2b: '',
    priceUsdB2b: '',
    priceUahB2b: '',
    compareAtEur: '',
    compareAtUsd: '',
    compareAtUah: '',
    compareAtEurB2b: '',
    compareAtUsdB2b: '',
    compareAtUahB2b: '',
    image: '',
  };
}

function skuSegment(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mediaPreviewable(item: MediaFormItem) {
  return item.mediaType === 'IMAGE' && item.src.trim();
}

function mediaTypeFromLibraryKind(kind: ShopLibraryMediaItem['kind']): ProductMediaType {
  return kind === 'video' ? 'VIDEO' : 'IMAGE';
}

function mediaLibraryLabel(item: ShopLibraryMediaItem) {
  return item.originalName || item.filename || item.url;
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
  return values.map((value) => value.trim().toLowerCase()).join('||');
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
    storeKey: 'urban',
    slug: '',
    sku: '',
    scope: 'auto',
    brand: '',
    vendor: '',
    productType: '',
    productCategory: '',
    categoryId: '',
    tagsText: '',
    collectionIds: [],
    status: 'ACTIVE',
    titleUa: '',
    titleEn: '',
    categoryUa: '',
    categoryEn: '',
    shortDescUa: '',
    shortDescEn: '',
    longDescUa: '',
    longDescEn: '',
    bodyHtmlUa: '',
    bodyHtmlEn: '',
    leadTimeUa: '',
    leadTimeEn: '',
    stock: 'inStock',
    collectionUa: '',
    collectionEn: '',
    priceEur: '',
    priceUsd: '',
    priceUah: '',
    priceEurB2b: '',
    priceUsdB2b: '',
    priceUahB2b: '',
    compareAtEur: '',
    compareAtUsd: '',
    compareAtUah: '',
    compareAtEurB2b: '',
    compareAtUsdB2b: '',
    compareAtUahB2b: '',
    image: '',
    seoTitleUa: '',
    seoTitleEn: '',
    seoDescriptionUa: '',
    seoDescriptionEn: '',
    isPublished: true,
    publishedAt: '',
    gallery: null,
    highlights: null,
    media: [emptyMedia()],
    options: [],
    variants: [emptyVariant()],
    metafields: [],
  };
}

function productToForm(product: ProductResponse): ProductFormState {
  return {
    storeKey: product.storeKey || 'urban',
    slug: product.slug,
    sku: product.sku ?? '',
    scope: product.scope === 'moto' ? 'moto' : 'auto',
    brand: product.brand ?? '',
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    productCategory: product.productCategory ?? '',
    categoryId: product.categoryId ?? '',
    tagsText: commaList(product.tags),
    collectionIds: product.collectionIds ?? product.collections.map((collection) => collection.id),
    status: product.status,
    titleUa: product.titleUa,
    titleEn: product.titleEn,
    categoryUa: product.categoryUa ?? '',
    categoryEn: product.categoryEn ?? '',
    shortDescUa: product.shortDescUa ?? '',
    shortDescEn: product.shortDescEn ?? '',
    longDescUa: product.longDescUa ?? '',
    longDescEn: product.longDescEn ?? '',
    bodyHtmlUa: product.bodyHtmlUa ?? '',
    bodyHtmlEn: product.bodyHtmlEn ?? '',
    leadTimeUa: product.leadTimeUa ?? '',
    leadTimeEn: product.leadTimeEn ?? '',
    stock: product.stock,
    collectionUa: product.collectionUa ?? '',
    collectionEn: product.collectionEn ?? '',
    priceEur: stringNumber(product.priceEur),
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
    image: product.image ?? '',
    seoTitleUa: product.seoTitleUa ?? '',
    seoTitleEn: product.seoTitleEn ?? '',
    seoDescriptionUa: product.seoDescriptionUa ?? '',
    seoDescriptionEn: product.seoDescriptionEn ?? '',
    isPublished: product.isPublished,
    publishedAt: product.publishedAt ?? '',
    gallery: product.gallery,
    highlights: product.highlights,
    media: product.media.length
      ? product.media.map((item) => ({
          id: item.id,
          src: item.src,
          altText: item.altText ?? '',
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
          title: item.title ?? '',
          sku: item.sku ?? '',
          position: String(item.position),
          option1Value: item.option1Value ?? '',
          option1LinkedTo: item.option1LinkedTo ?? '',
          option2Value: item.option2Value ?? '',
          option2LinkedTo: item.option2LinkedTo ?? '',
          option3Value: item.option3Value ?? '',
          option3LinkedTo: item.option3LinkedTo ?? '',
          grams: stringNumber(item.grams),
          inventoryTracker: item.inventoryTracker ?? '',
          inventoryQty: String(item.inventoryQty ?? 0),
          inventoryPolicy: item.inventoryPolicy,
          fulfillmentService: item.fulfillmentService ?? '',
          priceEur: stringNumber(item.priceEur),
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
          barcode: item.barcode ?? '',
          image: item.image ?? '',
          weightUnit: item.weightUnit ?? '',
          taxCode: item.taxCode ?? '',
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
    storeKey: form.storeKey,
    slug: form.slug,
    sku: form.sku || null,
    scope: form.scope,
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
        src: item.src.trim(),
        altText: item.altText.trim() || undefined,
        position: intOrNull(item.position) ?? index + 1,
        mediaType: item.mediaType,
      })),
    options: form.options
      .filter((item) => item.name.trim())
      .map((item, index) => ({
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
        namespace: item.namespace.trim(),
        key: item.key.trim(),
        value: item.value,
        valueType: item.valueType.trim() || 'single_line_text_field',
      })),
  };
}

type AdminProductEditorProps = {
  productId?: string;
};

export default function AdminProductEditor({ productId }: AdminProductEditorProps) {
  const router = useRouter();
  const isEditing = Boolean(productId);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);
  const [availableCollections, setAvailableCollections] = useState<CollectionOption[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<ShopLibraryMediaItem[]>([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingLibraryMediaId, setDeletingLibraryMediaId] = useState<string | null>(null);
  const [variantBulk, setVariantBulk] = useState<VariantBulkState>(createEmptyVariantBulk());
  const [hardDeleting, setHardDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await fetch('/api/admin/shop/categories');
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Не вдалося завантажити категорії');
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
        const response = await fetch('/api/admin/shop/collections');
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Не вдалося завантажити колекції');
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

    void loadCategories();
    void loadCollections();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMediaLibrary() {
      setMediaLibraryLoading(true);
      try {
        const response = await fetch('/api/admin/shop/media');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error((data as { error?: string }).error || 'Не вдалося завантажити медіатеку');
        }
        if (!cancelled) {
          setMediaLibrary(Array.isArray((data as { items?: unknown[] }).items) ? ((data as { items: ShopLibraryMediaItem[] }).items) : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((current) => current || (loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setMediaLibraryLoading(false);
        }
      }
    }

    void loadMediaLibrary();

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
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/products/${productId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Не вдалося завантажити товар');
        }
        if (!cancelled) {
          setForm(productToForm(data as ProductResponse));
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

  const updateField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if ((key === 'titleEn' || key === 'titleUa') && !slugTouched) {
        const base =
          key === 'titleEn'
            ? String(value || current.titleUa)
            : String(current.titleEn || value);
        next.slug = slugify(base);
      }
      return next;
    });
    if (key === 'slug') {
      setSlugTouched(true);
    }
  };

  const updateListItem = <
    K extends 'media' | 'options' | 'variants' | 'metafields',
    T extends ProductFormState[K][number]
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

  const removeListItem = (key: 'media' | 'options' | 'variants' | 'metafields', index: number) => {
    setForm((current) => {
      if (key === 'variants') {
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
      if (key === 'media') {
        const removedItem = current.media[index];
        const removedSource = removedItem?.src.trim() ?? '';
        const nextItems = current.media.filter((_, itemIndex) => itemIndex !== index);
        const nextPrimaryImage =
          removedSource && current.image.trim() === removedSource
            ? nextItems.find((item) => item.src.trim())?.src ?? ''
            : current.image;
        const nextVariants = current.variants.map((item) =>
          removedSource && item.image.trim() === removedSource ? { ...item, image: '' } : item
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
      if (key === 'options') {
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
    setForm((current) => ({ ...current, media: [...current.media, emptyMedia(current.media.length + 1)] }));
  };

  const addOption = () => {
    setForm((current) => ({ ...current, options: [...current.options, emptyOption(current.options.length + 1)] }));
  };

  const addVariant = () => {
    setForm((current) => ({
      ...current,
      variants: [...current.variants.map((item) => ({ ...item })), emptyVariant(current.variants.length + 1)],
    }));
  };

  const addMetafield = () => {
    setForm((current) => ({ ...current, metafields: [...current.metafields, emptyMetafield()] }));
  };

  const setDefaultVariant = (index: number) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item, itemIndex) => ({ ...item, isDefault: itemIndex === index })),
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
          variant.image.trim() === previousSource
            ? { ...variant, image: nextSource }
            : variant
        ),
      };
    });
  };

  const addLibraryMediaToProduct = (item: ShopLibraryMediaItem) => {
    setForm((current) => {
      if (current.media.some((entry) => entry.src.trim() === item.url)) {
        return current;
      }

      const nextMedia = normalizeMediaOrder([
        ...current.media.filter((entry) => entry.src.trim()),
        {
          ...emptyMedia(current.media.length + 1),
          src: item.url,
          altText: item.originalName,
          mediaType: mediaTypeFromLibraryKind(item.kind),
        },
      ]);

      return {
        ...current,
        media: nextMedia.length ? nextMedia : [emptyMedia()],
        image: current.image || item.url,
      };
    });
    setSuccess(`Added ${mediaLibraryLabel(item)} to product media.`);
  };

  const handleMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingMedia(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/shop/media', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Media upload failed');
      }

      const item = (data as { item: ShopLibraryMediaItem }).item;
      setMediaLibrary((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      addLibraryMediaToProduct(item);
      setSuccess(`Uploaded ${item.originalName}.`);
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setUploadingMedia(false);
      event.target.value = '';
    }
  };

  const handleHardDelete = async () => {
    if (!productId) return;
    if (
      !confirm(
        'Остаточно видалити цей товар разом з усіма варіантами та цінами?\n\nЦю дію не можна скасувати. Перед видаленням переконайтесь, що маєте актуальний бекап.'
      )
    ) {
      return;
    }

    setHardDeleting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/products/${productId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося видалити товар');
      }
      router.push('/admin/shop');
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setHardDeleting(false);
    }
  };

  const handleDeleteLibraryMedia = async (item: ShopLibraryMediaItem) => {
    setDeletingLibraryMediaId(item.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/shop/media/${item.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete media');
      }

      setMediaLibrary((current) => current.filter((entry) => entry.id !== item.id));
      setForm((current) => {
        const remainingMedia = current.media.filter((entry) => entry.src.trim() !== item.url);
        const nextPrimaryImage =
          current.image.trim() === item.url
            ? remainingMedia.find((entry) => entry.src.trim())?.src ?? ''
            : current.image;

        return {
          ...current,
          image: nextPrimaryImage,
          media: remainingMedia.length ? normalizeMediaOrder(remainingMedia) : [emptyMedia()],
          variants: current.variants.map((variant) =>
            variant.image.trim() === item.url ? { ...variant, image: '' } : variant
          ),
        };
      });
      setSuccess(`Елемент «${mediaLibraryLabel(item)}» видалено з медіатеки.`);
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingLibraryMediaId(null);
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
    setSuccess('Primary image updated from media.');
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
      setError('Fill at least one bulk field before applying it to variants.');
      return;
    }

    setError('');
    setSuccess('');
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item) => ({
        ...item,
        inventoryQty: variantBulk.inventoryQty.trim() || item.inventoryQty,
        priceEur: variantBulk.priceEur.trim() || item.priceEur,
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
    setSuccess('Bulk variant fields applied.');
  };

  const applyProductPricingToVariants = () => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((item) => ({
        ...item,
        priceEur: current.priceEur || item.priceEur,
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
    setSuccess('Top-level pricing copied to variants.');
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
    setSuccess('Default variant operational settings copied to all variants.');
  };

  const generateVariantsFromOptions = () => {
    const definitions = optionDefinitions(form.options);
    if (!definitions.length) {
      setError('Add at least one option with values before generating variants.');
      return;
    }
    if (definitions.length > 3) {
      setError('Up to 3 option groups are supported in this editor.');
      return;
    }
    if (definitions.some((definition) => definition.values.length === 0)) {
      setError('Each option must have at least one value before generating variants.');
      return;
    }

    const combinations = cartesianProduct(definitions.map((definition) => definition.values));
    if (!combinations.length) {
      setError('No option combinations were produced.');
      return;
    }
    if (combinations.length > 200) {
      setError('This option set would create more than 200 variants. Narrow the values first.');
      return;
    }

    const currentDefault = form.variants.find((item) => item.isDefault) ?? form.variants[0];
    const existingByKey = new Map(
      form.variants.map((variant) => [variantKey(variantOptionValues(variant, definitions.length)), variant])
    );
    const baseSku = form.sku.trim() || currentDefault?.sku.trim() || '';

    const nextVariants = combinations.map((values, index) => {
      const existing = existingByKey.get(variantKey(values));
      const baseVariant = existing
        ? { ...existing }
        : {
            ...emptyVariant(index + 1),
            inventoryPolicy: currentDefault?.inventoryPolicy ?? 'CONTINUE',
            inventoryTracker: currentDefault?.inventoryTracker ?? '',
            fulfillmentService: currentDefault?.fulfillmentService ?? '',
            requiresShipping: currentDefault?.requiresShipping ?? true,
            taxable: currentDefault?.taxable ?? true,
            weightUnit: currentDefault?.weightUnit ?? '',
            grams: currentDefault?.grams ?? '',
            taxCode: currentDefault?.taxCode ?? '',
            costPerItem: currentDefault?.costPerItem ?? '',
            priceEur: currentDefault?.priceEur ?? form.priceEur,
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
            image: currentDefault?.image ?? '',
            sku:
              baseSku && values.length
                ? `${baseSku}-${values.map(skuSegment).filter(Boolean).join('-')}`
                : currentDefault?.sku ?? '',
          };

      return {
        ...baseVariant,
        title: values.join(' / '),
        position: String(index + 1),
        option1Value: values[0] ?? '',
        option1LinkedTo: definitions[0]?.name ?? '',
        option2Value: values[1] ?? '',
        option2LinkedTo: definitions[1]?.name ?? '',
        option3Value: values[2] ?? '',
        option3LinkedTo: definitions[2]?.name ?? '',
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
    setError('');
    setSuccess(`Generated ${nextVariants.length} variants from ${definitions.length} option groups.`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        productId ? `/api/admin/shop/products/${productId}` : '/api/admin/shop/products',
        {
          method: productId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(form)),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося зберегти товар');
      }
      if (!productId && data.id) {
        router.push(`/admin/shop/${data.id}`);
        return;
      }
      if (productId) {
        setForm(productToForm(data as ProductResponse));
          setSuccess('Збережено');
      }
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-white/60">Завантаження товару…</div>;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4">
              <ArrowLeft className="w-4 h-4" />
              Назад до каталогу
            </Link>
            <h2 className="text-2xl font-semibold text-white">
              {isEditing ? `Редагувати товар: ${form.titleEn || form.titleUa || form.slug}` : 'Новий товар'}
            </h2>
            <p className="mt-2 text-sm text-white/45">
              Редактор товару у стилі Shopify: основні дані, медіа, варіанти, опції та додаткові поля для теми URBAN.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Стан у каталозі</div>
            <div className="mt-2 text-sm text-white/80">
              {form.status} · {form.isPublished ? 'Опублікований' : 'Прихований'} · {form.variants.length} варіант(и)
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <EditorCard
            title="Огляд"
            description="Основна ідентичність товару в каталозі, стан публікації та привʼязка до колекцій."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InputField label="Slug *" value={form.slug} onChange={(value) => updateField('slug', value)} mono />
              <SelectField
                label="Сфера (auto / moto)"
                value={form.scope}
                onChange={(value) => updateField('scope', value as ProductFormState['scope'])}
                options={[
                  { label: 'Auto', value: 'auto' },
                  { label: 'Moto', value: 'moto' },
                ]}
              />
              <SelectField
                label="Статус у каталозі"
                value={form.status}
                onChange={(value) => updateField('status', value as ProductStatus)}
                options={[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Archived', value: 'ARCHIVED' },
                ]}
              />
              <InputField label="Назва (EN) *" value={form.titleEn} onChange={(value) => updateField('titleEn', value)} />
              <InputField label="Назва (UA) *" value={form.titleUa} onChange={(value) => updateField('titleUa', value)} />
              <InputField label="Базовий SKU" value={form.sku} onChange={(value) => updateField('sku', value)} />
              <InputField label="Бренд" value={form.brand} onChange={(value) => updateField('brand', value)} />
              <InputField label="Постачальник" value={form.vendor} onChange={(value) => updateField('vendor', value)} />
              <InputField label="Тип товару" value={form.productType} onChange={(value) => updateField('productType', value)} />
              <SelectField
                label="Структурна категорія"
                value={form.categoryId}
                onChange={(value) => updateField('categoryId', value)}
                options={[
                  { label: 'Без категорії', value: '' },
                  ...availableCategories.map((category) => ({
                    label: `${category.titleEn || category.titleUa || category.slug}${category.parent ? ` · ${category.parent.titleEn || category.parent.titleUa}` : ''}`,
                    value: category.id,
                  })),
                ]}
              />
              <InputField label="Категорія товару" value={form.productCategory} onChange={(value) => updateField('productCategory', value)} />
              <InputField label="Категорія (EN)" value={form.categoryEn} onChange={(value) => updateField('categoryEn', value)} />
              <InputField label="Категорія (UA)" value={form.categoryUa} onChange={(value) => updateField('categoryUa', value)} />
              <SelectField
                label="Стан товару у вітрині"
                value={form.stock}
                onChange={(value) => updateField('stock', value as ProductFormState['stock'])}
                options={[
                  { label: 'В наявності', value: 'inStock' },
                  { label: 'Передзамовлення', value: 'preOrder' },
                ]}
              />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InputField
                label="Теги"
                value={form.tagsText}
                onChange={(value) => updateField('tagsText', value)}
                placeholder="urban, defender, widetrack"
              />
              <InputField
                label="URL головного зображення"
                value={form.image}
                onChange={(value) => updateField('image', value)}
                placeholder="https://..."
              />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Структурна категорія</div>
                  <p className="mt-1 text-xs text-white/45">
                    Використовуйте сутності категорій для фільтрів в адмінці та майбутньої навігації на сайті. Текстові поля категорій залишені для сумісності з імпортом.
                  </p>
                </div>
                <Link href="/admin/shop/categories" className="text-xs text-white/60 hover:text-white">
                  Керувати категоріями
                </Link>
              </div>
              <div className="mt-3 text-sm text-white/70">
                {form.categoryId
                  ? availableCategories.find((category) => category.id === form.categoryId)?.titleEn ||
                    availableCategories.find((category) => category.id === form.categoryId)?.titleUa ||
                    'Обрана категорія'
                  : 'Структурна категорія ще не обрана'}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">Привʼязані колекції</div>
                  <p className="mt-1 text-xs text-white/45">
                    Явні привʼязки до колекцій керують відображенням на сторінках URBAN‑колекцій та в каталозі.
                  </p>
                </div>
                <Link href="/admin/shop/collections" className="text-xs text-white/60 hover:text-white">
                  Керувати колекціями
                </Link>
              </div>
              {availableCollections.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {availableCollections.map((collection) => {
                    const selected = form.collectionIds.includes(collection.id);
                    const collectionTitle = collection.titleEn || collection.titleUa || collection.handle;
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        onClick={() => toggleCollection(collection.id)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selected
                            ? 'border-white/30 bg-white/10'
                            : 'border-white/10 bg-zinc-950/70 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{collectionTitle}</div>
                            <div className="mt-1 font-mono text-[11px] text-white/40">{collection.handle}</div>
                          </div>
                          <div
                            className={`mt-0.5 h-4 w-4 rounded border ${
                              selected ? 'border-white bg-white' : 'border-white/20 bg-transparent'
                            }`}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/45">
                          <span>{collection.brand || 'Без бренду'}</span>
                          <span>{collection.isUrban ? 'Urban' : 'Custom'}</span>
                          <span>{collection.isPublished ? 'Опублікована' : 'Прихована'}</span>
                          <span>{collection.productsCount ?? 0} товарів</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-zinc-950/60 px-4 py-6 text-sm text-white/45">
                  Колекцій ще немає. Спочатку створіть їх у розділі «Колекції».
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InputField
                  label="Старий handle колекції (EN)"
                  value={form.collectionEn}
                  onChange={(value) => updateField('collectionEn', value)}
                />
                <InputField
                  label="Старий handle колекції (UA)"
                  value={form.collectionUa}
                  onChange={(value) => updateField('collectionUa', value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <CheckboxField
                label="Опублікований у вітрині"
                checked={form.isPublished}
                onChange={(checked) => updateField('isPublished', checked)}
              />
              <div className="text-xs text-white/45">
                Опубліковано: {form.publishedAt ? new Date(form.publishedAt).toLocaleString() : 'ще не встановлено'}
              </div>
            </div>
          </EditorCard>

          <EditorCard
            title="Опис і контент"
            description="Короткі й довгі описи українською та англійською, а також сирий HTML з імпорту."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField label="Короткий опис (EN)" value={form.shortDescEn} onChange={(value) => updateField('shortDescEn', value)} rows={3} />
              <TextareaField label="Короткий опис (UA)" value={form.shortDescUa} onChange={(value) => updateField('shortDescUa', value)} rows={3} />
              <TextareaField label="Довгий опис (EN)" value={form.longDescEn} onChange={(value) => updateField('longDescEn', value)} rows={6} />
              <TextareaField label="Довгий опис (UA)" value={form.longDescUa} onChange={(value) => updateField('longDescUa', value)} rows={6} />
              <TextareaField label="HTML-контент (EN)" value={form.bodyHtmlEn} onChange={(value) => updateField('bodyHtmlEn', value)} rows={10} mono />
              <TextareaField label="HTML-контент (UA)" value={form.bodyHtmlUa} onChange={(value) => updateField('bodyHtmlUa', value)} rows={10} mono />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InputField label="Термін постачання (EN)" value={form.leadTimeEn} onChange={(value) => updateField('leadTimeEn', value)} />
              <InputField label="Термін постачання (UA)" value={form.leadTimeUa} onChange={(value) => updateField('leadTimeUa', value)} />
            </div>
          </EditorCard>

          <EditorCard
            title="Ціни"
            description="Базові ціни для карток у магазині, пошуку та як дефолт для варіантів (B2C і B2B)."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InputField label="Ціна EUR" type="number" step="0.01" value={form.priceEur} onChange={(value) => updateField('priceEur', value)} />
              <InputField label="Ціна USD" type="number" step="0.01" value={form.priceUsd} onChange={(value) => updateField('priceUsd', value)} />
              <InputField label="Ціна UAH" type="number" step="0.01" value={form.priceUah} onChange={(value) => updateField('priceUah', value)} />
              <InputField label="Порівн. ціна EUR" type="number" step="0.01" value={form.compareAtEur} onChange={(value) => updateField('compareAtEur', value)} />
              <InputField label="Порівн. ціна USD" type="number" step="0.01" value={form.compareAtUsd} onChange={(value) => updateField('compareAtUsd', value)} />
              <InputField label="Порівн. ціна UAH" type="number" step="0.01" value={form.compareAtUah} onChange={(value) => updateField('compareAtUah', value)} />
            </div>
            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="mb-3 text-sm font-medium text-white">B2B ціни</div>
              <div className="grid gap-4 md:grid-cols-3">
                <InputField label="B2B (опт) EUR" type="number" step="0.01" value={form.priceEurB2b} onChange={(value) => updateField('priceEurB2b', value)} />
                <InputField label="B2B (опт) USD" type="number" step="0.01" value={form.priceUsdB2b} onChange={(value) => updateField('priceUsdB2b', value)} />
                <InputField label="B2B (опт) UAH" type="number" step="0.01" value={form.priceUahB2b} onChange={(value) => updateField('priceUahB2b', value)} />
                <InputField label="B2B порівн. EUR" type="number" step="0.01" value={form.compareAtEurB2b} onChange={(value) => updateField('compareAtEurB2b', value)} />
                <InputField label="B2B порівн. USD" type="number" step="0.01" value={form.compareAtUsdB2b} onChange={(value) => updateField('compareAtUsdB2b', value)} />
                <InputField label="B2B порівн. UAH" type="number" step="0.01" value={form.compareAtUahB2b} onChange={(value) => updateField('compareAtUahB2b', value)} />
              </div>
            </div>
          </EditorCard>

          <EditorCard
            title="SEO"
            description="SEO‑поля з імпорту Shopify, які напряму мапляться в наш каталог і метадані сторінки."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="SEO заголовок (EN)" value={form.seoTitleEn} onChange={(value) => updateField('seoTitleEn', value)} />
              <InputField label="SEO заголовок (UA)" value={form.seoTitleUa} onChange={(value) => updateField('seoTitleUa', value)} />
              <TextareaField label="SEO description (EN)" value={form.seoDescriptionEn} onChange={(value) => updateField('seoDescriptionEn', value)} rows={3} />
              <TextareaField label="SEO description (UA)" value={form.seoDescriptionUa} onChange={(value) => updateField('seoDescriptionUa', value)} rows={3} />
            </div>
          </EditorCard>

          <EditorCard
            title="Медіа"
            description="Порядок зображень та відео у вітрині, бібліотека файлів і привʼязка картинок до варіантів."
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Бібліотека медіа</div>
                    <p className="mt-1 text-xs text-white/45">
                      Завантажуйте файли один раз і використовуйте в різних товарах; видалення блокується, якщо файл уже привʼязаний.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/admin/shop/media"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Відкрити бібліотеку
                    </Link>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingMedia ? 'Завантажуємо…' : 'Завантажити файл'}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {mediaLibraryLoading ? (
                    <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 text-sm text-white/45">
                      Завантаження бібліотеки медіа…
                    </div>
                  ) : mediaLibrary.length ? (
                    mediaLibrary.slice(0, 9).map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                          {item.kind === 'image' ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.url}
                              alt={item.originalName}
                              className="h-32 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-32 items-center justify-center text-xs uppercase tracking-[0.2em] text-white/35">
                              {item.kind}
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
                          <div className="truncate text-sm font-medium text-white">{mediaLibraryLabel(item)}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {item.usageCount} використань · {new Date(item.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => addLibraryMediaToProduct(item)}
                            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
                          >
                            Додати до товару
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteLibraryMedia(item)}
                            disabled={deletingLibraryMediaId === item.id || item.usageCount > 0}
                            className="rounded-md border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingLibraryMediaId === item.id
                              ? 'Видаляємо…'
                              : item.usageCount > 0
                                ? 'Використовується'
                                : 'Видалити'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 text-sm text-white/45">
                      Завантажте перший файл, щоб розпочати формувати бібліотеку медіа магазину.
                    </div>
                  )}
                </div>
              </div>
              {form.media.map((item, index) => (
                <div key={item.id ?? `media-${index}`} className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-medium text-white">Media #{index + 1}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveMedia(index, -1)}
                        disabled={index === 0}
                        className="rounded-md border border-white/15 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMedia(index, 1)}
                        disabled={index === form.media.length - 1}
                        className="rounded-md border border-white/15 p-2 text-white/70 hover:bg-white/5 disabled:opacity-40"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimaryImageFromMedia(index)}
                        disabled={!item.src.trim()}
                        className="rounded-md border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5 disabled:opacity-40"
                      >
                        Use as main
                      </button>
                      <button type="button" onClick={() => removeListItem('media', index)} className="rounded-md border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80">
                      {mediaPreviewable(item) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.src}
                          alt={item.altText || `Media ${index + 1}`}
                          className="h-44 w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center px-4 text-center text-xs text-white/35">
                          {item.src.trim() ? 'Превʼю доступне лише для зображень' : 'Додайте URL медіа, щоб побачити превʼю'}
                        </div>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <InputField label="URL джерела" value={item.src} onChange={(value) => updateMediaSource(index, value)} />
                    </div>
                    <InputField label="Альт текст" value={item.altText} onChange={(value) => updateListItem('media', index, { altText: value })} />
                    <InputField label="Позиція" type="number" value={item.position} onChange={(value) => updateListItem('media', index, { position: value })} />
                    <SelectField
                      label="Тип"
                      value={item.mediaType}
                      onChange={(value) => updateListItem('media', index, { mediaType: value as ProductMediaType })}
                      options={[
                        { label: 'Image', value: 'IMAGE' },
                        { label: 'Hosted video', value: 'VIDEO' },
                        { label: 'External video', value: 'EXTERNAL_VIDEO' },
                      ]}
                    />
                    <div className="md:col-span-4 rounded-lg border border-white/10 bg-zinc-950/70 p-3 text-xs text-white/45">
                      {item.src.trim().startsWith('/media/')
                        ? 'Library-backed asset. Variants using this source stay in sync if you change the URL here.'
                        : 'Custom external source. Variants can still link to this media item by matching the same URL.'}
                    </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addMedia}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати медіа
              </button>
            </div>
          </EditorCard>

          <EditorCard
            title="Опції"
            description="Набори опцій (наприклад, колір / розмір), з яких формуються варіанти."
          >
            <div className="space-y-4">
              {form.options.map((item, index) => (
                <div key={item.id ?? `option-${index}`} className="grid gap-4 rounded-xl border border-white/10 bg-black/40 p-4 md:grid-cols-4">
                  <InputField label="Назва" value={item.name} onChange={(value) => updateListItem('options', index, { name: value })} />
                  <InputField label="Позиція" type="number" value={item.position} onChange={(value) => updateListItem('options', index, { position: value })} />
                  <div className="md:col-span-2">
                    <InputField
                      label="Values"
                      value={item.valuesText}
                      onChange={(value) => updateListItem('options', index, { valuesText: value })}
                      placeholder="Front, Rear, Full Kit"
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeListItem('options', index)}
                      className="rounded-md border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати опцію
              </button>
            </div>
          </EditorCard>

          <EditorCard
            title="Варіанти"
            description="Ціни, залишки та опції на рівні SKU. Один варіант завжди має залишатися основним."
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Інструменти для варіантів</div>
                    <p className="mt-1 text-xs text-white/45">
                      Згенеруйте комбінації з опцій і застосуйте спільні ціни чи залишки до всіх варіантів.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateVariantsFromOptions}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5"
                    >
                      <Wand2 className="h-4 w-4" />
                      Згенерувати з опцій
                    </button>
                    <button
                      type="button"
                      onClick={applyProductPricingToVariants}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4" />
                      Скопіювати ціни товару
                    </button>
                    <button
                      type="button"
                      onClick={copyDefaultVariantSettings}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4" />
                      Скопіювати налаштування дефолтного
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <InputField
                    label="Масова кількість складу"
                    type="number"
                    value={variantBulk.inventoryQty}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, inventoryQty: value }))}
                  />
                  <InputField
                    label="Масова ціна EUR"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceEur}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceEur: value }))}
                  />
                  <InputField
                    label="Масова ціна USD"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceUsd}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceUsd: value }))}
                  />
                  <InputField
                    label="Масова ціна UAH"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceUah}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceUah: value }))}
                  />
                  <InputField
                    label="Масово B2B EUR"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceEurB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceEurB2b: value }))}
                  />
                  <InputField
                    label="Масово B2B USD"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceUsdB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceUsdB2b: value }))}
                  />
                  <InputField
                    label="Масово B2B UAH"
                    type="number"
                    step="0.01"
                    value={variantBulk.priceUahB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, priceUahB2b: value }))}
                  />
                  <InputField
                    label="Масова порівняльна ціна EUR"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtEur}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtEur: value }))}
                  />
                  <InputField
                    label="Bulk compare-at USD"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtUsd}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtUsd: value }))}
                  />
                  <InputField
                    label="Bulk compare-at UAH"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtUah}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtUah: value }))}
                  />
                  <InputField
                    label="Масово B2B порівн. EUR"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtEurB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtEurB2b: value }))}
                  />
                  <InputField
                    label="Масово B2B порівн. USD"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtUsdB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtUsdB2b: value }))}
                  />
                  <InputField
                    label="Масово B2B порівн. UAH"
                    type="number"
                    step="0.01"
                    value={variantBulk.compareAtUahB2b}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, compareAtUahB2b: value }))}
                  />
                  <InputField
                    label="Bulk image URL"
                    value={variantBulk.image}
                    onChange={(value) => setVariantBulk((current) => ({ ...current, image: value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-white/40">
                    {optionDefinitions(form.options).reduce(
                      (count, definition) => count * Math.max(definition.values.length, 1),
                      1
                    )}{' '}
                    можливих комбінацій з поточних опцій.
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkVariantFields}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                  >
                    <Copy className="h-4 w-4" />
                    Застосувати bulk‑поля
                  </button>
                </div>
              </div>
              {form.variants.map((item, index) => (
                <div key={item.id ?? `variant-${index}`} className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">
                      Варіант #{index + 1} {item.isDefault ? '· Основний' : ''}
                    </div>
                    <div className="flex items-center gap-2">
                      {!item.isDefault && (
                        <button
                          type="button"
                          onClick={() => setDefaultVariant(index)}
                          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
                        >
                          Зробити основним
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeListItem('variants', index)}
                        className="rounded-md border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <InputField label="Назва" value={item.title} onChange={(value) => updateListItem('variants', index, { title: value })} />
                    <InputField label="SKU" value={item.sku} onChange={(value) => updateListItem('variants', index, { sku: value })} />
                    <InputField label="Позиція" type="number" value={item.position} onChange={(value) => updateListItem('variants', index, { position: value })} />
                    <SelectField
                      label="Linked product media"
                      value={form.media.some((mediaItem) => mediaItem.src.trim() && mediaItem.src.trim() === item.image.trim()) ? item.image : '__custom__'}
                      onChange={(value) =>
                        updateListItem('variants', index, {
                          image: value === '__custom__' ? '' : value,
                        })
                      }
                      options={[
                        { label: 'Custom URL / none', value: '__custom__' },
                        ...form.media
                          .filter((mediaItem) => mediaItem.src.trim())
                          .map((mediaItem, mediaIndex) => ({
                            label: `Media #${mediaIndex + 1} · ${mediaItem.altText || mediaItem.src}`,
                            value: mediaItem.src,
                          })),
                      ]}
                    />
                    <InputField label="URL зображення" value={item.image} onChange={(value) => updateListItem('variants', index, { image: value })} />
                    <InputField label="Опція 1 значення" value={item.option1Value} onChange={(value) => updateListItem('variants', index, { option1Value: value })} />
                    <InputField label="Опція 1 зв’язок" value={item.option1LinkedTo} onChange={(value) => updateListItem('variants', index, { option1LinkedTo: value })} />
                    <InputField label="Опція 2 значення" value={item.option2Value} onChange={(value) => updateListItem('variants', index, { option2Value: value })} />
                    <InputField label="Опція 2 зв’язок" value={item.option2LinkedTo} onChange={(value) => updateListItem('variants', index, { option2LinkedTo: value })} />
                    <InputField label="Опція 3 значення" value={item.option3Value} onChange={(value) => updateListItem('variants', index, { option3Value: value })} />
                    <InputField label="Опція 3 зв’язок" value={item.option3LinkedTo} onChange={(value) => updateListItem('variants', index, { option3LinkedTo: value })} />
                    <InputField label="Кількість на складі" type="number" value={item.inventoryQty} onChange={(value) => updateListItem('variants', index, { inventoryQty: value })} />
                    <SelectField
                      label="Inventory policy"
                      value={item.inventoryPolicy}
                      onChange={(value) => updateListItem('variants', index, { inventoryPolicy: value as InventoryPolicy })}
                      options={[
                        { label: 'Continue', value: 'CONTINUE' },
                        { label: 'Deny', value: 'DENY' },
                      ]}
                    />
                    <InputField label="Відстеження складу" value={item.inventoryTracker} onChange={(value) => updateListItem('variants', index, { inventoryTracker: value })} />
                    <InputField label="Служба виконання" value={item.fulfillmentService} onChange={(value) => updateListItem('variants', index, { fulfillmentService: value })} />
                    <InputField label="Штрихкод" value={item.barcode} onChange={(value) => updateListItem('variants', index, { barcode: value })} />
                    <InputField label="Одиниця ваги" value={item.weightUnit} onChange={(value) => updateListItem('variants', index, { weightUnit: value })} />
                    <InputField label="Грами" type="number" value={item.grams} onChange={(value) => updateListItem('variants', index, { grams: value })} />
                    <InputField label="Податковий код" value={item.taxCode} onChange={(value) => updateListItem('variants', index, { taxCode: value })} />
                    <InputField label="Собівартість" type="number" step="0.01" value={item.costPerItem} onChange={(value) => updateListItem('variants', index, { costPerItem: value })} />
                    <InputField label="Ціна EUR" type="number" step="0.01" value={item.priceEur} onChange={(value) => updateListItem('variants', index, { priceEur: value })} />
                    <InputField label="Ціна USD" type="number" step="0.01" value={item.priceUsd} onChange={(value) => updateListItem('variants', index, { priceUsd: value })} />
                    <InputField label="Ціна UAH" type="number" step="0.01" value={item.priceUah} onChange={(value) => updateListItem('variants', index, { priceUah: value })} />
                    <InputField label="B2B (опт) EUR" type="number" step="0.01" value={item.priceEurB2b} onChange={(value) => updateListItem('variants', index, { priceEurB2b: value })} />
                    <InputField label="B2B (опт) USD" type="number" step="0.01" value={item.priceUsdB2b} onChange={(value) => updateListItem('variants', index, { priceUsdB2b: value })} />
                    <InputField label="B2B (опт) UAH" type="number" step="0.01" value={item.priceUahB2b} onChange={(value) => updateListItem('variants', index, { priceUahB2b: value })} />
                    <InputField label="Порівн. ціна EUR" type="number" step="0.01" value={item.compareAtEur} onChange={(value) => updateListItem('variants', index, { compareAtEur: value })} />
                    <InputField label="Порівн. ціна USD" type="number" step="0.01" value={item.compareAtUsd} onChange={(value) => updateListItem('variants', index, { compareAtUsd: value })} />
                    <InputField label="Порівн. ціна UAH" type="number" step="0.01" value={item.compareAtUah} onChange={(value) => updateListItem('variants', index, { compareAtUah: value })} />
                    <InputField label="B2B порівн. EUR" type="number" step="0.01" value={item.compareAtEurB2b} onChange={(value) => updateListItem('variants', index, { compareAtEurB2b: value })} />
                    <InputField label="B2B порівн. USD" type="number" step="0.01" value={item.compareAtUsdB2b} onChange={(value) => updateListItem('variants', index, { compareAtUsdB2b: value })} />
                    <InputField label="B2B порівн. UAH" type="number" step="0.01" value={item.compareAtUahB2b} onChange={(value) => updateListItem('variants', index, { compareAtUahB2b: value })} />
                  </div>
                  <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/70 p-3 text-xs text-white/45">
                    {item.image.trim()
                      ? form.media.some((mediaItem) => mediaItem.src.trim() === item.image.trim())
                        ? 'Зображення варіанта привʼязане до медіа товару і оновиться, якщо змінити джерело.'
                        : 'Зображення варіанта використовує власний URL поза списком медіа товару.'
                      : 'Для варіанта ще не задано зображення.'}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6">
                    <CheckboxField
                      label="Потребує доставки"
                      checked={item.requiresShipping}
                      onChange={(checked) => updateListItem('variants', index, { requiresShipping: checked })}
                    />
                    <CheckboxField
                      label="Оподатковується"
                      checked={item.taxable}
                      onChange={(checked) => updateListItem('variants', index, { taxable: checked })}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати варіант
              </button>
            </div>
          </EditorCard>

          <EditorCard
            title="Мета‑поля"
            description="Кастомні мета‑поля товару (як у Shopify), які використовуються темою URBAN та в CSV‑експорті."
          >
            <div className="space-y-4">
              {form.metafields.map((item, index) => (
                <div key={item.id ?? `metafield-${index}`} className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="mb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeListItem('metafields', index)}
                      className="rounded-md border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <InputField label="Namespace" value={item.namespace} onChange={(value) => updateListItem('metafields', index, { namespace: value })} />
                    <InputField label="Key" value={item.key} onChange={(value) => updateListItem('metafields', index, { key: value })} />
                    <InputField label="Value type" value={item.valueType} onChange={(value) => updateListItem('metafields', index, { valueType: value })} />
                  </div>
                  <div className="mt-4">
                    <TextareaField label="Value" value={item.value} onChange={(value) => updateListItem('metafields', index, { value })} rows={4} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addMetafield}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                <Plus className="h-4 w-4" />
                Додати мета‑поле
              </button>
            </div>
          </EditorCard>

          {isEditing && (
            <EditorCard
              title="Небезпечні дії"
              description="Остаточне видалення товару з бази даних. Використовуйте тільки після бекапу або якщо впевнені, що товар більше ніколи не знадобиться."
            >
              <div className="rounded-xl border border-red-500/40 bg-red-900/10 p-4 space-y-2">
                <p className="text-xs text-red-200">
                  Після остаточного видалення товару буде втрачено історію варіантів, цін і привʼязок до колекцій. Відновити його
                  можна буде лише з резервної копії бази даних.
                </p>
                <button
                  type="button"
                  onClick={() => void handleHardDelete()}
                  disabled={hardDeleting}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/60 bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {hardDeleting ? 'Видаляємо…' : 'Остаточно видалити товар'}
                </button>
              </div>
            </EditorCard>
          )}

          <div className="flex flex-wrap gap-3 pb-6 md:pb-0 hidden md:flex">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Зберігаємо…' : isEditing ? 'Зберегти товар' : 'Створити товар'}
            </button>
            <Link href="/admin/shop" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5">
              Скасувати
            </Link>
          </div>
          <div className="h-20 md:hidden" aria-hidden />
          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 border-t border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur-sm safe-area-pb md:hidden">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'Зберігаємо…' : isEditing ? 'Зберегти товар' : 'Створити товар'}
            </button>
            <Link href="/admin/shop" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5">
              Скасувати
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditorCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

function EditorCard({ title, description, children }: EditorCardProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/45">{description}</p>
      </div>
      {children}
    </section>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  placeholder?: string;
  mono?: boolean;
};

function InputField({ label, value, onChange, type = 'text', step, placeholder, mono = false }: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

type TextareaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
};

function TextareaField({ label, value, onChange, rows = 5, mono = false }: TextareaFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
      />
      {label}
    </label>
  );
}
