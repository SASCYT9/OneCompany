import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import sharp from "sharp";

import { FORGED_DESIGNS, getForgedDesignVisual } from "@/data/forgedDesigns";
import {
  FORGED_REFERENCE_CATALOG,
  FORGED_REFERENCE_TARGET_CARS,
} from "@/data/forgedReferenceCatalog";
import { CAR_LIBRARY } from "@/lib/forged/carLibrary";
import { MATERIALS, type Material } from "@/lib/forged/configSchema";
import { FORGED_CENTER_CAP_ASSET, getForgedRenderStagingPath } from "@/lib/forged/generationQueue";
import { getForgedCarRenderUrl } from "@/lib/forged/renderMatrix";

loadEnv({ path: path.join(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ override: false, quiet: true });

type Args = {
  dryRun: boolean;
  publish: boolean;
  force: boolean;
  limit: number | null;
  model: string;
  quality: "low" | "medium" | "high";
  size: "1024x1024" | "1024x1536" | "1536x1024";
};

type Job = {
  carSlug: string;
  carName: string;
  designSlug: string;
  designName: string;
  originalReferenceLabel: string;
  material: Material;
  prompt: string;
  outputPath: string;
  publicPath: string;
};

const STYLE_GUIDE = [
  "One Company Forged configurator render style: photorealistic full side-profile vehicle studio image.",
  "Dark luxury automotive detailing studio, seamless charcoal backdrop, concrete floor, soft overhead strip lighting, subtle floor reflections.",
  "Camera locked at low eye-level 70mm lens feel, full side view, both wheels visible, consistent 16:10 landscape catalog framing.",
  "Vehicle body proportions must remain factory-correct; stance can be slightly lowered but believable.",
  "Wheels must be mounted physically inside arches, perspective-correct, with realistic tires and dark brake hardware behind spokes.",
  "Center caps must be One Company carbon center caps matching /forged/branding/one-company-center-cap.svg: black carbon weave center, white ONE COMPANY mark, small circular ring text.",
  "Absolutely no HRE, Mansory, Brixton Forged, MV Forged, AL13, or other third-party logos, caps, watermarks, barrel marks, lip marks, or spoke text.",
].join(" ");

const MATERIAL_BRIEF: Record<Material, string> = {
  aluminium:
    "brushed forged aluminium, bright machined highlights, satin clearcoat, visible CNC-milled edges and realistic radial machining grain",
  magnesium:
    "matte warm grey magnesium alloy, low-sheen motorsport finish, subtle metallic texture, lighter and less reflective than aluminium",
  carbon:
    "real carbon-composite forged wheel, dark graphite-black surface with visible carbon weave following spoke curvature, satin clearcoat depth, not black painted metal",
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    publish: false,
    force: false,
    limit: null,
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    quality: (process.env.OPENAI_IMAGE_QUALITY as Args["quality"]) || "high",
    size: "1536x1024",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") args.dryRun = true;
    else if (token === "--publish") args.publish = true;
    else if (token === "--force") args.force = true;
    else if (token === "--limit") {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next > 0) args.limit = Math.trunc(next);
      i += 1;
    } else if (token === "--model") {
      args.model = argv[i + 1] || args.model;
      i += 1;
    } else if (token === "--quality") {
      const next = argv[i + 1] as Args["quality"];
      if (next === "low" || next === "medium" || next === "high") args.quality = next;
      i += 1;
    }
  }

  return args;
}

async function exists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildPrompt(job: Omit<Job, "prompt" | "outputPath" | "publicPath">) {
  const reference = FORGED_REFERENCE_CATALOG.find((item) => item.ocSlug === job.designSlug);
  const geometry = reference?.geometryBrief ?? job.designName;

  return [
    STYLE_GUIDE,
    `Car: ${job.carName}.`,
    `Wheel design: One Company Forged ${job.designName}, internally based on the original reference geometry "${job.originalReferenceLabel}" but with all source branding removed.`,
    `Geometry details: ${geometry}.`,
    `Material/finish for the wheels: ${MATERIAL_BRIEF[job.material]}.`,
    "Deliver a finished configurator photo, not a cutout: whole car centered, both wheels clear, premium catalog realism, no text in the background.",
  ].join("\n");
}

function buildJobs(args: Args): Job[] {
  const approvedSlugs = new Set(
    FORGED_REFERENCE_CATALOG.filter((reference) => reference.status === "approved-seed").map(
      (reference) => reference.ocSlug
    )
  );
  const designs = FORGED_DESIGNS.filter(
    (design) => design.isCatalogVisible !== false && approvedSlugs.has(design.slug)
  );
  const cars = CAR_LIBRARY.filter((car) =>
    FORGED_REFERENCE_TARGET_CARS.includes(car.slug as (typeof FORGED_REFERENCE_TARGET_CARS)[number])
  );

  const jobs = cars.flatMap((car) =>
    designs.flatMap((design) =>
      MATERIALS.map((material) => {
        const reference = FORGED_REFERENCE_CATALOG.find((item) => item.ocSlug === design.slug);
        const publicPath = args.publish
          ? getForgedCarRenderUrl(car.slug, design.slug, material)
          : getForgedRenderStagingPath(car.slug, design.slug, material);
        const base = {
          carSlug: car.slug,
          carName: `${car.make} ${car.model}`,
          designSlug: design.slug,
          designName: design.nameEn,
          originalReferenceLabel: reference?.originalReferenceLabel ?? design.nameEn,
          material,
        };

        return {
          ...base,
          prompt: buildPrompt(base),
          publicPath,
          outputPath: path.join(process.cwd(), "public", publicPath.replace(/^\/+/, "")),
        };
      })
    )
  );

  return args.limit ? jobs.slice(0, args.limit) : jobs;
}

async function callOpenAiImageApi(job: Job, args: Args) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate forged photo matrix images.");
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      prompt: job.prompt,
      size: args.size,
      quality: args.quality,
      output_format: "jpeg",
      n: 1,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ b64_json?: string }>;
    error?: { message?: string };
  };

  if (!response.ok || !payload.data?.[0]?.b64_json) {
    throw new Error(
      payload.error?.message || `OpenAI image generation failed for ${job.publicPath}`
    );
  }

  return Buffer.from(payload.data[0].b64_json, "base64");
}

async function normalizeOutput(buffer: Buffer, outPath: string) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buffer)
    .resize(1600, 1000, { fit: "cover", position: "center" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outPath);
}

async function writeManifest(jobs: Job[]) {
  const manifestPath = path.join(process.cwd(), "tmp", "forged-renders", "photo-matrix-jobs.jsonl");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, jobs.map((job) => JSON.stringify(job)).join("\n") + "\n", "utf8");
  return manifestPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = buildJobs(args);
  const manifestPath = await writeManifest(jobs);

  console.log(`Prepared ${jobs.length} forged photo jobs.`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Mode: ${args.dryRun ? "dry-run" : args.publish ? "publish" : "staging"}`);
  console.log(`Model: ${args.model}, quality: ${args.quality}, size: ${args.size}`);
  console.log(`Center cap reference: ${FORGED_CENTER_CAP_ASSET}`);

  if (args.dryRun) return;

  let generated = 0;
  let skipped = 0;
  for (const job of jobs) {
    if (!args.force && (await exists(job.outputPath))) {
      skipped += 1;
      console.log(`skip existing ${job.publicPath}`);
      continue;
    }

    console.log(`generate ${job.carSlug} / ${job.designSlug} / ${job.material}`);
    const buffer = await callOpenAiImageApi(job, args);
    await normalizeOutput(buffer, job.outputPath);
    generated += 1;
    console.log(`wrote ${job.publicPath}`);
  }

  console.log(`Done. Generated ${generated}, skipped ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
