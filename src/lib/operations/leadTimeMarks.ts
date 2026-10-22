import { ShopCatalogStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { writeAdminAuditLog } from "@/lib/adminRbac";
import type { OpsTelegramInlineButton } from "@/lib/operations/notifications";
import {
  adminSessionOf,
  canChangePrices,
  loadCatalogWriter,
  PRICE_CHANGE_INLINE_LIMIT,
  PRICE_CHANGE_UNDO_MS,
  type PriceButtonFactory,
  type PriceChangeActor,
  type PriceChangeCatalogWriter,
  type PriceReply,
} from "@/lib/operations/priceChanges";
import type { PriceWatchFinding } from "@/lib/operations/priceWatchChecks";
import {
  escapeTelegramHtml,
  formatPriceWatchNumber,
  priceWatchItemName,
  ruPlural,
} from "@/lib/operations/priceWatchReport";
import { findPriceWatchSource } from "@/lib/operations/priceWatchSources";
import {
  DEFAULT_BACKORDER_LEAD_DAYS,
  isShopLeadTimeOnRequest,
  SHOP_LEAD_TIME_ON_REQUEST,
} from "@/lib/shopGoogleAvailability";
import {
  readShopStorefrontDisplay,
  SHOP_STOREFRONT_DISPLAY_KEY,
  SHOP_STOREFRONT_DISPLAY_NAMESPACE,
} from "@/lib/shopStorefrontDisplay";
import { getShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";

/**
 * «Закончились у производителя»: the site must not promise the usual lead
 * time for an item the manufacturer is sold out of. The digest offers owners
 * to set such items to «Уточнюйте у менеджера» and back once the manufacturer
 * has them again; an owner confirms with a button, every product goes through
 * the catalog path (audit log, storefront refresh), and it can be undone for
 * 30 minutes. Kept as an OpsPriceChange with origin «lead_time».
 *
 * Items gone from the supplier's site are not offered: for Shopify stores that
 * is mostly a re-created product with new ids, not a discontinued one. The
 * digest lists them for a person to check.
 */

export const LEAD_TIME_CHANGE_ORIGIN = "lead_time";
/** Products changed per press, as many as a price change applies inline; the plan is rebuilt every time. */
export const LEAD_TIME_MARKS_PER_PRESS = PRICE_CHANGE_INLINE_LIMIT;
/** A supplier fact older than this does not prove the item is back. */
const FACT_FRESH_MS = 14 * 24 * 60 * 60 * 1000;
const LIST_LINES = 12;

export type LeadTimeMode = "mark" | "clear";

export type LeadTimeItem = {
  productId: string;
  sku: string;
  title: string;
  /** Kept with the change: what was done, so «Отменить» knows the way back. */
  mode?: LeadTimeMode;
  status?: "applied" | "skipped" | "failed";
};

export type LeadTimePlan = { mark: LeadTimeItem[]; clear: LeadTimeItem[] };

const PLAN_SELECT = {
  id: true,
  sku: true,
  slug: true,
  titleEn: true,
  titleUa: true,
  leadTimeUa: true,
  leadTimeEn: true,
  variants: { select: { sku: true } },
  metafields: {
    where: { namespace: SHOP_STOREFRONT_DISPLAY_NAMESPACE, key: SHOP_STOREFRONT_DISPLAY_KEY },
    select: { namespace: true, key: true, value: true },
  },
} satisfies Prisma.ShopProductSelect;

type PlanProduct = Prisma.ShopProductGetPayload<{ select: typeof PLAN_SELECT }>;

const leadOf = (product: Pick<PlanProduct, "leadTimeUa" | "leadTimeEn">) =>
  product.leadTimeUa?.trim() || product.leadTimeEn?.trim() || null;

const itemOf = (product: PlanProduct): LeadTimeItem => ({
  productId: product.id,
  sku: product.sku ?? product.slug,
  title: product.titleEn || product.titleUa,
});

/**
 * From the latest supplier checks: items the manufacturer is sold out of that
 * we sell «под заказ» with the usual lead time — and items with «Уточнюйте у
 * менеджера» the manufacturer has again. Our own stock and a lead time
 * somebody set by hand are left alone.
 */
export async function planLeadTimeMarks(
  client: Pick<PrismaClient, "shopProduct" | "opsSupplierItem">,
  runs: ReadonlyArray<{ sourceKey: string; findings: unknown }>,
  now = new Date()
): Promise<LeadTimePlan> {
  const out = new Set<string>();
  for (const run of runs) {
    const kind = findPriceWatchSource(run.sourceKey)?.kind;
    if (!kind || kind === "competitor" || kind === "fx") continue;
    const findings = Array.isArray(run.findings) ? (run.findings as PriceWatchFinding[]) : [];
    for (const finding of findings) {
      if (finding.kind === "sold_out" && finding.sku) out.add(finding.sku.toLowerCase());
    }
  }
  const keysOf = (product: PlanProduct) =>
    [product.sku, product.slug, ...product.variants.map((variant) => variant.sku)]
      .filter((key): key is string => Boolean(key))
      .map((key) => key.toLowerCase());
  // The lead time is the product's: with several variants, every one of them
  // must be sold out (or the supplier says so of the whole product).
  const soldOut = (product: PlanProduct) => {
    const variants = product.variants
      .map((variant) => variant.sku?.toLowerCase())
      .filter((key): key is string => Boolean(key));
    if (variants.length <= 1) return keysOf(product).some((key) => out.has(key));
    return (
      variants.every((key) => out.has(key)) ||
      [product.sku, product.slug].some(
        (key) => key && !variants.includes(key.toLowerCase()) && out.has(key.toLowerCase())
      )
    );
  };

  const wanted = [...out];
  const candidates: PlanProduct[] = [];
  for (let index = 0; index < wanted.length; index += 1_000) {
    const part = wanted.slice(index, index + 1_000);
    candidates.push(
      ...(await client.shopProduct.findMany({
        where: {
          status: ShopCatalogStatus.ACTIVE,
          OR: [
            { sku: { in: part, mode: "insensitive" } },
            { slug: { in: part } },
            { variants: { some: { sku: { in: part, mode: "insensitive" } } } },
          ],
        },
        select: PLAN_SELECT,
      }))
    );
  }
  const seen = new Set<string>();
  const mark = candidates.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    if (!soldOut(product)) return false;
    const availability = getShopConfirmedAvailability(
      product.sku,
      product.slug,
      readShopStorefrontDisplay(product.metafields)
    );
    return availability !== "inStock" && availability !== "inTransit" && !leadOf(product);
  });

  // Marked items whose supplier shows them in stock again.
  const marked = await client.shopProduct.findMany({
    where: {
      status: ShopCatalogStatus.ACTIVE,
      leadTimeUa: { equals: SHOP_LEAD_TIME_ON_REQUEST.ua, mode: "insensitive" },
    },
    select: PLAN_SELECT,
  });
  const available = marked.length
    ? await client.opsSupplierItem.findMany({
        where: {
          productId: { in: marked.map((product) => product.id) },
          available: true,
          lastSeenAt: { gte: new Date(now.getTime() - FACT_FRESH_MS) },
        },
        select: { productId: true, sourceKey: true },
      })
    : [];
  const back = new Set(
    available
      .filter((fact) => findPriceWatchSource(fact.sourceKey)?.kind !== "competitor")
      .map((fact) => fact.productId)
  );
  const clear = marked.filter(
    (product) =>
      back.has(product.id) &&
      isShopLeadTimeOnRequest(leadOf(product)) &&
      !keysOf(product).some((key) => out.has(key))
  );
  return { mark: mark.map(itemOf), clear: clear.map(itemOf) };
}

const products = (count: number) => ruPlural(count, "товар", "товара", "товаров");

function sample(items: readonly LeadTimeItem[], limit = 4) {
  const names = items.slice(0, limit).map((item) => escapeTelegramHtml(priceWatchItemName(item)));
  return `${names.join(", ")}${items.length > limit ? ` и ещё ${items.length - limit}` : ""}`;
}

/** Owners' lines under the digest; empty when there is nothing to offer. */
export function leadTimeDigestLines(plan: LeadTimePlan) {
  const weeks = Math.round(DEFAULT_BACKORDER_LEAD_DAYS / 7);
  return [
    ...(plan.mark.length
      ? [
          `🕓 Закончились у производителя, а на сайте «под заказ ≈ ${weeks} недели»: ${plan.mark.length} — ${sample(plan.mark)}`,
        ]
      : []),
    ...(plan.clear.length
      ? [
          `🔄 Снова есть у производителя, а на сайте «срок уточняйте»: ${plan.clear.length} — ${sample(plan.clear)}`,
        ]
      : []),
  ];
}

/** Labels of the digest buttons, with the counts. */
export function leadTimeButtonLabels(plan: LeadTimePlan) {
  return {
    mark: plan.mark.length ? `🕓 Срок «уточняйте у менеджера» (${plan.mark.length})` : null,
    clear: plan.clear.length ? `🔄 Вернуть обычный срок (${plan.clear.length})` : null,
  };
}

/** One product per catalog mutation, only from the state the plan saw. */
async function writeLeadTimes(input: {
  client: PrismaClient;
  writer: PriceChangeCatalogWriter;
  actor: PriceChangeActor;
  changeId: string;
  items: LeadTimeItem[];
  mode: LeadTimeMode;
}) {
  const session = adminSessionOf(input.actor, input.changeId);
  const changed: Array<{
    slug: string;
    brand: string | null;
    vendor: string | null;
    tags: string[];
  }> = [];
  for (const item of input.items) {
    try {
      let storefront: (typeof changed)[number] | null = null;
      await input.writer.mutate(input.client, {
        productId: item.productId,
        changeDomains: ["INVENTORY"],
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const product = await tx.shopProduct.findUnique({
            where: { id: item.productId },
            select: {
              slug: true,
              brand: true,
              vendor: true,
              tags: true,
              leadTimeUa: true,
              leadTimeEn: true,
            },
          });
          if (!product) throw new Error("PRODUCT_NOT_FOUND");
          const lead = leadOf(product);
          // Somebody set a lead time meanwhile: theirs stays.
          if (input.mode === "mark" ? lead : !isShopLeadTimeOnRequest(lead)) {
            throw new Error("LEAD_TIME_CHANGED");
          }
          await tx.shopProduct.update({
            where: { id: item.productId },
            data:
              input.mode === "mark"
                ? {
                    leadTimeUa: SHOP_LEAD_TIME_ON_REQUEST.ua,
                    leadTimeEn: SHOP_LEAD_TIME_ON_REQUEST.en,
                  }
                : { leadTimeUa: null, leadTimeEn: null },
          });
          await writeAdminAuditLog(tx, session, {
            scope: "shop",
            action: "lead_time.telegram",
            entityType: "shop.product",
            entityId: item.productId,
            metadata: {
              changeId: input.changeId,
              mode: input.mode,
              before: { ua: product.leadTimeUa, en: product.leadTimeEn },
            },
          });
          storefront = {
            slug: product.slug,
            brand: product.brand,
            vendor: product.vendor,
            tags: product.tags,
          };
          return input.writer.snapshot(tx, item.productId, nextCatalogVersion, {
            type: "ADMIN",
            id: session.email,
            reason: "lead_time.telegram",
          });
        },
      });
      item.status = "applied";
      if (storefront) changed.push(storefront);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      item.status = message === "LEAD_TIME_CHANGED" ? "skipped" : "failed";
      if (item.status === "failed") {
        console.error("[operations.lead-time] product failed", {
          productId: item.productId,
          message,
        });
      }
    }
  }
  if (changed.length) {
    try {
      await input.writer.publish(changed.length);
    } catch (error) {
      // The catalog cron publishes the rest; the lead times are already saved.
      console.error("[operations.lead-time] immediate publish failed", error);
    }
    for (const product of changed) {
      try {
        input.writer.revalidate(product);
      } catch (error) {
        console.error("[operations.lead-time] revalidation failed", error);
      }
    }
  }
  return input.items.filter((item) => item.status === "applied").length;
}

function listLines(items: readonly LeadTimeItem[]) {
  const applied = items.filter((item) => item.status === "applied");
  const lines = applied
    .slice(0, LIST_LINES)
    .map((item) => `• ${escapeTelegramHtml(priceWatchItemName(item))}`);
  if (applied.length > LIST_LINES) lines.push(`…и ещё ${applied.length - LIST_LINES}`);
  const skipped = items.filter((item) => item.status === "skipped").length;
  const failed = items.filter((item) => item.status === "failed").length;
  if (skipped) lines.push(`Пропущено ${skipped}: срок уже поменяли вручную.`);
  if (failed) lines.push(`Не сохранилось ${failed} — попробуйте ещё раз позже.`);
  return lines;
}

/** «🕓 Срок «уточняйте у менеджера»» / «🔄 Вернуть обычный срок» under the digest. */
export async function applyLeadTimeMarks(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  mode: LeadTimeMode;
  plan: LeadTimePlan;
  telegramChatId: bigint | null;
  button: PriceButtonFactory;
  /** The catalog write path; tests replace it. */
  writer?: PriceChangeCatalogWriter;
}): Promise<{ message: string; link: null; reply?: PriceReply }> {
  if (!canChangePrices(input.actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const offered = input.plan[input.mode];
  if (!offered.length) return { message: "Менять уже нечего — сроки актуальны.", link: null };
  const items = offered
    .slice(0, LEAD_TIME_MARKS_PER_PRESS)
    .map((item): LeadTimeItem => ({ ...item, mode: input.mode }));
  const title =
    input.mode === "mark"
      ? `Срок «уточняйте у менеджера»: ${items.length} ${products(items.length)}`
      : `Обычный срок: ${items.length} ${products(items.length)}`;
  const now = new Date();
  const change = await input.client.opsPriceChange.create({
    data: {
      status: "applying",
      origin: LEAD_TIME_CHANGE_ORIGIN,
      title,
      requestedById: input.actor.id,
      items: items as unknown as Prisma.InputJsonValue,
      itemCount: items.length,
      telegramChatId: input.telegramChatId,
      expiresAt: new Date(now.getTime() + PRICE_CHANGE_UNDO_MS),
      confirmedAt: now,
    },
  });
  const appliedCount = await writeLeadTimes({
    client: input.client,
    writer: input.writer ?? (await loadCatalogWriter()),
    actor: input.actor,
    changeId: change.id,
    items,
    mode: input.mode,
  });
  const appliedAt = new Date();
  await input.client.opsPriceChange.update({
    where: { id: change.id },
    data: {
      status: appliedCount ? "applied" : "failed",
      items: items as unknown as Prisma.InputJsonValue,
      appliedCount,
      failedCount: items.filter((item) => item.status === "failed").length,
      appliedAt,
      undoUntil: appliedCount ? new Date(appliedAt.getTime() + PRICE_CHANGE_UNDO_MS) : null,
    },
  });
  const rest = offered.length - items.length;
  const rows: OpsTelegramInlineButton[][] = [];
  const undo = appliedCount
    ? await input.button("price_lead_undo", change.id, "↩️ Отменить", "danger")
    : null;
  if (undo) rows.push([undo]);
  const text = [
    input.mode === "mark"
      ? `🕓 На сайте теперь «срок уточняйте у менеджера»: ${appliedCount} ${products(appliedCount)}`
      : `🔄 На сайте снова обычный срок: ${appliedCount} ${products(appliedCount)}`,
    ...listLines(items),
    ...(rest > 0
      ? [`Осталось ${formatPriceWatchNumber(rest, 0)} — нажмите кнопку в отчёте ещё раз.`]
      : []),
    ...(appliedCount ? ["Отменить можно 30 минут."] : []),
  ].join("\n");
  return {
    message: appliedCount ? "Готово." : "Не получилось.",
    link: null,
    reply: {
      text,
      parseMode: "HTML",
      ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}),
    },
  };
}

/** «↩️ Отменить» within 30 minutes: the lead times go back where nobody changed them since. */
export async function undoLeadTimeMarks(input: {
  client: PrismaClient;
  actor: PriceChangeActor;
  changeId: string;
  writer?: PriceChangeCatalogWriter;
}): Promise<{ message: string; link: null; reply?: PriceReply }> {
  if (!canChangePrices(input.actor)) throw new Error("TELEGRAM_ACTION_FORBIDDEN");
  const change = await input.client.opsPriceChange.findUnique({ where: { id: input.changeId } });
  if (!change || change.origin !== LEAD_TIME_CHANGE_ORIGIN || change.status !== "applied") {
    throw new Error("CALLBACK_RESOURCE_NOT_FOUND");
  }
  if (!change.undoUntil || change.undoUntil < new Date()) throw new Error("UNDO_WINDOW_EXPIRED");
  const done = (
    Array.isArray(change.items) ? (change.items as unknown as LeadTimeItem[]) : []
  ).filter((item) => item.status === "applied");
  // The way back: a mark is cleared, a cleared mark is set again.
  const mode: LeadTimeMode = done.some((item) => item.mode === "clear") ? "mark" : "clear";
  const items = done.map(
    (item): LeadTimeItem => ({ productId: item.productId, sku: item.sku, title: item.title })
  );
  const reverted = await writeLeadTimes({
    client: input.client,
    writer: input.writer ?? (await loadCatalogWriter()),
    actor: input.actor,
    changeId: change.id,
    items,
    mode,
  });
  await input.client.opsPriceChange.update({
    where: { id: change.id },
    data: { status: "undone", undoUntil: null },
  });
  return {
    message: "Отменено.",
    link: null,
    reply: {
      text: [
        `↩️ Сроки вернул как было: ${reverted} ${products(reverted)}`,
        ...listLines(items),
      ].join("\n"),
      parseMode: "HTML",
    },
  };
}
