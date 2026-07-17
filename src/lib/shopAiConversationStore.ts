import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ShopAiHistoryMessage, ShopAiPlan } from "@/lib/shopAiAssistantTypes";
import { redactShopAiContextValue, redactShopAiText } from "@/lib/shopAiPrivacy";

const CONVERSATION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_CONVERSATION_HISTORY = 12;
const memoryConversations = new Map<string, ShopAiConversationSnapshot>();
let databaseAvailable = process.env.SHOP_AI_PERSIST_CONVERSATIONS === "1";

export type ShopAiConversationSnapshot = {
  id: string;
  locale: "ua" | "en";
  currency: string;
  previousPlan: ShopAiPlan | null;
  history: ShopAiHistoryMessage[];
  shownProductIds: string[];
  ownerKey: string | null;
  expiresAt: Date;
};

function cleanIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(-100);
}

function cleanHistory(value: unknown): ShopAiHistoryMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_CONVERSATION_HISTORY).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    if (source.role !== "user" && source.role !== "assistant") return [];
    const text = redactShopAiText(String(source.text ?? "").replace(/<[^>]*>/g, " "), 800).text;
    return text ? [{ role: source.role, text }] : [];
  });
}

function cleanPreviousPlan(value: ShopAiPlan): ShopAiPlan {
  const vehicle = value.vehicle ?? {
    type: "unknown",
    make: null,
    model: null,
    chassis: null,
    year: null,
    engine: null,
  };
  return {
    ...value,
    vehicle: {
      ...vehicle,
      make: redactShopAiContextValue(vehicle.make, 80) || null,
      model: redactShopAiContextValue(vehicle.model, 100) || null,
      chassis: redactShopAiContextValue(vehicle.chassis, 60) || null,
      engine: redactShopAiContextValue(vehicle.engine, 100) || null,
      fuel: redactShopAiContextValue(vehicle.fuel, 40) || null,
      bodyStyle: redactShopAiContextValue(vehicle.bodyStyle, 60) || null,
      drivetrain: redactShopAiContextValue(vehicle.drivetrain, 60) || null,
      transmission: redactShopAiContextValue(vehicle.transmission, 60) || null,
      market: redactShopAiContextValue(vehicle.market, 60) || null,
    },
    searchQuery: redactShopAiContextValue(value.searchQuery, 300),
    brand: redactShopAiContextValue(value.brand, 80) || null,
    clarification: redactShopAiContextValue(value.clarification, 300) || null,
    vehicleResolution: value.vehicleResolution
      ? {
          ...value.vehicleResolution,
          candidates: value.vehicleResolution.candidates
            .map((candidate) => redactShopAiContextValue(candidate, 100))
            .filter(Boolean)
            .slice(0, 10),
          reason: redactShopAiContextValue(value.vehicleResolution.reason, 300),
        }
      : undefined,
  };
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
        ? cleanPreviousPlan(state.previousPlan as ShopAiPlan)
        : null,
    history: cleanHistory(state.history),
    shownProductIds: cleanIds(row.shownProductIds),
    ownerKey: typeof state.ownerKey === "string" ? state.ownerKey : null,
    expiresAt: row.expiresAt,
  };
}

export async function loadShopAiConversation(
  id: string | null | undefined,
  ownerKey?: string | null
) {
  if (!id) return null;
  const memory = memoryConversations.get(id);
  if (memory) {
    if (
      memory.expiresAt.getTime() > Date.now() &&
      (!ownerKey || (Boolean(memory.ownerKey) && memory.ownerKey === ownerKey))
    ) {
      return memory;
    }
    memoryConversations.delete(id);
  }
  if (!databaseAvailable) return null;
  try {
    const row = await prisma.shopAiConversation.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    const snapshot = fromDatabase(row);
    if (ownerKey && (!snapshot.ownerKey || snapshot.ownerKey !== ownerKey)) return null;
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
  history?: ShopAiHistoryMessage[];
  shownProductIds: string[];
  ownerKey?: string | null;
}) {
  const id = input.id || randomUUID();
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  const snapshot: ShopAiConversationSnapshot = {
    id,
    locale: input.locale,
    currency: input.currency,
    previousPlan: cleanPreviousPlan(input.previousPlan),
    history: cleanHistory(input.history),
    shownProductIds: cleanIds(input.shownProductIds),
    ownerKey: input.ownerKey ?? null,
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
        state: {
          previousPlan: snapshot.previousPlan,
          history: snapshot.history,
          ownerKey: snapshot.ownerKey,
        } as Prisma.InputJsonValue,
        shownProductIds: snapshot.shownProductIds,
        expiresAt,
      },
      update: {
        locale: input.locale,
        currency: input.currency,
        state: {
          previousPlan: snapshot.previousPlan,
          history: snapshot.history,
          ownerKey: snapshot.ownerKey,
        } as Prisma.InputJsonValue,
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
