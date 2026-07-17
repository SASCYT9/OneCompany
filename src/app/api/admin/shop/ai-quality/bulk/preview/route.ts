import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getOneAiQualityBulkSigningSecret,
  parseOneAiQualityBulkPreviewInput,
} from "@/lib/admin/oneAiQualityBulk";
import {
  OneAiQualityBulkSelectionError,
  previewOneAiQualityBulk,
} from "@/lib/admin/oneAiQualityBulkRepository";
import { isOneAiKnowledgeSchemaUnavailable } from "@/lib/admin/oneAiQualityProductRepository";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_PREVIEW_BYTES = 64 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function authResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401);
  if (message === "FORBIDDEN") return json({ error: "Forbidden" }, 403);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_AI_MANAGE);
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_PREVIEW_BYTES) {
      return json({ error: "Request body is too large" }, 413);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PREVIEW_BYTES) {
      return json({ error: "Request body is too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = parseOneAiQualityBulkPreviewInput(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const preview = await previewOneAiQualityBulk(
      prisma,
      parsed.value,
      session,
      getOneAiQualityBulkSigningSecret()
    );
    return json(preview);
  } catch (error) {
    const auth = authResponse(error);
    if (auth) return auth;
    if (error instanceof OneAiQualityBulkSelectionError) {
      return json({ error: error.message, code: "INVALID_BULK_SELECTION" }, 409);
    }
    if (isOneAiKnowledgeSchemaUnavailable(error)) {
      return json(
        {
          error:
            "One AI Knowledge V2 is not available. Apply migrations and run staging backfill first.",
        },
        503
      );
    }
    if (
      error instanceof Error &&
      /BULK_SECRET|bulk preview signing secret|ADMIN_SESSION_SECRET/i.test(error.message)
    ) {
      return json({ error: "Bulk preview signing is not configured" }, 503);
    }
    console.error("Admin One AI bulk preview failed", error);
    return json({ error: "Failed to build One AI bulk preview" }, 500);
  }
}
