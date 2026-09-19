import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMstSupplierFitment,
  buildMstCatalogProduct,
  calculateMstRetailPrice,
  canonicalMstSku,
  classifyMstProduct,
  isRequestedMstProduct,
  senditSkuCandidates,
} from "../../../src/lib/mstCatalog";

test("MST fitment drafts preserve source applications without pretending manager verification", () => {
  const fitment = buildMstSupplierFitment({
    sku: "BW-S5802",
    titleEn: "MST 2021+ BMW G80 G82 M3 M4 Competition S58 Cold Air Intake System (BW-S5802)",
    source: {
      officialUrl: "https://www.mst-performance.com/en/products/bw-s5802",
      senditUrl: "https://sendit.parts/example/",
      senditMatchedSku: "MST-BW-S5802",
      manufacturerAvailability: "http://schema.org/InStock",
      senditAvailability: "https://schema.org/InStock",
    },
  });
  assert.equal(fitment.version, 2);
  if (fitment.version !== 2) throw new Error("Expected MST V2 fitment");
  assert.equal(fitment.mode, "vehicle_specific");
  assert.ok(fitment.policy.clauses.every((clause) => clause.verification === "NEEDS_REVIEW"));
  assert.ok(
    fitment.policy.clauses.some((clause) =>
      clause.constraints.some(
        (constraint) =>
          constraint.dimension === "make" &&
          constraint.state === "EXACT" &&
          constraint.values.includes("BMW")
      )
    )
  );
  assert.ok(
    fitment.policy.clauses.some((clause) =>
      clause.constraints.some(
        (constraint) =>
          constraint.dimension === "chassis" &&
          constraint.state === "EXACT" &&
          constraint.values.includes("G80")
      )
    )
  );
  assert.ok(
    fitment.policy.clauses.some((clause) =>
      clause.constraints.some(
        (constraint) =>
          constraint.dimension === "engine" &&
          constraint.state === "EXACT" &&
          constraint.values.includes("S58")
      )
    )
  );
  assert.match(fitment.note ?? "", /manager review/i);
});

test("MST conditional turbo products retain the manufacturer caveat in fitment notes", () => {
  const fitment = buildMstSupplierFitment({
    sku: "TY-SUP08",
    titleEn: "MST Toyota Supra A90/A91 B58 3.0 Intake + Inlet (Only for Pure 900 turbo) (TY-SUP08)",
    source: {
      officialUrl: "https://www.mst-performance.com/en/products/ty-sup08",
      senditUrl: "https://sendit.parts/example/",
      senditMatchedSku: "MST-TY-SUP08",
      manufacturerAvailability: "http://schema.org/OutOfStock",
      senditAvailability: "https://schema.org/InStock",
    },
  });
  assert.equal(fitment.version, 2);
  if (fitment.version !== 2) throw new Error("Expected MST V2 fitment");
  assert.ok(
    fitment.policy.clauses.some((clause) =>
      clause.constraints.some(
        (constraint) =>
          constraint.dimension === "make" &&
          constraint.state === "EXACT" &&
          constraint.values.includes("Toyota")
      )
    )
  );
  assert.match(fitment.note ?? "", /Pure 900/i);
  assert.equal(fitment.mode, "vehicle_specific");
  assert.ok(fitment.policy.clauses.every((clause) => clause.verification === "NEEDS_REVIEW"));
});

test("MST pricing applies Sendit inc. VAT + 10%, the 1.37 cross, then rounds USD up to 5", () => {
  assert.deepEqual(calculateMstRetailPrice(680.06), {
    sourceIncVatGbp: 680.06,
    sellGbp: 748.07,
    priceUsd: 1025,
  });
});

test("MST selection keeps requested BMW and Supra intake products but excludes other parts", () => {
  assert.equal(
    isRequestedMstProduct(
      "bw-b5816",
      "MST 2025+ BMW M340i B58 Gen3 3.0L Cold Air Intake + Inlet Kit (BW-B5816)"
    ),
    true
  );
  assert.equal(
    isRequestedMstProduct(
      "ty-sup07",
      "MST Toyota Supra A90 A91 B58 3.0 Cold Air Intake System + Turbo Inlet Pipe (TY-SUP07)"
    ),
    true
  );
  assert.equal(isRequestedMstProduct("bw-5808dp", "MST BMW/Toyota B58 Catted Downpipe"), false);
  assert.equal(
    isRequestedMstProduct("bw-miu03", "MST MINI Cooper S/JCW Cold Air Intake System"),
    false
  );
});

test("MST category distinguishes pipe-only SKUs from complete intake systems", () => {
  assert.equal(classifyMstProduct("MST BMW N20 Turbo Inlet Pipe"), "turbo-pipes");
  assert.equal(
    classifyMstProduct(
      "MST Turbo Inlet Pipe for BMW B58 (Only compatible with MST Intake Kits) (BW-B5805H)"
    ),
    "turbo-pipes"
  );
  assert.equal(
    classifyMstProduct("MST BMW M340i Cold Air Intake System + Turbo Inlet Kit"),
    "intake"
  );
});

test("MST SKU normalization and audited Sendit aliases are deterministic", () => {
  assert.equal(canonicalMstSku("bw-m3401"), "BW-M3401");
  assert.equal(canonicalMstSku("MST-BW-M3401"), "BW-M3401");
  assert.deepEqual(senditSkuCandidates("BW-F90M5"), ["MST-BW-F90M5", "MST-BW-F90M5-BK"]);
});

test("MST Ukrainian titles isolate the application from English compatibility caveats", () => {
  const product = buildMstCatalogProduct(
    {
      handle: "bw-b5805h",
      officialUrl: "https://www.mst-performance.com/en/products/bw-b5805h",
      titleEn:
        "MST Turbo Inlet Pipe for BMW B58 G series/Toyota Supra A90 A91/BMW Z4 (Only compatible with MST Intake Kits) (BW-B5805H)",
      images: ["https://example.com/product.jpg"],
      manufacturerAvailability: null,
    },
    null
  );
  assert.equal(
    product.titleUa,
    "MST Performance турбо-інлет для BMW B58 G series/Toyota Supra A90 A91/BMW Z4 (BW-B5805H)"
  );
  assert.match(product.shortDescUa, /Сумісно лише з комплектами впуску MST/);
  assert.doesNotMatch(product.shortDescUa, /для for|комплект впускуs/);
  assert.deepEqual(product.sellingPointsUa, [
    "Оптимізований прохід замість більш обмежувальної штатної ділянки",
    "Стабільніший потік повітря та більш безпосередня реакція турбіни",
    "Конфігурація розроблена під заявлене застосування",
  ]);
});

test("MST catalog record preserves both sources and the derived USD price", () => {
  const product = buildMstCatalogProduct(
    {
      handle: "ty-sup01",
      officialUrl: "https://www.mst-performance.com/en/products/ty-sup01",
      titleEn: "MST Toyota Supra A90/BMW Z4 B58 3.0L Cold Air Intake System (TY-SUP01)",
      images: ["https://example.com/product.jpg"],
      manufacturerAvailability: "http://schema.org/InStock",
    },
    {
      matchedSku: "MST-TY-SUP01",
      url: "https://sendit.parts/example/",
      title: "MST Supra intake",
      incVatGbp: 386.4,
      exVatGbp: 322,
      availability: "https://schema.org/InStock",
    }
  );
  assert.equal(product.pricing.sellGbp, 425.04);
  assert.equal(product.pricing.priceUsd, 585);
  assert.deepEqual(product.tags.slice(0, 7), [
    "MST Performance",
    "category:intake",
    "store:main",
    "BMW",
    "Toyota",
    "Supra",
    "A90",
  ]);
  assert.equal(product.source.senditMatchedSku, "MST-TY-SUP01");
  assert.equal(product.sellingPointsUa.length, 3);
  assert.match(product.shortDescUa, /^Дайте двигуну/);
});

test("MST combined intake copy emphasizes the complete airflow-path upgrade", () => {
  const product = buildMstCatalogProduct(
    {
      handle: "bw-b5816",
      officialUrl: "https://www.mst-performance.com/en/products/bw-b5816",
      titleEn: "MST 2025+ BMW M340i B58 Gen3 3.0L Cold Air Intake + Inlet Kit (BW-B5816)",
      images: ["https://example.com/product.jpg"],
      manufacturerAvailability: null,
    },
    null
  );
  assert.match(product.shortDescUa, /^Розкрийте характер/);
  assert.match(product.sellingPointsUa[0], /від фільтра до входу турбіни/);
});
