import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CAR_LIBRARY } from "../src/lib/forged/carLibrary";
import { MATERIALS } from "../src/lib/forged/configSchema";
import { colorToken, getForgedCarRenderUrl } from "../src/lib/forged/renderMatrix";
import { FORGED_DESIGNS } from "../src/data/forgedDesigns";
import { FORGED_REFERENCE_CATALOG } from "../src/data/forgedReferenceCatalog";

const OUT_DIR = path.join(process.cwd(), "tmp", "forged-renders");
const OUT_FILE = path.join(OUT_DIR, "prompts.jsonl");
const CARBON_OUT_FILE = path.join(OUT_DIR, "prompts-carbon.jsonl");

const materialBrief: Record<(typeof MATERIALS)[number], string> = {
  aluminium: "brushed forged aluminium, bright machined highlights, clear satin finish",
  magnesium: "matte warm grey magnesium alloy, slightly darker low-sheen motorsport finish",
  carbon:
    "real forged carbon / carbon-composite wheel construction, visible fine woven carbon fiber texture following spoke curvature, deep satin clearcoat, dark graphite-black highlights, not painted metal",
};

function promptFor({
  car,
  design,
  material,
}: {
  car: (typeof CAR_LIBRARY)[number];
  design: (typeof FORGED_DESIGNS)[number];
  material: (typeof MATERIALS)[number];
}) {
  const reference = FORGED_REFERENCE_CATALOG.find((item) => item.ocSlug === design.slug);
  const geometry = reference?.geometryBrief ?? design.nameEn;

  return [
    "Use case: photorealistic-natural",
    "Asset type: premium One Company Forged configurator car render",
    `Primary request: Generate a photorealistic side-profile studio photograph of a ${car.make} ${car.model} fitted with One Company Forged ${design.nameEn} wheels.`,
    "Scene/backdrop: dark luxury detailing studio, concrete floor, soft overhead strip lights, subtle floor reflections, premium automotive catalog mood.",
    `Subject: ${car.make} ${car.model}, full side view, both wheels visible, realistic stance and factory body proportions.`,
    `Wheel design: ${geometry}. The wheel must be mounted physically and perspective-correct, integrated into the arches, not pasted on.`,
    `Material/finish: ${materialBrief[material]}.`,
    "Branding: subtle ONE COMPANY center cap on both wheels, small and physically plausible, matching the One Company carbon center-cap reference asset at /forged/branding/one-company-center-cap.svg. No third-party wheel-company logos, no HRE, no Mansory, no Brixton Forged, no MV Forged, no AL13 branding.",
    "Composition/framing: 16:10 landscape, whole car centered, catalog configurator preview, wheels clear but not oversized.",
    "Lighting/mood: realistic studio reflections on paint and metal, believable tire sidewalls, dark brake hardware behind spokes.",
    material === "carbon"
      ? "Carbon-specific constraints: the wheel must not look like black-painted aluminium. Show real carbon weave, satin clearcoat depth, anisotropic reflections, and molded composite surfaces while preserving the exact wheel geometry."
      : "Material-specific constraints: keep a real machined forged-metal surface with plausible brushed grain and milled edges.",
    "Constraints: photorealistic, no CGI look, no floating wheels, no ghost wheels, no duplicated wheels, no warped tires, no oversized center badge, no watermark, no background text, no third-party caps, no third-party lip/barrel/spoke marks.",
  ].join("\n");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const approvedReferenceSlugs = new Set(
    FORGED_REFERENCE_CATALOG.filter((reference) => reference.status === "approved-seed").map(
      (reference) => reference.ocSlug
    )
  );
  const visibleDesigns = FORGED_DESIGNS.filter(
    (design) => design.isCatalogVisible !== false && approvedReferenceSlugs.has(design.slug)
  );

  const rows = CAR_LIBRARY.flatMap((car) =>
    visibleDesigns.flatMap((design) =>
      MATERIALS.map((material) => ({
        carSlug: car.slug,
        designSlug: design.slug,
        material,
        outputUrl: getForgedCarRenderUrl(car.slug, design.slug, material),
        colorToken: colorToken("#1c1c1c"),
        prompt: promptFor({ car, design, material }),
      }))
    )
  );

  const carbonRows = rows.filter((row) => row.material === "carbon");

  await writeFile(OUT_FILE, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
  await writeFile(
    CARBON_OUT_FILE,
    carbonRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8"
  );
  console.log(`Wrote ${rows.length} forged render prompts to ${OUT_FILE}`);
  console.log(`Wrote ${carbonRows.length} dedicated carbon prompts to ${CARBON_OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
