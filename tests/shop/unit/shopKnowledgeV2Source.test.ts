import assert from "node:assert/strict";
import test from "node:test";

import {
  mapShopKnowledgeSourceProduct,
  type ShopKnowledgeSourceRow,
} from "../../../src/lib/shopKnowledgeV2/source";
import {
  knowledgeSourceProduct,
  verifiedManagerF80Application,
} from "./shopKnowledgeV2TestFixture";

test("maps canonical manager rows and preserves a strict block while knowledge is processing", () => {
  const {
    managerApplications: _managerApplications,
    managerStrictBlock: _managerStrictBlock,
    ...product
  } = knowledgeSourceProduct();
  void _managerApplications;
  void _managerStrictBlock;
  const managerApplication = verifiedManagerF80Application();
  const source = mapShopKnowledgeSourceProduct({
    ...product,
    knowledge: {
      status: "PROCESSING",
      qualityFlags: ["blocked_strict:manager"],
      vehicleApplications: [managerApplication],
    },
  } as unknown as ShopKnowledgeSourceRow);

  assert.equal(source.managerStrictBlock, true);
  assert.equal(source.managerApplications.length, 1);
  assert.equal(source.managerApplications[0].applicationKey, managerApplication.applicationKey);
  assert.equal(source.managerApplications[0].variantId, "variant-non-opf");
  assert.equal(source.managerApplications[0].generation, "F8x");
  assert.equal(
    source.managerApplications[0].evidence[0].sourceRef,
    "manager:fitment-certificate-42"
  );
});

test("drops legacy MANAGER rows without field-level admin provenance", () => {
  const {
    managerApplications: _managerApplications,
    managerStrictBlock: _managerStrictBlock,
    ...product
  } = knowledgeSourceProduct();
  void _managerApplications;
  void _managerStrictBlock;
  const legacyApplication = {
    ...verifiedManagerF80Application(),
    applicationKey: "legacy-normalized-manager-row",
    evidence: [
      {
        ...verifiedManagerF80Application().evidence[0],
        evidenceKey: "legacy-normalized-manager-evidence",
        fieldPath: "applications.legacy-normalized-manager-row",
        sourceRef: "neutral:metafield:onecompany.normalized_fitment",
        extractorVersion: "2.0.0",
      },
    ],
  };
  const source = mapShopKnowledgeSourceProduct({
    ...product,
    knowledge: {
      status: "READY",
      qualityFlags: [],
      vehicleApplications: [legacyApplication],
    },
  } as unknown as ShopKnowledgeSourceRow);

  assert.deepEqual(source.managerApplications, []);
});
