import { inflateRawSync } from "node:zlib";

import { ShopCatalogStatus, type PrismaClient } from "@prisma/client";
import Papa from "papaparse";

import {
  HOLLEY_BRANDS,
  POUND_KG,
  decideHolleyPriceUsd,
  type HolleyBrandKey,
} from "@/lib/holleyBrandCatalog";
import { OPS_XLSX_MIME_TYPE } from "@/lib/operations/media";
import {
  canChangePrices,
  effectivePriceChanges,
  loadPriceChangeActor,
  markPriceListCurrent,
  planFromFindings,
  proposePriceChange,
  sourceOfBrand,
  type PriceButtonFactory,
  type PriceChangeActor,
  type PriceChangeItem,
  type PriceReply,
} from "@/lib/operations/priceChanges";
import { savePriceWatchFacts } from "@/lib/operations/priceWatch";
import type { PriceWatchFact } from "@/lib/operations/priceWatchChecks";
import {
  escapeTelegramHtml,
  formatPriceWatchNumber,
  formatPriceWatchPercent,
  ruPlural,
} from "@/lib/operations/priceWatchReport";
import {
  PRICE_WATCH_SOURCES,
  findPriceWatchSource,
  type PriceWatchCurrency,
  type PriceWatchSourceDefinition,
} from "@/lib/operations/priceWatchSources";
import { normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import {
  isShopSourcePriceBook,
  shopUahSaleRate,
  type ShopPriceBookRates,
} from "@/lib/shopPriceBookCurrency";

/**
 * «Прайс файлом у бот»: an owner sends a supplier price list (.xlsx or .csv) to
 * the ops bot. A Dinan / APR dealer list is priced by Ігор's formula
 * (decideHolleyPriceUsd: MAP × 1.15 + $12/kg); any other sheet with SKU and price
 * columns becomes site prices by the brand's price-list rule or the caption
 * markup («+10%»). Either way the owner first sees what changes and confirms
 * it, as with «цена …» commands.
 */

export const PRICE_LIST_MAX_ROWS = 20_000;
const MAX_COLUMNS = 80;
const MAX_SHEETS = 6;
const MAX_ZIP_ENTRIES = 5_000;
const MAX_PART_BYTES = 40 * 1024 * 1024;
const HEADER_SEARCH_ROWS = 15;
const SAMPLE_SKUS = 20;
const COMPETITOR_FRESH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TEXT_LIMIT = 30_000;

export class PriceListFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PriceListFileError";
  }
}

export type PriceListSheet = { name: string | null; rows: string[][] };

export function isPriceListMime(mimeType: string | null | undefined) {
  return mimeType === OPS_XLSX_MIME_TYPE || mimeType === "text/csv";
}

// ---------------------------------------------------------------------------
// Reading .xlsx (a zip of XML parts) and .csv, without extra dependencies
// ---------------------------------------------------------------------------

const brokenFile = () =>
  new PriceListFileError("файл повреждён или это не .xlsx (может быть, он защищён паролем)");

/** The parts of a zip archive, unpacked on demand and never beyond the size limit. */
function readZip(body: Uint8Array) {
  const data = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  let end = -1;
  for (
    let offset = data.length - 22;
    offset >= Math.max(0, data.length - 22 - 0xffff);
    offset -= 1
  ) {
    if (data.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw brokenFile();
  const count = data.readUInt16LE(end + 10);
  if (count > MAX_ZIP_ENTRIES) throw brokenFile();
  const parts = new Map<
    string,
    { method: number; compressed: number; size: number; local: number }
  >();
  let offset = data.readUInt32LE(end + 16);
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50) throw brokenFile();
    const nameLength = data.readUInt16LE(offset + 28);
    parts.set(data.toString("utf8", offset + 46, offset + 46 + nameLength), {
      method: data.readUInt16LE(offset + 10),
      compressed: data.readUInt32LE(offset + 20),
      size: data.readUInt32LE(offset + 24),
      local: data.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
  }
  return (name: string): string | null => {
    const part = parts.get(name);
    if (!part) return null;
    if (part.size > MAX_PART_BYTES) throw new PriceListFileError("файл слишком большой");
    if (part.local + 30 > data.length || data.readUInt32LE(part.local) !== 0x04034b50)
      throw brokenFile();
    const start =
      part.local + 30 + data.readUInt16LE(part.local + 26) + data.readUInt16LE(part.local + 28);
    const raw = data.subarray(start, start + part.compressed);
    if (raw.length !== part.compressed) throw brokenFile();
    if (part.method === 0) return raw.toString("utf8");
    if (part.method !== 8) throw brokenFile();
    try {
      return inflateRawSync(raw, { maxOutputLength: MAX_PART_BYTES }).toString("utf8");
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
        throw new PriceListFileError("файл слишком большой");
      }
      throw brokenFile();
    }
  };
}

function attribute(source: string, name: string) {
  return source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null;
}

const XML_ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeXml(value: string) {
  return value
    .replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (whole, code: string) => {
      if (code[0] !== "#") return XML_ENTITIES[code] ?? whole;
      const point = code[1] === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/_x([0-9A-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Text of a shared or inline string: all its runs, without phonetic hints. */
function stringText(xml: string) {
  const runs = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").replace(/<t\b[^>]*\/>/g, "");
  return decodeXml(
    [...runs.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join("")
  );
}

/** «AB12» → 27. */
function columnIndex(reference: string) {
  let index = 0;
  for (const letter of reference.toUpperCase()) {
    if (letter < "A" || letter > "Z") break;
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function readSheetRows(xml: string, shared: readonly string[]) {
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    let next = 0;
    for (const cell of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = attribute(cell[1], "r");
      const column = reference ? columnIndex(reference) : next;
      next = column + 1;
      if (column < 0 || column >= MAX_COLUMNS) continue;
      const type = attribute(cell[1], "t");
      const inner = cell[2] ?? "";
      const raw = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
      const value =
        type === "inlineStr"
          ? stringText(inner)
          : raw === undefined
            ? ""
            : type === "s"
              ? (shared[Number(raw)] ?? "")
              : type === "b"
                ? raw === "1"
                  ? "TRUE"
                  : "FALSE"
                : decodeXml(raw);
      cells[column] = value.trim();
    }
    const values = Array.from(cells, (value) => value ?? "");
    if (!values.some(Boolean)) continue;
    if (rows.length >= PRICE_LIST_MAX_ROWS) {
      throw new PriceListFileError(
        `в файле больше ${formatPriceWatchNumber(PRICE_LIST_MAX_ROWS, 0)} строк`
      );
    }
    rows.push(values);
  }
  return rows;
}

function readXlsx(body: Uint8Array): PriceListSheet[] {
  const part = readZip(body);
  const workbook = part("xl/workbook.xml");
  if (!workbook) throw new PriceListFileError("в файле нет листов Excel");
  const relations = new Map(
    [...(part("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b([^>]*?)\/?>/g)].map(
      (match) => [attribute(match[1], "Id"), attribute(match[1], "Target")]
    )
  );
  const shared = (part("xl/sharedStrings.xml") ?? "")
    .split(/<si\b[^>]*?(?:\/>|>)/)
    .slice(1)
    .map((chunk) => stringText(chunk.split("</si>")[0]));
  const sheets: PriceListSheet[] = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    if (sheets.length >= MAX_SHEETS) break;
    if (/\sstate="(?:hidden|veryHidden)"/.test(match[1])) continue;
    const target = relations.get(match[1].match(/(?:^|\s)[\w.-]+:id="([^"]*)"/)?.[1] ?? null);
    if (!target) continue;
    const xml = part(
      target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`
    );
    if (!xml) continue;
    sheets.push({
      name: decodeXml(attribute(match[1], "name") ?? ""),
      rows: readSheetRows(xml, shared),
    });
  }
  if (!sheets.length) throw new PriceListFileError("в файле нет листов Excel");
  return sheets;
}

function readCsv(body: Uint8Array): PriceListSheet {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    // Excel on Windows saves Cyrillic CSV in Windows-1251.
    text = new TextDecoder("windows-1251").decode(body);
  }
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  if (parsed.data.length > PRICE_LIST_MAX_ROWS) {
    throw new PriceListFileError(
      `в файле больше ${formatPriceWatchNumber(PRICE_LIST_MAX_ROWS, 0)} строк`
    );
  }
  return {
    name: null,
    rows: parsed.data.map((row) =>
      row.slice(0, MAX_COLUMNS).map((cell) => String(cell ?? "").trim())
    ),
  };
}

export function readPriceListFile(body: Uint8Array, mimeType: string): PriceListSheet[] {
  return mimeType === OPS_XLSX_MIME_TYPE ? readXlsx(body) : [readCsv(body)];
}

/** A sheet that is not a price list goes to the usual inbox flow as plain text. */
export function priceListSheetsText(sheets: readonly PriceListSheet[]) {
  return sheets
    .map((sheet) =>
      [sheet.name ? `# ${sheet.name}` : "", ...sheet.rows.map((row) => row.join("\t").trimEnd())]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n")
    .slice(0, TEXT_LIMIT)
    .trim();
}

// ---------------------------------------------------------------------------
// What kind of price list it is (pure)
// ---------------------------------------------------------------------------

/** «1 234,50», «1,234.50», «$1234.5», «1.2345E+3» → a positive number, else null. */
export function parsePriceListNumber(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) {
    const number = Number(text);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  if (/^[-−]/.test(text)) return null;
  let clean = text.replace(/[\s  ']/g, "").replace(/[^\d.,]/g, "");
  if (!/\d/.test(clean)) return null;
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    clean = comma > dot ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (comma >= 0) {
    clean = /^\d{1,3}(?:,\d{3})+$/.test(clean) ? clean.replace(/,/g, "") : clean.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(clean)) {
    clean = clean.replace(/\./g, "");
  }
  const number = Number(clean);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function currencyOfPriceText(text: string): PriceWatchCurrency | null {
  const value = text.toLowerCase();
  if (/€|\beur\b|евро|євро/.test(value)) return "EUR";
  if (/\$|\busd\b|дол/.test(value)) return "USD";
  if (/£|\bgbp\b|фунт/.test(value)) return "GBP";
  if (/₴|грн|\buah\b/.test(value)) return "UAH";
  return null;
}

/**
 * Markup from the caption: «+10%», «-5 %», «×1.15»; «+0%» means «these are
 * site prices as they are». Null when the caption gives none.
 */
export function priceListMarkup(caption: string | null | undefined) {
  const text = String(caption ?? "");
  const percent = text.match(/(?:^|\s)([+\-−]?)\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (percent) {
    const value =
      Number(percent[2].replace(",", ".")) * (percent[1] && percent[1] !== "+" ? -1 : 1);
    return Number.isFinite(value) && Math.abs(value) <= 100 ? round(1 + value / 100, 4) : null;
  }
  const times = text.match(/(?:^|\s)[×x*]\s*(\d+(?:[.,]\d+)?)/i);
  if (times) {
    const value = Number(times[1].replace(",", "."));
    return value >= 0.5 && value <= 3 ? value : null;
  }
  return null;
}

/** «Прайс Eventuri.xlsx», «price list», a caption «новые цены» or «+10%». */
export function isPriceListHint(
  fileName: string | null | undefined,
  caption: string | null | undefined
) {
  return (
    /прайс|price|preis|tarif|цін|цен|rrp|msrp|uvp/i.test(`${fileName ?? ""} ${caption ?? ""}`) ||
    priceListMarkup(caption) !== null
  );
}

const headerKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_\-.:#№()/]+/g, " ")
    .trim();

const skuKey = (value: string) => value.replace(/[\s ]+/g, "").toUpperCase();

const cellOf = (row: readonly string[], column: number) =>
  column >= 0 ? (row[column] ?? "").trim() : "";

export type HolleyListColumns = {
  item: number;
  category: number;
  retail: number;
  map: number;
  status: number;
  brand: number;
  description: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

/** The Holley dealer sheet (Dinan, APR): Item, Item_Status, MAP, Retail, sizes, Weight. */
function holleyColumns(header: readonly string[]): HolleyListColumns | null {
  const keys = header.map(headerKey);
  const find = (test: (key: string) => boolean) => keys.findIndex(test);
  const columns = {
    item: find((key) => key === "item"),
    category: find((key) => key === "category"),
    retail: find((key) => key === "retail" || key.startsWith("retail ")),
    map: find((key) => key === "map" || key.startsWith("map ")),
    status: find((key) => key === "item status" || key === "status"),
    brand: find((key) => key === "brand"),
    description: find((key) => key === "description"),
    length: find((key) => key.startsWith("length")),
    width: find((key) => key.startsWith("width")),
    height: find((key) => key.startsWith("height")),
    weight: find((key) => key.startsWith("weight")),
  };
  return columns.item >= 0 && columns.retail >= 0 && columns.map >= 0 ? columns : null;
}

const SKU_HEADER =
  /^(?:sku|sku no|sku nr|sku number|артикул|арт|art|art nr|artikel|artikelnummer|part|part no|part nr|part number|pn|p n|mpn|item|item no|item nr|item number|item code|code|код|код товара|код товару|product code|reference|ref|каталожный номер|каталожний номер)$/;
const PRICE_HEADER =
  /price|цена|ціна|retail|msrp|rrp|uvp|preis|prix|стоимость|вартість|\beur\b|\busd\b|\buah\b|€|\$|₴|грн|£|\bgbp\b/;
const NOT_RETAIL_HEADER =
  /dealer|дилер|\bnet\b|netto|нетто|cost|закуп|wholesale|\bопт|\bmap\b|\bsale\b|акци|discount|скидк|знижк|\bold\b|стар|b2b/;

function tableColumns(header: readonly string[]) {
  const keys = header.map(headerKey);
  const sku = keys.findIndex((key) => SKU_HEADER.test(key));
  if (sku < 0) return null;
  const candidates = keys
    .map((key, index) => ({ key, index }))
    .filter(
      ({ key, index }) => index !== sku && PRICE_HEADER.test(key) && !NOT_RETAIL_HEADER.test(key)
    );
  const price = (
    candidates.find(({ key }) => /retail|msrp|rrp|uvp|розн/.test(key)) ?? candidates[0]
  )?.index;
  return price === undefined ? null : { sku, price };
}

/** The price cell; under a header merged over two columns («MSRP(USD)») it sits to the right. */
function priceCellOf(row: readonly string[], column: number, header: readonly string[]) {
  const own = cellOf(row, column);
  if (parsePriceListNumber(own)) return own;
  for (let next = column + 1; next <= column + 2 && next < row.length; next += 1) {
    if (cellOf(header, next)) break;
    const value = cellOf(row, next);
    if (parsePriceListNumber(value)) return value;
  }
  return own;
}

export type DetectedPriceList =
  | {
      kind: "holley";
      brand: HolleyBrandKey;
      sheet: PriceListSheet;
      headerRow: number;
      columns: HolleyListColumns;
    }
  | { kind: "holley_other"; brands: string[] }
  | {
      kind: "table";
      /** Every sheet with such a header (a supplier splits its list by sheet). */
      parts: Array<{
        sheet: PriceListSheet;
        headerRow: number;
        columns: { sku: number; price: number };
      }>;
      currency: PriceWatchCurrency | null;
    };

function holleyBrandOf(rows: readonly string[][], column: number, fileName: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const brand = cellOf(row, column);
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
  const named = (Object.keys(HOLLEY_BRANDS) as HolleyBrandKey[]).find(
    (key) => headerKey(HOLLEY_BRANDS[key].brand) === headerKey(top)
  );
  if (named) return { brand: named, brands: [top] };
  if (!counts.size) {
    const fromName = /dinan/i.test(fileName) ? "dinan" : /\bapr\b/i.test(fileName) ? "apr" : null;
    if (fromName) return { brand: fromName as HolleyBrandKey, brands: [] };
  }
  return { brand: null, brands: [...counts.keys()].slice(0, 5) };
}

export function detectPriceList(
  sheets: readonly PriceListSheet[],
  fileName = ""
): DetectedPriceList | null {
  const parts: Extract<DetectedPriceList, { kind: "table" }>["parts"] = [];
  let currency: PriceWatchCurrency | null = null;
  for (const sheet of sheets) {
    for (let index = 0; index < Math.min(HEADER_SEARCH_ROWS, sheet.rows.length); index += 1) {
      const header = sheet.rows[index];
      const holley = holleyColumns(header);
      if (holley) {
        const found = holleyBrandOf(sheet.rows.slice(index + 1), holley.brand, fileName);
        // A Holley sheet is never read as a plain table: Retail is the MSRP, not our price.
        return found.brand
          ? { kind: "holley", brand: found.brand, sheet, headerRow: index, columns: holley }
          : { kind: "holley_other", brands: found.brands };
      }
      const table = tableColumns(header);
      if (table) {
        if (!parts.length) currency = currencyOfPriceText(header[table.price] ?? "");
        parts.push({ sheet, headerRow: index, columns: table });
        break;
      }
    }
  }
  return parts.length ? { kind: "table", parts, currency } : null;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const positions = (count: number) => ruPlural(count, "позиция", "позиции", "позиций");

function skuSample(skus: readonly string[]) {
  const shown = skus.slice(0, SAMPLE_SKUS).map((sku) => `<code>${escapeTelegramHtml(sku)}</code>`);
  return `<blockquote expandable>${shown.join(", ")}${skus.length > SAMPLE_SKUS ? ` и ещё ${skus.length - SAMPLE_SKUS}` : ""}</blockquote>`;
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
  } catch {
    return null;
  }
}

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** One SKU of the import-time `<brand>_import.pricing` metafield. */
type StoredHolleyPricing = {
  sku?: string;
  mapUsd?: number | null;
  msrpUsd?: number;
  competitorUsd?: number | null;
};

type PlannedList = {
  title: string;
  origin: `price_list:${string}` | "price_list";
  items: PriceChangeItem[];
  skipped: Array<{ sku: string; reason: string }>;
  notes: string[];
  summary: string;
};

/** Dinan / APR: Ігор's formula per SKU, plus what is new and what is gone. */
async function planHolleyList(input: {
  client: PrismaClient;
  detected: Extract<DetectedPriceList, { kind: "holley" }>;
  fileName: string;
  rates: ShopPriceBookRates;
  now: Date;
}): Promise<PlannedList | { error: string }> {
  const { client, detected, now } = input;
  const brand = HOLLEY_BRANDS[detected.brand];
  const { columns } = detected;
  const products = await client.shopProduct.findMany({
    where: { status: ShopCatalogStatus.ACTIVE, brand: brand.brand },
    select: {
      id: true,
      sku: true,
      titleEn: true,
      titleUa: true,
      variants: { select: { id: true, sku: true } },
      metafields: {
        where: { namespace: brand.namespace, key: { in: ["pricing", "official_url"] } },
        select: { key: true, value: true },
      },
    },
  });
  type SiteItem = {
    productId: string;
    variantId: string | null;
    sku: string;
    title: string;
    url: string | null;
    /** The formula's base at import: MAP, or MSRP without MAP. */
    baseUsd: number | null;
    competitorUsd: number | null;
  };
  const site = new Map<string, SiteItem>();
  for (const product of products) {
    const meta = Object.fromEntries(product.metafields.map((field) => [field.key, field.value]));
    const pricing = parseJson<StoredHolleyPricing[]>(meta.pricing);
    const stored = new Map(
      (Array.isArray(pricing) ? pricing : [])
        .filter((row) => row.sku)
        .map((row) => [skuKey(row.sku!), row])
    );
    const url =
      meta.official_url && /^https:\/\//.test(meta.official_url) ? meta.official_url : null;
    const entries = product.variants.length
      ? product.variants.map((variant) => ({ id: variant.id as string | null, sku: variant.sku }))
      : [{ id: null, sku: product.sku }];
    for (const entry of entries) {
      if (!entry.sku) continue;
      const row = stored.get(skuKey(entry.sku));
      site.set(skuKey(entry.sku), {
        productId: product.id,
        variantId: entry.id,
        sku: entry.sku,
        title: product.titleEn || product.titleUa,
        url,
        baseUsd: positive(row?.mapUsd) ?? positive(row?.msrpUsd),
        competitorUsd: positive(row?.competitorUsd),
      });
    }
  }

  // A competitor price seen by the price watch within a month beats the import-time one.
  const competitorKeys = PRICE_WATCH_SOURCES.filter((source) => source.kind === "competitor").map(
    (source) => source.key
  );
  const [rivals, offSiteKnown, firstFact] = await Promise.all([
    products.length
      ? client.opsSupplierItem.findMany({
          where: {
            sourceKey: { in: competitorKeys },
            productId: { in: products.map((product) => product.id) },
            lastSeenAt: { gte: new Date(now.getTime() - COMPETITOR_FRESH_DAYS * DAY_MS) },
            currency: "UAH",
            price: { gt: 0 },
          },
          select: { sku: true, price: true },
        })
      : Promise.resolve([]),
    client.opsSupplierItem.findMany({
      where: { sourceKey: detected.brand, productId: null },
      select: { supplierKey: true },
    }),
    client.opsSupplierItem.findFirst({
      where: { sourceKey: detected.brand },
      orderBy: { firstSeenAt: "asc" },
      select: { firstSeenAt: true },
    }),
  ]);
  const uahPerUsd = shopUahSaleRate("USD", input.rates);
  const rivalUsd = new Map<string, number[]>();
  for (const rival of rivals) {
    if (!rival.sku) continue;
    const key = skuKey(rival.sku);
    rivalUsd.set(key, [...(rivalUsd.get(key) ?? []), Number(rival.price) / uahPerUsd]);
  }

  const listed = new Set<string>();
  const facts: PriceWatchFact[] = [];
  const findings: Array<{ sku: string; expected: number; currency: "USD" }> = [];
  const offSite: string[] = [];
  const freshOffSite: string[] = [];
  const discontinued: string[] = [];
  const baseMoves: number[] = [];
  const known = new Set(offSiteKnown.map((row) => row.supplierKey));
  for (const row of detected.sheet.rows.slice(detected.headerRow + 1)) {
    const sku = cellOf(row, columns.item);
    if (!sku || !/[0-9A-Za-z]/.test(sku)) continue;
    const rowBrand = cellOf(row, columns.brand);
    if (rowBrand && headerKey(rowBrand) !== headerKey(brand.brand)) continue;
    const key = skuKey(sku);
    if (listed.has(key)) continue;
    // T-shirts, caps and stickers are never imported; one already on the site stays checked.
    if (!site.has(key) && /apparel|merchandise/i.test(cellOf(row, columns.category))) continue;
    listed.add(key);
    const status = cellOf(row, columns.status);
    const active = !status || /^active$/i.test(status);
    const retail = parsePriceListNumber(cellOf(row, columns.retail));
    const map = parsePriceListNumber(cellOf(row, columns.map));
    const weightLb = parsePriceListNumber(cellOf(row, columns.weight));
    const [lengthIn, widthIn, heightIn] = [columns.length, columns.width, columns.height].map(
      (column) => parsePriceListNumber(cellOf(row, column))
    );
    const base = map ?? retail;
    const ours = site.get(key) ?? null;
    facts.push({
      supplierKey: key,
      productId: ours?.productId ?? null,
      variantId: ours?.variantId ?? null,
      sku: ours?.sku ?? sku,
      supplierSku: sku,
      title: ours?.title ?? (cellOf(row, columns.description) || sku),
      url: ours?.url ?? null,
      price: base,
      currency: "USD",
      available: active ? null : false,
      availability: active ? null : "снят с производства",
      weightKg: weightLb ? round(weightLb * POUND_KG, 3) : null,
      lengthCm: lengthIn ? round(lengthIn * 2.54, 1) : null,
      widthCm: widthIn ? round(widthIn * 2.54, 1) : null,
      heightCm: heightIn ? round(heightIn * 2.54, 1) : null,
    });
    if (!ours) {
      if (active && base) {
        offSite.push(sku);
        if (!known.has(key)) freshOffSite.push(sku);
      }
      continue;
    }
    if (!active || !base) {
      discontinued.push(ours.sku);
      continue;
    }
    if (ours.baseUsd) baseMoves.push(((base - ours.baseUsd) / ours.baseUsd) * 100);
    const decision = decideHolleyPriceUsd({
      retailUsd: retail ?? base,
      mapUsd: map,
      weightLb: weightLb ?? 0,
      competitorUsd: rivalUsd.get(key) ?? (ours.competitorUsd ? [ours.competitorUsd] : []),
    });
    findings.push({ sku: ours.sku, expected: decision.priceUsd, currency: "USD" });
  }
  if (!listed.size) return { error: `в файле нет строк ${brand.brand}` };
  const missing = [...site.values()]
    .filter((item) => !listed.has(skuKey(item.sku)))
    .map((item) => item.sku);

  // Facts: MAP, weight and box size for the product card and the future shipping calculator.
  // On a source's first price list, items not on the site are not reported as new.
  const firstList = known.size === 0;
  await savePriceWatchFacts(client, detected.brand, facts, {
    now,
    ...(firstList && firstFact ? { firstSeenAt: firstFact.firstSeenAt } : {}),
  });

  const title = `${brand.brand}: новый прайс`;
  const plan = await planFromFindings(client, title, findings);
  if (!plan.ok) return { error: plan.message };
  const changed = effectivePriceChanges(plan.items);
  const up = baseMoves.filter((move) => move >= 0.5);
  const down = baseMoves.filter((move) => move <= -0.5);
  const gone = [...discontinued, ...missing];
  const def = findPriceWatchSource(detected.brand);
  const notes = [
    `📄 ${escapeTelegramHtml(input.fileName)}: ${formatPriceWatchNumber(listed.size, 0)} ${positions(listed.size)}, на сайте из них ${formatPriceWatchNumber(facts.filter((fact) => fact.productId).length, 0)}`,
    ...(baseMoves.length
      ? [
          up.length || down.length
            ? `MAP: выше у ${up.length}${up.length ? ` (в среднем ${formatPriceWatchPercent(median(up))})` : ""}, ниже у ${down.length}${down.length ? ` (${formatPriceWatchPercent(median(down))})` : ""}`
            : "MAP не изменились",
        ]
      : []),
    ...(offSite.length
      ? [
          `🆕 В прайсе, но нет на сайте: ${offSite.length}${firstList ? "" : ` · новых с прошлого прайса: ${freshOffSite.length}`}`,
          skuSample(firstList ? offSite : freshOffSite.length ? freshOffSite : offSite),
        ]
      : []),
    ...(gone.length
      ? [
          `🚫 Сняты с производства или пропали из прайса: ${gone.length} — их цены не трогаю`,
          skuSample(gone),
        ]
      : []),
    ...(def?.priceList
      ? [
          `После «Применить» прайс считается актуальным — напомню через ${def.priceList.everyDays} дн.`,
        ]
      : []),
  ];
  return {
    title,
    origin: `price_list:${detected.brand}`,
    items: plan.items,
    skipped: plan.skipped,
    notes,
    summary: `Прайс ${brand.brand} «${input.fileName}»: ${listed.size} ${positions(listed.size)}, изменится ${changed.length}`,
  };
}

/** The brand most of these SKUs belong to on the site (a sample is enough). */
async function dominantBrand(client: PrismaClient, skus: readonly string[]) {
  const sample = [...new Set(skus)].slice(0, 2_000);
  const rows = await client.shopProduct.findMany({
    where: {
      status: ShopCatalogStatus.ACTIVE,
      OR: [
        { sku: { in: sample, mode: "insensitive" } },
        { variants: { some: { sku: { in: sample, mode: "insensitive" } } } },
      ],
    },
    select: { brand: true },
  });
  const counts = new Map<string, number>();
  for (const { brand } of rows) if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

type TableRefusal = { refusal: { source: PriceWatchSourceDefinition; rows: number } };

/**
 * Any SKU + price sheet. The markup comes from the caption, or from the brand's
 * price-list rule (Eventuri: IND + 10 %, Revozport: as is); a brand priced by
 * another formula (iPE kits with customs, Fi shipping, Brabus from its site) is
 * not guessed from a file unless the caption says how («+0%» = as is).
 */
async function planTableList(input: {
  client: PrismaClient;
  detected: Extract<DetectedPriceList, { kind: "table" }>;
  fileName: string;
  caption: string | null;
}): Promise<PlannedList | TableRefusal | { error: string }> {
  const { client, detected } = input;
  const seen = new Set<string>();
  const rows: Array<{ sku: string; price: number; currency: PriceWatchCurrency | null }> = [];
  let pounds = 0;
  for (const part of detected.parts) {
    const header = part.sheet.rows[part.headerRow];
    for (const row of part.sheet.rows.slice(part.headerRow + 1)) {
      const sku = cellOf(row, part.columns.sku);
      if (!sku || !/\d/.test(sku)) continue;
      const key = skuKey(sku);
      if (seen.has(key)) continue;
      const cell = priceCellOf(row, part.columns.price, header);
      const price = parsePriceListNumber(cell);
      if (!price) continue;
      seen.add(key);
      const currency = detected.currency ?? currencyOfPriceText(cell);
      if (currency === "GBP") {
        pounds += 1;
        continue;
      }
      rows.push({ sku, price, currency });
    }
  }
  if (!rows.length) {
    return {
      error: pounds
        ? "цены в файле в фунтах (£), а на сайте — в €, $ или ₴. Пришлите цены сайта"
        : "в файле нет строк с артикулом и ценой",
    };
  }
  const source = sourceOfBrand(
    await dominantBrand(
      client,
      rows.map((row) => row.sku)
    )
  );
  const captionMarkup = priceListMarkup(input.caption);
  const ruleMarkup = source?.priceList?.file?.markup;
  if (source && captionMarkup === null && ruleMarkup === undefined) {
    return { refusal: { source, rows: rows.length } };
  }
  const factor = captionMarkup ?? ruleMarkup ?? 1;
  const markupLabel = factor !== 1 ? formatPriceWatchPercent(round((factor - 1) * 100, 1)) : "";
  const plan = await planFromFindings(
    client,
    `Прайс «${input.fileName}»${markupLabel ? ` ${markupLabel}` : ""}`,
    rows.map((row) => ({
      sku: row.sku,
      expected: round(row.price * factor, 2),
      currency: row.currency,
    }))
  );
  if (!plan.ok) return { error: plan.message };
  // The list's own prices for the product card (owners see list price × markup there).
  // Only for a brand priced by its list alone, and only under the brand's own markup.
  if (source?.priceList?.file && !source.check && factor === ruleMarkup) {
    const listed = new Map(rows.map((row) => [skuKey(row.sku), row]));
    await savePriceWatchFacts(
      client,
      source.key,
      plan.items.flatMap((item) => {
        const row = listed.get(skuKey(item.sku));
        return row
          ? [
              {
                supplierKey: skuKey(row.sku),
                productId: item.productId,
                variantId: item.variantId,
                sku: item.sku,
                supplierSku: row.sku,
                title: item.title,
                url: null,
                price: row.price,
                currency: row.currency ?? item.currency,
                available: null,
                availability: null,
                weightKg: null,
              },
            ]
          : [];
      })
    );
  }
  const changed = effectivePriceChanges(plan.items);
  const moves = changed
    .filter((item) => item.before && item.before > 0)
    .map((item) => ((item.after - item.before!) / item.before!) * 100);
  const lower = moves.filter((move) => move <= -1).length;
  const higher = moves.filter((move) => move >= 1).length;
  const shift = median(moves);
  const currencyLabel = detected.currency
    ? { EUR: "€", USD: "$", GBP: "£", UAH: "₴" }[detected.currency]
    : "как у товара на сайте";
  const rule =
    markupLabel && captionMarkup === null && source
      ? ` (правило ${escapeTelegramHtml(source.title)}: ${escapeTelegramHtml(source.formula)})`
      : "";
  const notes = [
    `📄 ${escapeTelegramHtml(input.fileName)}: ${formatPriceWatchNumber(rows.length + pounds, 0)} ${positions(rows.length + pounds)} с ценой, на сайте найдено ${plan.items.length}`,
    `Цены из файла ставлю как цены сайта${markupLabel ? `, с наценкой ${markupLabel}${rule}` : ""}; валюта: ${currencyLabel}.`,
    // A supplier's purchase list sent without a markup moves almost every price one way.
    ...(moves.length >= 5 && Math.abs(shift) >= 3 && Math.max(lower, higher) >= moves.length * 0.7
      ? [
          `⚠️ Почти все цены ${shift < 0 ? "ниже" : "выше"}, чем на сайте (в среднем ${formatPriceWatchPercent(shift)}). Если это прайс поставщика, а не цены сайта, нажмите «Отмена» и пришлите файл с подписью наценки, например «+10%».`,
        ]
      : []),
    ...(pounds ? [`Пропущено ${pounds} — цены в фунтах.`] : []),
    ...(source?.priceList
      ? [`После «Применить» прайс ${escapeTelegramHtml(source.title)} считается актуальным.`]
      : []),
  ];
  return {
    title: plan.title,
    origin: source?.priceList ? `price_list:${source.key}` : "price_list",
    items: plan.items,
    skipped: plan.skipped,
    notes,
    summary: `Прайс «${input.fileName}»: ${rows.length} ${positions(rows.length)}, изменится ${changed.length}`,
  };
}

/** Why the bot does not price this brand from a file, and «прайс актуален» for price-list brands. */
async function refusalReply(input: {
  client: PrismaClient;
  refusal: TableRefusal["refusal"];
  fileName: string;
  button: PriceButtonFactory;
}): Promise<PriceListFileOutcome> {
  const { source, rows } = input.refusal;
  const row = source.priceList
    ? await input.client.opsPriceWatchSource.findUnique({
        where: { key: source.key },
        select: { id: true },
      })
    : null;
  const ack = row ? await input.button("price_ack", row.id, "✅ Прайс актуален", "success") : null;
  return {
    kind: "reply",
    reply: {
      text: [
        `📄 ${escapeTelegramHtml(input.fileName)}: ${formatPriceWatchNumber(rows, 0)} ${positions(rows)} с ценой, бренд ${escapeTelegramHtml(source.title)}.`,
        `Цены ${escapeTelegramHtml(source.title)} на сайте считаются так: ${escapeTelegramHtml(source.formula)} — из этого файла я их не пересчитаю.${
          source.check ? " Цены у поставщика я и так сверяю автоматически." : ""
        }`,
        "",
        "Если в файле уже готовые цены сайта — пришлите его ещё раз с подписью «+0%» (или с наценкой, например «+10%»).",
        ...(ack
          ? ["Если прайс просто новый, а цены на сайте верные — нажмите «Прайс актуален»."]
          : []),
      ].join("\n"),
      parseMode: "HTML",
      ...(ack ? { replyMarkup: { inline_keyboard: [[ack]] } } : {}),
    },
    summary: `Прайс «${input.fileName}»: ${source.title} — формула не из файла`,
  };
}

// ---------------------------------------------------------------------------
// Entry point from the bot
// ---------------------------------------------------------------------------

export type PriceListFileOutcome =
  /** Answered: a preview with «Применить», «already current», or why it cannot be read. */
  | { kind: "reply"; reply: PriceReply; summary: string }
  /** A price list from someone who cannot change prices: it stays in the inbox. */
  | { kind: "not_owner"; summary: string };

/**
 * A spreadsheet sent to the bot. Null when it is not a price list (the inbox
 * then reads it as text). Facts (weight, size, MSRP) are saved right away;
 * prices change only after «Применить».
 */
export async function handlePriceListFile(input: {
  client: PrismaClient;
  actorAdminUserId: string;
  body: Uint8Array;
  mimeType: string;
  fileName: string | null;
  caption: string | null;
  telegramChatId: bigint | null;
  button: PriceButtonFactory;
  actor?: PriceChangeActor | null;
  now?: Date;
}): Promise<PriceListFileOutcome | null> {
  const now = input.now ?? new Date();
  const fileName = (input.fileName || "прайс").slice(0, 80);
  const reply = (text: string, summary: string): PriceListFileOutcome => ({
    kind: "reply",
    reply: { text, parseMode: "HTML" },
    summary,
  });
  let sheets: PriceListSheet[];
  try {
    sheets = readPriceListFile(input.body, input.mimeType);
  } catch (error) {
    if (!(error instanceof PriceListFileError)) throw error;
    return reply(
      `⚠️ Не смог прочитать «${escapeTelegramHtml(fileName)}»: ${escapeTelegramHtml(error.message)}.\nСохраните как .xlsx или .csv и пришлите ещё раз.`,
      `Прайс «${fileName}» не прочитан: ${error.message}`
    );
  }
  const detected = detectPriceList(sheets, fileName);
  if (!detected) return null;
  // Any sheet with SKU and price columns (an order, an invoice) is not a price
  // list unless its name or caption says so; the dealer format speaks for itself.
  if (detected.kind === "table" && !isPriceListHint(fileName, input.caption)) return null;
  const actor =
    input.actor === undefined
      ? await loadPriceChangeActor(input.client, input.actorAdminUserId)
      : input.actor;
  if (!actor || !canChangePrices(actor)) {
    return {
      kind: "not_owner",
      summary: `Прайс-лист «${fileName}» — посмотреть и применить цены может владелец (переслать файл боту).`,
    };
  }
  if (detected.kind === "holley_other") {
    return reply(
      `📄 «${escapeTelegramHtml(fileName)}» — это дилерский прайс Holley${
        detected.brands.length ? ` (${escapeTelegramHtml(detected.brands.join(", "))})` : ""
      }, а из Holley на сайте только Dinan и APR. Цены не менял.`,
      `Прайс «${fileName}»: бренды Holley не с сайта`
    );
  }
  const settings = await input.client.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  const rates = normalizeShopCurrencyRates(settings?.currencyRates);
  if (!isShopSourcePriceBook(rates)) {
    return reply(
      "Прайс-бук магазина не настроен — менять цены из бота нельзя.",
      `Прайс «${fileName}»: прайс-бук не настроен`
    );
  }
  const planned =
    detected.kind === "holley"
      ? await planHolleyList({ client: input.client, detected, fileName, rates, now })
      : await planTableList({ client: input.client, detected, fileName, caption: input.caption });
  if ("error" in planned) {
    return reply(
      `⚠️ «${escapeTelegramHtml(fileName)}»: ${escapeTelegramHtml(planned.error)}.`,
      `Прайс «${fileName}»: ${planned.error}`
    );
  }
  if ("refusal" in planned) {
    return refusalReply({
      client: input.client,
      refusal: planned.refusal,
      fileName,
      button: input.button,
    });
  }
  if (!effectivePriceChanges(planned.items).length) {
    // Nothing to change: the site already follows this list.
    const nextReminderAt = (await markPriceListCurrent(input.client, planned.origin, now))
      ?.nextReminderAt;
    const text = (notes: string[]) =>
      [
        `✅ <b>${escapeTelegramHtml(planned.title)}</b>`,
        "Цены на сайте уже совпадают с прайсом — менять нечего.",
        "",
        ...notes.filter((note) => !note.startsWith("После «Применить»")),
        ...(nextReminderAt
          ? [
              "",
              `Прайс отмечен актуальным, следующее напоминание — ${new Intl.DateTimeFormat(
                "ru-RU",
                {
                  timeZone: "Europe/Kyiv",
                  day: "numeric",
                  month: "long",
                }
              ).format(nextReminderAt)}.`,
            ]
          : []),
      ].join("\n");
    const full = text(planned.notes);
    return reply(
      // Too long for Telegram: drop the SKU lists, never cut a tag in half.
      full.length > 3_900
        ? text(planned.notes.filter((note) => !note.startsWith("<blockquote")))
        : full,
      `${planned.summary}; цены уже совпадают`
    );
  }
  const preview = await proposePriceChange({
    client: input.client,
    actor,
    origin: planned.origin,
    plan: { ok: true, title: planned.title, items: planned.items, skipped: planned.skipped },
    notes: planned.notes,
    telegramChatId: input.telegramChatId,
    button: input.button,
    now,
  });
  return { kind: "reply", reply: preview, summary: planned.summary };
}
