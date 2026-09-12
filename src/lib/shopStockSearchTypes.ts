import type { ShopPriceSet } from "@/lib/shopMoneyFormat";

export type StockItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  thumbnail: string | null;
  imageSources?: string[];
  inStock: boolean;
  price: number | null;
  priceUsd?: number;
  priceEur?: number;
  priceUah?: number;
  priceSet?: ShopPriceSet | null;
  originalPrice?: number | null;
  originalPriceSet?: ShopPriceSet | null;
  basePrice: number;
  markupPct: number;
  slug: string;
  href?: string | null;
  variantId: string | null;
  turn14Id: string;
  category?: string | null;
  matchStatus?: "exact" | "requires_verification";
  missingFacts?: string[];
  matchReason?: string;
  matchedApplicationId?: string | null;
  fitmentStatus?: "inferred" | "verified" | "universal" | "needs_review";
  fitmentSource?: "automatic" | "manual" | "import";
  fitments?: StockFitmentApplication[];
};

export type StockFitmentApplication = {
  make: string;
  models: string[];
  chassisCodes: string[];
  yearRanges: Array<{ from: number; to: number | null }>;
  engines: string[];
  fuel?: string | null;
  bodyStyles: string[];
  drivetrains: string[];
  markets: string[];
  transmission?: string | null;
  opfGpf?: "with" | "without" | "unknown";
  confidence?: "high" | "medium" | "low" | "unknown";
};

export type StockSuggestion =
  | {
      type: "product";
      id: string;
      name: string;
      brand: string;
      partNumber: string;
      thumbnail: string | null;
      slug: string;
      href?: string | null;
      category: string;
    }
  | { type: "brand"; id: string; label: string; count?: number }
  | {
      type: "vehicle";
      id: string;
      label: string;
      make: string;
      model?: string;
      count?: number;
    };

export type FilterStats = {
  brands: Array<{ label: string; count: number }>;
  categories: Array<{ label: string; count: number }>;
  stock: {
    all: number;
    inStock: number;
    preOrder: number;
  };
  price?: {
    min: number;
    max: number;
    currency?: string;
  };
};

export type StockSearchResponse = {
  data?: StockItem[];
  error?: string;
  meta?: {
    totalPages?: number;
    totalItems?: number;
    fallbackApplied?: "fitment" | "all" | null;
  };
  filters?: {
    brands?: string[];
    categories?: string[];
    price?: FilterStats["price"];
  };
  filterStats?: FilterStats;
  globalFilterStats?: FilterStats;
};

export type StockInitialData = {
  response: StockSearchResponse;
  requestKey: string;
  audienceKey: string;
  isB2B: boolean;
};
