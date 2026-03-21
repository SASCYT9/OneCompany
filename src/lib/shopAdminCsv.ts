import type { AdminShopProductPayload } from '@/lib/shopAdminCatalog';

type CsvRecord = Record<string, string>;
type CsvRow = { rowNumber: number; record: CsvRecord };

type ImportBuildResult = {
  products: AdminShopProductPayload[];
  productRows: Array<{ rowNumber: number; product: AdminShopProductPayload }>;
  errors: { row: number; message: string }[];
  columns: string[];
  totalRows: number;
  variantsCount: number;
};

export type CsvHeaderMapping = Record<string, string>;

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(cell);
      const hasValue = row.some((entry) => entry.trim() !== '');
      if (hasValue) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((entry) => entry.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function normalizeMappedColumn(column: string, headerMapping?: CsvHeaderMapping) {
  const mapped = headerMapping?.[column];
  return String(mapped ?? column).trim();
}

function toRecords(text: string, headerMapping?: CsvHeaderMapping): { columns: string[]; records: CsvRecord[] } {
  const matrix = parseCsvMatrix(text);
  if (!matrix.length) {
    return { columns: [], records: [] };
  }

  const columns = matrix[0].map((column) => normalizeMappedColumn(column, headerMapping));
  const records = matrix.slice(1).map((cells) => {
    const record: CsvRecord = {};
    columns.forEach((column, index) => {
      record[column] = cells[index] ?? '';
    });
    return record;
  });

  return { columns, records };
}

function stringValue(value: string | undefined): string {
  return (value ?? '').trim();
}

function nullableString(value: string | undefined): string | null {
  const trimmed = stringValue(value);
  return trimmed || null;
}

function firstNonEmptyValue(rows: CsvRecord[], column: string): string {
  for (const row of rows) {
    const value = stringValue(row[column]);
    if (value) return value;
  }
  return stringValue(rows[0]?.[column]);
}

function firstNullableValue(rows: CsvRecord[], column: string): string | null {
  return nullableString(firstNonEmptyValue(rows, column));
}

function firstNonEmptyFromColumns(rows: CsvRecord[], columns: string[]): string {
  for (const column of columns) {
    const value = firstNonEmptyValue(rows, column);
    if (value) return value;
  }
  return '';
}

function firstNullableFromColumns(rows: CsvRecord[], columns: string[]): string | null {
  return nullableString(firstNonEmptyFromColumns(rows, columns));
}

function boolValue(value: string | undefined, fallback = false): boolean {
  const normalized = stringValue(value).toLowerCase();
  if (!normalized) return fallback;
  return ['true', '1', 'yes', 'y', 'published', 'active'].includes(normalized);
}

function decimalValue(value: string | undefined): number | null {
  const cleaned = stringValue(value).replace(/^'+/, '').replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function intValue(value: string | undefined): number | null {
  const parsed = decimalValue(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function splitTags(value: string | undefined): string[] {
  return stringValue(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(html: string, maxLength = 220): string {
  const plain = htmlToPlainText(html);
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trim()}…`;
}

function metafieldFromHeader(header: string): { namespace: string; key: string } | null {
  const match = header.match(/\(product\.metafields\.([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split('.');
  if (parts.length < 2) return null;
  return {
    namespace: parts.slice(0, -1).join('.'),
    key: parts[parts.length - 1],
  };
}

function shopCatalogStatus(status: string | undefined): AdminShopProductPayload['status'] {
  const normalized = stringValue(status).toLowerCase();
  if (normalized === 'draft') return 'DRAFT';
  if (normalized === 'archived') return 'ARCHIVED';
  return 'ACTIVE';
}

function inventoryPolicy(value: string | undefined): 'DENY' | 'CONTINUE' {
  return stringValue(value).toLowerCase() === 'deny' ? 'DENY' : 'CONTINUE';
}

function optionValue(record: CsvRecord, index: 1 | 2 | 3) {
  return nullableString(record[`Option${index} Value`]);
}

function optionLinkedTo(record: CsvRecord, index: 1 | 2 | 3) {
  return nullableString(record[`Option${index} Linked To`]);
}

function buildProductPayload(handle: string, rows: CsvRecord[], columns: string[]): AdminShopProductPayload {
  const first = rows.find((row) => stringValue(row['Title'])) ?? rows[0];
  const bodyHtml = firstNonEmptyValue(rows, 'Body (HTML)');
  const titleEn = firstNonEmptyFromColumns(rows, ['Title (EN)', 'Title EN', 'title_en', 'titleEn']) || firstNonEmptyValue(rows, 'Title');
  const bodyHtmlEn = firstNonEmptyFromColumns(rows, ['Body (HTML) (EN)', 'Body (HTML) EN', 'body_html_en', 'bodyHtmlEn']);
  const categoryEn = firstNonEmptyFromColumns(rows, ['Type (EN)', 'Type EN', 'category_en', 'Category EN', 'product_category_en']);
  const collectionEn = firstNonEmptyFromColumns(rows, [
    'vehicle_en (product.metafields.custom.vehicle_en)',
    'vehicle_en',
    'Vehicle EN',
    'Collection EN',
    'collection_en',
  ]);
  const defaultImage = firstNullableValue(rows, 'Image Src');
  const defaultVariantImage = firstNullableValue(rows, 'Variant Image');
  const mediaMap = new Map<string, { src: string; altText?: string; position: number }>();

  rows.forEach((row, index) => {
    const src = nullableString(row['Image Src']);
    if (!src) return;
    if (!mediaMap.has(src)) {
      mediaMap.set(src, {
        src,
        altText: nullableString(row['Image Alt Text']) ?? undefined,
        position: intValue(row['Image Position']) ?? index + 1,
      });
    }
  });

  const optionNames = [1, 2, 3]
    .map((position) => ({
      position,
      name: firstNullableValue(rows, `Option${position} Name`),
    }))
    .filter((item) => item.name && item.name.toLowerCase() !== 'title')
    .map((item) => ({
      position: item.position,
      name: item.name!,
      values: Array.from(
        new Set(
          rows
            .map((row) => nullableString(row[`Option${item.position} Value`]))
            .filter((value): value is string => Boolean(value) && value !== 'Default Title')
        )
      ),
    }));

  const variants = rows.map((row, index) => {
    const variantTitle = [1, 2, 3]
      .map((position) => nullableString(row[`Option${position} Value`]))
      .filter((value): value is string => Boolean(value) && value !== 'Default Title')
      .join(' / ');

    return {
    title: variantTitle || 'Default Title',
    sku: nullableString(row['Variant SKU']),
    position: index + 1,
    option1Value: optionValue(row, 1),
    option1LinkedTo: optionLinkedTo(row, 1),
    option2Value: optionValue(row, 2),
    option2LinkedTo: optionLinkedTo(row, 2),
    option3Value: optionValue(row, 3),
    option3LinkedTo: optionLinkedTo(row, 3),
    grams: intValue(row['Variant Grams']),
    inventoryTracker: nullableString(row['Variant Inventory Tracker']),
    inventoryQty: intValue(row['Variant Inventory Qty']) ?? 0,
    inventoryPolicy: inventoryPolicy(row['Variant Inventory Policy']),
    fulfillmentService: nullableString(row['Variant Fulfillment Service']),
    priceEur:
      decimalValue(row['price_eur (product.metafields.custom.price_eur)']) ??
      decimalValue(row['custom_price_eur (product.metafields.custom.custom_price_eur)']),
    priceUsd: null,
    priceUah: decimalValue(row['Variant Price']),
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: decimalValue(row['Variant Compare At Price']),
    requiresShipping: boolValue(row['Variant Requires Shipping'], true),
    taxable: boolValue(row['Variant Taxable'], true),
    barcode: nullableString(row['Variant Barcode']),
    image: nullableString(row['Variant Image']) ?? nullableString(row['Image Src']),
    weightUnit: nullableString(row['Variant Weight Unit']),
    taxCode: nullableString(row['Variant Tax Code']),
    costPerItem: decimalValue(row['Cost per item']),
    isDefault: index === 0,
    };
  });

  const metafields = columns
    .map((column) => {
      const meta = metafieldFromHeader(column);
      if (!meta) return null;
      const rawValue =
        rows.find((row) => stringValue(row[column]))?.[column] ??
        '';
      if (!stringValue(rawValue)) return null;
      return {
        namespace: meta.namespace,
        key: meta.key,
        value: stringValue(rawValue),
        valueType: 'multi_line_text_field',
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const primaryVariant = variants[0];
  const status = shopCatalogStatus(first['Status']);
  const published = boolValue(first['Published'], status === 'ACTIVE');

  return {
    slug: slugify(handle),
    sku: firstNullableValue(rows, 'Variant SKU'),
    scope: 'auto',
    brand:
      firstNullableValue(rows, 'brand (product.metafields.custom.brand)') ??
      firstNullableValue(rows, 'Vendor') ??
      'Urban',
    vendor: firstNullableValue(rows, 'Vendor'),
    productType: firstNullableValue(rows, 'Type'),
    productCategory: firstNullableValue(rows, 'Product Category'),
    tags: splitTags(firstNonEmptyValue(rows, 'Tags')),
    collectionIds: [],
    status,
    titleUa: firstNonEmptyValue(rows, 'Title'),
    titleEn,
    categoryUa: firstNullableValue(rows, 'Type'),
    categoryEn: categoryEn ?? firstNullableValue(rows, 'Type'),
    shortDescUa: excerpt(bodyHtml),
    shortDescEn: excerpt(bodyHtmlEn || bodyHtml),
    longDescUa: htmlToPlainText(bodyHtml),
    longDescEn: htmlToPlainText(bodyHtmlEn || bodyHtml),
    bodyHtmlUa: nullableString(bodyHtml),
    bodyHtmlEn: nullableString(bodyHtmlEn || bodyHtml),
    leadTimeUa: null,
    leadTimeEn: null,
    stock: (variants.some((variant) => (variant.inventoryQty ?? 0) > 0) ? 'inStock' : 'preOrder'),
    collectionUa: firstNullableValue(rows, 'vehicle (product.metafields.custom.vehicle)'),
    collectionEn: collectionEn ?? firstNullableValue(rows, 'vehicle (product.metafields.custom.vehicle)'),
    priceEur: primaryVariant?.priceEur ?? null,
    priceUsd: null,
    priceUah: primaryVariant?.priceUah ?? null,
    compareAtEur: primaryVariant?.compareAtEur ?? null,
    compareAtUsd: null,
    compareAtUah: primaryVariant?.compareAtUah ?? null,
    image: defaultImage ?? defaultVariantImage,
    seoTitleUa: firstNullableValue(rows, 'SEO Title'),
    seoTitleEn: firstNullableFromColumns(rows, ['SEO Title (EN)', 'SEO Title EN', 'seo_title_en', 'seoTitleEn']) ?? firstNullableValue(rows, 'SEO Title'),
    seoDescriptionUa: firstNullableValue(rows, 'SEO Description'),
    seoDescriptionEn:
      firstNullableFromColumns(rows, ['SEO Description (EN)', 'SEO Description EN', 'seo_description_en', 'seoDescriptionEn']) ??
      firstNullableValue(rows, 'SEO Description'),
    isPublished: published,
    publishedAt: published ? new Date().toISOString() : null,
    gallery: Array.from(mediaMap.values()).map((item) => item.src),
    highlights: null,
    media: Array.from(mediaMap.values())
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        src: item.src,
        altText: item.altText,
        position: item.position,
        mediaType: 'IMAGE' as const,
      })),
    options: optionNames,
    variants,
    metafields,
  };
}

export function buildProductsFromShopifyCsv(
  csvText: string,
  headerMapping?: CsvHeaderMapping
): ImportBuildResult {
  const { columns, records } = toRecords(csvText, headerMapping);
  if (!columns.length) {
    return {
      products: [],
      productRows: [],
      errors: [],
      columns: [],
      totalRows: 0,
      variantsCount: 0,
    };
  }

  const grouped = new Map<string, CsvRow[]>();
  const errors: { row: number; message: string }[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const handle = stringValue(record['Handle']);
    if (!handle) {
      errors.push({ row: rowNumber, message: 'Handle is required' });
      return;
    }
    if (!grouped.has(handle)) {
      grouped.set(handle, []);
    }
    grouped.get(handle)!.push({ rowNumber, record });
  });

  const productRows = Array.from(grouped.entries())
    .map(([handle, rows]) => {
      const csvRows = rows.map((entry) => entry.record);
      const title = firstNonEmptyValue(csvRows, 'Title');
      if (!title) {
        errors.push({ row: rows[0]?.rowNumber ?? 2, message: 'Title is required for handle group' });
        return null;
      }
      return {
        rowNumber: rows[0]?.rowNumber ?? 2,
        product: buildProductPayload(handle, csvRows, columns),
      };
    })
    .filter((entry): entry is { rowNumber: number; product: AdminShopProductPayload } => Boolean(entry));

  return {
    products: productRows.map((entry) => entry.product),
    productRows,
    errors,
    columns,
    totalRows: records.length,
    variantsCount: productRows.reduce((sum, entry) => sum + entry.product.variants.length, 0),
  };
}
