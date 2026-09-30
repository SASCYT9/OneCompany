import assert from "node:assert/strict";
import test from "node:test";
import { estimateRevozportDeliveryPricingWeight, revozportDeliveryPartClass } from "../../../scripts/_lib/revozport-delivery-estimator";
import type { RevozportSource } from "../../../scripts/_lib/revozport-enrichment";
const source = (sku: string, extra: Partial<RevozportSource> = {}): RevozportSource => ({ sku, titleEn: "Carbon Rear Spoiler", productType: "Spoiler", weight: null, length: 140, width: 30, height: 20, image: null, gallery: [], longDescUa: "", priceUsd: 499, source: { officialUrl: "https://revozport.com/products/rear-spoiler", shippingWeightLbs: null, productWeightLbs: null, seaShippingUsd: 49 }, ...extra });
const measured = (sku: string, lbs: number, extra: Partial<RevozportSource> = {}) => source(sku, { ...extra, source: { officialUrl: "https://revozport.com/products/rear-spoiler", shippingWeightLbs: lbs, productWeightLbs: null, seaShippingUsd: 49 } });

test("a close supplier package receives one 10 percent reserve", () => {
 const row = source("RZ-XM-1313", { weight: 5.489 });
 const estimate = estimateRevozportDeliveryPricingWeight(row, [measured("RZ-BM-1073", 6.6)]);
 assert.equal(estimate.baseWeightKg, 2.994);
 assert.equal(estimate.weightKg, 3.293);
 assert.equal(estimate.confidence, "medium");
 assert.equal(row.weight, 5.489);
});

test("self and variant siblings cannot supply a circular reference", () => {
 const row = source("RZ-BM-1090-02");
 const estimate = estimateRevozportDeliveryPricingWeight(row, [measured("RZ-BM-1090", 200), measured("RZ-BM-1090-03", 200), measured("RZ-BM-1073", 6.6)]);
 assert.equal(estimate.weightKg, 3.293);
 assert.deepEqual(estimate.analogues.map((analogue) => analogue.sku), ["RZ-BM-1073"]);
});

test("weak geometry keeps a conservative floor instead of reducing an unsupported weight", () => {
 const estimate = estimateRevozportDeliveryPricingWeight(source("RZ-XM-1313", { length: 178.638, width: 50.546, height: 13.005 }), [measured("RZ-BM-1073", 6.6)]);
 assert.equal(estimate.confidence, "low");
 assert.equal(estimate.weightKg, 5.489);
});

test("full wings, lightweight fender vents and complete fenders have distinct classes", () => {
 assert.equal(revozportDeliveryPartClass(source("wing", { titleEn: "Carbon Rear Spoiler", source: { officialUrl: "https://revozport.com/products/c7-rear-wing", shippingWeightLbs: null, productWeightLbs: null, seaShippingUsd: 49 } })), "wing");
 assert.equal(revozportDeliveryPartClass(source("vents", { titleEn: "Carbon Side Fender Vents", productType: "Vents" })), "vent");
 assert.equal(revozportDeliveryPartClass(source("fenders", { titleEn: "Carbon Side Fenders", productType: "Side Fenders" })), "fender");
});

test("implausible source units are flagged and not used as package geometry", () => {
 const estimate = estimateRevozportDeliveryPricingWeight(source("RZ-XF-9008", { length: 2064.563, width: 385.293, height: 126.086, source: { officialUrl: "https://revozport.com/products/c7-rear-wing", shippingWeightLbs: null, productWeightLbs: null, seaShippingUsd: 49 } }), []);
 assert.equal(estimate.dimensionsUsable, false);
 assert.equal(estimate.weightKg, 10.978);
 assert.equal(estimate.confidence, "low");
});
