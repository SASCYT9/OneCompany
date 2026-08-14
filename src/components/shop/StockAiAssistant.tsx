"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CircleHelp,
  ExternalLink,
  MessageCircleMore,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { isShopAiContinuation } from "@/lib/shopAiAssistantConversation";
import type {
  ShopAiAssistantResponse,
  ShopAiContext,
  ShopAiDegradedReason,
  ShopAiManagerContext,
  ShopAiProduct,
  ShopAiPipeline,
} from "@/lib/shopAiAssistantTypes";
import { formatShopAiProductKind } from "@/lib/shopAiProductKind";
import { formatShopMoney } from "@/lib/shopMoneyFormat";
import { SHOP_STOCK_CATEGORY_GROUPS } from "@/lib/shopStockTaxonomy";
import { resolveShopCatalogProductHref } from "@/lib/shopStorefrontRouting";
import {
  postShopAiClientAttributionEvent,
  storeShopAiClientAttribution,
  type ShopAiClientAttribution,
} from "@/lib/shopAiClientAttribution";
import { SHOP_AI_CLIENT_ABORT_MS } from "@/lib/shopAiProviderPolicy";

type ShopAiV2Mode = "results" | "clarification" | "no_match";
type ShopAiV2MatchStatus = "exact" | "requires_verification";
type ShopAiV2Counts = {
  exact: number;
  requiresVerification: number;
};

type AssistantProduct = ShopAiProduct & {
  matchStatus?: ShopAiV2MatchStatus;
  missingFacts: string[];
  productHref?: string;
  managerHref?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: AssistantProduct[];
  followUps?: string[];
  searchHref?: string | null;
  managerHref?: string;
  managerContext?: ShopAiManagerContext;
  plan?: ShopAiAssistantResponse["plan"];
  mode?: ShopAiV2Mode;
  counts?: ShopAiV2Counts;
  runId?: string;
  conversationId?: string;
  degraded?: boolean;
  pipeline?: ShopAiPipeline;
  degradedReason?: ShopAiDegradedReason;
};

type Props = ShopAiContext;
type FeedbackRating = "up" | "down";
type FeedbackReason =
  | "wrong_fitment"
  | "wrong_category"
  | "irrelevant"
  | "missing_product"
  | "other";
type FeedbackState = {
  rating: FeedbackRating;
  reason?: FeedbackReason;
  status: "choosing" | "sending" | "sent" | "failed";
};

type PersistedOneAiConversation = {
  version: 1;
  savedAt: number;
  contextKey: string;
  conversationId: string | null;
  messages: ChatMessage[];
};

const AI_FILTER_SESSION_KEY = "onecompany:stock-ai-filters";
const MANAGER_HANDOFF_SESSION_KEY = "onecompany:one-ai-manager-handoff";
const ONE_AI_CONVERSATION_SESSION_KEY = "onecompany:one-ai-conversation:v1";
const ONE_AI_CONVERSATION_TTL_MS = 2 * 60 * 60 * 1000;
const AI_FILTER_KEYS = [
  "q",
  "brand",
  "category",
  "make",
  "model",
  "chassis",
  "year",
  "engine",
  "opfGpf",
  "productKind",
  "strict",
  "stock",
  "minPrice",
  "maxPrice",
  "page",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneAiContextKey(context: ShopAiContext) {
  return JSON.stringify([
    context.locale,
    context.currency,
    context.scope ?? "auto",
    context.category ?? null,
    context.make ?? null,
    context.model ?? null,
    context.chassis ?? null,
    context.year ?? null,
    context.engine ?? null,
    context.fuel ?? null,
    context.bodyStyle ?? null,
    context.opfGpf ?? null,
    context.productKind ?? null,
  ]);
}

function readPersistedOneAiConversation(contextKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ONE_AI_CONVERSATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedOneAiConversation>;
    if (
      parsed.version !== 1 ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > ONE_AI_CONVERSATION_TTL_MS ||
      parsed.contextKey !== contextKey ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0
    ) {
      window.sessionStorage.removeItem(ONE_AI_CONVERSATION_SESSION_KEY);
      return null;
    }
    return {
      version: 1 as const,
      savedAt: parsed.savedAt,
      contextKey,
      conversationId: typeof parsed.conversationId === "string" ? parsed.conversationId : null,
      messages: parsed.messages.slice(-12) as ChatMessage[],
    } satisfies PersistedOneAiConversation;
  } catch {
    try {
      window.sessionStorage.removeItem(ONE_AI_CONVERSATION_SESSION_KEY);
    } catch {
      // Session storage may be unavailable under strict privacy settings.
    }
    return null;
  }
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function readOptionalStringArray(value: unknown, key: string): string[] {
  if (!isRecord(value) || !Array.isArray(value[key])) return [];
  return value[key].filter(
    (candidate): candidate is string => typeof candidate === "string" && Boolean(candidate.trim())
  );
}

function readV2Mode(value: unknown): ShopAiV2Mode | undefined {
  const candidate = readOptionalString(value, "mode");
  return candidate === "results" || candidate === "clarification" || candidate === "no_match"
    ? candidate
    : undefined;
}

function readV2MatchStatus(value: unknown): ShopAiV2MatchStatus | undefined {
  const candidate = readOptionalString(value, "matchStatus");
  return candidate === "exact" || candidate === "requires_verification" ? candidate : undefined;
}

function readV2Counts(value: unknown): ShopAiV2Counts | undefined {
  if (!isRecord(value) || !isRecord(value.counts)) return undefined;
  const exact = value.counts.exact;
  const requiresVerification = value.counts.requiresVerification;
  if (
    typeof exact !== "number" ||
    !Number.isFinite(exact) ||
    typeof requiresVerification !== "number" ||
    !Number.isFinite(requiresVerification)
  ) {
    return undefined;
  }
  return {
    exact: Math.max(0, Math.floor(exact)),
    requiresVerification: Math.max(0, Math.floor(requiresVerification)),
  };
}

function readShopAiPipeline(value: unknown): ShopAiPipeline | undefined {
  const candidate = readOptionalString(value, "pipeline");
  return candidate === "legacy" || candidate === "v2" ? candidate : undefined;
}

function readShopAiDegradedReason(value: unknown): ShopAiDegradedReason | undefined {
  const candidate = readOptionalString(value, "degradedReason");
  return candidate === "planner" ||
    candidate === "vehicle_resolution" ||
    candidate === "retrieval" ||
    candidate === "answer" ||
    candidate === "timeout"
    ? candidate
    : undefined;
}

function normalizeAssistantProduct(product: ShopAiProduct): AssistantProduct {
  return {
    ...product,
    matchStatus: readV2MatchStatus(product),
    missingFacts: readOptionalStringArray(product, "missingFacts"),
    productHref: readOptionalString(product, "productHref"),
    managerHref: readOptionalString(product, "managerHref"),
  };
}

function resolvedMatchStatus(product: AssistantProduct): ShopAiV2MatchStatus {
  if (product.matchStatus) return product.matchStatus;
  return product.compatibility === "confirmed" ? "exact" : "requires_verification";
}

function sortAssistantProducts(products: AssistantProduct[]) {
  return [...products].sort((left, right) => {
    const leftRank = resolvedMatchStatus(left) === "exact" ? 0 : 1;
    const rightRank = resolvedMatchStatus(right) === "exact" ? 0 : 1;
    return leftRank - rightRank;
  });
}

function localizedCategoryLabel(category: string | null | undefined, locale: "ua" | "en") {
  const normalized = category?.trim();
  if (!normalized) return "";
  const canonical = SHOP_STOCK_CATEGORY_GROUPS.find((group) => group.id === normalized);
  return canonical ? (locale === "en" ? canonical.en : canonical.ua) : normalized;
}

function createGreeting(
  locale: "ua" | "en",
  vehicleLabel: string,
  scope: "auto" | "moto" = "auto",
  category = ""
): ChatMessage {
  const activeCategory = localizedCategoryLabel(category, locale);

  return {
    id: "greeting",
    role: "assistant",
    text:
      locale === "ua"
        ? vehicleLabel
          ? activeCategory
            ? `Ви переглядаєте «${activeCategory}» для ${vehicleLabel}. Підберу доречні варіанти й коротко поясню різницю.`
            : `Що хочете змінити у ${vehicleLabel}? Підберу кілька доречних варіантів і коротко поясню різницю.`
          : activeCategory
            ? `Ви переглядаєте «${activeCategory}». Напишіть марку й модель — підберу доречні варіанти.`
            : scope === "moto"
              ? "Напишіть марку, модель мотоцикла і що саме хочете змінити. Я підберу кілька доречних варіантів."
              : "Напишіть марку, модель авто і що саме хочете змінити. Я підберу кілька доречних варіантів."
        : vehicleLabel
          ? activeCategory
            ? `You are viewing “${activeCategory}” for ${vehicleLabel}. I will shortlist the strongest options and explain the differences.`
            : `What would you like to change on your ${vehicleLabel}? I will shortlist the strongest options and explain the differences.`
          : activeCategory
            ? `You are viewing “${activeCategory}”. Tell me the make and model and I will shortlist the strongest options.`
            : scope === "moto"
              ? "Tell me the motorcycle make, model and what you want to upgrade. I will shortlist the strongest options."
              : "Tell me the car make, model and what you want to upgrade. I will shortlist the strongest options.",
  };
}

function productPrice(product: ShopAiProduct, context: ShopAiContext) {
  const direct =
    context.currency === "EUR"
      ? product.priceSet?.eur
      : context.currency === "USD"
        ? product.priceSet?.usd
        : product.priceSet?.uah;
  return Number(direct ?? product.price ?? 0);
}

function resolveProductHref(product: AssistantProduct, context: ShopAiContext) {
  return (
    product.productHref || resolveShopCatalogProductHref(context.locale, product.href, product.slug)
  );
}

function buildProductAttribution(
  message: ChatMessage,
  product: AssistantProduct,
  context: ShopAiContext
): ShopAiClientAttribution | null {
  if (!message.runId) return null;
  return {
    savedAt: Date.now(),
    runId: message.runId,
    conversationId: message.conversationId ?? null,
    productId: product.id,
    variantId: product.variantId,
    slug: product.slug,
    locale: context.locale,
  };
}

function productFactLabel(product: ShopAiProduct, isUa: boolean) {
  const facts = product.facts;
  if (!facts) return "";
  return [
    facts.materialVerified && facts.material === "titanium"
      ? isUa
        ? "Титан"
        : "Titanium"
      : facts.materialVerified && facts.material === "stainless_steel"
        ? isUa
          ? "Нержавіюча сталь"
          : "Stainless steel"
        : facts.materialVerified && facts.material === "carbon"
          ? isUa
            ? "Карбон"
            : "Carbon"
          : facts.materialVerified && facts.material === "mixed"
            ? isUa
              ? "Комбіновані матеріали"
              : "Mixed materials"
            : null,
    facts.opfGpfVerified && facts.opfGpf === "with"
      ? "OPF/GPF"
      : facts.opfGpfVerified && facts.opfGpf === "without"
        ? "NON-OPF"
        : null,
    facts.productKindVerified
      ? formatShopAiProductKind(facts.productKind, isUa ? "ua" : "en")
      : null,
    facts.installationTypeVerified && facts.installationType === "direct_fit"
      ? "Bolt-on"
      : facts.installationTypeVerified && facts.installationType === "welding_required"
        ? isUa
          ? "Потрібне зварювання"
          : "Welding required"
        : facts.installationTypeVerified && facts.installationType === "professional_installation"
          ? isUa
            ? "Професійне встановлення"
            : "Professional installation"
          : null,
    facts.powerGainVerified && facts.powerGainHp
      ? `+${facts.powerGainHp} ${isUa ? "к.с." : "hp"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildDefaultManagerContext(context: ShopAiContext): ShopAiManagerContext {
  const vehicle = [context.make, context.model, context.chassis].filter(Boolean).join(" ");
  return {
    createdAt: Date.now(),
    vehicleType: context.scope === "moto" ? "moto" : "auto",
    vehicle,
    vehicleDetails: {
      make: context.make ?? null,
      model: context.model ?? null,
      chassis: context.chassis ?? null,
      year: context.year ?? null,
      engine: context.engine ?? null,
      fuel: context.fuel ?? null,
      bodyStyle: context.bodyStyle ?? null,
      opfGpf: context.opfGpf ?? null,
    },
    request: context.query ?? "",
    products: [],
  };
}

export function StockAiAssistant(props: Props) {
  const router = useRouter();
  const [assistantContext, setAssistantContext] = useState<ShopAiContext>(() => ({
    ...props,
    filters: props.filters ? { ...props.filters } : undefined,
  }));
  const isUa = assistantContext.locale === "ua";
  const reducedMotion = useReducedMotion();
  const vehicleLabel = [
    assistantContext.make,
    assistantContext.model,
    assistantContext.chassis,
    assistantContext.year,
  ]
    .filter(Boolean)
    .join(" ");
  const [portalReady, setPortalReady] = useState(false);
  const [desktopPanel, setDesktopPanel] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createGreeting(
      assistantContext.locale,
      vehicleLabel,
      assistantContext.scope,
      assistantContext.category
    ),
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contextEdited, setContextEdited] = useState(false);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, FeedbackState>>({});
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const hydratedConversationRef = useRef(false);

  const conversationContextKey = oneAiContextKey(assistantContext);

  const clearPersistedConversation = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(ONE_AI_CONVERSATION_SESSION_KEY);
    } catch {
      // Conversation persistence is optional.
    }
  }, []);

  useEffect(() => {
    setAssistantContext((current) => ({
      ...current,
      locale: props.locale,
      currency: props.currency,
      country: props.country,
    }));
  }, [props.country, props.currency, props.locale]);

  useEffect(() => {
    if (hydratedConversationRef.current) return;
    const persisted = readPersistedOneAiConversation(conversationContextKey);
    if (persisted) {
      setMessages(persisted.messages);
      conversationIdRef.current = persisted.conversationId;
    }
    hydratedConversationRef.current = true;
  }, [conversationContextKey]);

  useEffect(() => {
    if (!hydratedConversationRef.current || typeof window === "undefined") return;
    if (messages.length <= 1 && !conversationIdRef.current) {
      clearPersistedConversation();
      return;
    }
    const payload: PersistedOneAiConversation = {
      version: 1,
      savedAt: Date.now(),
      contextKey: conversationContextKey,
      conversationId: conversationIdRef.current,
      messages: messages.slice(-12),
    };
    try {
      window.sessionStorage.setItem(ONE_AI_CONVERSATION_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Session storage is an enhancement; a quota or privacy failure must not break chat.
    }
  }, [clearPersistedConversation, conversationContextKey, messages]);

  useEffect(() => {
    return () => requestRef.current?.abort();
  }, []);

  function commitAssistantContext(next: ShopAiContext) {
    requestRef.current?.abort();
    requestRef.current = null;
    conversationIdRef.current = null;
    clearPersistedConversation();
    setAssistantContext(next);
    setContextEdited(true);
    const nextVehicleLabel = [next.make, next.model, next.chassis, next.year]
      .filter(Boolean)
      .join(" ");
    setMessages([createGreeting(next.locale, nextVehicleLabel, next.scope, next.category)]);
    setDraft("");
    setError("");
    setLoading(false);
    setFeedbackByMessage({});
  }

  function removeAssistantContextField(
    field:
      | "category"
      | "make"
      | "model"
      | "chassis"
      | "year"
      | "engine"
      | "fuel"
      | "bodyStyle"
      | "opfGpf"
      | "productKind"
  ) {
    const next: ShopAiContext = {
      ...assistantContext,
      filters: assistantContext.filters ? { ...assistantContext.filters } : undefined,
    };
    const fields = new Set<typeof field>([field]);
    if (field === "make") {
      fields.add("model");
      fields.add("chassis");
      fields.add("year");
      fields.add("engine");
      fields.add("fuel");
      fields.add("bodyStyle");
      fields.add("opfGpf");
    } else if (field === "model") {
      fields.add("chassis");
    } else if (field === "category") {
      fields.add("productKind");
    }
    for (const key of fields) {
      delete next[key];
      if (next.filters && key in next.filters) delete next.filters[key];
    }
    commitAssistantContext(next);
  }

  function toggleAssistantScope() {
    const nextScope = assistantContext.scope === "moto" ? "auto" : "moto";
    const next: ShopAiContext = {
      ...assistantContext,
      scope: nextScope,
      make: undefined,
      model: undefined,
      chassis: undefined,
      year: null,
      engine: undefined,
      fuel: undefined,
      bodyStyle: undefined,
      opfGpf: null,
      filters: assistantContext.filters
        ? {
            ...assistantContext.filters,
            make: undefined,
            model: undefined,
            chassis: undefined,
            year: null,
            engine: undefined,
            fuel: undefined,
            bodyStyle: undefined,
            opfGpf: null,
          }
        : undefined,
    };
    commitAssistantContext(next);
  }

  const storeManagerHandoff = useCallback((context: ShopAiManagerContext) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        MANAGER_HANDOFF_SESSION_KEY,
        JSON.stringify({ ...context, createdAt: Date.now() })
      );
    } catch {
      // The contact page remains reachable even if storage is unavailable.
    }
  }, []);

  const hasAiAppliedFilters = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(window.sessionStorage.getItem(AI_FILTER_SESSION_KEY));
    } catch {
      return false;
    }
  }, []);

  const markAiAppliedFilters = useCallback((href: string) => {
    if (typeof window === "undefined") return;
    const target = new URL(href, window.location.origin);
    const values = Object.fromEntries(
      AI_FILTER_KEYS.flatMap((key) => {
        const value = target.searchParams.get(key);
        return value === null ? [] : [[key, value]];
      })
    );
    try {
      window.sessionStorage.setItem(AI_FILTER_SESSION_KEY, JSON.stringify(values));
    } catch {
      // Filter attribution is an enhancement and must not block navigation.
    }
  }, []);

  const clearAiAppliedFilters = useCallback(() => {
    if (typeof window === "undefined") return;
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(AI_FILTER_SESSION_KEY);
      if (stored) window.sessionStorage.removeItem(AI_FILTER_SESSION_KEY);
    } catch {
      return;
    }
    if (!stored) return;
    let appliedFilters: Record<string, string> = {};
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        appliedFilters = parsed as Record<string, string>;
      }
    } catch {
      // A malformed marker should never block closing the assistant.
    }
    const url = new URL(window.location.href);
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (url.searchParams.get(key) === value) url.searchParams.delete(key);
    });
    const query = url.searchParams.toString();
    router.replace(`${url.pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [router]);

  const closeAssistant = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setOpen(false);
    setLoading(false);
  }, []);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncPanelMode = () => setDesktopPanel(mediaQuery.matches);
    syncPanelMode();
    mediaQuery.addEventListener("change", syncPanelMode);
    return () => mediaQuery.removeEventListener("change", syncPanelMode);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const launcher = launcherRef.current;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 180);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const inertSiblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== panel
    );
    const previousSiblingAttributes = inertSiblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.getAttribute("inert"),
    }));
    inertSiblings.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousSiblingAttributes.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        if (inert === null) element.removeAttribute("inert");
        else element.setAttribute("inert", inert);
      });
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else launcher?.focus();
    };
  }, [closeAssistant, open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [loading, messages, open]);

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || loading) return;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setError("");
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let clientTimedOut = false;
    const clientTimeout = window.setTimeout(() => {
      clientTimedOut = true;
      controller.abort();
    }, SHOP_AI_CLIENT_ABORT_MS);

    try {
      const startsNewSearch =
        !contextEdited && hasAiAppliedFilters() && !isShopAiContinuation(message);
      if (startsNewSearch) {
        clearAiAppliedFilters();
        conversationIdRef.current = null;
      }
      const requestContext: ShopAiContext = startsNewSearch
        ? {
            locale: assistantContext.locale,
            currency: assistantContext.currency,
            scope: assistantContext.scope,
            country: assistantContext.country,
          }
        : assistantContext;
      const response = await fetch("/api/shop/stock/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: requestContext,
          conversationId: conversationIdRef.current,
        }),
        signal: controller.signal,
      });
      const responsePayload: unknown = await response.json().catch(() => ({}));
      const data = (
        isRecord(responsePayload) ? responsePayload : {}
      ) as Partial<ShopAiAssistantResponse>;
      const responseError = readOptionalString(responsePayload, "error");
      if (!response.ok) throw new Error(responseError || "Assistant request failed");

      const conversationId = readOptionalString(responsePayload, "conversationId");
      conversationIdRef.current = conversationId || conversationIdRef.current;
      const rawProducts = Array.isArray(data.products) ? data.products : [];
      const products = sortAssistantProducts(rawProducts.map(normalizeAssistantProduct));
      const answer =
        readOptionalString(responsePayload, "answer") ||
        readOptionalString(responsePayload, "message") ||
        (isUa ? "Не вдалося сформувати відповідь." : "I could not prepare an answer.");
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: answer,
          products,
          followUps: readOptionalStringArray(responsePayload, "followUps"),
          searchHref:
            readOptionalString(responsePayload, "catalogHref") ||
            readOptionalString(responsePayload, "searchHref") ||
            null,
          managerHref: readOptionalString(responsePayload, "managerHref"),
          managerContext: data.managerContext,
          plan: data.plan,
          mode: readV2Mode(responsePayload),
          counts: readV2Counts(responsePayload),
          runId: readOptionalString(responsePayload, "runId"),
          conversationId,
          degraded: data.degraded === true,
          pipeline: readShopAiPipeline(responsePayload),
          degradedReason: readShopAiDegradedReason(responsePayload),
        },
      ]);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError" || clientTimedOut) {
        setError(
          clientTimedOut
            ? isUa
              ? "OneAI не встиг відповісти. Спробуйте ще раз або зверніться до менеджера."
              : "OneAI did not respond in time. Try again or ask a manager."
            : isUa
              ? "Не вдалося отримати відповідь. Спробуйте ще раз."
              : "I could not get an answer. Please try again."
        );
      }
    } finally {
      window.clearTimeout(clientTimeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  function resetConversation() {
    requestRef.current?.abort();
    requestRef.current = null;
    clearPersistedConversation();
    setMessages([
      createGreeting(
        assistantContext.locale,
        vehicleLabel,
        assistantContext.scope,
        assistantContext.category
      ),
    ]);
    conversationIdRef.current = null;
    setDraft("");
    setError("");
    setLoading(false);
    setFeedbackByMessage({});
    clearAiAppliedFilters();
  }

  async function submitFeedback(
    message: ChatMessage,
    rating: FeedbackRating,
    reason?: FeedbackReason
  ) {
    const currentState = feedbackByMessage[message.id];
    if (currentState?.status === "sending" || currentState?.status === "sent") return;

    setFeedbackByMessage((current) => ({
      ...current,
      [message.id]: { rating, status: "sending" },
    }));

    try {
      const response = await fetch("/api/shop/stock/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: message.runId,
          conversationId: message.conversationId || conversationIdRef.current || undefined,
          rating,
          reason,
          locale: assistantContext.locale,
        }),
      });
      if (!response.ok) throw new Error("Feedback request failed");
      setFeedbackByMessage((current) => ({
        ...current,
        [message.id]: { rating, reason, status: "sent" },
      }));
    } catch {
      setFeedbackByMessage((current) => ({
        ...current,
        [message.id]: { rating, reason, status: "failed" },
      }));
    }
  }

  const categoryLabel = localizedCategoryLabel(assistantContext.category, isUa ? "ua" : "en");
  const starters = isUa
    ? [
        assistantContext.category
          ? vehicleLabel
            ? `Підбери найкращі варіанти «${categoryLabel}» для ${vehicleLabel}`
            : `Підбери найкращі варіанти з категорії «${categoryLabel}»`
          : vehicleLabel
            ? `Покажи вихлоп для ${vehicleLabel}`
            : assistantContext.scope === "moto"
              ? "Підбери вихлоп для мого мотоцикла"
              : "Підбери вихлоп для мого авто",
        "Порівняй найкращі варіанти",
        "Що варто змінити спочатку?",
      ]
    : [
        assistantContext.category
          ? vehicleLabel
            ? `Find the strongest “${categoryLabel}” options for ${vehicleLabel}`
            : `Find the strongest options in “${categoryLabel}”`
          : vehicleLabel
            ? `Show exhausts for ${vehicleLabel}`
            : assistantContext.scope === "moto"
              ? "Find an exhaust for my motorcycle"
              : "Find an exhaust for my car",
        "Compare the strongest options",
        "What should I upgrade first?",
      ];
  const inputPlaceholder = vehicleLabel
    ? isUa
      ? `Запитайте про ${vehicleLabel}`
      : `Ask about ${vehicleLabel}`
    : isUa
      ? assistantContext.scope === "moto"
        ? "Мотоцикл і бажаний результат"
        : "Авто і бажаний результат"
      : assistantContext.scope === "moto"
        ? "Motorcycle and desired result"
        : "Car and desired result";
  const managerHref =
    [...messages].reverse().find((message) => message.managerHref)?.managerHref ||
    `/${assistantContext.locale}/contact?source=one-ai`;
  const managerContext =
    [...messages].reverse().find((message) => message.managerContext)?.managerContext ||
    buildDefaultManagerContext(assistantContext);
  const latestAttributableMessage = [...messages]
    .reverse()
    .find((message) => message.runId && message.products?.length);
  const managerAttribution = latestAttributableMessage?.products?.[0]
    ? buildProductAttribution(
        latestAttributableMessage,
        latestAttributableMessage.products[0],
        assistantContext
      )
    : null;
  const contextChips: Array<{
    key: string;
    label: string;
    onClick: () => void;
    removable: boolean;
  }> = [
    {
      key: "scope",
      label: assistantContext.scope === "moto" ? (isUa ? "Мото" : "Moto") : isUa ? "Авто" : "Auto",
      onClick: toggleAssistantScope,
      removable: false,
    },
  ];
  const addContextChip = (
    key: Parameters<typeof removeAssistantContextField>[0],
    value: string | number | null | undefined,
    label: string
  ) => {
    if (value === null || value === undefined || value === "") return;
    contextChips.push({
      key,
      label,
      onClick: () => removeAssistantContextField(key),
      removable: true,
    });
  };
  addContextChip(
    "category",
    assistantContext.category,
    `${isUa ? "Категорія" : "Category"}: ${categoryLabel}`
  );
  addContextChip("make", assistantContext.make, assistantContext.make ?? "");
  addContextChip("model", assistantContext.model, assistantContext.model ?? "");
  addContextChip("chassis", assistantContext.chassis, assistantContext.chassis ?? "");
  addContextChip(
    "year",
    assistantContext.year,
    `${isUa ? "Рік" : "Year"}: ${assistantContext.year ?? ""}`
  );
  addContextChip(
    "engine",
    assistantContext.engine,
    `${isUa ? "Двигун" : "Engine"}: ${assistantContext.engine ?? ""}`
  );
  addContextChip(
    "fuel",
    assistantContext.fuel,
    `${isUa ? "Паливо" : "Fuel"}: ${assistantContext.fuel ?? ""}`
  );
  addContextChip(
    "bodyStyle",
    assistantContext.bodyStyle,
    `${isUa ? "Кузов" : "Body"}: ${assistantContext.bodyStyle ?? ""}`
  );
  addContextChip(
    "opfGpf",
    assistantContext.opfGpf,
    assistantContext.opfGpf === "with"
      ? isUa
        ? "З OPF/GPF"
        : "With OPF/GPF"
      : isUa
        ? "Без OPF/GPF"
        : "Without OPF/GPF"
  );
  addContextChip(
    "productKind",
    assistantContext.productKind,
    formatShopAiProductKind(assistantContext.productKind, isUa ? "ua" : "en") ?? ""
  );

  return (
    <>
      <motion.button
        ref={launcherRef}
        type="button"
        data-testid="stock-ai-launcher"
        onClick={() => setOpen(true)}
        whileHover={reducedMotion ? undefined : { y: -2 }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-foreground/25 bg-foreground px-2.5 text-background shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-colors hover:border-foreground hover:brightness-110 sm:h-10 sm:px-3"
        aria-label={isUa ? "Відкрити One AI" : "Open One AI"}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-background/25"
            animate={
              reducedMotion ? undefined : { opacity: [0.15, 0.45, 0.15], scale: [0.8, 1.12, 0.8] }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <Sparkles className="relative h-3.5 w-3.5" />
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em]">One AI</span>
      </motion.button>

      {portalReady
        ? createPortal(
            open ? (
              <motion.aside
                ref={panelRef}
                data-testid="stock-ai-panel"
                role="dialog"
                aria-modal="true"
                aria-label="One AI"
                aria-labelledby="one-ai-panel-title"
                initial={
                  reducedMotion ? { opacity: 0 } : desktopPanel ? { x: "100%" } : { y: "100%" }
                }
                animate={reducedMotion ? { opacity: 1 } : desktopPanel ? { x: 0 } : { y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 360, damping: 34 }
                }
                className="fixed inset-x-0 bottom-0 z-[70] flex h-[min(92dvh,760px)] w-full flex-col overflow-hidden rounded-t-[var(--one-ai-radius)] border border-b-0 border-foreground/14 bg-background text-foreground shadow-[0_-16px_48px_rgba(0,0,0,0.18)] md:inset-auto md:bottom-6 md:right-6 md:h-[min(680px,calc(100dvh-8rem))] md:w-[390px] md:rounded-[var(--one-ai-radius)] md:border md:border-foreground/14 md:shadow-[-16px_0_48px_rgba(0,0,0,0.18)]"
              >
                <header className="flex h-14 shrink-0 items-center justify-between border-b border-foreground/10 px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center border border-foreground/15 bg-foreground/[0.04]">
                      <motion.span
                        className="absolute right-1 top-1 h-1.5 w-1.5 bg-foreground/70"
                        animate={reducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <Sparkles className="h-4 w-4 opacity-70" />
                    </div>
                    <div className="min-w-0">
                      <div id="one-ai-panel-title" className="text-sm font-semibold tracking-wide">
                        One AI
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">
                        {isUa ? "Підбір тюнінгу" : "Tuning assistant"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={resetConversation}
                      className="flex h-9 w-9 items-center justify-center text-foreground/45 transition hover:bg-foreground/[0.05] hover:text-foreground"
                      aria-label={isUa ? "Новий діалог" : "New conversation"}
                      title={isUa ? "Новий діалог" : "New conversation"}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={closeAssistant}
                      className="flex h-9 w-9 items-center justify-center text-foreground/45 transition hover:bg-foreground/[0.05] hover:text-foreground"
                      aria-label={isUa ? "Закрити" : "Close"}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </header>

                {contextChips.length ? (
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-foreground/10 bg-foreground/[0.018] px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {contextChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onClick}
                        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 border border-foreground/12 bg-background/55 px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground/62 transition hover:border-foreground/30 hover:text-foreground"
                        aria-label={
                          chip.removable
                            ? isUa
                              ? `Прибрати контекст: ${chip.label}`
                              : `Remove context: ${chip.label}`
                            : isUa
                              ? "Перемкнути авто або мото"
                              : "Switch auto or moto"
                        }
                        title={
                          chip.removable
                            ? isUa
                              ? "Прибрати з підбору"
                              : "Remove from matching"
                            : isUa
                              ? "Перемкнути авто / мото"
                              : "Switch auto / moto"
                        }
                      >
                        <span>{chip.label}</span>
                        {chip.removable ? (
                          <X className="h-3 w-3 text-foreground/38" aria-hidden="true" />
                        ) : (
                          <span className="text-foreground/32" aria-hidden="true">
                            ↔
                          </span>
                        )}
                      </button>
                    ))}
                    <span className="ml-auto shrink-0 pl-1 font-mono text-[9px] text-foreground/35">
                      {assistantContext.currency}
                    </span>
                  </motion.div>
                ) : null}

                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                >
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.24,
                          delay: reducedMotion ? 0 : Math.min(index * 0.025, 0.12),
                        }}
                        className={message.role === "user" ? "pl-12" : "pr-1"}
                      >
                        {message.role === "assistant" ? (
                          <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/38">
                            <span className="flex h-5 w-5 items-center justify-center border border-foreground/12">
                              <Bot className="h-3 w-3" />
                            </span>
                            One AI
                          </div>
                        ) : null}
                        <div
                          className={
                            message.role === "user"
                              ? "border border-foreground/14 bg-foreground/[0.055] px-3.5 py-2.5 text-sm leading-5"
                              : "border-l-2 border-foreground/12 pl-3 text-[13px] font-light leading-5 text-foreground/76"
                          }
                        >
                          {message.text}
                        </div>

                        {message.role === "assistant" &&
                        (message.mode === "clarification" ||
                          message.mode === "no_match" ||
                          message.counts) ? (
                          <AssistantResultStatus
                            mode={message.mode}
                            counts={message.counts}
                            isUa={isUa}
                            degraded={message.degraded === true}
                          />
                        ) : null}

                        {message.degraded ? (
                          <div
                            className="mt-2.5 border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-[10px] leading-4 text-foreground/65"
                            role="status"
                            aria-live="polite"
                          >
                            <p>
                              {isUa
                                ? "Підбір тимчасово працює в обмеженому режимі. Це не означає, що товарів немає."
                                : "Selection is temporarily limited. This does not mean the products are unavailable."}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const previousUser = [...messages]
                                  .slice(0, index)
                                  .reverse()
                                  .find((candidate) => candidate.role === "user");
                                if (previousUser) void sendMessage(previousUser.text);
                              }}
                              disabled={loading}
                              className="mt-2 inline-flex min-h-8 items-center gap-2 border border-amber-500/35 px-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition hover:border-amber-500/70 disabled:opacity-40"
                            >
                              <RotateCcw className="h-3 w-3" />
                              {isUa ? "Спробувати ще раз" : "Try again"}
                            </button>
                          </div>
                        ) : null}

                        {message.role === "assistant" &&
                        !message.plan?.needsClarification &&
                        message.plan?.requiredDetails?.length ? (
                          <div className="mt-2.5 border border-foreground/10 px-3 py-2.5">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground/38">
                              {isUa
                                ? "Для точного підбору уточніть"
                                : "For an exact match, confirm"}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-foreground/58">
                              {message.plan.requiredDetails.map((detail) => (
                                <span key={detail} className="inline-flex items-center gap-1.5">
                                  <CircleHelp className="h-3 w-3" />
                                  {detail === "opfGpf"
                                    ? "OPF / GPF"
                                    : detail === "engine"
                                      ? isUa
                                        ? "Двигун"
                                        : "Engine"
                                      : isUa
                                        ? "Рік або кузов"
                                        : "Year or chassis"}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {message.mode !== "no_match" &&
                        message.products?.length &&
                        !/(немає товару з підтвердженим приростом|no product with a confirmed)/i.test(
                          message.text
                        ) ? (
                          <div className="mt-4 space-y-2.5">
                            <AssistantComparison
                              products={message.products}
                              context={assistantContext}
                              onProductClick={(product) => {
                                const attribution = buildProductAttribution(
                                  message,
                                  product,
                                  assistantContext
                                );
                                if (!attribution) return;
                                storeShopAiClientAttribution(attribution);
                                void postShopAiClientAttributionEvent("product_click", attribution);
                              }}
                            />
                            <section
                              aria-label={isUa ? "Знайдені товари" : "Products found"}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between px-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-foreground/42">
                                <span>{isUa ? "Знайдені товари" : "Products found"}</span>
                                <span className="font-mono text-foreground/28">
                                  {Math.min(message.products.length, 6)}
                                </span>
                              </div>
                              {message.products.slice(0, 6).map((product) => (
                                <AssistantProductCard
                                  key={`${message.id}-${product.id}-${product.variantId ?? "base"}`}
                                  product={product}
                                  context={assistantContext}
                                  managerHref={
                                    product.managerHref || message.managerHref || managerHref
                                  }
                                  onProductClick={(selectedProduct) => {
                                    const attribution = buildProductAttribution(
                                      message,
                                      selectedProduct,
                                      assistantContext
                                    );
                                    if (!attribution) return;
                                    storeShopAiClientAttribution(attribution);
                                    void postShopAiClientAttributionEvent(
                                      "product_click",
                                      attribution
                                    );
                                  }}
                                  onManagerClick={(selectedProduct) => {
                                    const baseContext =
                                      message.managerContext ||
                                      buildDefaultManagerContext(assistantContext);
                                    storeManagerHandoff({
                                      ...baseContext,
                                      runId: message.runId ?? baseContext.runId ?? null,
                                      conversationId:
                                        message.conversationId ??
                                        baseContext.conversationId ??
                                        null,
                                      selectedProduct: {
                                        productId: selectedProduct.id,
                                        variantId: selectedProduct.variantId,
                                        brand: selectedProduct.brand,
                                        sku: selectedProduct.partNumber,
                                        name: selectedProduct.name,
                                        matchStatus: resolvedMatchStatus(selectedProduct),
                                        missingFacts: selectedProduct.missingFacts,
                                      },
                                    });
                                    const attribution = buildProductAttribution(
                                      message,
                                      selectedProduct,
                                      assistantContext
                                    );
                                    if (attribution) {
                                      void postShopAiClientAttributionEvent(
                                        "manager_handoff",
                                        attribution
                                      );
                                    }
                                    setOpen(false);
                                  }}
                                />
                              ))}
                            </section>
                            {message.searchHref ? (
                              <motion.div whileHover={reducedMotion ? undefined : { x: 2 }}>
                                <Link
                                  href={message.searchHref}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    markAiAppliedFilters(message.searchHref!);
                                    setOpen(false);
                                    window.location.assign(message.searchHref!);
                                  }}
                                  className="flex min-h-10 items-center justify-between border border-foreground/12 px-3 text-[11px] font-medium text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground"
                                >
                                  {isUa ? "Переглянути всі результати" : "View all results"}
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </motion.div>
                            ) : null}
                          </div>
                        ) : null}

                        {message.followUps?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.followUps.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                onClick={() => void sendMessage(followUp)}
                                disabled={loading}
                                className="inline-flex items-center gap-2 border border-foreground/12 px-3 py-2 text-left text-[10px] leading-4 text-foreground/58 transition hover:border-foreground/35 hover:bg-foreground/[0.025] hover:text-foreground disabled:opacity-40"
                              >
                                {followUp}
                                <ArrowRight className="h-3 w-3 shrink-0" />
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {message.role === "assistant" && message.id !== "greeting" ? (
                          <AssistantFeedback
                            state={feedbackByMessage[message.id]}
                            isUa={isUa}
                            onRate={(rating) => {
                              if (rating === "down") {
                                setFeedbackByMessage((current) => ({
                                  ...current,
                                  [message.id]: { rating, status: "choosing" },
                                }));
                                return;
                              }
                              void submitFeedback(message, rating);
                            }}
                            onReason={(reason) => void submitFeedback(message, "down", reason)}
                          />
                        ) : null}

                        {index === 0 && messages.length === 1 ? (
                          <div className="mt-4 grid gap-2">
                            {starters.map((starter) => (
                              <button
                                key={starter}
                                type="button"
                                onClick={() => void sendMessage(starter)}
                                className="group flex min-h-11 items-center justify-between border border-foreground/12 px-3 text-left text-xs text-foreground/62 transition hover:border-foreground/35 hover:bg-foreground/[0.03] hover:text-foreground"
                              >
                                {starter}
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </motion.div>
                    ))}

                    {loading ? (
                      <motion.div
                        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-3 text-[11px] text-foreground/48"
                        role="status"
                        aria-live="polite"
                      >
                        <span className="flex items-center gap-1" aria-hidden="true">
                          {[0, 1, 2].map((dot) => (
                            <motion.span
                              key={dot}
                              className="h-1.5 w-1.5 bg-foreground/45"
                              animate={
                                reducedMotion
                                  ? undefined
                                  : { opacity: [0.2, 1, 0.2], y: [0, -2, 0] }
                              }
                              transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.14 }}
                            />
                          ))}
                        </span>
                        {isUa ? "Підбираю варіанти" : "Selecting options"}
                      </motion.div>
                    ) : null}
                    {error ? (
                      <div
                        className="border border-foreground/15 bg-foreground/[0.035] px-3 py-2.5 text-xs text-foreground/65"
                        role="alert"
                        aria-live="assertive"
                      >
                        {error}
                      </div>
                    ) : null}
                  </div>
                </div>

                <footer className="shrink-0 border-t border-foreground/10 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <Link
                    href={managerHref}
                    onClick={() => {
                      storeManagerHandoff(managerContext);
                      if (managerAttribution) {
                        void postShopAiClientAttributionEvent(
                          "manager_handoff",
                          managerAttribution
                        );
                      }
                      setOpen(false);
                    }}
                    className="mb-2 flex min-h-10 items-center justify-between border border-foreground/12 px-3 transition hover:border-foreground/35 hover:bg-foreground/[0.025]"
                  >
                    <span className="flex items-center gap-2.5">
                      <MessageCircleMore className="h-4 w-4 text-foreground/55" />
                      <span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/70">
                          {isUa ? "Уточнити у менеджера" : "Ask a manager"}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-foreground/38">
                          {isUa
                            ? "Сумісність, комплектація, встановлення"
                            : "Fitment, configuration, installation"}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/35" />
                  </Link>
                  <div className="flex items-end border border-foreground/15 bg-foreground/[0.025] focus-within:border-foreground/40">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 800))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage(draft);
                        }
                      }}
                      rows={1}
                      aria-label={isUa ? "Повідомлення для One AI" : "Message for One AI"}
                      placeholder={inputPlaceholder}
                      className="max-h-24 min-h-12 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-5 text-foreground outline-none placeholder:text-foreground/32"
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage(draft)}
                      disabled={!draft.trim() || loading}
                      className="group m-1 flex h-10 w-10 shrink-0 items-center justify-center bg-foreground text-background transition hover:opacity-85 disabled:opacity-25"
                      aria-label={isUa ? "Надіслати" : "Send"}
                    >
                      <Send
                        className={`h-4 w-4 transition-transform ${loading ? "opacity-35" : "group-hover:translate-x-0.5"}`}
                      />
                    </button>
                  </div>
                  <p className="mt-2 px-1 text-[9px] leading-4 text-foreground/35">
                    {isUa
                      ? "Відкрийте товар, щоб переглянути характеристики."
                      : "Open a product to review its specifications."}
                  </p>
                </footer>
              </motion.aside>
            ) : null,
            document.body
          )
        : null}
    </>
  );
}

function AssistantResultStatus({
  mode,
  counts,
  isUa,
  degraded,
}: {
  mode?: ShopAiV2Mode;
  counts?: ShopAiV2Counts;
  isUa: boolean;
  degraded: boolean;
}) {
  if (degraded && mode === "no_match") {
    return (
      <div className="mt-2.5 inline-flex items-center gap-2 border border-amber-500/25 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-foreground/50">
        <CircleHelp className="h-3 w-3" />
        {isUa ? "Технічне обмеження" : "Technical limitation"}
      </div>
    );
  }
  if (mode === "clarification") {
    return (
      <div className="mt-2.5 inline-flex items-center gap-2 border border-foreground/10 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-foreground/50">
        <CircleHelp className="h-3 w-3" />
        {isUa ? "Потрібне уточнення" : "More detail needed"}
      </div>
    );
  }

  if (mode === "no_match") {
    return (
      <div className="mt-2.5 inline-flex items-center gap-2 border border-foreground/10 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-foreground/50">
        <CircleHelp className="h-3 w-3" />
        {isUa ? "Товарів не знайдено" : "No products found"}
      </div>
    );
  }

  if (!counts) return null;
  const total = counts.exact + counts.requiresVerification;
  if (total === 0) return null;

  return (
    <div
      className="mt-2.5 inline-flex items-center gap-2 border border-foreground/10 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-foreground/50"
      aria-label={isUa ? "Результати пошуку" : "Search results"}
    >
      <Sparkles className="h-3 w-3" />
      {isUa ? "Знайдено" : "Found"} <span className="font-mono text-foreground">{total}</span>
    </div>
  );
}

function AssistantFeedback({
  state,
  isUa,
  onRate,
  onReason,
}: {
  state?: FeedbackState;
  isUa: boolean;
  onRate: (rating: FeedbackRating) => void;
  onReason: (reason: FeedbackReason) => void;
}) {
  const disabled = state?.status === "sending" || state?.status === "sent";
  const reasonOptions: Array<{ value: FeedbackReason; ua: string; en: string }> = [
    { value: "wrong_fitment", ua: "Не підходить до авто", en: "Wrong fitment" },
    { value: "wrong_category", ua: "Не та категорія", en: "Wrong category" },
    { value: "irrelevant", ua: "Не по запиту", en: "Not relevant" },
    { value: "missing_product", ua: "Немає потрібного товару", en: "Product is missing" },
    { value: "other", ua: "Інше", en: "Other" },
  ];

  return (
    <div className="mt-3 border-t border-foreground/8 pt-2">
      <div className="flex min-h-8 items-center gap-2">
        <span className="mr-auto text-[9px] text-foreground/35">
          {state?.status === "sent"
            ? isUa
              ? "Дякуємо за оцінку"
              : "Thanks for the feedback"
            : state?.status === "failed"
              ? isUa
                ? "Не вдалося зберегти. Можна повторити."
                : "Could not save it. You can retry."
              : state?.status === "choosing"
                ? isUa
                  ? "Що було не так?"
                  : "What was wrong?"
                : isUa
                  ? "Відповідь була корисною?"
                  : "Was this helpful?"}
        </span>
        <button
          type="button"
          onClick={() => onRate("up")}
          disabled={disabled}
          aria-label={isUa ? "Корисна відповідь" : "Helpful answer"}
          aria-pressed={state?.status === "sent" && state.rating === "up"}
          className={`flex h-8 w-8 items-center justify-center border transition ${
            state?.status === "sent" && state.rating === "up"
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/10 text-foreground/38 hover:border-foreground/35 hover:text-foreground"
          } disabled:cursor-default disabled:opacity-60`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRate("down")}
          disabled={disabled}
          aria-label={isUa ? "Некорисна відповідь" : "Unhelpful answer"}
          aria-pressed={
            (state?.status === "sent" || state?.status === "choosing") && state.rating === "down"
          }
          aria-expanded={state?.status === "choosing"}
          className={`flex h-8 w-8 items-center justify-center border transition ${
            state?.rating === "down" && (state.status === "sent" || state.status === "choosing")
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/10 text-foreground/38 hover:border-foreground/35 hover:text-foreground"
          } disabled:cursor-default disabled:opacity-60`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {state?.status === "choosing" ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reasonOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onReason(option.value)}
              className="border border-foreground/10 px-2 py-1.5 text-left text-[9px] text-foreground/48 transition hover:border-foreground/35 hover:text-foreground"
            >
              {isUa ? option.ua : option.en}
            </button>
          ))}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {state?.status === "sent"
          ? isUa
            ? "Оцінку збережено"
            : "Feedback saved"
          : state?.status === "failed"
            ? isUa
              ? "Оцінку не збережено"
              : "Feedback was not saved"
            : ""}
      </span>
    </div>
  );
}

function AssistantComparison({
  products,
  context,
  onProductClick,
}: {
  products: AssistantProduct[];
  context: ShopAiContext;
  onProductClick: (product: AssistantProduct) => void;
}) {
  const isUa = context.locale === "ua";
  const reducedMotion = useReducedMotion();
  const selected: AssistantProduct[] = [];
  const seenBrands = new Set<string>();

  for (const product of products) {
    const brand = product.brand.trim().toLocaleLowerCase("en-US");
    if (seenBrands.has(brand)) continue;
    selected.push(product);
    seenBrands.add(brand);
    if (selected.length === 3) break;
  }
  for (const product of products) {
    if (selected.length === 3) break;
    if (!selected.some((item) => item.id === product.id)) selected.push(product);
  }

  if (selected.length < 2) return null;

  return (
    <section
      className="border border-foreground/12 bg-foreground/[0.012]"
      aria-label={isUa ? "Порівняння" : "Comparison"}
    >
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
          {isUa ? "Порівняння" : "Comparison"}
        </span>
        <span className="font-mono text-[8px] text-foreground/28">{selected.length}</span>
      </div>
      <div className="divide-y divide-foreground/10">
        {selected.map((product, index) => {
          const price = productPrice(product, context);
          const factLabel = productFactLabel(product, isUa);
          return (
            <motion.div
              key={`comparison-${product.id}`}
              initial={reducedMotion ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.06, duration: 0.22 }}
            >
              <Link
                href={resolveProductHref(product, context)}
                prefetch={false}
                onClick={() => onProductClick(product)}
                className="group grid min-h-13 grid-cols-[1.5rem_minmax(0,1fr)_auto_0.75rem] items-center gap-2 px-3 py-2 transition-colors hover:bg-foreground/[0.035]"
              >
                <span className="font-mono text-[9px] text-foreground/25">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/65">
                    {product.brand}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-foreground/42">
                    {product.name}
                  </span>
                  {factLabel ? (
                    <span className="mt-0.5 block truncate text-[9px] text-foreground/30">
                      {factLabel}
                    </span>
                  ) : null}
                </span>
                <span className="whitespace-nowrap text-right text-xs font-semibold tabular-nums">
                  {price > 0 ? formatShopMoney(context.locale, price, context.currency) : "—"}
                </span>
                <ArrowRight className="h-3 w-3 text-foreground/25 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/55" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function AssistantProductCard({
  product,
  context,
  managerHref,
  onProductClick,
  onManagerClick,
}: {
  product: AssistantProduct;
  context: ShopAiContext;
  managerHref: string;
  onProductClick: (product: AssistantProduct) => void;
  onManagerClick: (product: AssistantProduct) => void;
}) {
  const isUa = context.locale === "ua";
  const reducedMotion = useReducedMotion();
  const price = productPrice(product, context);
  const href = resolveProductHref(product, context);
  const factLabel = productFactLabel(product, isUa);
  const image = product.thumbnail ? (
    <Image
      src={product.thumbnail}
      alt=""
      fill
      unoptimized
      className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.04]"
    />
  ) : null;

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden border border-foreground/12 bg-foreground/[0.012] p-2.5 transition-colors hover:border-foreground/28 hover:bg-foreground/[0.022]"
      data-testid="one-ai-product-card"
      data-product-id={product.id}
    >
      <span className="absolute inset-y-0 left-0 w-px bg-foreground/20" aria-hidden="true" />
      <div className="flex gap-3">
        <Link
          href={href}
          prefetch={false}
          onClick={() => onProductClick(product)}
          aria-label={isUa ? `Відкрити товар ${product.name}` : `Open product ${product.name}`}
          className="group relative h-20 w-24 shrink-0 overflow-hidden bg-foreground/[0.035]"
        >
          {image}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-foreground/40">
            <span className="truncate">{product.brand}</span>
            <span className="truncate font-mono">{product.partNumber}</span>
          </div>
          <Link
            href={href}
            prefetch={false}
            onClick={() => onProductClick(product)}
            className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-foreground transition hover:opacity-65"
          >
            {product.name}
          </Link>
          {factLabel ? (
            <div className="mt-1.5 truncate text-[9px] text-foreground/36">{factLabel}</div>
          ) : null}
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {price > 0 ? formatShopMoney(context.locale, price, context.currency) : "—"}
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={href}
                prefetch={false}
                onClick={() => onProductClick(product)}
                className="inline-flex h-9 items-center gap-2 border border-foreground bg-foreground px-3 text-[9px] font-semibold uppercase tracking-[0.09em] text-background transition hover:opacity-80"
                aria-label={isUa ? "Відкрити товар" : "Open product"}
              >
                {isUa ? "Відкрити товар" : "Open product"}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={managerHref}
                onClick={() => onManagerClick(product)}
                className="inline-flex h-9 items-center justify-center border border-foreground/15 px-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground/62 transition hover:border-foreground/38 hover:text-foreground"
                aria-label={
                  isUa ? "Запитати менеджера про товар" : "Ask a manager about this product"
                }
              >
                <MessageCircleMore className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
