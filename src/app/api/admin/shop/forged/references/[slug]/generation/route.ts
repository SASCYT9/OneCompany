import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { FORGED_REFERENCE_CATALOG } from "@/data/forgedReferenceCatalog";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import {
  checkPublicAssets,
  getForgedStagingRoot,
  getRequiredForgedAssetPaths,
  promoteStagedForgedAssets,
  updateForgedGenerationMetadata,
} from "@/lib/forged/generationQueue";

type GenerationAction = "generate" | "regenerate" | "approve" | "reject";

function isGenerationAction(value: unknown): value is GenerationAction {
  return (
    value === "generate" || value === "regenerate" || value === "approve" || value === "reject"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_FORGED_REFERENCES_WRITE);
    const reference = FORGED_REFERENCE_CATALOG.find((item) => item.ocSlug === slug);
    if (!reference) {
      return NextResponse.json({ error: "Forged reference not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      qaIssues?: unknown;
    };
    if (!isGenerationAction(body.action)) {
      return NextResponse.json({ error: "Invalid generation action" }, { status: 400 });
    }

    if (reference.status !== "approved-seed") {
      const metadata = await updateForgedGenerationMetadata(slug, {
        generationStatus: "blocked",
        qaIssues: ["Blocked until a model-level official source is approved."],
      });
      return NextResponse.json({ metadata }, { status: 409 });
    }

    const now = new Date().toISOString();
    let metadata;

    if (body.action === "generate" || body.action === "regenerate") {
      metadata = await updateForgedGenerationMetadata(slug, {
        generationStatus: "queued",
        lastGeneratedAt: now,
        stagedAssetSet: getForgedStagingRoot(slug),
        qaIssues: [
          "Generation queued. Run the forged staging asset script, then approve after visual QA.",
        ],
      });
    }

    if (body.action === "reject") {
      const qaIssues = Array.isArray(body.qaIssues)
        ? body.qaIssues.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : ["Rejected by admin QA."];
      metadata = await updateForgedGenerationMetadata(slug, {
        generationStatus: "rejected",
        rejectedAt: now,
        qaIssues,
      });
    }

    if (body.action === "approve") {
      const stagedCoverage = await checkPublicAssets(
        getRequiredForgedAssetPaths(slug, getForgedStagingRoot(slug))
      );
      if (stagedCoverage.existing < stagedCoverage.expected) {
        metadata = await updateForgedGenerationMetadata(slug, {
          generationStatus: "staged",
          stagedAssetSet: getForgedStagingRoot(slug),
          qaIssues: [
            `Cannot approve yet: ${stagedCoverage.missing.length} staged design assets are missing.`,
          ],
        });
        return NextResponse.json({ metadata, stagedCoverage }, { status: 409 });
      }

      await promoteStagedForgedAssets(slug);
      metadata = await updateForgedGenerationMetadata(slug, {
        generationStatus: "approved",
        approvedAt: now,
        approvedAssetSet: `/forged/designs/${slug}`,
        stagedAssetSet: getForgedStagingRoot(slug),
        qaIssues: [],
      });
    }

    await writeAdminAuditLog(prisma, session, {
      scope: "shop",
      action: `forged.generation.${body.action}`,
      entityType: "forged-reference",
      entityId: slug,
      metadata: {
        originalReferenceLabel: reference.originalReferenceLabel,
        generationStatus: metadata?.generationStatus ?? null,
      },
    });

    return NextResponse.json({ metadata });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin forged generation action failed", error);
    return NextResponse.json({ error: "Failed to update forged generation" }, { status: 500 });
  }
}

export const runtime = "nodejs";
