import type { ShopCurrencyCode, ShopPriceSet } from "@/lib/shopMoneyFormat";

export type OneAiLocale = "ua" | "en";

/** Page context the catalog passes along: who is asking and what is already selected. */
export type OneAiContext = {
  locale: OneAiLocale;
  currency: ShopCurrencyCode;
  scope?: "auto" | "moto";
  country?: string;
  vehicle?: {
    make?: string;
    model?: string;
    chassis?: string;
    year?: number | null;
    engine?: string;
  };
  category?: string;
};

/** inStock = on the shelf, inTransit = already shipped to us, onOrder = ordered from the supplier. */
export type OneAiAvailability = "inStock" | "inTransit" | "onOrder";

/** A catalog product the assistant has seen in this conversation, addressed by a short ref. */
export type OneAiProduct = {
  ref: string;
  id: string;
  slug: string;
  href: string;
  brand: string;
  name: string;
  sku: string;
  image: string | null;
  priceSet: ShopPriceSet | null;
  compareAtSet: ShopPriceSet | null;
  availability: OneAiAvailability;
  category: string | null;
  /** Short supplier description, shown to the model only. */
  summary: string;
};

export type OneAiCard = Omit<OneAiProduct, "summary"> & { reason: string | null };

export type OneAiComparison = {
  rows: Array<{ label: string; values: string[] }>;
};

export type OneAiUsage = {
  model: string;
  modelCalls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  costUsd: number;
  latencyMs: number;
  firstTextMs: number | null;
  tools: string[];
};

/** One NDJSON line of the streamed answer. */
export type OneAiEvent =
  | { type: "status"; text: string }
  | { type: "text"; text: string }
  | {
      type: "products";
      layout: "cards" | "compare";
      products: OneAiCard[];
      comparison: OneAiComparison | null;
    }
  | { type: "replies"; options: string[] }
  | {
      type: "done";
      conversationId: string;
      catalogHref: string | null;
      usage?: OneAiUsage;
    }
  | { type: "error"; code: string; message: string };

export type OneAiHistoryEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; shownRefs: string[] };

export type OneAiConversationState = {
  kind: "one-ai-agent";
  version: 1;
  history: OneAiHistoryEntry[];
  products: Record<string, OneAiProduct>;
  nextRef: number;
  /** Catalog page with the filters of the latest search ("see everything" link). */
  lastCatalogHref: string | null;
};
