import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { after, NextRequest, NextResponse } from "next/server";

import {
  getOneAiQualityProductDetail,
  isOneAiKnowledgeSchemaUnavailable,
  mutateOneAiQualityProduct,
  OneAiQualityKnowledgeMissingError,
  OneAiQualityProductNotFoundError,
  OneAiQualityReferenceError,
} from "@/lib/admin/oneAiQualityProductRepository";
import {
  isOneAiQualityRevisionConflict,
  parseOneAiQualityMutation,
} from "@/lib/admin/oneAiQualityMutation";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import {
  createPrismaShopKnowledgeV2Repository,
  runShopKnowledgeOutboxJobById,
} from "@/lib/shopKnowledgeV2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MUTATION_BYTES = 16 * 1024;

type RouteContext = {
  params: Promise<{ productId: string }>;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function cleanProductId(value: string) {
  const cleaned = value.trim();
  return /^[A-Za-z0-9_-]{1,100}$/u.test(cleaned) ? cleaned : null;
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }
  if (message === "FORBIDDEN") {
    return noStoreJson({ error: "Forbidden" }, 403);
  }
  return null;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_AI_REVIEW);

    const productId = cleanProductId((await params).productId);
    if (!productId) {
      return noStoreJson({ error: "Invalid productId" }, 400);
    }

    return noStoreJson(await getOneAiQualityProductDetail(prisma, productId));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof OneAiQualityProductNotFoundError) {
      return noStoreJson({ error: "Product not found" }, 404);
    }
    if (isOneAiKnowledgeSchemaUnavailable(error)) {
      return noStoreJson(
        {
          error:
            "One AI Knowledge V2 is not available. Apply migrations and run the staging backfill first.",
        },
        503
      );
    }

    console.error("Admin One AI product detail failed", error);
    return noStoreJson({ error: "Failed to load One AI product detail" }, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_AI_MANAGE);

    const productId = cleanProductId((await params).productId);
    if (!productId) {
      return noStoreJson({ error: "Invalid productId" }, 400);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return noStoreJson({ error: "Content-Type must be application/json" }, 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_MUTATION_BYTES) {
      return noStoreJson({ error: "Request body is too large" }, 413);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return noStoreJson({ error: "Failed to read request body" }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_MUTATION_BYTES) {
      return noStoreJson({ error: "Request body is too large" }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return noStoreJson({ error: "Invalid JSON body" }, 400);
    }

    const parsed = parseOneAiQualityMutation(body);
    if (!parsed.ok) {
      return noStoreJson({ error: parsed.error }, 400);
    }

    const result = await mutateOneAiQualityProduct(prisma, productId, parsed.value, session);
    if (result.reindexOutboxId) {
      const outboxId = result.reindexOutboxId;
      after(async () => {
        try {
          await runShopKnowledgeOutboxJobById(
            createPrismaShopKnowledgeV2Repository(prisma),
            outboxId,
            {
              workerId: `admin-after:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
              maxAttempts: 8,
              staleLockMs: 15 * 60_000,
            }
          );
        } catch (error) {
          console.error("Admin One AI targeted reindex failed; cron recovery remains active", {
            outboxId,
            error,
          });
        }
      });
    }
    return noStoreJson(result);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (isOneAiQualityRevisionConflict(error)) {
      return noStoreJson(
        {
          error: "Revision conflict",
          code: "REVISION_CONFLICT",
          expectedRevision: error.expectedRevision,
          currentRevision: error.currentRevision,
        },
        409
      );
    }
    if (error instanceof OneAiQualityProductNotFoundError) {
      return noStoreJson({ error: "Product not found" }, 404);
    }
    if (error instanceof OneAiQualityKnowledgeMissingError) {
      return noStoreJson(
        {
          error:
            "This product has no Knowledge V2 record. Run the staging backfill before editing it.",
          code: "KNOWLEDGE_V2_MISSING",
        },
        409
      );
    }
    if (error instanceof OneAiQualityReferenceError) {
      return noStoreJson({ error: error.message }, 400);
    }
    if (isOneAiKnowledgeSchemaUnavailable(error)) {
      return noStoreJson(
        {
          error:
            "One AI Knowledge V2 is not available. Apply migrations and run the staging backfill first.",
        },
        503
      );
    }

    console.error("Admin One AI product mutation failed", error);
    return noStoreJson({ error: "Failed to update One AI product quality" }, 500);
  }
}
