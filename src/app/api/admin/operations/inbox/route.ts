import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess } from "@/lib/operations/access";
import { opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_READ);
    const params = request.nextUrl.searchParams;
    const reviewStatus = params.get("status")?.trim().toUpperCase() || undefined;
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 50) || 50));
    const items = await prisma.opsInboxItem.findMany({
      where: reviewStatus ? { reviewStatus: reviewStatus as never } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        originalMessage: true,
        transcription: true,
        extractionStatus: true,
        reviewStatus: true,
        confidence: true,
        summary: true,
        ambiguities: true,
        requiresApproval: true,
        processingErrorType: true,
        processingError: true,
        undoExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        reviewedAt: true,
        telegramUpdate: {
          select: {
            telegramUpdateId: true,
            chatId: true,
            telegramUserId: true,
            messageId: true,
            messageThreadId: true,
            updateType: true,
            isUntrustedForward: true,
            receivedAt: true,
          },
        },
        proposals: {
          orderBy: { ordinal: "asc" },
          select: {
            id: true,
            kind: true,
            ordinal: true,
            payload: true,
            payloadHash: true,
            confidence: true,
            status: true,
            appliedTaskId: true,
            createdAt: true,
            appliedAt: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            state: true,
            retentionAt: true,
            pinned: true,
            createdAt: true,
          },
        },
        jobs: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            status: true,
            stage: true,
            attempts: true,
            maxAttempts: true,
            errorType: true,
            errorMessage: true,
            availableAt: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
    });
    return NextResponse.json({ items: serializeOpsJson(items) });
  } catch (error) {
    return opsErrorResponse(error);
  }
}
