const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

const { getShopProductBySlugServer } = require("./src/lib/shopCatalogServer");
const { extractShopProductDescriptionSections } = require("./src/lib/shopProductDescription");
const { buildDo88EnrichedDescription } = require("./src/lib/do88DescriptionEnricher");

async function main() {
  const product = await getShopProductBySlugServer("do88-icm-300-br");
  if (product) {
    const supplierLongDescription = product.longDescription.ua;
    console.log("Supplier long desc length:", supplierLongDescription.length);

    const descriptionSections = extractShopProductDescriptionSections(supplierLongDescription);
    console.log("--- BEFORE ENRICHMENT OVERRIDE ---");
    console.log("introHtml length:", descriptionSections.introHtml.length);
    console.log("features count:", descriptionSections.features.length);
    console.log("specs count:", descriptionSections.specs.length);
    console.log("specs:", descriptionSections.specs);

    const do88Enriched = buildDo88EnrichedDescription(product, "ua");
    console.log("--- DO88 ENRICHED ---");
    console.log("do88Enriched exists:", !!do88Enriched);
    if (do88Enriched) {
      console.log("shortDescription:", do88Enriched.shortDescription);
      console.log("longDescriptionHtml length:", do88Enriched.longDescriptionHtml.length);
      console.log("bullets count:", do88Enriched.bullets.length);
    }

    // Apply the PDP logic
    if (do88Enriched) {
      const hasRichSupplier =
        typeof supplierLongDescription === "string" && supplierLongDescription.length > 800;
      console.log("hasRichSupplier:", hasRichSupplier);
      descriptionSections.introHtml = hasRichSupplier
        ? supplierLongDescription
        : do88Enriched.longDescriptionHtml;

      const hasInlineSections = /<h3\b/i.test(descriptionSections.introHtml);
      console.log("hasInlineSections:", hasInlineSections);
      if (hasInlineSections) {
        descriptionSections.features = [];
      } else if (descriptionSections.features.length === 0) {
        descriptionSections.features = [...do88Enriched.bullets];
      }
    }

    console.log("--- AFTER PDP LOGIC ---");
    console.log("introHtml:", descriptionSections.introHtml);
    console.log("features:", descriptionSections.features);
    console.log("specs:", descriptionSections.specs);
  } else {
    console.log("Product not found");
  }
}

main().catch(console.error);
