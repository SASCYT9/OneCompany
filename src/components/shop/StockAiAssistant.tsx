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
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { isShopAiContinuation } from "@/lib/shopAiAssistantConversation";
import type {
  ShopAiAssistantResponse,
  ShopAiContext,
  ShopAiHistoryMessage,
  ShopAiManagerContext,
  ShopAiProduct,
} from "@/lib/shopAiAssistantTypes";
import { formatShopMoney } from "@/lib/shopMoneyFormat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: ShopAiProduct[];
  followUps?: string[];
  searchHref?: string | null;
  managerHref?: string;
  managerContext?: ShopAiManagerContext;
  plan?: ShopAiAssistantResponse["plan"];
};

type Props = ShopAiContext;

const AI_FILTER_SESSION_KEY = "onecompany:stock-ai-filters";
const MANAGER_HANDOFF_SESSION_KEY = "onecompany:one-ai-manager-handoff";
const AI_FILTER_KEYS = [
  "q",
  "brand",
  "category",
  "make",
  "model",
  "chassis",
  "year",
  "stock",
  "minPrice",
  "maxPrice",
  "page",
] as const;

function createGreeting(locale: "ua" | "en", vehicleLabel: string): ChatMessage {
  return {
    id: "greeting",
    role: "assistant",
    text:
      locale === "ua"
        ? vehicleLabel
          ? `Що хочете змінити у ${vehicleLabel}? Підберу кілька доречних варіантів і коротко поясню різницю.`
          : "Напишіть марку, модель і що саме хочете змінити. Я підберу кілька доречних варіантів."
        : vehicleLabel
          ? `What would you like to change on your ${vehicleLabel}? I will shortlist the strongest options and explain the differences.`
          : "Tell me the make, model and what you want to upgrade. I will shortlist the strongest options.",
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

function productFactLabel(product: ShopAiProduct, isUa: boolean) {
  const facts = product.facts;
  if (!facts) return "";
  return [
    facts.material === "titanium"
      ? isUa
        ? "Титан"
        : "Titanium"
      : facts.material === "stainless_steel"
        ? isUa
          ? "Нержавіюча сталь"
          : "Stainless steel"
        : facts.material === "carbon"
          ? isUa
            ? "Карбон"
            : "Carbon"
          : facts.material === "mixed"
            ? isUa
              ? "Комбіновані матеріали"
              : "Mixed materials"
            : null,
    facts.opfGpf === "with" ? "OPF/GPF" : facts.opfGpf === "without" ? "NON-OPF" : null,
    facts.productKind === "system"
      ? isUa
        ? "Вихлопна система"
        : "Exhaust system"
      : facts.productKind === "downpipe"
        ? "Downpipe"
        : facts.productKind === "link_pipe"
          ? "Link pipe"
          : facts.productKind === "tips"
            ? isUa
              ? "Насадки"
              : "Exhaust tips"
            : null,
    facts.installationType === "direct_fit"
      ? "Bolt-on"
      : facts.installationType === "welding_required"
        ? isUa
          ? "Потрібне зварювання"
          : "Welding required"
        : facts.installationType === "professional_installation"
          ? isUa
            ? "Професійне встановлення"
            : "Professional installation"
          : null,
    facts.powerGainHp ? `+${facts.powerGainHp} ${isUa ? "к.с." : "hp"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildDefaultManagerContext(context: ShopAiContext): ShopAiManagerContext {
  const vehicle = [context.make, context.model, context.chassis].filter(Boolean).join(" ");
  return {
    createdAt: Date.now(),
    vehicleType: "auto",
    vehicle,
    request: context.query ?? "",
    products: [],
  };
}

export function StockAiAssistant(props: Props) {
  const router = useRouter();
  const isUa = props.locale === "ua";
  const reducedMotion = useReducedMotion();
  const vehicleLabel = [props.make, props.model, props.chassis].filter(Boolean).join(" ");
  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createGreeting(props.locale, vehicleLabel),
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const storeManagerHandoff = useCallback((context: ShopAiManagerContext) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      MANAGER_HANDOFF_SESSION_KEY,
      JSON.stringify({ ...context, createdAt: Date.now() })
    );
  }, []);

  const hasAiAppliedFilters = useCallback(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.sessionStorage.getItem(AI_FILTER_SESSION_KEY));
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
    window.sessionStorage.setItem(AI_FILTER_SESSION_KEY, JSON.stringify(values));
  }, []);

  const clearAiAppliedFilters = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(AI_FILTER_SESSION_KEY);
    if (!stored) return;
    window.sessionStorage.removeItem(AI_FILTER_SESSION_KEY);
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
    setOpen(false);
    clearAiAppliedFilters();
  }, [clearAiAppliedFilters]);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (window.innerWidth < 768) document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [loading, messages, open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAssistant();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAssistant]);

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

    try {
      const startsNewSearch = hasAiAppliedFilters() && !isShopAiContinuation(message);
      if (startsNewSearch) clearAiAppliedFilters();
      const requestContext: ShopAiContext = startsNewSearch
        ? {
            locale: props.locale,
            currency: props.currency,
            country: props.country,
          }
        : props;
      const history: ShopAiHistoryMessage[] = nextMessages.slice(-10).map((item) => ({
        role: item.role,
        text: item.text,
      }));
      const previousPlan = [...nextMessages].reverse().find((item) => item.plan)?.plan;
      const excludedProductIds = nextMessages.flatMap((item) =>
        (item.products ?? []).map((product) => product.id)
      );
      const response = await fetch("/api/shop/stock/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          context: requestContext,
          conversationId: conversationIdRef.current,
          previousPlan,
          excludedProductIds,
        }),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as ShopAiAssistantResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Assistant request failed");
      conversationIdRef.current = data.conversationId || conversationIdRef.current;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.message,
          products: data.products,
          followUps: data.followUps,
          searchHref: data.searchHref,
          managerHref: data.managerHref,
          managerContext: data.managerContext,
          plan: data.plan,
        },
      ]);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") {
        setError(
          isUa
            ? "Не вдалося отримати відповідь. Спробуйте ще раз."
            : "I could not get an answer. Please try again."
        );
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      setLoading(false);
    }
  }

  function resetConversation() {
    requestRef.current?.abort();
    setMessages([createGreeting(props.locale, vehicleLabel)]);
    conversationIdRef.current = null;
    setDraft("");
    setError("");
    setLoading(false);
    clearAiAppliedFilters();
  }

  const starters = isUa
    ? [
        vehicleLabel ? `Покажи вихлоп для ${vehicleLabel}` : "Підбери вихлоп для мого авто",
        "Порівняй найкращі варіанти",
        "Що варто змінити спочатку?",
      ]
    : [
        vehicleLabel ? `Show exhausts for ${vehicleLabel}` : "Find an exhaust for my car",
        "Compare the strongest options",
        "What should I upgrade first?",
      ];
  const inputPlaceholder = vehicleLabel
    ? isUa
      ? `Запитайте про ${vehicleLabel}`
      : `Ask about ${vehicleLabel}`
    : isUa
      ? "Марка, модель і бажаний результат"
      : "Vehicle and desired result";
  const managerHref =
    [...messages].reverse().find((message) => message.managerHref)?.managerHref ||
    `/${props.locale}/contact?source=one-ai`;
  const managerContext =
    [...messages].reverse().find((message) => message.managerContext)?.managerContext ||
    buildDefaultManagerContext(props);

  return (
    <>
      <motion.button
        type="button"
        data-testid="stock-ai-launcher"
        onClick={() => setOpen(true)}
        whileHover={reducedMotion ? undefined : { y: -2 }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        className="group fixed bottom-5 right-4 z-50 inline-flex h-12 items-center gap-2 border border-foreground/20 bg-background px-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition-colors hover:border-foreground/45 hover:bg-foreground/[0.04] sm:bottom-6 sm:right-6 sm:px-4"
        aria-label={isUa ? "Відкрити One AI" : "Open One AI"}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 border border-foreground/20"
            animate={
              reducedMotion ? undefined : { opacity: [0.15, 0.45, 0.15], scale: [0.8, 1.12, 0.8] }
            }
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <Sparkles className="relative h-3.5 w-3.5" />
        </span>
        <span className="hidden sm:inline">One AI</span>
      </motion.button>

      {portalReady
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.aside
                  data-testid="stock-ai-panel"
                  role="dialog"
                  aria-label="One AI"
                  initial={reducedMotion ? { opacity: 0 } : { x: "100%" }}
                  animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { x: "100%" }}
                  transition={
                    reducedMotion
                      ? { duration: 0.12 }
                      : { type: "spring", stiffness: 360, damping: 34 }
                  }
                  className="fixed inset-0 z-[70] flex h-dvh w-screen flex-col bg-background text-foreground shadow-[-16px_0_48px_rgba(0,0,0,0.18)] md:inset-auto md:bottom-6 md:right-6 md:h-[min(680px,calc(100dvh-8rem))] md:w-[390px] md:border md:border-foreground/14"
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
                        <div className="text-sm font-semibold tracking-wide">One AI</div>
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

                  {vehicleLabel ? (
                    <motion.div
                      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex min-h-10 shrink-0 items-center justify-between border-b border-foreground/10 bg-foreground/[0.018] px-4"
                    >
                      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/58">
                        {vehicleLabel}
                      </span>
                      <span className="ml-3 shrink-0 font-mono text-[9px] text-foreground/35">
                        {props.currency}
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

                          {message.role === "assistant" && message.plan?.requiredDetails?.length ? (
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

                          {message.products?.length &&
                          !/(немає товару з підтвердженим приростом|no product with a confirmed)/i.test(
                            message.text
                          ) ? (
                            <div className="mt-4 space-y-2.5">
                              <AssistantComparison products={message.products} context={props} />
                              {message.products.slice(0, 3).map((product) => (
                                <AssistantProductCard
                                  key={`${message.id}-${product.id}`}
                                  product={product}
                                  context={props}
                                />
                              ))}
                              {message.searchHref ? (
                                <motion.div whileHover={reducedMotion ? undefined : { x: 2 }}>
                                  <Link
                                    href={message.searchHref}
                                    onClick={() => {
                                      markAiAppliedFilters(message.searchHref!);
                                      setOpen(false);
                                    }}
                                    className="flex min-h-10 items-center justify-between border border-foreground/12 px-3 text-[11px] font-medium text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground"
                                  >
                                    {isUa ? "Відкрити всі варіанти" : "Open all options"}
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
                        <div className="border border-foreground/15 bg-foreground/[0.035] px-3 py-2.5 text-xs text-foreground/65">
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
                        ? "Сумісність перевіримо перед оформленням."
                        : "Fitment will be checked before checkout."}
                    </p>
                  </footer>
                </motion.aside>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}

function AssistantComparison({
  products,
  context,
}: {
  products: ShopAiProduct[];
  context: ShopAiContext;
}) {
  const isUa = context.locale === "ua";
  const reducedMotion = useReducedMotion();
  const selected: ShopAiProduct[] = [];
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
          return (
            <motion.div
              key={`comparison-${product.id}`}
              initial={reducedMotion ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.06, duration: 0.22 }}
            >
              <Link
                href={`/${context.locale}/shop/${product.slug}`}
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
                  {productFactLabel(product, isUa) ? (
                    <span className="mt-0.5 block truncate text-[9px] text-foreground/30">
                      {productFactLabel(product, isUa)}
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
}: {
  product: ShopAiProduct;
  context: ShopAiContext;
}) {
  const isUa = context.locale === "ua";
  const reducedMotion = useReducedMotion();
  const price = productPrice(product, context);
  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.22 }}
      className="relative overflow-hidden border border-foreground/12 bg-foreground/[0.012] p-2.5 transition-colors hover:border-foreground/28 hover:bg-foreground/[0.022]"
    >
      <span className="absolute inset-y-0 left-0 w-px bg-foreground/22" aria-hidden="true" />
      <div className="flex gap-3">
        <Link
          href={`/${context.locale}/shop/${product.slug}`}
          className="group relative h-20 w-24 shrink-0 overflow-hidden bg-foreground/[0.035]"
        >
          {product.thumbnail ? (
            <Image
              src={product.thumbnail}
              alt=""
              fill
              unoptimized
              className="object-contain p-1 transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-foreground/40">
            <span className="truncate">{product.brand}</span>
            <span className="truncate font-mono">{product.partNumber}</span>
          </div>
          <Link
            href={`/${context.locale}/shop/${product.slug}`}
            className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-foreground transition hover:opacity-65"
          >
            {product.name}
          </Link>
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[9px] text-foreground/42">
            <span className="inline-flex shrink-0 items-center gap-1">
              {product.compatibility === "confirmed" ? (
                <ShieldCheck className="h-3 w-3" />
              ) : (
                <CircleHelp className="h-3 w-3" />
              )}
              {product.compatibility === "confirmed"
                ? isUa
                  ? "Сумісність підтверджена"
                  : "Fitment confirmed"
                : product.compatibility === "likely"
                  ? isUa
                    ? "Ймовірно сумісний"
                    : "Likely compatible"
                  : isUa
                    ? "Потрібна перевірка"
                    : "Verification required"}
            </span>
            {productFactLabel(product, isUa) ? (
              <span className="truncate text-foreground/32">{productFactLabel(product, isUa)}</span>
            ) : null}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {price > 0 ? formatShopMoney(context.locale, price, context.currency) : "—"}
            </div>
            <div className="flex gap-1">
              <Link
                href={`/${context.locale}/shop/${product.slug}`}
                className="flex h-9 w-9 items-center justify-center border border-foreground/12 text-foreground/55 transition hover:border-foreground/35 hover:text-foreground"
                aria-label={isUa ? "Відкрити товар" : "Open product"}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <AddToCartButton
                slug={product.slug}
                turn14Id={product.turn14Id || undefined}
                variantId={product.variantId}
                locale={context.locale}
                productName={product.name}
                variant="minimal"
                redirect={false}
                label={isUa ? "У кошик" : "Add"}
                labelAdded={isUa ? "Додано" : "Added"}
                className="h-9 border border-foreground bg-foreground px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-background transition hover:opacity-80"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
