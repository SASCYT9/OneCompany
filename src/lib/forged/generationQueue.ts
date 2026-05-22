import { promises as fs } from "fs";
import path from "path";

import { readJsonFileWithFallback, writeVersionedJsonFile } from "@/lib/adminJsonStorage";

export const FORGED_CENTER_CAP_ASSET = "/forged/branding/one-company-center-cap.svg";
export const FORGED_STAGING_PUBLIC_ROOT = "/forged/generated-staging";

export type ForgedGenerationStatus =
  | "idle"
  | "queued"
  | "staged"
  | "approved"
  | "rejected"
  | "failed"
  | "blocked";

export type ForgedGenerationMetadata = {
  generationStatus: ForgedGenerationStatus;
  lastGeneratedAt: string | null;
  approvedAssetSet: string | null;
  qaIssues: string[];
  stagedAssetSet?: string | null;
  rejectedAt?: string | null;
  approvedAt?: string | null;
};

export type ForgedGenerationState = {
  version: 1;
  items: Record<string, ForgedGenerationMetadata>;
};

const DEFAULT_STATE: ForgedGenerationState = {
  version: 1,
  items: {},
};

const REQUIRED_ASSET_NAMES = ["hero.jpg", "wheel.png", "01.jpg", "02.jpg", "03.jpg"] as const;
const REQUIRED_MATERIALS = ["aluminium", "magnesium", "carbon"] as const;

function statePath() {
  return (
    process.env.FORGED_GENERATION_STATE_PATH ??
    path.join(process.cwd(), "data", "forged-generation-state.json")
  );
}

function defaultMetadata(): ForgedGenerationMetadata {
  return {
    generationStatus: "idle",
    lastGeneratedAt: null,
    approvedAssetSet: null,
    qaIssues: [],
    stagedAssetSet: null,
  };
}

export function getRequiredForgedAssetPaths(slug: string, root = `/forged/designs/${slug}`) {
  const paths = new Set<string>();
  for (const name of REQUIRED_ASSET_NAMES) {
    paths.add(`${root}/${name}`);
  }
  for (const material of REQUIRED_MATERIALS) {
    for (const name of REQUIRED_ASSET_NAMES) {
      paths.add(`${root}/materials/${material}/${name}`);
    }
  }
  return Array.from(paths);
}

export function getForgedStagingRoot(slug: string) {
  return `${FORGED_STAGING_PUBLIC_ROOT}/${slug}`;
}

export function getForgedRenderStagingRoot(slug: string) {
  return `${FORGED_STAGING_PUBLIC_ROOT}/renders/${slug}`;
}

export function getForgedRenderStagingPath(carSlug: string, designSlug: string, material: string) {
  return `${FORGED_STAGING_PUBLIC_ROOT}/renders/${designSlug}/${carSlug}/${material}.jpg`;
}

export async function readForgedGenerationState(): Promise<ForgedGenerationState> {
  const state = await readJsonFileWithFallback<ForgedGenerationState>({
    filePath: statePath(),
    defaultValue: DEFAULT_STATE,
  });
  return {
    version: 1,
    items: state.items ?? {},
  };
}

async function writeState(state: ForgedGenerationState) {
  await writeVersionedJsonFile({
    filePath: statePath(),
    historyKey: "forged-generation-state",
    value: state,
    retention: 20,
  });
}

export async function getForgedGenerationMetadata(slug: string) {
  const state = await readForgedGenerationState();
  return state.items[slug] ?? defaultMetadata();
}

export async function updateForgedGenerationMetadata(
  slug: string,
  update: Partial<ForgedGenerationMetadata>
) {
  const state = await readForgedGenerationState();
  const previous = state.items[slug] ?? defaultMetadata();
  const next = {
    ...previous,
    ...update,
  };
  state.items[slug] = next;
  await writeState(state);
  return next;
}

export async function checkPublicAssets(assetPaths: string[]) {
  const publicDir = path.join(process.cwd(), "public");
  const results = await Promise.all(
    assetPaths.map(async (assetPath) => {
      const filePath = path.join(publicDir, assetPath.replace(/^\/+/, ""));
      try {
        await fs.access(filePath);
        return { assetPath, exists: true };
      } catch {
        return { assetPath, exists: false };
      }
    })
  );

  return {
    expected: results.length,
    existing: results.filter((item) => item.exists).length,
    missing: results.filter((item) => !item.exists).map((item) => item.assetPath),
  };
}

async function copyDirContents(sourceDir: string, targetDir: string) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  await fs.mkdir(targetDir, { recursive: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirContents(source, target);
    } else if (entry.isFile()) {
      await fs.copyFile(source, target);
    }
  }
}

async function copyDesignRenderContents(stagedDesignRenderRoot: string, targetRenderRoot: string) {
  let carDirs: string[] = [];
  try {
    const entries = await fs.readdir(stagedDesignRenderRoot, { withFileTypes: true });
    carDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return;
  }

  for (const carSlug of carDirs) {
    await copyDirContents(
      path.join(stagedDesignRenderRoot, carSlug),
      path.join(targetRenderRoot, carSlug)
    );
  }
}

export async function promoteStagedForgedAssets(slug: string) {
  const sourceDir = path.join(process.cwd(), "public", "forged", "generated-staging", slug);
  const targetDir = path.join(process.cwd(), "public", "forged", "designs", slug);
  await fs.access(sourceDir);
  await copyDirContents(sourceDir, targetDir);

  await copyDesignRenderContents(
    path.join(process.cwd(), "public", "forged", "generated-staging", "renders", slug),
    path.join(process.cwd(), "public", "forged", "renders")
  );
}
