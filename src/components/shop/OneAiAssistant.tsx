"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackOneAi } from "@/lib/analytics";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircleMore,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { oneAiPriceAmount } from "@/lib/shopAiAgent/catalogQuery";
import type { OneAiCard, OneAiComparison, OneAiContext, OneAiEvent } from "@/lib/shopAiAgent/types";
import { formatShopMoneyWithSign, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";

import { OneAiText } from "./oneAiText";

type Props = {
  locale: "ua" | "en";
  currency: ShopCurrencyCode;
  scope?: "auto" | "moto";
  country?: string;
  make?: string;
  model?: string;
  chassis?: string;
  year?: number | null;
  engine?: string;
  category?: string;
};

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      status: string | null;
      streaming: boolean;
      cards: OneAiCard[];
      layout: "cards" | "compare";
      comparison: OneAiComparison | null;
      replies: string[];
      catalogHref: string | null;
      error: string | null;
    };

type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>;

const STORAGE_KEY = "one-ai-agent-v1";
const STORAGE_TTL_MS = 6 * 60 * 60 * 1000;
const CLIENT_TIMEOUT_MS = 60_000;

function readStoredConversation(): {
  conversationId: string | null;
  messages: ChatMessage[];
} | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      conversationId?: string | null;
      messages?: ChatMessage[];
    };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > STORAGE_TTL_MS) return null;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      conversationId: typeof parsed.conversationId === "string" ? parsed.conversationId : null,
      messages: parsed.messages
        .filter((message) => message && (message.role === "user" || message.role === "assistant"))
        .map((message) =>
          message.role === "assistant" ? { ...message, streaming: false, status: null } : message
        ),
    };
  } catch {
    return null;
  }
}

function storeConversation(conversationId: string | null, messages: ChatMessage[]) {
  try {
    if (!messages.length) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), conversationId, messages: messages.slice(-30) })
    );
  } catch {
    // Storage is a convenience; the chat works without it.
  }
}

function availabilityLabel(card: OneAiCard, isUa: boolean) {
  if (card.availability === "inStock") return isUa ? "В наявності" : "In stock";
  if (card.availability === "inTransit") return isUa ? "В дорозі" : "In transit";
  return isUa ? "Під замовлення" : "On order";
}

function ProductCard({ card, context }: { card: OneAiCard; context: OneAiContext }) {
  const isUa = context.locale === "ua";
  const price = oneAiPriceAmount(card.priceSet, context.currency);
  const oldPrice = oneAiPriceAmount(card.compareAtSet, context.currency);
  const showOld = Boolean(price && oldPrice && oldPrice > price);
  return (
    <article
      className="group relative border border-foreground/12 bg-foreground/[0.012] transition-colors hover:border-foreground/30"
      data-testid="one-ai-card"
    >
      <div className="flex gap-3 p-2.5">
        <Link
          href={card.href}
          prefetch={false}
          className="relative h-[84px] w-[92px] shrink-0 overflow-hidden bg-white"
          aria-label={isUa ? `Відкрити ${card.name}` : `Open ${card.name}`}
        >
          {card.image ? (
            <Image
              src={card.image}
              alt=""
              fill
              unoptimized
              sizes="92px"
              className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : null}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-foreground/45">
            <span className="max-w-[60%] shrink-0 truncate font-semibold">{card.brand}</span>
            {card.sku ? (
              <span className="min-w-0 truncate font-mono normal-case">{card.sku}</span>
            ) : null}
          </div>
          <Link
            href={card.href}
            prefetch={false}
            className="mt-1 line-clamp-2 text-[12px] font-medium leading-4 text-foreground transition hover:opacity-70"
          >
            {card.name}
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {price
                ? formatShopMoneyWithSign(context.locale, price, context.currency)
                : isUa
                  ? "Ціна за запитом"
                  : "Price on request"}
            </span>
            {showOld && oldPrice ? (
              <span className="text-[11px] tabular-nums text-foreground/40 line-through">
                {formatShopMoneyWithSign(context.locale, oldPrice, context.currency)}
              </span>
            ) : null}
            <span
              className={`ml-auto inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                card.availability === "inStock"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground/45"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 ${card.availability === "inStock" ? "bg-emerald-500" : "bg-foreground/30"}`}
              />
              {availabilityLabel(card, isUa)}
            </span>
          </div>
        </div>
      </div>
      {card.reason ? (
        <p className="border-t border-foreground/8 px-2.5 py-2 text-[11.5px] leading-[1.35rem] text-foreground/72">
          {card.reason}
        </p>
      ) : null}
    </article>
  );
}

function ComparisonTable({
  cards,
  comparison,
  context,
}: {
  cards: OneAiCard[];
  comparison: OneAiComparison;
  context: OneAiContext;
}) {
  const isUa = context.locale === "ua";
  return (
    <div className="overflow-x-auto border border-foreground/12 [scrollbar-width:thin]">
      <table className="w-full min-w-[340px] border-collapse text-left text-[11px] leading-4">
        <thead>
          <tr className="bg-foreground/[0.035]">
            <th className="sticky left-0 z-[1] w-[96px] bg-background px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground/45">
              {isUa ? "Порівняння" : "Compare"}
            </th>
            {cards.map((card) => (
              <th
                key={card.ref}
                className="min-w-[120px] px-2.5 py-2 align-top font-semibold text-foreground"
              >
                <Link href={card.href} prefetch={false} className="line-clamp-2 hover:opacity-70">
                  {card.brand}
                </Link>
                <span className="mt-0.5 block font-mono text-[9px] font-normal text-foreground/45">
                  {card.sku}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.label} className="border-t border-foreground/8">
              <th className="sticky left-0 z-[1] bg-background px-2.5 py-2 align-top text-[10px] font-medium text-foreground/55">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td
                  key={`${row.label}-${index}`}
                  className="px-2.5 py-2 align-top text-foreground/80"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypingDots({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="h-1.5 w-1.5 bg-foreground/45"
          animate={reducedMotion ? undefined : { opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.14 }}
        />
      ))}
    </span>
  );
}

export function OneAiAssistant(props: Props) {
  const isUa = props.locale === "ua";
  const reducedMotion = useReducedMotion() ?? false;
  const [portalReady, setPortalReady] = useState(false);
  const [desktopPanel, setDesktopPanel] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const vehicleLabel = [props.make, props.model, props.chassis, props.year ?? null]
    .filter(Boolean)
    .join(" ");
  const managerHref = `/${props.locale}/contact?source=one-ai`;

  const starters = isUa
    ? [
        vehicleLabel
          ? `Що поставити на ${vehicleLabel} для звуку?`
          : "Вихлоп на BMW M3 G80, щоб гучніше",
        "Що поставити на Urus до 5000 €?",
        "Чим Akrapovič відрізняється від Remus?",
        "Впуск на Porsche 911 Turbo S 992",
      ]
    : [
        vehicleLabel
          ? `Best sound upgrade for my ${vehicleLabel}?`
          : "Louder exhaust for a BMW M3 G80",
        "What can I fit to a Urus under €5,000?",
        "Akrapovič vs Remus — what is the difference?",
        "Intake for a Porsche 911 Turbo S 992",
      ];

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = readStoredConversation();
    if (stored) {
      conversationIdRef.current = stored.conversationId;
      setMessages(stored.messages);
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || busy) return;
    storeConversation(conversationIdRef.current, messages);
  }, [busy, messages]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktopPanel(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const closeAssistant = useCallback(() => setOpen(false), []);

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
          'button:not([disabled]), [href], textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
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
    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== panel
    );
    const previous = siblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.getAttribute("inert"),
    }));
    siblings.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previous.forEach(({ element, ariaHidden, inert }) => {
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
    const scroller = scrollRef.current;
    if (!scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 220;
    if (nearBottom || busy) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [busy, messages, open]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const updateAssistant = useCallback(
    (id: string, update: (message: AssistantMessage) => AssistantMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id && message.role === "assistant" ? update(message) : message
        )
      );
    },
    []
  );

  function resetConversation() {
    requestRef.current?.abort();
    requestRef.current = null;
    conversationIdRef.current = null;
    setBusy(false);
    setMessages([]);
    storeConversation(null, []);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send(rawText: string) {
    const text = rawText.trim().slice(0, 800);
    if (!text || busy) return;
    const stamp = Date.now();
    const assistantId = `a-${stamp}`;
    setDraft("");
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: `u-${stamp}`, role: "user", text },
      {
        id: assistantId,
        role: "assistant",
        text: "",
        status: isUa ? "Думаю над запитом" : "Thinking",
        streaming: true,
        cards: [],
        layout: "cards",
        comparison: null,
        replies: [],
        catalogHref: null,
        error: null,
      },
    ]);

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    const context: OneAiContext = {
      locale: props.locale,
      currency: props.currency,
      scope: props.scope,
      country: props.country,
      vehicle: {
        make: props.make || undefined,
        model: props.model || undefined,
        chassis: props.chassis || undefined,
        year: props.year ?? null,
        engine: props.engine || undefined,
      },
      category: props.category || undefined,
    };

    const applyEvent = (event: OneAiEvent) => {
      if (event.type === "done") conversationIdRef.current = event.conversationId;
      updateAssistant(assistantId, (message) => {
        switch (event.type) {
          case "status":
            return { ...message, status: event.text };
          case "text":
            return { ...message, text: message.text + event.text, status: null };
          case "products": {
            const known = new Set(message.cards.map((card) => card.ref));
            const cards =
              event.layout === "compare"
                ? event.products
                : [...message.cards, ...event.products.filter((card) => !known.has(card.ref))];
            return {
              ...message,
              cards,
              layout: event.layout,
              comparison:
                event.comparison ?? (event.layout === "compare" ? null : message.comparison),
            };
          }
          case "replies":
            return { ...message, replies: event.options };
          case "done":
            return { ...message, streaming: false, status: null, catalogHref: event.catalogHref };
          case "error":
            return { ...message, streaming: false, status: null, error: event.message };
          default:
            return message;
        }
      });
    };

    try {
      trackOneAi("ask", "agent");
      const response = await fetch("/api/shop/stock/assistant/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: conversationIdRef.current, context }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(response.status === 429 ? "rate" : "http");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            try {
              applyEvent(JSON.parse(line) as OneAiEvent);
            } catch {
              // A malformed line is skipped; the stream continues.
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
      updateAssistant(assistantId, (message) => ({ ...message, streaming: false, status: null }));
    } catch (error) {
      const rateLimited = error instanceof Error && error.message === "rate";
      const aborted = controller.signal.aborted;
      updateAssistant(assistantId, (message) => ({
        ...message,
        streaming: false,
        status: null,
        error:
          message.text && aborted
            ? null
            : rateLimited
              ? isUa
                ? "Забагато запитів поспіль. Зачекайте хвилину."
                : "Too many requests. Please wait a minute."
              : isUa
                ? "Не вдалося отримати відповідь. Спробуйте ще раз або напишіть менеджеру."
                : "Could not get an answer. Try again or contact a manager.",
      }));
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const contextForCards: OneAiContext = { locale: props.locale, currency: props.currency };

  return (
    <>
      <motion.button
        ref={launcherRef}
        type="button"
        data-testid="one-ai-launcher"
        onClick={() => {
          setOpen(true);
          trackOneAi("open", "agent");
        }}
        whileHover={reducedMotion ? undefined : { y: -2 }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-foreground/25 bg-foreground px-2.5 text-background shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-colors hover:border-foreground hover:brightness-110 sm:h-10 sm:px-3"
        aria-label={isUa ? "Відкрити One AI" : "Open One AI"}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em]">One AI</span>
      </motion.button>

      {portalReady && open
        ? createPortal(
            <motion.aside
              ref={panelRef}
              data-testid="one-ai-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="one-ai-title"
              initial={
                reducedMotion ? { opacity: 0 } : desktopPanel ? { x: "100%" } : { y: "100%" }
              }
              animate={reducedMotion ? { opacity: 1 } : desktopPanel ? { x: 0 } : { y: 0 }}
              transition={
                reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 360, damping: 34 }
              }
              className="fixed inset-x-0 bottom-0 z-[70] flex h-[min(94dvh,800px)] w-full flex-col overflow-hidden rounded-t-[var(--one-ai-radius)] border border-b-0 border-foreground/14 bg-background text-foreground shadow-[0_-16px_48px_rgba(0,0,0,0.18)] md:inset-auto md:bottom-5 md:right-5 md:h-[min(760px,calc(100dvh-6rem))] md:w-[440px] md:rounded-[var(--one-ai-radius)] md:border md:shadow-[-16px_0_48px_rgba(0,0,0,0.2)]"
            >
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-foreground/10 px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-foreground/15 bg-foreground/[0.04]">
                    <Sparkles className="h-4 w-4 opacity-75" />
                  </div>
                  <div className="min-w-0">
                    <div
                      id="one-ai-title"
                      className="flex items-center gap-2 text-sm font-semibold tracking-wide"
                    >
                      One AI
                      <span className="border border-foreground/15 px-1 py-px text-[8px] font-semibold uppercase tracking-[0.14em] text-foreground/50">
                        beta
                      </span>
                    </div>
                    <div className="truncate text-[10px] uppercase tracking-[0.16em] text-foreground/45">
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

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
              >
                {messages.length === 0 ? (
                  <div>
                    <div className="border-l-2 border-foreground/12 pl-3 text-[13px] leading-5 text-foreground/78">
                      {isUa
                        ? vehicleLabel
                          ? `Привіт! Бачу, ви дивитесь ${vehicleLabel}. Напишіть, що хочете покращити — звук, потужність, керованість чи вигляд — і бюджет. Підберу з каталогу, порівняю й поясню різницю.`
                          : "Привіт! Напишіть авто й що хочете покращити — звук, потужність, керованість чи вигляд. Підберу з каталогу, порівняю й поясню різницю."
                        : vehicleLabel
                          ? `Hi! I see you are browsing ${vehicleLabel}. Tell me what to improve — sound, power, handling or looks — and your budget. I will pick from the catalog, compare and explain.`
                          : "Hi! Tell me your vehicle and what to improve — sound, power, handling or looks. I will pick from the catalog, compare and explain."}
                    </div>
                    <div className="mt-4 grid gap-2">
                      {starters.map((starter) => (
                        <button
                          key={starter}
                          type="button"
                          onClick={() => void send(starter)}
                          className="group flex min-h-11 items-center justify-between border border-foreground/12 px-3 text-left text-xs text-foreground/65 transition hover:border-foreground/35 hover:bg-foreground/[0.03] hover:text-foreground"
                        >
                          {starter}
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-5">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <div key={message.id} className="flex justify-end pl-10">
                        <div className="border border-foreground/14 bg-foreground/[0.055] px-3.5 py-2.5 text-sm leading-5">
                          {message.text}
                        </div>
                      </div>
                    ) : (
                      <div key={message.id} className="space-y-3" data-testid="one-ai-answer">
                        {message.text ? (
                          <div className="border-l-2 border-foreground/12 pl-3 text-[13px] leading-5 text-foreground/80">
                            <OneAiText text={message.text} />
                          </div>
                        ) : null}
                        {message.status ? (
                          <div
                            className="flex items-center gap-3 border-l-2 border-foreground/12 py-1 pl-3 text-[11px] text-foreground/50"
                            role="status"
                            aria-live="polite"
                          >
                            <TypingDots reducedMotion={reducedMotion} />
                            {message.status}
                          </div>
                        ) : null}
                        {message.layout === "compare" &&
                        message.comparison &&
                        message.cards.length > 1 ? (
                          <ComparisonTable
                            cards={message.cards}
                            comparison={message.comparison}
                            context={contextForCards}
                          />
                        ) : null}
                        {message.cards.length ? (
                          <section
                            aria-label={isUa ? "Підібрані товари" : "Suggested products"}
                            className="space-y-2"
                          >
                            {message.cards.map((card) => (
                              <ProductCard
                                key={`${message.id}-${card.ref}`}
                                card={card}
                                context={contextForCards}
                              />
                            ))}
                          </section>
                        ) : null}
                        {!message.streaming && message.catalogHref && message.cards.length ? (
                          <Link
                            href={message.catalogHref}
                            prefetch={false}
                            onClick={() => setOpen(false)}
                            className="flex min-h-10 items-center justify-between border border-foreground/12 px-3 text-[11px] font-medium text-foreground/65 transition-colors hover:border-foreground/35 hover:text-foreground"
                          >
                            {isUa ? "Усі варіанти в каталозі" : "See all in the catalog"}
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {message.error ? (
                          <div
                            className="border border-foreground/15 bg-foreground/[0.035] px-3 py-2.5 text-xs text-foreground/70"
                            role="alert"
                          >
                            {message.error}
                          </div>
                        ) : null}
                        {message.id === lastAssistantId &&
                        !message.streaming &&
                        message.replies.length ? (
                          <div className="flex flex-wrap gap-2">
                            {message.replies.map((reply) => (
                              <button
                                key={reply}
                                type="button"
                                onClick={() => void send(reply)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 border border-foreground/14 px-3 py-2 text-left text-[11px] leading-4 text-foreground/65 transition hover:border-foreground/40 hover:bg-foreground/[0.03] hover:text-foreground disabled:opacity-40"
                              >
                                {reply}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              </div>

              <footer className="shrink-0 border-t border-foreground/10 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-end border border-foreground/15 bg-foreground/[0.025] focus-within:border-foreground/40">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 800))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send(draft);
                      }
                    }}
                    rows={1}
                    aria-label={isUa ? "Повідомлення для One AI" : "Message for One AI"}
                    placeholder={
                      isUa ? "Напишіть авто, задачу й бюджет…" : "Your vehicle, goal and budget…"
                    }
                    className="max-h-24 min-h-12 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-5 text-foreground outline-none placeholder:text-foreground/35"
                  />
                  <button
                    type="button"
                    onClick={() => void send(draft)}
                    disabled={!draft.trim() || busy}
                    className="group m-1 flex h-10 w-10 shrink-0 items-center justify-center bg-foreground text-background transition hover:opacity-85 disabled:opacity-25"
                    aria-label={isUa ? "Надіслати" : "Send"}
                  >
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[9.5px] leading-4 text-foreground/40">
                  <span>
                    {isUa
                      ? "One AI може помилятися. Сумісність підтверджує менеджер."
                      : "One AI can make mistakes. A manager confirms fitment."}
                  </span>
                  <Link
                    href={managerHref}
                    onClick={() => setOpen(false)}
                    className="inline-flex shrink-0 items-center gap-1 font-semibold uppercase tracking-[0.08em] text-foreground/55 transition hover:text-foreground"
                  >
                    <MessageCircleMore className="h-3.5 w-3.5" />
                    {isUa ? "Менеджер" : "Manager"}
                  </Link>
                </div>
              </footer>
            </motion.aside>,
            document.body
          )
        : null}
    </>
  );
}
