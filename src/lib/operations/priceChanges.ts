import { randomUUID } from "node:crypto";

import {
  OpsJobStage,
  OpsJobStatus,
  ShopCatalogStatus,
  type OpsPriceChange,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import {
  ADMIN_PERMISSIONS,
  OWNER_ROLE_KEY,
  matchesAdminPermission,
} from "@/lib/admin/adminPermissions";
import type { AdminSession } from "@/lib/adminAuth";
import { writeAdminAuditLog } from "@/lib/adminRbac";
import { opsAdminLink } from "@/lib/operations/adminLinks";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";
import {
  findNovaPoshtaCity,
  NP_COUNTRYWIDE_CITY_REF,
  NP_ESTIMATE_MARK,
  NP_OTHER_CARRIERS_NOTE,
  novaPoshtaCardLine,
  novaPoshtaDeliveryDay,
  novaPoshtaPriceText,
  quoteNovaPoshta,
  type NovaPoshtaSeat,
} from "@/lib/operations/novaPoshta";
import { buildOrderCard } from "@/lib/operations/orderCard";
import {
  deliveryPromptFor,
  looksLikeSku,
  parseDeliveryCommand,
  parseOrderCommand,
  parsePriceCommand,
  parseProductLink,
  type PriceCommand,
} from "@/lib/operations/priceCommands";
import {
  comparePriceWithFormula,
  competitorSourcesForBrand,
  type PriceWatchFinding,
  type PriceWatchSummary,
} from "@/lib/operations/priceWatchChecks";
import {
  escapeTelegramHtml,
  formatPriceWatchMoney,
  formatPriceWatchNumber,
  formatPriceWatchPercent,
  priceWatchItemName,
  ruPlural,
  systemicPriceWatchDifference,
  systemicPriceWatchWarning,
} from "@/lib/operations/priceWatchReport";
import {
  PRICE_WATCH_SOURCES,
  findPriceWatchSource,
  type PriceWatchCurrency,
  type PriceWatchSourceDefinition,
} from "@/lib/operations/priceWatchSources";
import { absoluteUrl } from "@/lib/seo";
import { normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import { DEFAULT_BACKORDER_LEAD_DAYS, isShopLeadTimeOnRequest } from "@/lib/shopGoogleAvailability";
import {
  resolveShopShippingClass,
  SHOP_SHIPPING_CLASS_PRICE_UAH,
  type ShopShippingClass,
} from "@/lib/shopShippingClass";
import {
  readShopStorefrontDisplay,
  SHOP_STOREFRONT_DISPLAY_KEY,
  SHOP_STOREFRONT_DISPLAY_NAMESPACE,
} from "@/lib/shopStorefrontDisplay";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { getShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";
import type { applyAdminPricingPatchInTransaction } from "@/lib/shopAdminVariants";
import type { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import type { coordinateShopCatalogProductMutationWithClient } from "@/lib/shopCatalogMutationCoordinator.server";
import { managedAdminPricingPatch } from "@/lib/shopManagedAdminPricing";
import {
  isShopSourcePriceBook,
  repriceShopSourceMoney,
  type ShopPriceBookRates,
} from "@/lib/shopPriceBookCurrency";
import type { revalidateShopStorefrontProductDetail } from "@/lib/shopStorefrontRevalidation";

/**
 * Price changes from Telegram, for owners only. A change is always shown first
 * («что изменится»), applied only after «Применить» through the same catalog
 * path as the admin pricing page (price book, audit log, storefront refresh),
 * and can be undone for 30 minutes. A whole brand goes in the background.
 */

export const PRICE_CHANGE_UNDO_MS = 30 * 60 * 1000;
/** A change of more than 30 % asks once more. */
export const PRICE_CHANGE_BIG_SHARE = 0.3;
/** Up to this many prices are applied right away; more go to a background job. */
export const PRICE_CHANGE_INLINE_LIMIT = 20;
export const PRICE_CHANGE_JOB_TYPE = "price_change_apply";
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_LINES = 12;
const PRICE_CHANGE_MESSAGE_LIMIT = 3_900;
const DAY_MS = 24 * 60 * 60 * 1000;

type Currency = PriceWatchCurrency & ("EUR" | "USD" | "UAH");
const PRICE_FIELD: Record<Currency, "priceEur" | "priceUsd" | "priceUah"> = {
  EUR: "priceEur",
  USD: "priceUsd",
  UAH: "priceUah",
};

export type PriceChangeItem = {
  productId: string;
  /** Null when the product has no variants and carries the price itself. */
  variantId: string | null;
  sku: string;
  title: string;
  currency: Currency;
  before: number | null;
  after: number;
  deltaPct: number | null;
  big: boolean;
  status?: "applied" | "skipped" | "failed";
  note?: string;
};

export type PriceChangeActor = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  roleKeys: string[];
};

/** «Тільки власники»: the owner role and the pricing permission. */
export function canChangePrices(actor: Pick<PriceChangeActor, "permissions" | "roleKeys">) {
  return (
    actor.roleKeys.includes(OWNER_ROLE_KEY) &&
    matchesAdminPermission(actor.permissions, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE)
  );
}

export async function loadPriceChangeActor(
  client: Pick<PrismaClient, "adminUser">,
  adminUserId: string
): Promise<PriceChangeActor | null> {
  const user = await client.adminUser.findFirst({
    where: { id: adminUserId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      roles: { select: { role: { select: { key: true, permissions: true } } } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    permissions: user.roles.flatMap(({ role }) => role.permissions),
    roleKeys: user.roles.map(({ role }) => role.key),
  };
}

// Commands live in priceCommands.ts (pure, read by the webhook too).
export { looksLikeSku, parsePriceCommand, type PriceCommand } from "@/lib/operations/priceCommands";

const normalizeName = (value: string) => value.toLowerCase().replace(/[\s\-_.·]+/g, "");

/** A brand or a source by name: «Brabus», «ct carbon», «ct-carbon». */
export function resolvePriceBrand(target: string): {
  title: string;
  brands: string[];
  source: PriceWatchSourceDefinition | null;
} | null {
  const wanted = normalizeName(target);
  for (const source of PRICE_WATCH_SOURCES) {
    for (const brand of source.brands) {
      if (normalizeName(brand) === wanted) {
        return { title: brand, brands: [brand], source };
      }
    }
  }
  for (const source of PRICE_WATCH_SOURCES) {
    if (
      source.brands.length &&
      (normalizeName(source.title) === wanted || normalizeName(source.key) === wanted)
    ) {
      return { title: source.title, brands: [...source.brands], source };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

const PRICE_SELECT = {
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  priceSourceCurrency: true,
  compareAtEur: true,
  compareAtUsd: true,
  compareAtUah: true,
} as const;

type PriceRecord = {
  priceEur: Prisma.Decimal | number | null;
  priceUsd: Prisma.Decimal | number | null;
  priceUah: Prisma.Decimal | number | null;
  priceSourceCurrency: string | null;
  compareAtEur?: Prisma.Decimal | number | null;
  compareAtUsd?: Prisma.Decimal | number | null;
  compareAtUah?: Prisma.Decimal | number | null;
};

const PRODUCT_SELECT = {
  id: true,
  sku: true,
  slug: true,
  brand: true,
  titleEn: true,
  titleUa: true,
  ...PRICE_SELECT,
  variants: {
    orderBy: { position: "asc" as const },
    select: { id: true, sku: true, ...PRICE_SELECT },
  },
} satisfies Prisma.ShopProductSelect;

type PlannedProduct = Prisma.ShopProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

const num = (value: Prisma.Decimal | number | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);

function hasOwnPrice(record: PriceRecord) {
  return num(record.priceEur) > 0 || num(record.priceUsd) > 0 || num(record.priceUah) > 0;
}

/** The record that carries the price: the variant, or the product it inherits from. */
function priceOwner(product: PlannedProduct, variant: PlannedProduct["variants"][number] | null) {
  return variant && hasOwnPrice(variant) ? variant : product;
}

/** The native price (the one the others are derived from) and its currency. */
export function nativePrice(record: PriceRecord): { currency: Currency; amount: number } | null {
  const declared = record.priceSourceCurrency as Currency | null;
  const owned = (["EUR", "USD", "UAH"] as const).filter(
    (currency) => num(record[PRICE_FIELD[currency]]) > 0
  );
  const currency =
    declared && owned.includes(declared) ? declared : owned.length === 1 ? owned[0] : null;
  return currency ? { currency, amount: num(record[PRICE_FIELD[currency]]) } : null;
}

/** The price in another currency, as the storefront converts it. */
function priceIn(record: PriceRecord, currency: Currency, rates: ShopPriceBookRates) {
  const native = nativePrice(record);
  if (!native) return null;
  if (native.currency === currency) return native.amount;
  const money = repriceShopSourceMoney(
    {
      eur: num(record.priceEur),
      usd: num(record.priceUsd),
      uah: num(record.priceUah),
      sourceCurrency: native.currency,
    },
    rates
  );
  return currency === "EUR" ? money.eur : currency === "USD" ? money.usd : money.uah;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function makeItem(input: {
  product: PlannedProduct;
  variant: PlannedProduct["variants"][number] | null;
  currency: Currency;
  before: number | null;
  after: number;
}): PriceChangeItem {
  const after = round2(input.after);
  const deltaPct =
    input.before && input.before > 0
      ? Math.round(((after - input.before) / input.before) * 1000) / 10
      : null;
  return {
    productId: input.product.id,
    variantId: input.variant?.id ?? null,
    sku: input.variant?.sku ?? input.product.sku ?? input.product.slug,
    title: input.product.titleEn || input.product.titleUa,
    currency: input.currency,
    before: input.before === null ? null : round2(input.before),
    after,
    deltaPct,
    big: deltaPct !== null && Math.abs(deltaPct) > PRICE_CHANGE_BIG_SHARE * 100,
  };
}

/** Products and variants the price belongs to: one per variant, or the product itself. */
function priceTargets(product: PlannedProduct) {
  return product.variants.length ? product.variants.map((variant) => variant) : [null];
}

async function loadRates(client: Pick<PrismaClient, "shopSettings">) {
  const settings = await client.shopSettings.findUnique({
    where: { key: "shop" },
    select: { currencyRates: true },
  });
  return normalizeShopCurrencyRates(settings?.currencyRates);
}

export type PriceChangePlan =
  | {
      ok: true;
      title: string;
      items: PriceChangeItem[];
      skipped: Array<{ sku: string; reason: string }>;
      /** Warnings shown in the preview, such as a systemic difference at the supplier. */
      notes?: string[];
    }
  | { ok: false; message: string };

async function findItemBySku(client: Pick<PrismaClient, "shopProduct">, sku: string) {
  const products = await client.shopProduct.findMany({
    where: {
      status: ShopCatalogStatus.ACTIVE,
      OR: [
        { sku: { equals: sku, mode: "insensitive" } },
        { variants: { some: { sku: { equals: sku, mode: "insensitive" } } } },
      ],
    },
    take: 2,
    select: PRODUCT_SELECT,
  });
  const product = products[0];
  if (!product) return null;
  const variant =
    product.variants.find((entry) => entry.sku?.toLowerCase() === sku.toLowerCase()) ??
    (product.variants.length === 1 ? product.variants[0] : null);
  return { product, variant, ambiguous: products.length > 1 };
}

/** A product picked from search results or a link: by id or slug, its variant when known. */
async function findItemByRef(
  client: Pick<PrismaClient, "shopProduct">,
  ref: { productId?: string; slug?: string; variantId?: string | null }
) {
  const product = await client.shopProduct.findFirst({
    where: {
      status: ShopCatalogStatus.ACTIVE,
      ...(ref.productId ? { id: ref.productId } : { slug: ref.slug ?? "" }),
    },
    select: PRODUCT_SELECT,
  });
  if (!product) return null;
  const variant =
    product.variants.find((entry) => entry.id === ref.variantId) ??
    (product.variants.length === 1 ? product.variants[0] : null);
  return { product, variant, ambiguous: false };
}

const SEARCH_STOP_WORDS = new Set([
  "для",
  "for",
  "the",
  "and",
  "with",
  "на",
  "из",
  "від",
  "и",
  "і",
  "з",
]);
const SEARCH_RESULTS = 8;

/**
 * «товар Akrapovic M3 G80»: every word must appear in the title, SKU or brand
 * (any order, any case; «g63» also as «G 63» or «G-63», as titles write it).
 * Whole words count more; among equal matches the dearer item — the system
 * rather than its clamp — comes first.
 */
export async function searchProductsByText(
  client: Pick<PrismaClient, "shopProduct">,
  query: string
) {
  const words = [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[«»"'(),;:!?]+/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2 && !SEARCH_STOP_WORDS.has(word))
    ),
  ].slice(0, 6);
  if (!words.length) return { total: 0, items: [] };
  const spellings = (word: string) => {
    const split = word.match(/^(\p{L}+)(\d+)$/u);
    return split ? [word, `${split[1]} ${split[2]}`, `${split[1]}-${split[2]}`] : [word];
  };
  const rows = await client.shopProduct.findMany({
    where: {
      status: ShopCatalogStatus.ACTIVE,
      AND: words.map((word) => ({
        OR: spellings(word).flatMap((spelling) => [
          { titleEn: { contains: spelling, mode: "insensitive" as const } },
          { titleUa: { contains: spelling, mode: "insensitive" as const } },
          { sku: { contains: spelling, mode: "insensitive" as const } },
          { brand: { contains: spelling, mode: "insensitive" as const } },
        ]),
      })),
    },
    take: 60,
    select: {
      id: true,
      sku: true,
      brand: true,
      titleEn: true,
      titleUa: true,
      isPublished: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      variants: { take: 1, orderBy: { position: "asc" }, select: { sku: true } },
    },
  });
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWord = (text: string, word: string) =>
    spellings(word).some((spelling) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${escape(spelling)}(?![\\p{L}\\p{N}])`, "iu").test(text)
    );
  // Only to order the results: the price in euros, roughly.
  const roughEur = (row: (typeof rows)[number]) =>
    num(row.priceEur) || num(row.priceUsd) / 1.14 || num(row.priceUah) / 50;
  const scored = rows
    .map((row) => {
      const title = `${row.titleEn} ${row.titleUa}`;
      const score =
        words.filter((word) => wholeWord(title, word)).length * 2 +
        words.filter((word) => row.brand && wholeWord(row.brand, word)).length +
        (row.isPublished ? 1 : 0);
      return { row, score };
    })
    .sort((left, right) => right.score - left.score || roughEur(right.row) - roughEur(left.row));
  return {
    total: rows.length,
    items: scored.slice(0, SEARCH_RESULTS).map(({ row }) => ({
      productId: row.id,
      sku: row.sku ?? row.variants[0]?.sku ?? null,
      brand: row.brand,
      title: row.titleEn || row.titleUa,
    })),
  };
}

/** What a command would change; nothing is written. */
export async function planPriceChange(
  client: Pick<
    PrismaClient,
    "shopProduct" | "shopSettings" | "opsPriceWatchRun" | "opsPriceWatchSource"
  >,
  command: Exclude<PriceCommand, { kind: "lookup" }>
): Promise<PriceChangePlan> {
  const rates = await loadRates(client);
  if (!isShopSourcePriceBook(rates)) {
    return { ok: false, message: "Прайс-бук магазина не настроен — менять цены из бота нельзя." };
  }
  const skipped: Array<{ sku: string; reason: string }> = [];
  if (command.kind === "set") {
    const found = await findItemBySku(client, command.target);
    if (!found) return { ok: false, message: `Не нашёл товар с артикулом «${command.target}».` };
    const owner = priceOwner(found.product, found.variant);
    const native = nativePrice(owner);
    const currency = command.currency ?? native?.currency ?? null;
    if (!currency)
      return { ok: false, message: "У товара нет цены — укажите валюту: €, $ или грн." };
    const before = priceIn(owner, currency, rates);
    return {
      ok: true,
      title: `${found.variant?.sku ?? found.product.sku ?? command.target}: новая цена`,
      items: [
        makeItem({
          product: found.product,
          variant: found.variant,
          currency,
          before,
          after: command.amount,
        }),
      ],
      skipped,
    };
  }
  if (command.kind === "percent") {
    if (Math.abs(command.percent) > 50 || command.percent === 0) {
      return { ok: false, message: "Процент должен быть от −50 до +50 и не ноль." };
    }
    const factor = 1 + command.percent / 100;
    const brand = resolvePriceBrand(command.target);
    const products = brand
      ? await client.shopProduct.findMany({
          where: {
            status: ShopCatalogStatus.ACTIVE,
            isPublished: true,
            brand: { in: brand.brands },
          },
          orderBy: { id: "asc" },
          select: PRODUCT_SELECT,
        })
      : await findItemBySku(client, command.target).then((found) => (found ? [found.product] : []));
    if (!products.length) {
      return { ok: false, message: `Не нашёл бренд или товар «${command.target}».` };
    }
    const items: PriceChangeItem[] = [];
    for (const product of products) {
      for (const variant of priceTargets(product)) {
        const owner = priceOwner(product, variant);
        const native = nativePrice(owner);
        const sku = variant?.sku ?? product.sku ?? product.slug;
        if (!native) {
          skipped.push({ sku, reason: "нет цены" });
          continue;
        }
        if (
          num(owner.compareAtEur) > 0 ||
          num(owner.compareAtUsd) > 0 ||
          num(owner.compareAtUah) > 0
        ) {
          skipped.push({ sku, reason: "акционная цена" });
          continue;
        }
        items.push(
          makeItem({
            product,
            variant,
            currency: native.currency,
            before: native.amount,
            after: native.amount * factor,
          })
        );
      }
    }
    return {
      ok: true,
      title: `${brand?.title ?? command.target}: ${formatPriceWatchPercent(command.percent)} ко всем ценам`,
      items,
      skipped,
    };
  }
  // По формуле: the differences found by the latest check of the brand's source.
  const brand = resolvePriceBrand(command.target);
  const found = brand ? null : await findItemBySku(client, command.target);
  const source = brand?.source ?? (found ? sourceOfBrand(found.product.brand) : null);
  if (!source || (source.kind !== "formula" && source.kind !== "competitor")) {
    return {
      ok: false,
      message: `Для «${command.target}» нет формулы в проверке цен — используйте «цена … +5%» или точную цену.`,
    };
  }
  const { findings, systemic } = await latestFormulaRun(client, source.key);
  const wanted = found
    ? findings.filter((finding) =>
        [found.variant?.sku, found.product.sku].some(
          (sku) => sku && sku.toLowerCase() === finding.sku.toLowerCase()
        )
      )
    : findings;
  if (!wanted.length) {
    return {
      ok: false,
      message: `По последней проверке ${source.title} всё совпадает с формулой — менять нечего.`,
    };
  }
  const plan = await planFromFindings(
    client,
    `${found ? (found.product.sku ?? command.target) : source.title}: по формуле`,
    wanted
  );
  return plan.ok && systemic && !found
    ? { ...plan, notes: [systemicPriceWatchWarning(systemic)] }
    : plan;
}

export function sourceOfBrand(brand: string | null) {
  if (!brand) return null;
  return PRICE_WATCH_SOURCES.find((source) => source.brands.includes(brand)) ?? null;
}

/** The formula differences of a source's latest check, and whether they are systemic. */
async function latestFormulaRun(
  client: Pick<PrismaClient, "opsPriceWatchRun" | "opsPriceWatchSource">,
  sourceKey: string
) {
  const source = await client.opsPriceWatchSource.findUnique({
    where: { key: sourceKey },
    select: { id: true },
  });
  if (!source) return { findings: [], systemic: null };
  const run = await client.opsPriceWatchRun.findFirst({
    where: { sourceId: source.id },
    orderBy: { finishedAt: "desc" },
    select: { findings: true, summary: true, checked: true },
  });
  const findings = Array.isArray(run?.findings) ? (run.findings as PriceWatchFinding[]) : [];
  return {
    findings: findings.filter(
      (finding) =>
        (finding.kind === "cheaper" || finding.kind === "dearer") && Number(finding.expected) > 0
    ),
    systemic: systemicPriceWatchDifference(
      run?.summary as PriceWatchSummary | null | undefined,
      run?.checked ?? 0
    ),
  };
}

async function latestFormulaFindings(
  client: Pick<PrismaClient, "opsPriceWatchRun" | "opsPriceWatchSource">,
  sourceKey: string
) {
  return (await latestFormulaRun(client, sourceKey)).findings;
}

/**
 * Items that set each SKU to the price its formula (or a price list) asks for.
 * A null currency means the product's own price currency.
 */
export async function planFromFindings(
  client: Pick<PrismaClient, "shopProduct" | "shopSettings">,
  title: string,
  findings: readonly {
    sku: string;
    expected?: number | null;
    currency: PriceWatchFinding["currency"] | null;
  }[]
): Promise<PriceChangePlan> {
  const rates = await loadRates(client);
  const skus = [...new Set(findings.map((finding) => finding.sku))];
  // A price list can hold thousands of SKUs: look them up in parts.
  const products: PlannedProduct[] = [];
  for (let index = 0; index < skus.length; index += 2_000) {
    const part = skus.slice(index, index + 2_000);
    products.push(
      ...(await client.shopProduct.findMany({
        where: {
          status: ShopCatalogStatus.ACTIVE,
          OR: [
            { sku: { in: part, mode: "insensitive" } },
            { variants: { some: { sku: { in: part, mode: "insensitive" } } } },
          ],
        },
        select: PRODUCT_SELECT,
      }))
    );
  }
  const bySku = new Map<
    string,
    { product: PlannedProduct; variant: PlannedProduct["variants"][number] | null }
  >();
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.sku) bySku.set(variant.sku.toLowerCase(), { product, variant });
    }
    if (product.sku && !bySku.has(product.sku.toLowerCase())) {
      bySku.set(product.sku.toLowerCase(), {
        product,
        variant: product.variants.length === 1 ? product.variants[0] : null,
      });
    }
  }
  const items: PriceChangeItem[] = [];
  const skipped: Array<{ sku: string; reason: string }> = [];
  for (const finding of findings) {
    const hit = bySku.get(finding.sku.toLowerCase());
    if (!hit) {
      skipped.push({ sku: finding.sku, reason: "нет на сайте" });
      continue;
    }
    const owner = priceOwner(hit.product, hit.variant);
    const currency = (finding.currency ?? nativePrice(owner)?.currency ?? null) as Currency | null;
    if (!currency || !PRICE_FIELD[currency]) {
      skipped.push({
        sku: finding.sku,
        reason: finding.currency ? "валюта не €, $ или ₴" : "нет цены",
      });
      continue;
    }
    items.push(
      makeItem({
        product: hit.product,
        variant: hit.variant,
        currency,
        before: priceIn(owner, currency, rates),
        after: Number(finding.expected),
      })
    );
  }
  return { ok: true, title, items, skipped };
}

// ---------------------------------------------------------------------------
// Proposals and Telegram texts
// ---------------------------------------------------------------------------

export type PriceButtonFactory = (
  action:
    | "price_apply"
    | "price_apply_big"
    | "price_cancel"
    | "price_undo"
    | "price_formula"
    | "price_card_formula"
    | "price_card_client_text"
    | "price_card_delivery"
    | "price_card_open"
    | "price_lead_undo"
    | "order_client_text"
    | "price_ack",
  resourceId: string,
  label: string,
  style?: "primary" | "success" | "danger",
  /** Kept with the button, e.g. the variant of the card. */
  value?: string
) => Promise<OpsTelegramInlineButton | null>;

export type PriceReply = {
  text: string;
  replyMarkup?: OpsTelegramReplyMarkup;
  parseMode: "HTML";
  /** Sent as a photo with the text as its caption; the text alone when Telegram cannot. */
  photoUrl?: string;
  /** A prompt: Telegram opens a reply to it, and the answer comes back as a command. */
  forceReply?: { placeholder: string };
};

function itemsOf(change: Pick<OpsPriceChange, "items">): PriceChangeItem[] {
  return Array.isArray(change.items) ? (change.items as unknown as PriceChangeItem[]) : [];
}

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function changeLine(item: PriceChangeItem) {
  const name = escapeTelegramHtml(priceWatchItemName(item));
  return `<code>${name}</code>  ${formatPriceWatchMoney(item.before, item.currency)} → <b>${formatPriceWatchMoney(
    item.after,
    item.currency
  )}</b>${item.deltaPct !== null ? ` (${formatPriceWatchPercent(item.deltaPct)})` : ""}${item.big ? " ⚠️" : ""}`;
}

const prices = (count: number) => ruPlural(count, "цена", "цены", "цен");

/** «на 13,1 %»: the size of a difference, its direction is said in words. */
const unsignedPercent = (value: number) => `${formatPriceWatchNumber(Math.abs(value), 1)} %`;

/**
 * The preview. `notes` are whole lines (a price list's summary); when the text
 * is too long for Telegram the «…и ещё» list goes first, then later notes, so
 * no HTML tag is ever cut in half.
 */
export function renderPriceChangePreview(input: {
  title: string;
  items: PriceChangeItem[];
  skipped: Array<{ sku: string; reason: string }>;
  notes?: string[];
}) {
  const sorted = [...input.items].sort(
    (left, right) => Math.abs(right.deltaPct ?? 0) - Math.abs(left.deltaPct ?? 0)
  );
  const big = sorted.filter((item) => item.big).length;
  const reasons = new Map<string, number>();
  for (const entry of input.skipped)
    reasons.set(entry.reason, (reasons.get(entry.reason) ?? 0) + 1);
  const rest = sorted.slice(PREVIEW_LINES);
  const render = (showRest: boolean, notes: string[]) =>
    [
      `✏️ <b>${escapeTelegramHtml(input.title)}</b>`,
      `Изменится: ${formatPriceWatchNumber(sorted.length, 0)} ${prices(sorted.length)}${
        big ? ` · ⚠️ больше чем на 30 %: ${big}` : ""
      }`,
      "",
      ...sorted.slice(0, PREVIEW_LINES).map(changeLine),
      ...(rest.length
        ? [
            showRest
              ? `<blockquote expandable>…и ещё ${rest.length}: ${rest
                  .slice(0, 50)
                  .map(
                    (item) =>
                      `${escapeTelegramHtml(item.sku)} ${formatPriceWatchPercent(item.deltaPct)}`
                  )
                  .join(", ")}${rest.length > 50 ? " …" : ""}</blockquote>`
              : `…и ещё ${rest.length}`,
          ]
        : []),
      ...(reasons.size
        ? [
            "",
            `Пропущено: ${[...reasons.entries()].map(([reason, count]) => `${count} — ${reason}`).join(", ")}`,
          ]
        : []),
      ...(notes.length ? ["", ...notes] : []),
      "",
      "Остальные валюты пересчитаются по прайс-буку. Отменить можно в течение 30 минут.",
    ].join("\n");
  const notes = input.notes ?? [];
  let text = render(true, notes);
  if (text.length > PRICE_CHANGE_MESSAGE_LIMIT) text = render(false, notes);
  for (
    let keep = notes.length - 1;
    text.length > PRICE_CHANGE_MESSAGE_LIMIT && keep >= 0;
    keep -= 1
  ) {
    text = render(false, notes.slice(0, keep));
  }
  return text;
}

/** Only the items that really change a price. */
export function effectivePriceChanges(items: readonly PriceChangeItem[]) {
  return items.filter((item) => item.before === null || Math.abs(item.after - item.before) >= 0.01);
}

/**
 * Saves the plan as a proposal and returns the preview with «Применить» / «Отмена».
 * `price_list:<source>`: applying it also marks that source's price list as current.
 */
export async function proposePriceChange(input: {
  client: Pick<PrismaClient, "opsPriceChange">;
  actor: PriceChangeActor;
  origin: "command" | "digest" | "card" | "price_list" | `price_list:${string}`;
  plan: Extract<PriceChangePlan, { ok: true }>;
  notes?: string[];
  telegramChatId?: bigint | null;
  button: PriceButtonFactory;
  now?: Date;
}): Promise<PriceReply> {
  const now = input.now ?? new Date();
  const items = effectivePriceChanges(input.plan.items).sort((left, right) =>
    left.productId.localeCompare(right.productId)
  );
  if (!items.length) {
    return {
      text: [
        `✏️ <b>${escapeTelegramHtml(input.plan.title)}</b>`,
        "Менять нечего: цены уже такие.",
        ...(input.notes?.length ? ["", ...input.notes] : []),
      ]
        .join("\n")
        .slice(0, PRICE_CHANGE_MESSAGE_LIMIT),
      parseMode: "HTML",
    };
  }
  const change = await input.client.opsPriceChange.create({
    data: {
      status: "proposed",
      origin: input.origin,
      title: input.plan.title.slice(0, 200),
      requestedById: input.actor.id,
      items: asJson(items),
      itemCount: items.length,
      bigChanges: items.filter((item) => item.big).length,
      telegramChatId: input.telegramChatId ?? null,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
    },
    select: { id: true },
  });
  const apply = await input.button(
    "price_apply",
    change.id,
    `✅ Применить ${items.length} ${prices(items.length)}`,
    "success"
  );
  const cancel = await input.button("price_cancel", change.id, "✖ Отмена", "danger");
  const row = [apply, cancel].filter((button): button is OpsTelegramInlineButton =>
    Boolean(button)
  );
  return {
    text: renderPriceChangePreview({
      title: input.plan.title,
      items,
      skipped: input.plan.skipped,
      notes: input.notes,
    }),
    parseMode: "HTML",
    ...(row.length ? { replyMarkup: { inline_keyboard: [row] } } : {}),
  };
}

/**
 * The site now follows this price list: the reminder starts counting again.
 * `origin` is a change origin such as `price_list:dinan`; others are ignored.
 */
export async function markPriceListCurrent(
  client: Pick<PrismaClient, "opsPriceWatchSource">,
  origin: string,
  now = new Date()
) {
  const def = priceListSourceOf(origin);
  if (!def?.priceList) return null;
  const nextReminderAt = new Date(now.getTime() + def.priceList.everyDays * DAY_MS);
  const row = await client.opsPriceWatchSource.findUnique({
    where: { key: def.key },
    select: { priceListDate: true, nextReminderAt: true },
  });
  await client.opsPriceWatchSource.updateMany({
    where: { key: def.key },
    data: { priceListDate: now, nextReminderAt },
  });
  return {
    nextReminderAt,
    /** What undo puts back. */
    previous: {
      priceListDate: row?.priceListDate?.toISOString() ?? null,
      nextReminderAt: row?.nextReminderAt?.toISOString() ?? null,
    },
  };
}

function priceListSourceOf(origin: string) {
  return origin.startsWith("price_list:")
    ? findPriceWatchSource(origin.slice("price_list:".length))
    : null;
}

/** Undo of an applied price list: the list is not current any more, its old dates come back. */
async function restorePriceList(
  client: Pick<PrismaClient, "opsPriceWatchSource">,
  change: Pick<OpsPriceChange, "origin" | "previousPriceList">
) {
  const def = priceListSourceOf(change.origin);
  const previous = change.previousPriceList as {
    priceListDate?: string | null;
    nextReminderAt?: string | null;
  } | null;
  if (!def?.priceList || !previous) return;
  await client.opsPriceWatchSource.updateMany({
    where: { key: def.key },
    data: {
      priceListDate: previous.priceListDate ? new Date(previous.priceListDate) : null,
      nextReminderAt: previous.nextReminderAt ? new Date(previous.nextReminderAt) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

export function adminSessionOf(actor: PriceChangeActor, changeId: string): AdminSession {
  return {
    email: actor.email,
    name: actor.name ?? actor.email,
    permissions: actor.permissions,
    issuedAt: Date.now(),
    nonce: `telegram-price-change:${changeId}`,
  };
}

/**
 * Applies the next items of a confirmed change. Each product is one catalog
 * mutation; a price that changed since the preview is skipped, never overwritten.
 */
export type PriceChangeCatalogWriter = {
  mutate: typeof coordinateShopCatalogProductMutationWithClient;
  snapshot: typeof buildShopCatalogAdminSnapshot;
  patchVariant: typeof applyAdminPricingPatchInTransaction;
  publish: (changedProducts: number) => Promise<unknown>;
  revalidate: typeof revalidateShopStorefrontProductDetail;
};

/**
 * The catalog write path, loaded only when prices are applied: it is
 * server-only, and the bot's intake (which imports this module) should not
 * carry the storefront and outbox runtime.
 */
export async function loadCatalogWriter(): Promise<PriceChangeCatalogWriter> {
  const [coordinator, snapshot, variants, outbox, revalidation] = await Promise.all([
    import("@/lib/shopCatalogMutationCoordinator.server"),
    import("@/lib/shopCatalogAdminSnapshot.server"),
    import("@/lib/shopAdminVariants"),
    import("@/lib/shopCatalogOutboxRuntime.server"),
    import("@/lib/shopStorefrontRevalidation"),
  ]);
  return {
    mutate: coordinator.coordinateShopCatalogProductMutationWithClient,
    snapshot: snapshot.buildShopCatalogAdminSnapshot,
    patchVariant: variants.applyAdminPricingPatchInTransaction,
    publish: (changedProducts) =>
      outbox.runShopCatalogOutboxRuntime({
        workerId: `price-change:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
        limit: Math.min(50, Math.max(10, changedProducts)),
      }),
    revalidate: revalidation.revalidateShopStorefrontProductDetail,
  };
}

export async function applyPriceChangeChunk(input: {
  client: PrismaClient;
  changeId: string;
  limit: number;
  deadline: number;
  /** The catalog write path; tests replace it. */
  writer?: PriceChangeCatalogWriter;
}) {
  const { client } = input;
  const writer = input.writer ?? (await loadCatalogWriter());
  const change = await client.opsPriceChange.findUnique({ where: { id: input.changeId } });
  if (!change || change.status !== "applying") return { done: true as const, change };
  const actor = await loadPriceChangeActor(client, change.requestedById);
  if (!actor || !canChangePrices(actor)) {
    const failed = await client.opsPriceChange.update({
      where: { id: change.id },
      data: { status: "failed", error: "Нет прав менять цены." },
    });
    return { done: true as const, change: failed };
  }
  const rates = await loadRates(client);
  if (!isShopSourcePriceBook(rates)) throw new Error("PRICE_BOOK_NOT_MANAGED");
  const session = adminSessionOf(actor, change.id);
  const items = itemsOf(change);
  let cursor = change.cursor;
  let products = 0;
  const changed: Array<{
    slug: string;
    brand: string | null;
    vendor: string | null;
    tags: string[];
  }> = [];
  while (cursor < items.length && products < input.limit && Date.now() < input.deadline) {
    const productId = items[cursor].productId;
    const group: number[] = [];
    while (cursor < items.length && items[cursor].productId === productId) group.push(cursor++);
    products += 1;
    try {
      let storefront: (typeof changed)[number] | null = null;
      await writer.mutate(client, {
        productId,
        changeDomains: ["PRICE"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const product = await tx.shopProduct.findUnique({
            where: { id: productId },
            select: { ...PRODUCT_SELECT, vendor: true, tags: true },
          });
          if (!product) throw new Error("PRODUCT_NOT_FOUND");
          let appliedHere = 0;
          for (const index of group) {
            const item = items[index];
            const variant = item.variantId
              ? (product.variants.find((entry) => entry.id === item.variantId) ?? null)
              : null;
            if (item.variantId && !variant) {
              item.status = "skipped";
              item.note = "вариант удалён";
              continue;
            }
            const current = priceIn(priceOwner(product, variant), item.currency, rates);
            if (
              item.before !== null &&
              (current === null || Math.abs(current - item.before) > 0.01)
            ) {
              item.status = "skipped";
              item.note = "цена уже изменилась";
              continue;
            }
            const field = PRICE_FIELD[item.currency];
            if (variant) {
              await writer.patchVariant(tx, {
                productId,
                variantIds: [variant.id],
                [field]: item.after,
              });
            } else {
              const patch = managedAdminPricingPatch(product, { [field]: item.after }, rates);
              await tx.shopProduct.update({ where: { id: productId }, data: patch });
            }
            item.status = "applied";
            appliedHere += 1;
          }
          // Nothing to write: roll the version bump back with the transaction.
          if (!appliedHere) throw new Error("PRICE_CHANGE_NOTHING_TO_APPLY");
          await writeAdminAuditLog(tx, session, {
            scope: "shop",
            action: "pricing.telegram",
            entityType: "shop.product",
            entityId: productId,
            metadata: asJson({
              changeId: change.id,
              title: change.title,
              items: group.map((index) => {
                const item = items[index];
                return {
                  sku: item.sku,
                  currency: item.currency,
                  before: item.before,
                  after: item.after,
                  status: item.status,
                };
              }),
            }),
          });
          storefront = {
            slug: product.slug,
            brand: product.brand,
            vendor: product.vendor,
            tags: product.tags,
          };
          return writer.snapshot(tx, productId, nextCatalogVersion, {
            type: "ADMIN",
            id: session.email,
            reason: "pricing.telegram",
          });
        },
      });
      if (storefront) changed.push(storefront);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "PRICE_CHANGE_NOTHING_TO_APPLY") {
        console.error("[operations.price-change] product failed", { productId, message });
        for (const index of group) {
          if (items[index].status !== "skipped") {
            items[index].status = "failed";
            items[index].note = "не сохранилось";
          }
        }
      }
    }
  }
  if (changed.length) {
    try {
      await writer.publish(changed.length);
    } catch (error) {
      // The catalog cron publishes the rest; prices are already saved.
      console.error("[operations.price-change] immediate publish failed", error);
    }
    for (const product of changed) {
      try {
        writer.revalidate(product);
      } catch (error) {
        console.error("[operations.price-change] revalidation failed", error);
      }
    }
  }
  const done = cursor >= items.length;
  const now = new Date();
  const appliedCount = items.filter((item) => item.status === "applied").length;
  // An applied price list becomes the current one; its old dates are kept for undo.
  const marked =
    done && appliedCount ? await markPriceListCurrent(client, change.origin, now) : null;
  const updated = await client.opsPriceChange.update({
    where: { id: change.id },
    data: {
      items: asJson(items),
      cursor,
      appliedCount,
      failedCount: items.filter((item) => item.status === "failed").length,
      ...(done
        ? {
            status: "applied",
            appliedAt: now,
            undoUntil: new Date(now.getTime() + PRICE_CHANGE_UNDO_MS),
          }
        : {}),
      ...(marked ? { previousPriceList: asJson(marked.previous) } : {}),
    },
  });
  return { done, change: updated };
}

export function renderPriceChangeResult(
  change: Pick<OpsPriceChange, "title" | "items" | "origin">
) {
  const items = itemsOf(change);
  const applied = items.filter((item) => item.status === "applied");
  const skipped = items.filter((item) => item.status === "skipped");
  const failed = items.filter((item) => item.status === "failed");
  return [
    change.origin === "undo"
      ? `↩️ <b>Вернул прежние цены</b>: ${applied.length} ${prices(applied.length)}`
      : `✅ <b>Готово: изменено ${applied.length} ${prices(applied.length)}</b>`,
    escapeTelegramHtml(change.title),
    ...(skipped.length
      ? [
          `Пропущено ${skipped.length}: ${escapeTelegramHtml([...new Set(skipped.map((item) => item.note))].join(", "))}`,
        ]
      : []),
    ...(failed.length
      ? [`⚠️ Не сохранилось ${failed.length} — попробуйте позже или в админке.`]
      : []),
    ...(change.origin !== "undo" && applied.length
      ? ["", "Отменить можно в течение 30 минут."]
      : []),
  ].join("\n");
}

async function resultReply(
  change: OpsPriceChange,
  button: PriceButtonFactory
): Promise<PriceReply> {
  const applied = itemsOf(change).some((item) => item.status === "applied");
  const undo =
    change.origin !== "undo" && applied
      ? await button("price_undo", change.id, "↩️ Отменить изменения", "danger")
      : null;
  return {
    text: renderPriceChangeResult(change),
    parseMode: "HTML",
    ...(undo ? { replyMarkup: { inline_keyboard: [[undo]] } } : {}),
  };
}

/** Confirmed: small changes right away, big ones as a background job. */
async function startApplying(input: {
  client: PrismaClient;
  change: OpsPriceChange;
  button: PriceButtonFactory;
}): Promise<{ message: string; reply: PriceReply }> {
  const { client, change } = input;
  await client.opsPriceChange.update({
    where: { id: change.id },
    data: { status: "applying", confirmedAt: new Date() },
  });
  if (change.itemCount <= PRICE_CHANGE_INLINE_LIMIT) {
    const result = await applyPriceChangeChunk({
      client,
      changeId: change.id,
      limit: PRICE_CHANGE_INLINE_LIMIT,
      deadline: Date.now() + 60_000,
    });
    if (result.done && result.change) {
      return { message: "Цены изменены.", reply: await resultReply(result.change, input.button) };
    }
  }
  await client.opsJob.createMany({
    data: [
      {
        idempotencyKey: `price-change:${change.id}`,
        type: PRICE_CHANGE_JOB_TYPE,
        status: OpsJobStatus.QUEUED,
        stage: OpsJobStage.EXECUTE_AUTOMATIONS,
        payload: { changeId: change.id },
      },
    ],
    skipDuplicates: true,
  });
  return {
    message: "Применяю цены в фоне.",
    reply: {
      text: `⏳ Применяю ${change.itemCount} ${prices(change.itemCount)} в фоне, понемногу, чтобы не нагружать сайт. Напишу, когда закончу.`,
      parseMode: "HTML",
    },
  };
}

async function claimProposal(client: PrismaClient, changeId: string, actor: PriceChangeActor) {
  if (!canChangePrices(actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const change = await client.opsPriceChange.findUnique({ where: { id: changeId } });
  if (!change) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  if (change.requestedById !== actor.id) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  return change;
}

/** «Применить»: changes over 30 % ask once more. */
export async function confirmPriceChange(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  changeId: string;
  confirmedBig: boolean;
  button: PriceButtonFactory;
}) {
  const change = await claimProposal(input.client, input.changeId, input.actor);
  if (change.status !== "proposed") {
    return { message: "Это изменение уже обработано.", link: null };
  }
  if (change.expiresAt.getTime() < Date.now()) {
    await input.client.opsPriceChange.update({
      where: { id: change.id },
      data: { status: "expired" },
    });
    return { message: "Предложение устарело — пришлите команду ещё раз.", link: null };
  }
  if (change.bigChanges > 0 && !input.confirmedBig) {
    const yes = await input.button("price_apply_big", change.id, "✅ Да, применить", "success");
    const no = await input.button("price_cancel", change.id, "✖ Отмена", "danger");
    return {
      message: "Нужно подтвердить большие изменения.",
      link: null,
      reply: {
        text: `⚠️ <b>${change.bigChanges} ${prices(change.bigChanges)} меняются больше чем на 30 %.</b>\nТочно применить «${escapeTelegramHtml(change.title)}»?`,
        parseMode: "HTML" as const,
        replyMarkup: {
          inline_keyboard: [
            [yes, no].filter((button): button is OpsTelegramInlineButton => Boolean(button)),
          ],
        },
      },
    };
  }
  const started = await startApplying({ client: input.client, change, button: input.button });
  return { message: started.message, link: null, reply: started.reply };
}

export async function cancelPriceChange(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  changeId: string;
}) {
  const change = await claimProposal(input.client, input.changeId, input.actor);
  if (change.status !== "proposed") return { message: "Это изменение уже обработано.", link: null };
  await input.client.opsPriceChange.update({
    where: { id: change.id },
    data: { status: "cancelled" },
  });
  return { message: "Отменено — цены не менялись.", link: null };
}

/** «Отменить изменения» within 30 minutes: puts back the prices it changed. */
export async function undoPriceChange(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  changeId: string;
  button: PriceButtonFactory;
}) {
  const change = await claimProposal(input.client, input.changeId, input.actor);
  if (change.status !== "applied" || !change.undoUntil) {
    return { message: "Отменить можно только применённое изменение.", link: null };
  }
  if (change.undoUntil.getTime() < Date.now()) {
    return { message: "30 минут прошло — верните цены командой или в админке.", link: null };
  }
  const reverse = itemsOf(change)
    .filter((item) => item.status === "applied" && item.before !== null)
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      title: item.title,
      currency: item.currency,
      before: item.after,
      after: item.before as number,
      deltaPct:
        item.after > 0
          ? Math.round((((item.before as number) - item.after) / item.after) * 1000) / 10
          : null,
      big: false,
    }));
  await input.client.opsPriceChange.update({
    where: { id: change.id },
    data: { status: "undone", undoUntil: null },
  });
  await restorePriceList(input.client, change);
  const undo = await input.client.opsPriceChange.create({
    data: {
      status: "proposed",
      origin: "undo",
      title: `Отмена: ${change.title}`.slice(0, 200),
      requestedById: input.actor.id,
      items: asJson(reverse),
      itemCount: reverse.length,
      telegramChatId: change.telegramChatId,
      undoOfId: change.id,
      expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS),
    },
  });
  const started = await startApplying({ client: input.client, change: undo, button: input.button });
  return { message: started.message, link: null, reply: started.reply };
}

/** The background job: one chunk per run; tells the owner when it is done. */
export async function runPriceChangeJob(input: {
  client: PrismaClient;
  changeId: string;
  deadline: number;
}) {
  return applyPriceChangeChunk({
    client: input.client,
    changeId: input.changeId,
    limit: 25,
    deadline: input.deadline,
  });
}

export async function priceChangeDoneReply(change: OpsPriceChange, button: PriceButtonFactory) {
  return resultReply(change, button);
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

const MEASURE_SELECT = {
  weight: true,
  length: true,
  width: true,
  height: true,
  isDimensionsEstimated: true,
} as const;

type Measures = {
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  isDimensionsEstimated: boolean;
};

const measured = (value: Prisma.Decimal | number | null | undefined) =>
  value != null && Number(value) > 0;

const centimetres = (value: Prisma.Decimal | number | null) => {
  const number = Number(value);
  return formatPriceWatchNumber(number, Number.isInteger(number) ? 0 : 1);
};

/** The supplier's price behind ours: from a site check, or from a price list. */
type SupplierPrice = { price: number; currency: PriceWatchCurrency; fromList: boolean };

/**
 * Owners only: the formula and the calculation behind our price (the
 * supplier's price → what the formula asks → what the site shows), and the
 * price list's age. The supplier's price can be a purchase price.
 */
function pricingLines(input: {
  source: PriceWatchSourceDefinition | null;
  row: { priceListDate: Date | null; nextReminderAt: Date | null } | null;
  formula: Pick<PriceWatchFinding, "kind" | "expected" | "currency" | "deltaPct"> | null;
  supplier: SupplierPrice | null;
  /** Our price in a currency, as the storefront converts it. */
  ours: (currency: PriceWatchCurrency) => number | null;
  now: Date;
}): { lines: string[]; showsSupplierPrice: boolean } {
  const { source, formula, supplier } = input;
  if (!source) {
    return {
      lines: ["Источник цены не настроен — бренд не привязан к проверке цен."],
      showsSupplierPrice: false,
    };
  }
  const lines = [`Формула: ${escapeTelegramHtml(source.formula)}`];
  const verdict = (difference: { kind: string; deltaPct?: number | null } | null) =>
    difference
      ? `у нас ${difference.kind === "cheaper" ? "дешевле" : "дороже"} на ${unsignedPercent(
          Number(difference.deltaPct)
        )}`
      : "совпадает с сайтом ✅";
  const supplierText = supplier
    ? `${formatPriceWatchMoney(supplier.price, supplier.currency)} ${
        supplier.fromList ? "по прайсу" : "у поставщика"
      }`
    : null;
  const markup = source.priceList?.file?.markup;
  let showsSupplierPrice = false;
  if (formula) {
    const expected = formatPriceWatchMoney(formula.expected, formula.currency);
    lines.push(
      supplierText
        ? `Расчёт: ${supplierText} → по формуле ${expected} — ${verdict(formula)}`
        : `По формуле: ${expected} — ${verdict(formula)}`
    );
    showsSupplierPrice = Boolean(supplierText);
  } else if (source.kind === "formula") {
    lines.push(
      supplierText
        ? `Расчёт: ${supplierText} → по формуле ${verdict(null)}`
        : "По формуле: совпадает ✅"
    );
    showsSupplierPrice = Boolean(supplierText);
  } else if (markup !== undefined && !source.check) {
    // A price list read by the bot: its price × the brand's markup.
    if (supplier) {
      const expected = round2(supplier.price * markup);
      const difference = comparePriceWithFormula({
        ours: input.ours(supplier.currency),
        expected,
        currency: supplier.currency,
      });
      lines.push(
        `Расчёт: прайс ${formatPriceWatchMoney(supplier.price, supplier.currency)}${
          markup !== 1
            ? ` + ${formatPriceWatchNumber(round2((markup - 1) * 100))} % = ${formatPriceWatchMoney(expected, supplier.currency)}`
            : ""
        } — ${verdict(difference)}`
      );
      showsSupplierPrice = true;
    } else {
      lines.push("Расчёт: цен из прайса ещё нет — пришлите прайс файлом в этот чат");
    }
  }
  if (source.priceList) {
    const date = input.row?.priceListDate ?? new Date(source.priceList.date);
    const overdue = Boolean(input.row?.nextReminderAt && input.row.nextReminderAt <= input.now);
    const label = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Kyiv",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    lines.push(`Прайс от ${label}${overdue ? " — пора запросить новый" : ""}`);
  } else if (!source.check) {
    lines.push("Сайт поставщика пока не проверяю автоматически.");
  }
  return { lines, showsSupplierPrice };
}

type SupplierMeasures = {
  weightKg: Prisma.Decimal | number | null;
  lengthCm: Prisma.Decimal | number | null;
  widthCm: Prisma.Decimal | number | null;
  heightCm: Prisma.Decimal | number | null;
};

const kilograms = (value: number) => formatPriceWatchNumber(value, value < 1 ? 2 : 1);

/**
 * Weight and box, each from the supplier when it publishes them, otherwise from
 * our own product card (marked when the card's size is an estimate) — and the
 * box Nova Poshta can price: a real weight, never an estimate.
 */
function cardShipping(
  supplierFacts: readonly SupplierMeasures[],
  variant: Measures | null,
  product: Measures | null
): { line: string; seat: NovaPoshtaSeat | null } {
  const supplierWeight = supplierFacts.find((fact) => measured(fact.weightKg)) ?? null;
  const supplierBox =
    supplierFacts.find(
      (fact) => measured(fact.lengthCm) && measured(fact.widthCm) && measured(fact.heightCm)
    ) ?? null;
  const card = (has: (entry: Measures) => boolean) =>
    [variant, product].find((entry): entry is Measures => Boolean(entry && has(entry))) ?? null;
  const cardWeight = supplierWeight ? null : card((entry) => measured(entry.weight));
  const cardBox = supplierBox
    ? null
    : card((entry) => measured(entry.length) && measured(entry.width) && measured(entry.height));
  const weight = supplierWeight?.weightKg ?? cardWeight?.weight ?? null;
  const box = supplierBox
    ? [supplierBox.lengthCm, supplierBox.widthCm, supplierBox.heightCm]
    : cardBox
      ? [cardBox.length, cardBox.width, cardBox.height]
      : null;
  if (!measured(weight) && !box) {
    return { line: "Вес и коробка: нет ни у поставщика, ни в карточке.", seat: null };
  }
  // A card value is an estimate when its entry says so, or the product does (an
  // import may flag only the product while its variant carries the same numbers).
  const estimatedOf = (entry: Measures | null) =>
    Boolean(entry?.isDimensionsEstimated || product?.isDimensionsEstimated);
  const seat: NovaPoshtaSeat | null = measured(weight)
    ? {
        weightKg: Number(weight),
        box: box ? [Number(box[0]), Number(box[1]), Number(box[2])] : null,
        ...((!supplierWeight && estimatedOf(cardWeight)) ||
        (box && !supplierBox && estimatedOf(cardBox))
          ? { estimated: true }
          : {}),
      }
    : null;
  const fromCard = (entry: Measures | null) => `из карточки${estimatedOf(entry) ? ", оценка" : ""}`;
  const parts = [
    measured(weight)
      ? {
          text: `${kilograms(Number(weight))} кг`,
          from: supplierWeight ? "у поставщика" : fromCard(cardWeight),
        }
      : null,
    box
      ? {
          text: `коробка ${box.map(centimetres).join(" × ")} см`,
          from: supplierBox ? "у поставщика" : fromCard(cardBox),
        }
      : null,
  ].filter((part): part is { text: string; from: string } => Boolean(part));
  const sources = new Set(parts.map((part) => part.from));
  return {
    line:
      sources.size === 1
        ? `Вес и коробка: ${parts.map((part) => part.text).join(" · ")} (${parts[0].from})`
        : `Вес и коробка: ${parts.map((part) => `${part.text} (${part.from})`).join(" · ")}`,
    seat,
  };
}

const SHIPPING_CLASS_LABEL: Readonly<Record<ShopShippingClass, string>> = {
  small: "маленькая посылка",
  medium: "средняя посылка",
  large: "большая посылка",
  oversize: "негабарит",
};

/** What the storefront reads to tell a customer about stock, lead time and delivery. */
const STOREFRONT_SELECT = {
  scope: true,
  productType: true,
  categoryUa: true,
  categoryEn: true,
  category: { select: { titleUa: true, titleEn: true } },
  leadTimeUa: true,
  leadTimeEn: true,
  vendor: true,
  tags: true,
  metafields: {
    where: { namespace: SHOP_STOREFRONT_DISPLAY_NAMESPACE, key: SHOP_STOREFRONT_DISPLAY_KEY },
    select: { namespace: true, key: true, value: true },
  },
} satisfies Prisma.ShopProductSelect;

type StorefrontDetails = {
  scope?: string | null;
  productType?: string | null;
  categoryUa?: string | null;
  categoryEn?: string | null;
  category?: { titleUa: string; titleEn: string } | null;
  leadTimeUa?: string | null;
  leadTimeEn?: string | null;
  metafields?: Array<{ namespace: string; key: string; value: string }>;
};

/**
 * What a customer is told on the site: our stock (warehouse-confirmed, as on
 * the product page), the lead time of an item on order, and the Nova Poshta
 * size class in Ukraine (owner-approved prices).
 */
function storefrontFacts(input: {
  sku: string;
  slug: string;
  title: { ua: string; en: string };
  details: StorefrontDetails | null;
}) {
  const details = input.details ?? {};
  return {
    availability: getShopConfirmedAvailability(
      input.sku,
      input.slug,
      readShopStorefrontDisplay(details.metafields)
    ),
    lead: details.leadTimeUa?.trim() || details.leadTimeEn?.trim() || null,
    shippingClass: resolveShopShippingClass({
      productType: details.productType ?? undefined,
      // As the storefront reads it: the product's own category, else its catalog category.
      category: {
        ua: details.categoryUa || details.category?.titleUa || "",
        en: details.categoryEn || details.category?.titleEn || "",
      },
      title: input.title,
      scope: details.scope === "moto" ? "moto" : "auto",
    }),
  };
}

type StorefrontFacts = ReturnType<typeof storefrontFacts>;

const USUAL_LEAD_WEEKS = Math.round(DEFAULT_BACKORDER_LEAD_DAYS / 7);

/** The stock, and the delivery: Nova Poshta's own price when the card has a real weight. */
function customerLines(facts: StorefrontFacts, novaPoshtaLine: string | null) {
  return [
    facts.availability === "inStock"
      ? "Наличие у нас: на складе — отправим в день заказа или на следующий"
      : facts.availability === "inTransit"
        ? "Наличие у нас: в пути на склад"
        : `Наличие у нас: под заказ, ${
            isShopLeadTimeOnRequest(facts.lead)
              ? "на сайте «срок уточняйте у менеджера»"
              : `срок ${
                  facts.lead
                    ? escapeTelegramHtml(facts.lead)
                    : `≈ ${USUAL_LEAD_WEEKS} недели (обычный срок)`
                }`
          }`,
    novaPoshtaLine ??
      `Доставка по Украине: Нова Пошта ≈ ${formatPriceWatchMoney(
        SHOP_SHIPPING_CLASS_PRICE_UAH[facts.shippingClass],
        "UAH"
      )} (${SHIPPING_CLASS_LABEL[facts.shippingClass]}), 1–2 дня в пути`,
  ];
}

/** «📝 Текст для клиента»: in Ukrainian, plain, ready to copy into a chat with the customer. */
function clientTextLines(input: {
  title: string;
  sku: string;
  uah: number | null;
  facts: StorefrontFacts;
  url: string | null;
}) {
  const { facts } = input;
  const stock =
    facts.availability === "inStock"
      ? "є на складі — відправимо в день замовлення або наступного дня"
      : facts.availability === "inTransit"
        ? "в дорозі на наш склад"
        : `під замовлення, термін ${
            isShopLeadTimeOnRequest(facts.lead)
              ? "уточнимо окремо"
              : (facts.lead ?? `≈ ${USUAL_LEAD_WEEKS} тижні`)
          }`;
  return [
    input.title,
    `Артикул: ${input.sku}`,
    ...(input.uah ? [`Ціна: ${formatPriceWatchMoney(input.uah, "UAH")}`] : []),
    `Наявність: ${stock}`,
    // Customers are not told delivery prices (owner, 2026-10-22).
    "Доставка по Україні: Нова Пошта, 1–2 дні в дорозі",
    ...(input.url ? [input.url] : []),
  ];
}

/** The product page on our site, in Ukrainian. */
function productPageUrl(product: {
  slug: string;
  brand: string | null;
  vendor?: string | null;
  tags?: string[];
}) {
  return absoluteUrl(
    buildShopStorefrontProductPathForProduct("ua", {
      slug: product.slug,
      brand: product.brand ?? "",
      vendor: product.vendor ?? undefined,
      tags: product.tags ?? [],
    })
  );
}

/** Our price in hryvnias, as the storefront converts it; null without a price. */
function uahPrice(owner: PriceRecord, rates: ShopPriceBookRates) {
  const native = nativePrice(owner);
  if (!native) return null;
  try {
    return Math.round(
      repriceShopSourceMoney(
        {
          eur: num(owner.priceEur),
          usd: num(owner.priceUsd),
          uah: num(owner.priceUah),
          sourceCurrency: native.currency,
        },
        rates
      ).uah
    );
  } catch {
    return null;
  }
}

/** Without a competitor price: still checking, not sold there, or a brand we do not compare. */
function competitorStatus(
  rivals: readonly string[],
  row: (key: string) => { lastFinishedAt: Date | null } | null
) {
  if (!rivals.length) return "Конкуренты: этот бренд с конкурентами не сравниваю.";
  return `Конкуренты: ${rivals
    .map((key) => {
      const title = escapeTelegramHtml(findPriceWatchSource(key)?.title ?? key);
      return row(key)?.lastFinishedAt ? `у ${title} не найден` : `${title} — проверка ещё идёт`;
    })
    .join("; ")}.`;
}

/**
 * «Спитати бота про товар»: our price, stock and delivery as the site tells a
 * customer, the supplier's stock, weight and box, competitors — and, for
 * owners only, the formula and the calculation from the supplier's price.
 * Where the bot knows nothing yet, the card says why.
 */
export async function buildProductCard(input: {
  client: Pick<
    PrismaClient,
    "shopProduct" | "shopSettings" | "opsSupplierItem" | "opsPriceWatchRun" | "opsPriceWatchSource"
  >;
  /** A SKU from the chat; or the product picked from search results or a link. */
  sku?: string;
  productId?: string;
  slug?: string;
  variantId?: string | null;
  actor: PriceChangeActor | null;
  button: PriceButtonFactory;
  fetchImpl?: typeof fetch;
}): Promise<PriceReply | null> {
  const found =
    input.productId || input.slug
      ? await findItemByRef(input.client, input)
      : await findItemBySku(input.client, input.sku ?? "");
  if (!found) return null;
  const { product, variant } = found;
  const rates = await loadRates(input.client);
  const owner = priceOwner(product, variant);
  const native = nativePrice(owner);
  const sku = variant?.sku ?? product.sku ?? input.sku ?? product.slug;
  const source = sourceOfBrand(product.brand);
  const rivals = competitorSourcesForBrand(product.brand);
  const isOwner = Boolean(input.actor && canChangePrices(input.actor));
  const [facts, findings, sourceRows, measures] = await Promise.all([
    input.client.opsSupplierItem.findMany({
      where: {
        productId: product.id,
        ...(variant ? { OR: [{ variantId: variant.id }, { variantId: null }] } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: 12,
    }),
    source ? latestFormulaFindings(input.client, source.key) : Promise.resolve([]),
    input.client.opsPriceWatchSource.findMany({
      where: { key: { in: [...(source ? [source.key] : []), ...rivals] } },
      select: { key: true, lastFinishedAt: true, priceListDate: true, nextReminderAt: true },
    }),
    // What the storefront shows (stock, lead time, size class) and our own weight and box.
    input.client.shopProduct.findUnique({
      where: { id: product.id },
      select: {
        ...MEASURE_SELECT,
        ...STOREFRONT_SELECT,
        variants: { where: { id: variant?.id ?? "" }, select: MEASURE_SELECT },
      },
    }),
  ]);
  const formula =
    findings.find((finding) => finding.sku.toLowerCase() === sku.toLowerCase()) ?? null;
  const uah = uahPrice(owner, rates);
  const supplierFacts = facts.filter(
    (fact) => findPriceWatchSource(fact.sourceKey)?.kind !== "competitor"
  );
  const rivalFacts = facts.filter(
    (fact) => findPriceWatchSource(fact.sourceKey)?.kind === "competitor"
  );
  const supplier = supplierFacts[0] ?? null;
  const row = (key: string) => sourceRows.find((entry) => entry.key === key) ?? null;
  const day = (date: Date) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Kyiv",
      day: "numeric",
      month: "short",
    }).format(date);
  const stock = (available: boolean | null, text: string | null) =>
    available === false
      ? "нет в наличии"
      : available === true
        ? text && /Limited/i.test(text)
          ? "ограниченно"
          : "в наличии"
        : "наличие не указано";
  // A price-list brand's own facts come from the list (read by the bot or kept at import).
  const fromList = Boolean(
    source?.kind === "price_list" && (!source.check || source.check === "import-facts")
  );
  const ownFact = source
    ? (supplierFacts.find((fact) => fact.sourceKey === source.key) ?? null)
    : null;
  const pricing = isOwner
    ? pricingLines({
        source,
        row: source ? row(source.key) : null,
        formula,
        supplier:
          ownFact && Number(ownFact.price) > 0
            ? {
                price: Number(ownFact.price),
                currency: (ownFact.currency ?? source?.currency ?? "EUR") as PriceWatchCurrency,
                fromList,
              }
            : null,
        ours: (currency) => (currency === "GBP" ? null : priceIn(owner, currency, rates)),
        now: new Date(),
      })
    : null;
  // The supplier's stock for everyone; its price for owners, when the calculation does not show it.
  const supplierPrice =
    isOwner && supplier && !pricing?.showsSupplierPrice
      ? supplier.price !== null
        ? formatPriceWatchMoney(
            Number(supplier.price),
            (supplier.currency ?? "EUR") as PriceWatchCurrency
          )
        : "цена не указана"
      : null;
  const supplierLines = !supplier
    ? source?.check
      ? [`У поставщика (${escapeTelegramHtml(source.site)}): ещё не проверялось`]
      : []
    : fromList && supplier === ownFact
      ? [
          ...(supplierPrice ? [`По прайсу: ${supplierPrice}`] : []),
          ...(supplier.available === false ? ["У поставщика: снят с производства"] : []),
        ]
      : [
          `У поставщика: ${supplierPrice ? `${supplierPrice} · ` : ""}${stock(
            supplier.available,
            supplier.availability
          )} · проверено ${day(supplier.lastSeenAt)}`,
        ];
  const shipping = cardShipping(supplierFacts, measures?.variants[0] ?? null, measures);
  const storefront = storefrontFacts({
    sku,
    slug: product.slug,
    title: { ua: product.titleUa, en: product.titleEn },
    details: measures,
  });
  // Oversize goods without a real weight are quoted by hand: an estimate there
  // can cost more than the margin (owner, 2026-10-23).
  const oversize = isHandQuoted(storefront, shipping.seat);
  // Nova Poshta's own price for the box; the size class's estimate when there is none.
  const novaPoshta =
    shipping.seat && !oversize
      ? await quoteNovaPoshta({
          cityRef: NP_COUNTRYWIDE_CITY_REF,
          seats: [shipping.seat],
          declaredUah: uah,
          fetchImpl: input.fetchImpl,
        }).catch((error) => {
          console.warn(
            "[operations.product-card] Nova Poshta price failed",
            error instanceof Error ? error.message : error
          );
          return null;
        })
      : null;
  const lines = [
    `🔎 <b>${escapeTelegramHtml(sku)}</b> · ${escapeTelegramHtml(product.brand ?? "")}`,
    escapeTelegramHtml((product.titleEn || product.titleUa).slice(0, 160)),
    "",
    `На сайте: <b>${native ? formatPriceWatchMoney(native.amount, native.currency) : "без цены"}</b>${
      uah && native?.currency !== "UAH" ? ` · ${formatPriceWatchMoney(uah, "UAH")}` : ""
    }`,
    ...(pricing?.lines ?? []),
    ...customerLines(
      storefront,
      oversize
        ? NP_OVERSIZE_LINE
        : novaPoshta
          ? novaPoshtaCardLine(novaPoshta, Boolean(shipping.seat?.estimated))
          : null
    ),
    ...supplierLines,
    shipping.line,
    ...(rivalFacts.length
      ? rivalFacts.map((fact) => {
          const theirs = Number(fact.price);
          const difference = uah && theirs > 0 ? ((uah - theirs) / theirs) * 100 : null;
          return `${escapeTelegramHtml(findPriceWatchSource(fact.sourceKey)?.title ?? fact.sourceKey)}: ${formatPriceWatchMoney(
            theirs,
            "UAH"
          )}${difference !== null && Math.abs(difference) >= 1 ? ` (мы ${difference > 0 ? "дороже" : "дешевле"} на ${unsignedPercent(difference)})` : ""}`;
        })
      : [competitorStatus(rivals, row)]),
  ];
  const rows: OpsTelegramInlineButton[][] = [];
  const links: OpsTelegramInlineButton[] = [];
  if (supplier?.url && /^https:\/\//.test(supplier.url))
    links.push({ text: "🌐 У поставщика", url: supplier.url });
  const adminUrl = opsAdminLink(`/admin/shop/${product.id}`);
  if (/^https?:\/\//.test(adminUrl)) links.push({ text: "🛠 В админке", url: adminUrl });
  links.push({
    text: "🛒 На сайте",
    url: productPageUrl({
      slug: product.slug,
      brand: product.brand,
      vendor: measures?.vendor,
      tags: measures?.tags,
    }),
  });
  rows.push(links);
  const clientText = await input.button(
    "price_card_client_text",
    product.id,
    "📝 Текст для клиента",
    undefined,
    variant?.id
  );
  const delivery =
    shipping.seat && !oversize
      ? await input.button(
          "price_card_delivery",
          product.id,
          "🚚 Доставка в город",
          undefined,
          variant?.id
        )
      : null;
  const actions = [clientText, delivery].filter((button): button is OpsTelegramInlineButton =>
    Boolean(button)
  );
  if (actions.length) rows.push(actions);
  if (formula && isOwner) {
    const fix = await input.button(
      "price_card_formula",
      product.id,
      `✏️ Поставить ${formatPriceWatchMoney(formula.expected, formula.currency)}`,
      "primary"
    );
    if (fix) rows.push([fix]);
  }
  return {
    text: lines.join("\n").slice(0, 3_900),
    parseMode: "HTML",
    ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}),
  };
}

/** «📝 Текст для клиента» under the card: the customer's facts in Ukrainian, ready to copy. */
export async function clientTextForProduct(input: {
  client: Pick<PrismaClient, "shopProduct" | "shopSettings">;
  productId: string;
  variantId: string | null;
}) {
  const product = await input.client.shopProduct.findFirst({
    where: { id: input.productId, status: ShopCatalogStatus.ACTIVE },
    select: { ...PRODUCT_SELECT, ...STOREFRONT_SELECT, image: true },
  });
  if (!product) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const image = product.image?.trim() ?? "";
  const photoUrl = image.startsWith("https://")
    ? image
    : image.startsWith("/")
      ? absoluteUrl(image)
      : null;
  const variant =
    product.variants.find((entry) => entry.id === input.variantId) ??
    (product.variants.length === 1 ? product.variants[0] : null);
  const sku = variant?.sku ?? product.sku ?? product.slug;
  const text = clientTextLines({
    title: product.titleUa || product.titleEn,
    sku,
    uah: uahPrice(priceOwner(product, variant), await loadRates(input.client)),
    facts: storefrontFacts({
      sku,
      slug: product.slug,
      title: { ua: product.titleUa, en: product.titleEn },
      details: product,
    }),
    url: productPageUrl(product),
  });
  return {
    message: "Текст для клиента — ниже.",
    link: null,
    // With the product photo: one message to forward to the customer.
    reply: {
      text: escapeTelegramHtml(text.join("\n")),
      parseMode: "HTML",
      ...(photoUrl ? { photoUrl } : {}),
    } satisfies PriceReply,
  };
}

/** «🚚 Доставка в город» under the card: a prompt the city is read from. */
export async function deliveryPromptForProduct(input: {
  client: Pick<PrismaClient, "shopProduct">;
  productId: string;
  variantId: string | null;
}) {
  const product = await input.client.shopProduct.findFirst({
    where: { id: input.productId, status: ShopCatalogStatus.ACTIVE },
    select: { sku: true, slug: true, variants: { select: { id: true, sku: true } } },
  });
  if (!product) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const variant =
    product.variants.find((entry) => entry.id === input.variantId) ??
    (product.variants.length === 1 ? product.variants[0] : null);
  const sku = variant?.sku ?? product.sku ?? product.slug;
  return {
    message: "Напишите город ответом.",
    link: null,
    reply: {
      text: escapeTelegramHtml(
        `${deliveryPromptFor(sku)}.\nНапример: «Одесса». Посчитаю Новую почту до отделения и до дверей.`
      ),
      parseMode: "HTML",
      forceReply: { placeholder: "Город" },
    } satisfies PriceReply,
  };
}

const NP_OVERSIZE_LINE = "🚚 Негабарит — цену доставки уточните у перевозчика.";

/** An oversize item (by the storefront's size class) without a real weight and box. */
function isHandQuoted(facts: StorefrontFacts, seat: NovaPoshtaSeat | null) {
  return facts.shippingClass === "oversize" && (!seat || Boolean(seat.estimated));
}

const NOVA_POSHTA_DOWN: PriceReply = {
  text: "🚚 Новая почта сейчас не отвечает — попробуйте через минуту.",
  parseMode: "HTML",
};

/**
 * «доставка 1021000B Одесса»: Nova Poshta from Kyiv to the city — to a branch
 * and to the door, insured for our price — and when it arrives; without a city,
 * across Ukraine. Null when the first word is not a SKU: an ordinary message.
 */
async function deliveryReply(input: {
  client: Pick<PrismaClient, "shopProduct" | "shopSettings" | "opsSupplierItem">;
  query: string;
  fetchImpl?: typeof fetch;
}): Promise<PriceReply | null> {
  const words = input.query.split(" ");
  if (!looksLikeSku(words[0])) return null;
  // A SKU may hold spaces («0006 55SR»): the longest start that is one of ours.
  let found: Awaited<ReturnType<typeof findItemBySku>> = null;
  let city = "";
  for (let take = Math.min(words.length, 4); take >= 1 && !found; take -= 1) {
    found = await findItemBySku(input.client, words.slice(0, take).join(" "));
    if (found) city = words.slice(take).join(" ").trim();
  }
  if (!found) {
    return {
      text: `Не нашёл товар «${escapeTelegramHtml(words[0])}». Пришлите артикул и город: «доставка 1021000B Одесса».`,
      parseMode: "HTML",
    };
  }
  const { product, variant } = found;
  const sku = variant?.sku ?? product.sku ?? product.slug;
  const [facts, measures, rates] = await Promise.all([
    input.client.opsSupplierItem.findMany({
      where: {
        productId: product.id,
        ...(variant ? { OR: [{ variantId: variant.id }, { variantId: null }] } : {}),
      },
      orderBy: { lastSeenAt: "desc" },
      take: 12,
    }),
    input.client.shopProduct.findUnique({
      where: { id: product.id },
      select: {
        ...MEASURE_SELECT,
        ...STOREFRONT_SELECT,
        variants: { where: { id: variant?.id ?? "" }, select: MEASURE_SELECT },
      },
    }),
    loadRates(input.client),
  ]);
  const shipping = cardShipping(
    facts.filter((fact) => findPriceWatchSource(fact.sourceKey)?.kind !== "competitor"),
    measures?.variants[0] ?? null,
    measures
  );
  const title = `🚚 <b>${escapeTelegramHtml(sku)}</b>`;
  const storefront = storefrontFacts({
    sku,
    slug: product.slug,
    title: { ua: product.titleUa, en: product.titleEn },
    details: measures,
  });
  if (isHandQuoted(storefront, shipping.seat)) {
    return { text: `${title}: ${NP_OVERSIZE_LINE.replace("🚚 ", "")}`, parseMode: "HTML" };
  }
  if (!shipping.seat) {
    return {
      text: `${title}: в карточке нет веса — Новая почта не посчитает. Впишите вес и коробку в админке.`,
      parseMode: "HTML",
    };
  }
  let target: { ref: string; name: string } | null = {
    ref: NP_COUNTRYWIDE_CITY_REF,
    name: "по Украине",
  };
  if (city) {
    try {
      target = await findNovaPoshtaCity(city, input.fetchImpl);
    } catch {
      return NOVA_POSHTA_DOWN;
    }
    if (!target) {
      return {
        text: `🚚 Не нашёл «${escapeTelegramHtml(city)}» среди городов Украины. Доставку за границу (DHL) посчитаю, когда будет доступ к API DHL Express.`,
        parseMode: "HTML",
      };
    }
  }
  const quote = await quoteNovaPoshta({
    cityRef: target.ref,
    seats: [shipping.seat],
    declaredUah: uahPrice(priceOwner(product, variant), rates),
    doors: Boolean(city),
    fetchImpl: input.fetchImpl,
  }).catch(() => null);
  if (!quote) return NOVA_POSHTA_DOWN;
  const { box } = shipping.seat;
  return {
    text: [
      `${title} → ${escapeTelegramHtml(target.name)}`,
      `Новая почта из Киева · ${kilograms(shipping.seat.weightKg)} кг${
        box ? ` · коробка ${box.map(centimetres).join(" × ")} см` : ""
      }${shipping.seat.estimated ? ` (${NP_ESTIMATE_MARK})` : ""}:`,
      `• ${novaPoshtaPriceText(quote)}`,
      ...(quote.doors ? [`• до дверей — ${formatPriceWatchMoney(quote.doors, "UAH")}`] : []),
      ...(quote.deliveryDate ? [`Доставка: ${novaPoshtaDeliveryDay(quote.deliveryDate)}`] : []),
      NP_OTHER_CARRIERS_NOTE,
    ].join("\n"),
    parseMode: "HTML",
  };
}

/** «товар Akrapovic M3»: the card when one product fits, buttons to pick from when several do. */
async function productSearchReply(input: {
  client: Pick<
    PrismaClient,
    "shopProduct" | "shopSettings" | "opsSupplierItem" | "opsPriceWatchRun" | "opsPriceWatchSource"
  >;
  query: string;
  actor: PriceChangeActor;
  button: PriceButtonFactory;
  fetchImpl?: typeof fetch;
}): Promise<PriceReply> {
  const query = escapeTelegramHtml(input.query.slice(0, 80));
  const notFound: PriceReply = {
    text: `Не нашёл товар «${query}». Пришлите артикул, ссылку с сайта или другие слова.`,
    parseMode: "HTML",
  };
  const found = await searchProductsByText(input.client, input.query);
  if (!found.items.length) return notFound;
  if (found.items.length === 1) {
    return (
      (await buildProductCard({
        client: input.client,
        productId: found.items[0].productId,
        actor: input.actor,
        button: input.button,
        fetchImpl: input.fetchImpl,
      })) ?? notFound
    );
  }
  const rows: OpsTelegramInlineButton[][] = [];
  for (const item of found.items) {
    const label = `${item.sku ? `${item.sku} · ` : ""}${item.title}`;
    const button = await input.button(
      "price_card_open",
      item.productId,
      label.length > 60 ? `${label.slice(0, 59)}…` : label
    );
    if (button) rows.push([button]);
  }
  const shown =
    found.total > found.items.length
      ? `нашёл ${found.total >= 60 ? "больше 60" : found.total}, вот ближайшие ${found.items.length}`
      : `нашёл ${found.items.length}`;
  return {
    text: `🔎 «${query}»: ${shown}. Выберите товар:${
      found.total > found.items.length ? "\nНет нужного — уточните: модель, кузов, год." : ""
    }`,
    parseMode: "HTML",
    ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}),
  };
}

/**
 * Text commands from the bot chat: an order number, a product link, «товар …»
 * (SKU or words), a bare SKU, price changes. Null when the text is none of these.
 */
export async function handlePriceMessage(input: {
  client: PrismaClient;
  actorAdminUserId: string;
  text: string;
  telegramChatId: bigint | null;
  button: PriceButtonFactory;
  /** Nova Poshta's API; tests replace it. */
  fetchImpl?: typeof fetch;
}): Promise<PriceReply | null> {
  const orderNumber = parseOrderCommand(input.text);
  const linkSlug = orderNumber ? null : parseProductLink(input.text);
  const command = orderNumber || linkSlug ? null : parsePriceCommand(input.text);
  const bareSku =
    !orderNumber && !linkSlug && !command && looksLikeSku(input.text) ? input.text.trim() : null;
  const delivery =
    !orderNumber && !linkSlug && !command && !bareSku ? parseDeliveryCommand(input.text) : null;
  if (!orderNumber && !linkSlug && !command && !bareSku && !delivery) return null;
  const actor = await loadPriceChangeActor(input.client, input.actorAdminUserId);
  if (!actor) return null;
  if (delivery) {
    return deliveryReply({ client: input.client, query: delivery, fetchImpl: input.fetchImpl });
  }
  if (orderNumber) {
    return (
      (await buildOrderCard({
        client: input.client,
        orderNumber,
        actor,
        button: input.button,
        fetchImpl: input.fetchImpl,
      })) ?? { text: `Не нашёл заказ «${escapeTelegramHtml(orderNumber)}».`, parseMode: "HTML" }
    );
  }
  if (linkSlug) {
    return (
      (await buildProductCard({
        client: input.client,
        slug: linkSlug,
        actor,
        button: input.button,
        fetchImpl: input.fetchImpl,
      })) ?? {
        text: "Не нашёл этот товар в каталоге — возможно, его сняли с продажи.",
        parseMode: "HTML",
      }
    );
  }
  if (bareSku || command?.kind === "lookup") {
    const card = await buildProductCard({
      client: input.client,
      sku: bareSku ?? command!.target,
      actor,
      button: input.button,
      fetchImpl: input.fetchImpl,
    });
    if (card) return card;
    // A bare word that is not one of our SKUs stays a normal message for the team.
    if (bareSku) return null;
    return productSearchReply({
      client: input.client,
      query: command!.target,
      actor,
      button: input.button,
      fetchImpl: input.fetchImpl,
    });
  }
  if (!canChangePrices(actor)) {
    return { text: "Менять цены из бота могут только владельцы.", parseMode: "HTML" };
  }
  const plan = await planPriceChange(input.client, command!);
  if (!plan.ok) return { text: escapeTelegramHtml(plan.message), parseMode: "HTML" };
  return proposePriceChange({
    client: input.client,
    actor,
    origin: "command",
    plan,
    notes: plan.notes,
    telegramChatId: input.telegramChatId,
    button: input.button,
  });
}

/** «✏️ … по формуле» under the digest: every difference of the source's last check. */
export async function proposeFormulaForSource(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  sourceId: string;
  telegramChatId: bigint | null;
  button: PriceButtonFactory;
}) {
  if (!canChangePrices(input.actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const source = await input.client.opsPriceWatchSource.findUnique({
    where: { id: input.sourceId },
  });
  const def = source ? findPriceWatchSource(source.key) : null;
  if (!source || !def) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const { findings, systemic } = await latestFormulaRun(input.client, def.key);
  if (!findings.length) {
    return { message: `По последней проверке ${def.title} менять нечего.`, link: null };
  }
  const plan = await planFromFindings(input.client, `${def.title}: по формуле`, findings);
  if (!plan.ok) return { message: plan.message, link: null };
  const reply = await proposePriceChange({
    client: input.client,
    actor: input.actor,
    origin: "digest",
    plan,
    notes: systemic ? [systemicPriceWatchWarning(systemic)] : undefined,
    telegramChatId: input.telegramChatId,
    button: input.button,
  });
  return { message: "Показал, что изменится.", link: null, reply };
}

/** «✏️ Поставить …» on a product card. */
export async function proposeFormulaForProduct(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  productId: string;
  telegramChatId: bigint | null;
  button: PriceButtonFactory;
}) {
  if (!canChangePrices(input.actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const product = await input.client.shopProduct.findUnique({
    where: { id: input.productId },
    select: { sku: true, brand: true, variants: { select: { sku: true } } },
  });
  const source = sourceOfBrand(product?.brand ?? null);
  if (!product || !source) throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  const skus = new Set(
    [product.sku, ...product.variants.map((variant) => variant.sku)]
      .filter(Boolean)
      .map((sku) => sku!.toLowerCase())
  );
  const findings = (await latestFormulaFindings(input.client, source.key)).filter((finding) =>
    skus.has(finding.sku.toLowerCase())
  );
  if (!findings.length) return { message: "Цена уже совпадает с формулой.", link: null };
  const plan = await planFromFindings(
    input.client,
    `${product.sku ?? "Товар"}: по формуле`,
    findings
  );
  if (!plan.ok) return { message: plan.message, link: null };
  const reply = await proposePriceChange({
    client: input.client,
    actor: input.actor,
    origin: "card",
    plan,
    telegramChatId: input.telegramChatId,
    button: input.button,
  });
  return { message: "Показал, что изменится.", link: null, reply };
}
