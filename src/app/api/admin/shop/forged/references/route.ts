import { access, readdir } from "fs/promises";
import path from "path";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { FORGED_DESIGNS } from "@/data/forgedDesigns";
import { FORGED_REFERENCE_CATALOG } from "@/data/forgedReferenceCatalog";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import {
  checkPublicAssets,
  getForgedStagingRoot,
  getRequiredForgedAssetPaths,
  readForgedGenerationState,
} from "@/lib/forged/generationQueue";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const RENDER_MATERIALS = ["aluminium", "magnesium", "carbon"] as const;

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function publicPath(assetPath: string) {
  return path.join(PUBLIC_DIR, assetPath.replace(/^\/+/, ""));
}

async function checkDesignAssets(slug: string) {
  const design = FORGED_DESIGNS.find((item) => item.slug === slug);
  if (!design) {
    return {
      expected: 0,
      existing: 0,
      missing: [] as string[],
    };
  }

  const paths = new Set<string>([
    design.heroImage,
    design.wheelTransparentImage,
    ...design.gallery,
  ]);

  for (const visual of Object.values(design.materialVisuals ?? {})) {
    paths.add(visual.heroImage);
    paths.add(visual.wheelTransparentImage);
    visual.gallery.forEach((item) => paths.add(item));
  }

  const allPaths = Array.from(paths);
  const results = await Promise.all(
    allPaths.map(async (assetPath) => ({
      assetPath,
      exists: await exists(publicPath(assetPath)),
    }))
  );

  return {
    expected: results.length,
    existing: results.filter((item) => item.exists).length,
    missing: results.filter((item) => !item.exists).map((item) => item.assetPath),
  };
}

async function checkStagedDesignAssets(slug: string) {
  return checkPublicAssets(getRequiredForgedAssetPaths(slug, getForgedStagingRoot(slug)));
}

async function countRenderFiles(slug: string) {
  const renderRoot = path.join(PUBLIC_DIR, "forged", "renders");
  let carDirs: string[] = [];

  try {
    const entries = await readdir(renderRoot, { withFileTypes: true });
    carDirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
      .map((entry) => entry.name);
  } catch {
    return { carCount: 0, fileCount: 0 };
  }

  const counts = await Promise.all(
    carDirs.map(async (carSlug) => {
      const designDir = path.join(renderRoot, carSlug, slug);
      const files = await Promise.all(
        RENDER_MATERIALS.map(async (material) => {
          const jpg = await exists(path.join(designDir, `${material}.jpg`));
          const png = await exists(path.join(designDir, `${material}.png`));
          return jpg || png;
        })
      );

      const fileCount = files.filter(Boolean).length;
      return {
        hasAny: fileCount > 0,
        fileCount,
      };
    })
  );

  return {
    carCount: counts.filter((item) => item.hasAny).length,
    fileCount: counts.reduce((total, item) => total + item.fileCount, 0),
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_FORGED_REFERENCES_READ);
    const generationState = await readForgedGenerationState();

    const items = await Promise.all(
      FORGED_REFERENCE_CATALOG.map(async (reference) => {
        const design = FORGED_DESIGNS.find((item) => item.slug === reference.ocSlug);
        const [designAssets, stagedDesignAssets, renderCoverage] = await Promise.all([
          checkDesignAssets(reference.ocSlug),
          checkStagedDesignAssets(reference.ocSlug),
          countRenderFiles(reference.ocSlug),
        ]);
        const generation = generationState.items[reference.ocSlug] ?? {
          generationStatus: reference.status === "approved-seed" ? "idle" : "blocked",
          lastGeneratedAt: null,
          approvedAssetSet: null,
          qaIssues:
            reference.status === "approved-seed"
              ? []
              : ["Blocked until a model-level official source is approved."],
          stagedAssetSet: null,
        };

        return {
          ...reference,
          generation,
          catalogEntry: design
            ? {
                present: true,
                visible: design.isCatalogVisible !== false,
                family: design.family,
                basePriceEur: design.basePriceEur,
                leadTimeWeeksAl: design.leadTimeWeeksAl,
                isReplicaStyle: design.isReplicaStyle,
              }
            : {
                present: false,
                visible: false,
                family: null,
                basePriceEur: null,
                leadTimeWeeksAl: null,
                isReplicaStyle: null,
              },
          assetCoverage: {
            designAssets,
            stagedDesignAssets,
            renders: renderCoverage,
          },
        };
      })
    );

    return NextResponse.json({
      summary: {
        total: items.length,
        approvedSeed: items.filter((item) => item.status === "approved-seed").length,
        needsReview: items.filter((item) => item.status === "needs-model-page-review").length,
        withCatalogEntry: items.filter((item) => item.catalogEntry.present).length,
        visibleCatalogEntries: items.filter((item) => item.catalogEntry.visible).length,
        withAnyDesignAssets: items.filter((item) => item.assetCoverage.designAssets.existing > 0)
          .length,
        withAnyStagedDesignAssets: items.filter(
          (item) => item.assetCoverage.stagedDesignAssets.existing > 0
        ).length,
        withAnyCarRenders: items.filter((item) => item.assetCoverage.renders.carCount > 0).length,
        queued: items.filter((item) => item.generation.generationStatus === "queued").length,
        staged: items.filter((item) => item.generation.generationStatus === "staged").length,
        rejected: items.filter((item) => item.generation.generationStatus === "rejected").length,
      },
      items,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin forged references failed", error);
    return NextResponse.json({ error: "Failed to load forged references" }, { status: 500 });
  }
}

export const runtime = "nodejs";
