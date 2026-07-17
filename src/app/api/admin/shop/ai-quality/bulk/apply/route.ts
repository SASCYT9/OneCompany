import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { after, NextRequest, NextResponse } from "next/server";

import {
  getOneAiQualityBulkSigningSecret,
  hashOneAiQualityBulkActor,
  parseOneAiQualityBulkApplyInput,
  verifyOneAiQualityBulkPreviewToken,
} from "@/lib/admin/oneAiQualityBulk";
import {
  applyOneAiQualityBulk,
  OneAiQualityBulkIdempotencyConflictError,
  OneAiQualityBulkRevisionConflictError,
  OneAiQualityBulkSelectionError,
} from "@/lib/admin/oneAiQualityBulkRepository";
import { isOneAiKnowledgeSchemaUnavailable } from "@/lib/admin/oneAiQualityProductRepository";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import {
  createPrismaShopKnowledgeV2Repository,
  runShopKnowledgeOutboxJobById,
} from "@/lib/shopKnowledgeV2";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_APPLY_BYTES = 96 * 1024;

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

async function processTargetedOutboxJobs(outboxIds: string[]) {
  const repository = createPrismaShopKnowledgeV2Repository(prisma);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(2, outboxIds.length) }, async () => {
    while (cursor < outboxIds.length) {
      const outboxId = outboxIds[cursor];
      cursor += 1;
      try {
        await runShopKnowledgeOutboxJobById(repository, outboxId, {
          workerId: `admin-bulk-after:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
          maxAttempts: 8,
          staleLockMs: 15 * 60_000,
        });
      } catch (error) {
        console.error("Admin One AI bulk targeted reindex failed; cron recovery remains active", {
          outboxId,
          error,
        });
      }
    }
  });
  await Promise.all(workers);
}

export async function POST(request: NextRequest) {
  try {
    const session = assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_AI_MANAGE);
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_APPLY_BYTES) {
      return json({ error: "Request body is too large" }, 413);
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_APPLY_BYTES) {
      return json({ error: "Request body is too large" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const parsed = parseOneAiQualityBulkApplyInput(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const verification = verifyOneAiQualityBulkPreviewToken(
      parsed.value.previewToken,
      getOneAiQualityBulkSigningSecret(),
      hashOneAiQualityBulkActor(session.email)
    );
    if (!verification.ok) {
      if (verification.reason === "expired") {
        return json({ error: "Bulk preview expired", code: "PREVIEW_EXPIRED" }, 410);
      }
      if (verification.reason === "actor-mismatch") {
        return json({ error: "Bulk preview belongs to another manager" }, 403);
      }
      return json({ error: "Bulk preview token is invalid", code: "INVALID_PREVIEW_TOKEN" }, 400);
    }

    const result = await applyOneAiQualityBulk(
      prisma,
      verification.payload,
      parsed.value.previewToken,
      parsed.value.idempotencyKey,
      session
    );
    if (result.reindexOutboxIds.length) {
      after(() => processTargetedOutboxJobs(result.reindexOutboxIds));
    }
    return json(result);
  } catch (error) {
    const auth = authResponse(error);
    if (auth) return auth;
    if (error instanceof OneAiQualityBulkRevisionConflictError) {
      return json(
        {
          error: "One or more products changed after preview",
          code: "BULK_REVISION_CONFLICT",
          conflicts: error.conflicts,
        },
        409
      );
    }
    if (error instanceof OneAiQualityBulkIdempotencyConflictError) {
      return json(
        {
          error: "Idempotency key was already used for a different preview",
          code: "IDEMPOTENCY_CONFLICT",
        },
        409
      );
    }
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
    console.error("Admin One AI bulk apply failed", error);
    return json({ error: "Failed to apply One AI bulk update" }, 500);
  }
}
