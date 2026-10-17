import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { OneAiConversationState, OneAiHistoryEntry, OneAiProduct } from "./types";

/**
 * One AI conversations reuse the ShopAiConversation table (state JSON tagged
 * `one-ai-agent`), so no migration is needed. Serverless instances do not
 * share memory: with SHOP_AI_PERSIST_CONVERSATIONS=1 (production) the state
 * lives in PostgreSQL, otherwise only in this process.
 */
const CONVERSATION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_HISTORY_ENTRIES = 16;
const MAX_MEMORY_CONVERSATIONS = 300;

type StoredConversation = {
  id: string;
  ownerKey: string | null;
  state: OneAiConversationState;
  expiresAt: number;
};

const memory = new Map<string, StoredConversation>();

function persistenceEnabled() {
  return process.env.SHOP_AI_PERSIST_CONVERSATIONS === "1";
}

export function createOneAiConversationState(): OneAiConversationState {
  return {
    kind: "one-ai-agent",
    version: 1,
    history: [],
    products: {},
    nextRef: 1,
    lastCatalogHref: null,
  };
}

function isProduct(value: unknown): value is OneAiProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.ref === "string" &&
    typeof product.id === "string" &&
    typeof product.slug === "string" &&
    typeof product.name === "string"
  );
}

function parseState(value: unknown): OneAiConversationState | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (source.kind !== "one-ai-agent" || source.version !== 1) return null;
  const history = (Array.isArray(source.history) ? source.history : []).flatMap(
    (entry): OneAiHistoryEntry[] => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const text = typeof item.text === "string" ? item.text.slice(0, 4000) : "";
      if (item.role === "user" && text) return [{ role: "user", text }];
      if (item.role === "assistant") {
        const shownRefs = Array.isArray(item.shownRefs)
          ? item.shownRefs.filter((ref): ref is string => typeof ref === "string").slice(0, 12)
          : [];
        return [{ role: "assistant", text, shownRefs }];
      }
      return [];
    }
  );
  const products: Record<string, OneAiProduct> = {};
  if (source.products && typeof source.products === "object") {
    for (const [ref, product] of Object.entries(source.products as Record<string, unknown>)) {
      if (isProduct(product) && product.ref === ref) products[ref] = product;
    }
  }
  const nextRef = Number(source.nextRef);
  return {
    kind: "one-ai-agent",
    version: 1,
    history: history.slice(-MAX_HISTORY_ENTRIES),
    products,
    nextRef: Number.isInteger(nextRef) && nextRef > 0 ? nextRef : Object.keys(products).length + 1,
    lastCatalogHref: typeof source.lastCatalogHref === "string" ? source.lastCatalogHref : null,
  };
}

function remember(entry: StoredConversation) {
  // Re-insert so Map order stays "least recently used first".
  memory.delete(entry.id);
  memory.set(entry.id, entry);
  if (memory.size <= MAX_MEMORY_CONVERSATIONS) return;
  const now = Date.now();
  for (const [id, stored] of memory) {
    if (stored.expiresAt <= now) memory.delete(id);
  }
  while (memory.size > MAX_MEMORY_CONVERSATIONS) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

export async function loadOneAiConversation(
  id: string | null | undefined,
  ownerKey: string
): Promise<{ id: string; state: OneAiConversationState } | null> {
  if (!id) return null;
  const cached = memory.get(id);
  if (cached) {
    if (cached.expiresAt > Date.now() && cached.ownerKey === ownerKey) {
      return { id, state: structuredClone(cached.state) };
    }
    memory.delete(id);
  }
  if (!persistenceEnabled()) return null;
  try {
    const row = await prisma.shopAiConversation.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    const stateSource = row.state as Record<string, unknown> | null;
    if (!stateSource || stateSource.ownerKey !== ownerKey) return null;
    const state = parseState(stateSource.agent);
    if (!state) return null;
    remember({ id, ownerKey, state, expiresAt: row.expiresAt.getTime() });
    return { id, state: structuredClone(state) };
  } catch (error) {
    console.warn("One AI conversation load failed; starting fresh", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function saveOneAiConversation(input: {
  id: string | null;
  ownerKey: string;
  locale: "ua" | "en";
  currency: string;
  state: OneAiConversationState;
}) {
  const id = input.id || randomUUID();
  const expiresAt = Date.now() + CONVERSATION_TTL_MS;
  const state: OneAiConversationState = {
    ...input.state,
    history: input.state.history.slice(-MAX_HISTORY_ENTRIES),
  };
  remember({ id, ownerKey: input.ownerKey, state, expiresAt });
  if (!persistenceEnabled()) return id;
  const json = { ownerKey: input.ownerKey, agent: state } as unknown as Prisma.InputJsonValue;
  const shownProductIds = Array.from(
    new Set(Object.values(state.products).map((product) => product.id))
  ).slice(-100);
  try {
    await prisma.shopAiConversation.upsert({
      where: { id },
      create: {
        id,
        locale: input.locale,
        currency: input.currency,
        state: json,
        shownProductIds,
        expiresAt: new Date(expiresAt),
      },
      update: {
        locale: input.locale,
        currency: input.currency,
        state: json,
        shownProductIds,
        expiresAt: new Date(expiresAt),
      },
    });
  } catch (error) {
    console.warn("One AI conversation save failed; kept in memory only", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return id;
}
