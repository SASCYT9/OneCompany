import type { ShopCurrencyCode, ShopPriceSet } from "@/lib/shopMoneyFormat";
import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export type ShopAiRole = "user" | "assistant";

export type ShopAiHistoryMessage = {
  role: ShopAiRole;
  text: string;
};

export type ShopAiVehicle = {
  type: "car" | "motorcycle" | "unknown";
  make: string | null;
  model: string | null;
  chassis: string | null;
  year: number | null;
  engine: string | null;
};

export type ShopAiContext = {
  locale: "ua" | "en";
  currency: ShopCurrencyCode;
  country?: string;
  query?: string;
  category?: string;
  make?: string;
  model?: string;
  chassis?: string;
  powerGainHp?: number | null;
  opfGpf?: "with" | "without" | null;
};

export type ShopAiRequiredDetail = "yearOrChassis" | "engine" | "opfGpf";
export type ShopAiProductKind = "system" | "downpipe" | "link_pipe" | "tips" | "any";

export type ShopAiPlan = {
  intent: "recommend" | "compare" | "compatibility" | "question";
  vehicle: ShopAiVehicle;
  category: ShopStockCategoryGroupId | null;
  searchQuery: string;
  minPrice: number | null;
  maxPrice: number | null;
  powerGainHp?: number | null;
  opfGpf?: "with" | "without" | null;
  requiredDetails?: ShopAiRequiredDetail[];
  productKind?: ShopAiProductKind;
  needsClarification: boolean;
  clarification: string | null;
};

export type ShopAiProduct = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  category?: string | null;
  thumbnail: string | null;
  inStock: boolean;
  price: number | null;
  priceSet?: ShopPriceSet | null;
  originalPrice?: number | null;
  originalPriceSet?: ShopPriceSet | null;
  slug: string;
  variantId: string | null;
  turn14Id: string;
  fitments?: Array<{
    make: string | null;
    models: string[];
    chassisCodes: string[];
    yearRanges?: Array<{ from: number; to: number | null }>;
    confidence?: "high" | "medium" | "low" | "unknown";
  }>;
  fitmentStatus?: "inferred" | "verified" | "universal" | "needs_review";
  fitmentSource?: "automatic" | "manual" | "import";
  compatibility?: "confirmed" | "likely" | "needs_review";
  compatibilityReason?: string;
  facts?: {
    material?: "titanium" | "stainless_steel" | "carbon" | "mixed" | null;
    opfGpf?: "with" | "without" | null;
    installationType?: "direct_fit" | "welding_required" | "professional_installation" | null;
    powerGainHp?: number | null;
    productKind?: ShopAiProductKind;
  };
};

export type ShopAiManagerContext = {
  createdAt: number;
  vehicleType: "auto" | "moto";
  vehicle: string;
  request: string;
  products: Array<{ brand: string; sku: string; name: string }>;
};

export type ShopAiAssistantResponse = {
  conversationId?: string;
  message: string;
  products: ShopAiProduct[];
  totalItems: number;
  plan: ShopAiPlan;
  followUps: string[];
  searchHref: string | null;
  managerHref: string;
  managerContext: ShopAiManagerContext;
  degraded?: boolean;
};
