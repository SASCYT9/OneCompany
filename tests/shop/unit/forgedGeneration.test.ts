import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import { FORGED_REFERENCE_CATALOG } from "../../../src/data/forgedReferenceCatalog";
import { getForgedDesigns } from "../../../src/lib/forged/catalog";
import {
  FORGED_CENTER_CAP_ASSET,
  checkPublicAssets,
  getForgedStagingRoot,
  getRequiredForgedAssetPaths,
  updateForgedGenerationMetadata,
} from "../../../src/lib/forged/generationQueue";

test("forged storefront catalog does not expose private original references", () => {
  const publicDesign = getForgedDesigns()[0] as Record<string, unknown>;

  assert.ok(publicDesign);
  assert.equal(publicDesign.sourceBrand, undefined);
  assert.equal(publicDesign.sourceModel, undefined);
  assert.equal(publicDesign.sourceUrl, undefined);
  assert.equal(publicDesign.originalReferenceLabel, undefined);
});

test("forged reference catalog keeps an admin-only original reference label", () => {
  const approved = FORGED_REFERENCE_CATALOG.find((item) => item.ocSlug === "oc-p101sc");

  assert.equal(approved?.originalReferenceLabel, "HRE P101SC");
  assert.equal(approved?.sourceBrand, "HRE");
});

test("forged staging coverage counts required approved and staged assets separately", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forged-coverage-"));
  const cwd = process.cwd();
  process.chdir(tempRoot);
  try {
    await fs.mkdir(path.join(tempRoot, "public", "forged", "generated-staging", "oc-test"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempRoot, "public", "forged", "generated-staging", "oc-test", "wheel.png"),
      "x"
    );

    const staged = await checkPublicAssets(
      getRequiredForgedAssetPaths("oc-test", getForgedStagingRoot("oc-test"))
    );
    const approved = await checkPublicAssets(getRequiredForgedAssetPaths("oc-test"));

    assert.equal(staged.expected, 20);
    assert.equal(staged.existing, 1);
    assert.equal(approved.existing, 0);
  } finally {
    process.chdir(cwd);
  }
});

test("forged generation metadata is versioned in the configured state file", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forged-state-"));
  const statePath = path.join(tempRoot, "forged-generation-state.json");
  process.env.FORGED_GENERATION_STATE_PATH = statePath;
  try {
    const updated = await updateForgedGenerationMetadata("oc-p101sc", {
      generationStatus: "queued",
      stagedAssetSet: "/forged/generated-staging/oc-p101sc",
      qaIssues: ["queued"],
    });

    assert.equal(updated.generationStatus, "queued");
    const raw = JSON.parse(await fs.readFile(statePath, "utf8")) as {
      items: Record<string, { generationStatus: string }>;
    };
    assert.equal(raw.items["oc-p101sc"]?.generationStatus, "queued");
  } finally {
    delete process.env.FORGED_GENERATION_STATE_PATH;
  }
});

test("forged prompt writer carries One Company center-cap and third-party logo constraints", async () => {
  const promptWriter = await fs.readFile(
    path.join(process.cwd(), "scripts", "write-forged-render-prompts.ts"),
    "utf8"
  );

  assert.match(promptWriter, /one-company-center-cap\.svg/);
  assert.match(promptWriter, /No third-party wheel-company logos/);
  assert.match(promptWriter, /status === "approved-seed"/);
  assert.equal(FORGED_CENTER_CAP_ASSET, "/forged/branding/one-company-center-cap.svg");
});

test("forged photo matrix automation covers cars, designs, materials, and center-cap rules", async () => {
  const matrixScript = await fs.readFile(
    path.join(process.cwd(), "scripts", "generate-forged-photo-matrix.ts"),
    "utf8"
  );

  assert.match(matrixScript, /FORGED_REFERENCE_TARGET_CARS/);
  assert.match(matrixScript, /getForgedRenderStagingPath/);
  assert.match(matrixScript, /OPENAI_API_KEY/);
  assert.match(matrixScript, /Center caps must be One Company carbon center caps/);
  assert.match(matrixScript, /Absolutely no HRE, Mansory, Brixton Forged, MV Forged, AL13/);
});
