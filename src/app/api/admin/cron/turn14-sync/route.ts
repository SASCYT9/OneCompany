import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";
import { findTurn14BrandIdByName, fetchTurn14ItemsByBrand } from "@/lib/turn14";
import { syncBrandFromTurn14 } from "@/lib/turn14Sync";

const ALLOWED_BRANDS = new Map(
  ["Eventuri", "KW", "Radium Engineering", "AWE"].map((brand) => [brand.toLowerCase(), brand])
);

const turn14CronSession = {
  email: "cron@system.local",
  name: "Turn14 Feed Cron",
  permissions: ["*"],
  issuedAt: 0,
  nonce: "turn14-feed-cron",
};

export async function POST(request: Request) {
  const cronSecret = resolveSecret("CRON_SECRET");
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!matchesBearerSecret(request.headers, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedBrand = new URL(request.url).searchParams.get("brand")?.trim() ?? "";
  const brandName = ALLOWED_BRANDS.get(requestedBrand.toLowerCase());
  if (!brandName) {
    return NextResponse.json(
      { error: "Unsupported Turn14 cron brand", allowedBrands: [...ALLOWED_BRANDS.values()] },
      { status: 400 }
    );
  }

  try {
    const result = await syncBrandFromTurn14(
      prisma,
      brandName,
      findTurn14BrandIdByName,
      fetchTurn14ItemsByBrand,
      turn14CronSession,
      (message) => console.log(`[Turn14 Cron] ${message}`)
    );
    const publication = await runShopCatalogOutboxRuntime({
      workerId: `catalog-turn14-cron:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
      limit: 50,
    });
    return NextResponse.json({ ok: true, brand: brandName, ...result, publication });
  } catch (error) {
    console.error("[Turn14 Cron] sync failed", { brand: brandName, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
