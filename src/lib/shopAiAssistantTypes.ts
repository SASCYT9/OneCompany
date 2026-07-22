import type { ShopCurrencyCode, ShopPriceSet } from "@/lib/shopMoneyFormat";
import type { ShopAiProductKind } from "@/lib/shopAiProductKind";
import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export type { ShopAiProductKind } from "@/lib/shopAiProductKind";

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
  fuel?: string | null;
  bodyStyle?: string | null;
  drivetrain?: string | null;
  transmission?: string | null;
  market?: string | null;
};

export type ShopAiVehicleResolution = {
  status: "resolved" | "ambiguous" | "incomplete";
  confidence: "high" | "medium" | "low";
  source: "explicit" | "catalog" | "unresolved";
  candidates: string[];
  reason: string;
};

export type ShopAiContext = {
  locale: "ua" | "en";
  currency: ShopCurrencyCode;
  scope?: "auto" | "moto";
  country?: string;
  query?: string;
  category?: string;
  make?: string;
  model?: string;
  chassis?: string;
  year?: number | null;
  engine?: string;
  powerGainHp?: number | null;
  opfGpf?: "with" | "without" | null;
  productKind?: ShopAiProductKind;
  filters?: {
    category?: string;
    make?: string;
    model?: string;
    chassis?: string;
    year?: number | null;
    engine?: string;
    opfGpf?: "with" | "without" | null;
    productKind?: ShopAiProductKind;
  };
};

export type ShopAiRequiredDetail = "yearOrChassis" | "engine" | "opfGpf";
export type ShopAiMatchStatus = "exact" | "requires_verification";
export type ShopAiMatchBasis = "fitment" | "identity";
export type ShopAiResponseMode = "results" | "clarification" | "no_match";

export type ShopAiPlan = {
  intent: "recommend" | "compare" | "compatibility" | "question";
  vehicle: ShopAiVehicle;
  vehicleResolution?: ShopAiVehicleResolution;
  category: ShopStockCategoryGroupId | null;
  searchQuery: string;
  minPrice: number | null;
  maxPrice: number | null;
  brand?: string | null;
  brandOnly?: boolean;
  stockOnly?: boolean;
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
  href?: string | null;
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
  matchStatus?: ShopAiMatchStatus;
  matchBasis?: ShopAiMatchBasis;
  matchReason?: string;
  missingFacts?: string[];
  matchedApplicationId?: string | null;
  productHref?: string;
  managerHref?: string | null;
  facts?: {
    material?: "titanium" | "stainless_steel" | "carbon" | "mixed" | null;
    materialVerified?: boolean;
    opfGpf?: "with" | "without" | null;
    opfGpfVerified?: boolean;
    installationType?: "direct_fit" | "welding_required" | "professional_installation" | null;
    installationTypeVerified?: boolean;
    powerGainHp?: number | null;
    powerGainVerified?: boolean;
    productKind?: ShopAiProductKind;
    productKindVerified?: boolean;
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
  runId?: string;
  mode?: ShopAiResponseMode;
  answer?: string;
  counts?: {
    exact: number;
    requiresVerification: number;
  };
  message: string;
  products: ShopAiProduct[];
  totalItems: number;
  plan: ShopAiPlan;
  followUps: string[];
  searchHref: string | null;
  catalogHref?: string | null;
  managerHref: string;
  managerContext: ShopAiManagerContext;
  degraded?: boolean;
};
