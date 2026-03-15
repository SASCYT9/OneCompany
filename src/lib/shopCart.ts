import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { getShopProductBySlugServer } from '@/lib/shopCatalogServer';
import {
  resolveShopPriceBands,
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from '@/lib/shopPricingAudience';

export const SHOP_CART_COOKIE = 'oc_cart_token';
export const SHOP_CART_MAX_ITEMS = 40;
export const SHOP_CART_MAX_QUANTITY = 20;
const SHOP_CART_TTL_DAYS = 30;

const cartWithItemsInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ShopCartInclude;

type ShopCartWithItems = Prisma.ShopCartGetPayload<{
  include: typeof cartWithItemsInclude;
}>;

export type ShopCartItemInput = {
  slug: string;
  quantity: number;
  variantId?: string | null;
};

function normalizeLocale(locale?: string | null) {
  return locale === 'ua' ? 'ua' : 'en';
}

function createCartToken() {
  return crypto.randomBytes(18).toString('hex');
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function uniqueKey(slug: string, variantId?: string | null) {
  return `${slug}::${variantId ?? ''}`;
}

function normalizeQuantity(value: unknown) {
  const parsed = Math.floor(Number(value) || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(SHOP_CART_MAX_QUANTITY, Math.max(0, parsed));
}

function normalizeItems(items: ShopCartItemInput[]) {
  const aggregate = new Map<string, ShopCartItemInput>();

  for (const item of items.slice(0, SHOP_CART_MAX_ITEMS)) {
    const slug = String(item.slug ?? '').trim();
    const quantity = normalizeQuantity(item.quantity);
    if (!slug || quantity <= 0) continue;

    const variantId = item.variantId ? String(item.variantId).trim() : null;
    const key = uniqueKey(slug, variantId);
    const existing = aggregate.get(key);
    if (existing) {
      existing.quantity = Math.min(SHOP_CART_MAX_QUANTITY, existing.quantity + quantity);
      continue;
    }
    aggregate.set(key, { slug, quantity, variantId });
  }

  return Array.from(aggregate.values());
}

export function mergeShopCartItemInputs(
  existingItems: ShopCartItemInput[],
  incomingItems: ShopCartItemInput[]
) {
  return normalizeItems([...existingItems, ...incomingItems]);
}

async function loadCartByToken(prisma: PrismaClient, token?: string | null) {
  if (!token?.trim()) return null;
  return prisma.shopCart.findFirst({
    where: { token: token.trim() },
    include: cartWithItemsInclude,
  });
}

async function loadCustomerCart(prisma: PrismaClient, customerId?: string | null) {
  if (!customerId) return null;
  return prisma.shopCart.findFirst({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
    include: cartWithItemsInclude,
  });
}

async function createCart(
  prisma: PrismaClient,
  input: {
    customerId?: string | null;
    token?: string | null;
    currency?: string | null;
    locale?: string | null;
  }
) {
  return prisma.shopCart.create({
    data: {
      token: input.token?.trim() || createCartToken(),
      customerId: input.customerId ?? null,
      currency: String(input.currency ?? 'EUR').toUpperCase(),
      locale: normalizeLocale(input.locale),
      expiresAt: addDays(SHOP_CART_TTL_DAYS),
    },
    include: cartWithItemsInclude,
  });
}

async function touchCart(
  prisma: PrismaClient,
  cart: ShopCartWithItems,
  input: {
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
  }
) {
  return prisma.shopCart.update({
    where: { id: cart.id },
    data: {
      customerId: input.customerId ?? cart.customerId ?? null,
      currency: String(input.currency ?? cart.currency).toUpperCase(),
      locale: normalizeLocale(input.locale ?? cart.locale),
      expiresAt: addDays(SHOP_CART_TTL_DAYS),
    },
    include: cartWithItemsInclude,
  });
}

async function replaceCartItems(prisma: PrismaClient, cartId: string, items: ShopCartItemInput[]) {
  const normalized = normalizeItems(items);
  const products = normalized.length
    ? await prisma.shopProduct.findMany({
        where: {
          slug: {
            in: normalized.map((item) => item.slug),
          },
        },
        select: {
          id: true,
          slug: true,
        },
      })
    : [];
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  await prisma.shopCartItem.deleteMany({
    where: { cartId },
  });

  if (!normalized.length) {
    return;
  }

  await prisma.shopCartItem.createMany({
    data: normalized
      .map((item) => {
        const product = productBySlug.get(item.slug);
        return {
          cartId,
          productId: product?.id ?? null,
          variantId: item.variantId ?? null,
          productSlug: item.slug,
          quantity: item.quantity,
        };
      })
      .filter((item) => item.productSlug),
  });
}

async function mergeCartItems(
  prisma: PrismaClient,
  targetCart: ShopCartWithItems,
  sourceCart: ShopCartWithItems
) {
  const combined = [
    ...mergeShopCartItemInputs(
      targetCart.items.map((item) => ({
        slug: item.productSlug,
        quantity: item.quantity,
        variantId: item.variantId,
      })),
      sourceCart.items.map((item) => ({
        slug: item.productSlug,
        quantity: item.quantity,
        variantId: item.variantId,
      }))
    ),
  ];

  await replaceCartItems(prisma, targetCart.id, combined);
  await prisma.shopCart.delete({
    where: { id: sourceCart.id },
  });
}

export async function resolveShopCart(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
  }
) {
  const guestCart = await loadCartByToken(prisma, input.cartToken);
  const customerCart = await loadCustomerCart(prisma, input.customerId);

  if (input.customerId) {
    if (customerCart && guestCart && customerCart.id !== guestCart.id) {
      await mergeCartItems(prisma, customerCart, guestCart);
      const merged = await prisma.shopCart.findUniqueOrThrow({
        where: { id: customerCart.id },
        include: cartWithItemsInclude,
      });
      return {
        cart: await touchCart(prisma, merged, input),
        token: merged.token,
      };
    }

    if (customerCart) {
      return {
        cart: await touchCart(prisma, customerCart, input),
        token: customerCart.token,
      };
    }

    if (guestCart) {
      return {
        cart: await touchCart(prisma, guestCart, input),
        token: guestCart.token,
      };
    }

    const created = await createCart(prisma, input);
    return {
      cart: created,
      token: created.token,
    };
  }

  if (guestCart) {
    return {
      cart: await touchCart(prisma, guestCart, input),
      token: guestCart.token,
    };
  }

  const created = await createCart(prisma, input);
  return {
    cart: created,
    token: created.token,
  };
}

export async function replaceEntireShopCart(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
    items: ShopCartItemInput[];
  }
) {
  const { cart, token } = await resolveShopCart(prisma, input);
  await replaceCartItems(prisma, cart.id, input.items);
  const refreshed = await prisma.shopCart.findUniqueOrThrow({
    where: { id: cart.id },
    include: cartWithItemsInclude,
  });
  return { cart: refreshed, token };
}

export async function addItemToShopCart(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
    item: ShopCartItemInput;
  }
) {
  const { cart, token } = await resolveShopCart(prisma, input);
  const nextItems = [
    ...cart.items.map((item) => ({
      slug: item.productSlug,
      quantity: item.quantity,
      variantId: item.variantId,
    })),
    input.item,
  ];
  await replaceCartItems(prisma, cart.id, nextItems);
  const refreshed = await prisma.shopCart.findUniqueOrThrow({
    where: { id: cart.id },
    include: cartWithItemsInclude,
  });
  return { cart: refreshed, token };
}

export async function updateShopCartItemQuantity(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
    itemId: string;
    quantity: number;
  }
) {
  const { cart, token } = await resolveShopCart(prisma, input);
  const existing = cart.items.find((item) => item.id === input.itemId);
  if (!existing) {
    throw new Error('CART_ITEM_NOT_FOUND');
  }

  const nextItems = cart.items.map((item) => ({
    slug: item.productSlug,
    quantity: item.id === input.itemId ? input.quantity : item.quantity,
    variantId: item.variantId,
  }));
  await replaceCartItems(prisma, cart.id, nextItems);
  const refreshed = await prisma.shopCart.findUniqueOrThrow({
    where: { id: cart.id },
    include: cartWithItemsInclude,
  });
  return { cart: refreshed, token };
}

export async function deleteShopCartItem(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
    itemId: string;
  }
) {
  const { cart, token } = await resolveShopCart(prisma, input);
  const nextItems = cart.items
    .filter((item) => item.id !== input.itemId)
    .map((item) => ({
      slug: item.productSlug,
      quantity: item.quantity,
      variantId: item.variantId,
    }));
  await replaceCartItems(prisma, cart.id, nextItems);
  const refreshed = await prisma.shopCart.findUniqueOrThrow({
    where: { id: cart.id },
    include: cartWithItemsInclude,
  });
  return { cart: refreshed, token };
}

export async function clearShopCart(
  prisma: PrismaClient,
  input: {
    cartToken?: string | null;
    customerId?: string | null;
    currency?: string | null;
    locale?: string | null;
  }
) {
  const { cart, token } = await resolveShopCart(prisma, input);
  await prisma.shopCartItem.deleteMany({
    where: { cartId: cart.id },
  });
  const refreshed = await prisma.shopCart.findUniqueOrThrow({
    where: { id: cart.id },
    include: cartWithItemsInclude,
  });
  return { cart: refreshed, token };
}

export async function serializeResolvedShopCart(
  cart: ShopCartWithItems,
  context: ShopViewerPricingContext
) {
  const items = [];

  for (const item of cart.items) {
    const product = await getShopProductBySlugServer(item.productSlug);
    if (!product) continue;

    const variant = item.variantId
      ? product.variants?.find((entry) => entry.id === item.variantId)
      : null;
    const pricing = variant
      ? resolveShopPriceBands({
          b2cPrice: variant.price,
          b2cCompareAt: variant.compareAt ?? null,
          b2bPrice: variant.b2bPrice ?? null,
          b2bCompareAt: variant.b2bCompareAt ?? null,
          context,
        })
      : resolveShopProductPricing(product, context);
    items.push({
      id: item.id,
      slug: item.productSlug,
      quantity: item.quantity,
      variantId: item.variantId,
      variantTitle: variant?.title ?? null,
      title: product.title,
      price: pricing.effectivePrice,
      compareAt: pricing.effectiveCompareAt,
      pricing: {
        audience: pricing.audience,
        b2bVisible: pricing.b2bVisible,
        requestQuote: pricing.requestQuote,
        bands: pricing.bands,
      },
      image: variant?.image || product.image,
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
