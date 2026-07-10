import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ShopAiPlan } from "@/lib/shopAiAssistantTypes";

const CONVERSATION_TTL_MS = 2 * 60 * 60 * 1000;
const memoryConversations = new Map<string, ShopAiConversationSnapshot>();
let databaseAvailable = process.env.SHOP_AI_PERSIST_CONVERSATIONS === "1";

export type ShopAiConversationSnapshot = {
  id: string;
  locale: "ua" | "en";
  currency: string;
  previousPlan: ShopAiPlan | null;
  shownProductIds: string[];
  expiresAt: Date;
};

function cleanIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(-100);
}

function fromDatabase(row: {
  id: string;
  locale: string;
  currency: string;
  state: Prisma.JsonValue;
  shownProductIds: string[];
  expiresAt: Date;
}): ShopAiConversationSnapshot {
  const state =
    row.state && typeof row.state === "object" && !Array.isArray(row.state)
      ? (row.state as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    locale: row.locale === "en" ? "en" : "ua",
    currency: row.currency,
    previousPlan:
      state.previousPlan && typeof state.previousPlan === "object"
        ? (state.previousPlan as ShopAiPlan)
        : null,
    shownProductIds: cleanIds(row.shownProductIds),
    expiresAt: row.expiresAt,
  };
}

export async function loadShopAiConversation(id: string | null | undefined) {
  if (!id) return null;
  const memory = memoryConversations.get(id);
  if (memory) {
    if (memory.expiresAt.getTime() > Date.now()) return memory;
    memoryConversations.delete(id);
  }
  if (!databaseAvailable) return null;
  try {
    const row = await prisma.shopAiConversation.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    const snapshot = fromDatabase(row);
    memoryConversations.set(id, snapshot);
    return snapshot;
  } catch (error) {
    databaseAvailable = false;
    console.warn("Persistent Shop AI conversations unavailable; using memory", error);
    return null;
  }
}

export async function saveShopAiConversation(input: {
  id?: string | null;
  locale: "ua" | "en";
  currency: string;
  previousPlan: ShopAiPlan;
  shownProductIds: string[];
}) {
  const id = input.id || randomUUID();
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  const snapshot: ShopAiConversationSnapshot = {
    id,
    locale: input.locale,
    currency: input.currency,
    previousPlan: input.previousPlan,
    shownProductIds: cleanIds(input.shownProductIds),
    expiresAt,
  };
  memoryConversations.set(id, snapshot);
  if (memoryConversations.size > 500) {
    for (const [key, value] of memoryConversations) {
      if (value.expiresAt.getTime() <= Date.now()) memoryConversations.delete(key);
    }
  }
  if (!databaseAvailable) return snapshot;
  try {
    await prisma.shopAiConversation.upsert({
      where: { id },
      create: {
        id,
        locale: input.locale,
        currency: input.currency,
        state: { previousPlan: input.previousPlan } as Prisma.InputJsonValue,
        shownProductIds: snapshot.shownProductIds,
        expiresAt,
      },
      update: {
        locale: input.locale,
        currency: input.currency,
        state: { previousPlan: input.previousPlan } as Prisma.InputJsonValue,
        shownProductIds: snapshot.shownProductIds,
        expiresAt,
      },
    });
  } catch (error) {
    databaseAvailable = false;
    console.warn("Persistent Shop AI conversations unavailable; using memory", error);
  }
  return snapshot;
}
