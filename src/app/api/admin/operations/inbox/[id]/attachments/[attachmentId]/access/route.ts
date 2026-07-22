import { issueSignedToken, presignUrl } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import {
  createConfiguredOpsMediaStore,
  getOpsBlobAuthOptions,
  isLocalOpsMediaStoreConfigured,
} from "@/lib/operations/media";
import { createOpsMediaResponse } from "@/lib/operations/mediaResponse";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_READ);
    const { id, attachmentId } = await params;
    const attachment = await prisma.opsAttachment.findFirst({
      where: {
        id: attachmentId,
        inboxItemId: id,
        state: "READY",
      },
      select: { storageKey: true, mimeType: true, fileName: true },
    });
    if (!attachment) {
      throw new OpsError("NOT_FOUND", 404, "Attachment not found");
    }
    if (
      isLocalOpsMediaStoreConfigured() ||
      attachment.mimeType.startsWith("audio/") ||
      attachment.mimeType.startsWith("video/")
    ) {
      const body = await createConfiguredOpsMediaStore().get(attachment.storageKey);
      return createOpsMediaResponse({
        body,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        rangeHeader: request.headers.get("range"),
      });
    }
    const auth = getOpsBlobAuthOptions();
    const validUntil = Date.now() + 60_000;
    const signedToken = await issueSignedToken({
      ...auth,
      pathname: attachment.storageKey,
      operations: ["get"],
      validUntil,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      access: "private",
      operation: "get",
      pathname: attachment.storageKey,
      validUntil,
      useCache: true,
    });
    const response = NextResponse.redirect(presignedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return opsErrorResponse(error);
  }
}
