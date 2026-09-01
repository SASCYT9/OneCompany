import crypto from "node:crypto";

import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import {
  resolveShopPriceBands,
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";

export type LocalShopCartItem = {
  id: string;
  slug: string;
  quantity: number;
  variantId: string | null;
  oneAiRunId?: string | null;
  oneAiCandidateDecisionId?: string | null;
};

export type LocalShopCart = {
  id: string;
  token: string;
  currency: string;
  locale: "ua" | "en";
  items: LocalShopCartItem[];
};

const MAX_ITEMS = 40;
const MAX_QUANTITY = 20;
const carts = new Map<string, LocalShopCart>();

function createToken() {
  return crypto.randomBytes(18).toString("hex");
}

function normalizeLocale(locale?: string | null): "ua" | "en" {
  return locale === "ua" ? "ua" : "en";
}

function normalizeQuantity(value: unknown) {
  const quantity = Math.floor(Number(value) || 0);
  return Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(0, quantity)) : 0;
}

function itemKey(slug: string, variantId?: string | null) {
  return `${slug}::${variantId ?? ""}`;
}

export function mergeLocalShopCartItems(
  existingItems: Array<Pick<LocalShopCartItem, "slug" | "quantity" | "variantId">>,
  incomingItems: Array<Pick<LocalShopCartItem, "slug" | "quantity" | "variantId">>
) {
  const aggregate = new Map<string, { slug: string; quantity: number; variantId: string | null }>();

  for (const item of [...existingItems, ...incomingItems].slice(0, MAX_ITEMS)) {
    const slug = String(item.slug ?? "").trim();
    const quantity = normalizeQuantity(item.quantity);
    if (!slug || quantity <= 0) continue;
    const variantId = item.variantId ? String(item.variantId).trim() : null;
    const key = itemKey(slug, variantId);
    const existing = aggregate.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    } else {
      aggregate.set(key, { slug, quantity, variantId });
    }
  }

  return [...aggregate.values()];
}

function getOrCreateCart(input: {
  token?: string | null;
  currency?: string | null;
  locale?: string | null;
}) {
  const requestedToken = String(input.token ?? "").trim();
  const existing = requestedToken ? carts.get(requestedToken) : undefined;
  if (existing) {
    existing.currency = String(input.currency ?? existing.currency).toUpperCase();
    existing.locale = normalizeLocale(input.locale ?? existing.locale);
    return existing;
  }

  const token = requestedToken || createToken();
  const cart: LocalShopCart = {
    id: `local-cart-${token}`,
    token,
    currency: String(input.currency ?? "EUR").toUpperCase(),
    locale: normalizeLocale(input.locale),
    items: [],
  };
  carts.set(token, cart);
  return cart;
}

export function resolveLocalShopCart(input: {
  token?: string | null;
  currency?: string | null;
  locale?: string | null;
}) {
  const cart = getOrCreateCart(input);
  return { cart, token: cart.token };
}

export function replaceLocalShopCart(
  input: {
    token?: string | null;
    currency?: string | null;
    locale?: string | null;
  },
  items: Array<Pick<LocalShopCartItem, "slug" | "quantity" | "variantId">>
) {
  const cart = getOrCreateCart(input);
  const previousIds = new Map(
    cart.items.map((item) => [itemKey(item.slug, item.variantId), item.id])
  );
  cart.items = mergeLocalShopCartItems([], items).map((item) => ({
    ...item,
    id: previousIds.get(itemKey(item.slug, item.variantId)) ?? `local-item-${createToken()}`,
  }));
  return { cart, token: cart.token };
}

export function updateLocalShopCartItem(input: {
  token?: string | null;
  currency?: string | null;
  locale?: string | null;
  itemId: string;
  quantity: number;
}) {
  const cart = getOrCreateCart(input);
  const item = cart.items.find((entry) => entry.id === input.itemId);
  if (!item) throw new Error("CART_ITEM_NOT_FOUND");
  const nextItems = cart.items.map((entry) => ({
    slug: entry.slug,
    quantity: entry.id === input.itemId ? input.quantity : entry.quantity,
    variantId: entry.variantId,
  }));
  return replaceLocalShopCart(input, nextItems);
}

export function deleteLocalShopCartItem(input: {
  token?: string | null;
  currency?: string | null;
  locale?: string | null;
  itemId: string;
}) {
  const cart = getOrCreateCart(input);
  const nextItems = cart.items
    .filter((entry) => entry.id !== input.itemId)
    .map((entry) => ({
      slug: entry.slug,
      quantity: entry.quantity,
      variantId: entry.variantId,
    }));
  return replaceLocalShopCart(input, nextItems);
}

export async function serializeLocalShopCart(
  cart: LocalShopCart,
  context: ShopViewerPricingContext
) {
  const items = [];

  for (const item of cart.items) {
    const product = await getShopProductBySlugServer(item.slug);
    if (!product) continue;

    const variant = item.variantId
      ? product.variants?.find((entry) => entry.id === item.variantId)
      : null;
    const pricing = variant
      ? resolveShopPriceBands({
          b2cPrice: variant.price,
          europePrice: variant.europePrice ?? product.europePrice ?? null,
          b2cCompareAt: variant.compareAt ?? null,
          b2bPrice: variant.b2bPrice ?? null,
          b2bCompareAt: variant.b2bCompareAt ?? null,
          context,
          brand: product.brand,
        })
      : resolveShopProductPricing(product, context);
    items.push({
      id: item.id,
      slug: item.slug,
      quantity: item.quantity,
      variantId: item.variantId,
      variantTitle: variant?.title ?? null,
      title: product.title,
      price: pricing.effectivePrice,
      compareAt: pricing.effectiveCompareAt,
      pricing: {
        audience: pricing.audience,
        source: pricing.source,
        baseRegion: pricing.baseRegion,
        b2bVisible: pricing.b2bVisible,
        requestQuote: pricing.requestQuote,
        bands: pricing.bands,
      },
      image: variant?.image || product.image,
      fallbackImage: product.image,
      stock: product.stock,
    });
  }

  return {
    id: cart.id,
    token: cart.token,
    currency: cart.currency,
    locale: cart.locale,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
