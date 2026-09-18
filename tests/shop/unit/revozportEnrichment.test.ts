import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevozportEnrichment,
  matchOfficialRevozport,
  revozportEditorialTitle,
  type RevozportSource,
  type OfficialRevozportProduct,
} from "../../../scripts/_lib/revozport-enrichment";

const source: RevozportSource = {
  sku: "RZ-AD-1001",
  titleEn: "Carbon Fiber Front Lip for Audi RS3 8Y",
  longDescUa: "<li>Матеріал: Dry CF</li>",
  image: null,
  gallery: [],
  priceUsd: 1299,
  length: 100,
  width: 20,
  height: 10,
  weight: 4,
  source: {
    officialUrl: "https://revozport.com/products/front-lip",
    seaShippingUsd: 49,
    shippingWeightLbs: 10,
    productWeightLbs: 2,
  },
};
const official: OfficialRevozportProduct = {
  handle: "front-lip",
  title: "Front Lip",
  variants: [
    { id: 1, sku: source.sku, price: "1299.00", title: "Carbon" },
    { id: 2, sku: `${source.sku}-1`, price: "909.00", title: "Gloss Black" },
  ],
  images: [
    { src: "https://cdn.shopify.com/shared.jpg", variant_ids: [] },
    { src: "https://cdn.shopify.com/carbon.jpg", variant_ids: [1] },
    { src: "https://cdn.shopify.com/black.jpg", variant_ids: [2] },
    { src: "https://unverified.example/image.jpg", variant_ids: [1] },
  ],
};
test("prices match exact variant SKU, never the cheaper product variant", () => {
  const result = buildRevozportEnrichment(source, [official]);
  assert.equal(result.regionalDraft.europe.baseUsd, 1299);
  assert.equal(result.regionalDraft.america.baseUsd, 1299);
  assert.equal(result.regionalDraft.ukraine.deliveredUsd, 1412.4);
  assert.equal(result.regionalDraft.applied, false);
  assert.ok(!Object.keys(result.data).some((key) => /price|stock|tax|weight|status/i.test(key)));
});
test("ambiguity fails closed unless the supplier links the exact product", () => {
  const alternative = { ...official, handle: "other-vehicle" };
  assert.equal(
    matchOfficialRevozport(source, [official, alternative])?.product.handle,
    "front-lip"
  );
  assert.equal(
    matchOfficialRevozport({ ...source, source: { ...source.source, officialUrl: "" } }, [
      official,
      alternative,
    ]),
    null
  );
});
test("gallery excludes another variant and unapproved hosts", () => {
  const result = buildRevozportEnrichment(source, [official]);
  assert.deepEqual(result.data.gallery, [
    "https://cdn.shopify.com/shared.jpg",
    "https://cdn.shopify.com/carbon.jpg",
  ]);
});
test("estimates shipping weight when workbook shipping weight is missing", () => {
  const result = buildRevozportEnrichment(
    { ...source, source: { ...source.source, shippingWeightLbs: null } },
    []
  );
  assert.ok(result.data.longDescUa?.includes("Вага відправлення: 5.489 кг"));
  assert.ok(!result.data.longDescUa?.includes("Орієнтовна"));
  assert.equal(result.regionalDraft.ukraine.shippingWeightEstimated, true);
  assert.equal(result.regionalDraft.ukraine.shippingUsd, 137.23);
  assert.equal(result.regionalDraft.ukraine.deliveredUsd, 1436.23);
});
test("copy escapes source text and does not promise calculated final taxes at checkout", () => {
  const result = buildRevozportEnrichment({ ...source, titleEn: `${source.titleEn} <script>` }, []);
  assert.ok(result.data.longDescUa?.includes("&lt;script&gt;"));
  assert.ok(!result.data.longDescUa?.includes("<script>"));
  assert.ok(!result.data.longDescEn?.includes("during checkout"));
});
test("unknown or SKU-only product names are not fabricated", () => {
  assert.equal(revozportEditorialTitle({ ...source, titleEn: source.sku }), null);
  assert.equal(revozportEditorialTitle({ ...source, titleEn: "Unknown part for BMW" }), null);
});
test("quantity uses neutral Ukrainian units", () => {
  assert.equal(
    revozportEditorialTitle({ ...source, titleEn: "6 Pieces Carbon Fiber Front Lip for BMW" })
      ?.titleUa,
    "Карбонова передня губа для BMW (комплект: 6 шт.)"
  );
});
test("the atypical BMW G99 supplier title is localized without widening the model year", () => {
  assert.equal(
    revozportEditorialTitle({
      ...source,
      titleEn: "2025 BMW G99 M5 wagon revozport dry carbon spoiler",
    })?.titleUa,
    "Карбоновий задній спойлер для BMW M5 G99 Touring 2025"
  );
});
test("a missing or zero base price never becomes a delivered price", () => {
  for (const priceUsd of [null, 0])
    assert.equal(
      buildRevozportEnrichment({ ...source, priceUsd }, []).regionalDraft.ukraine.deliveredUsd,
      null
    );
});
