import assert from "node:assert/strict";
import test from "node:test";
import { buildShopCatalogVehicleSearchPlan } from "../../../src/lib/shopCatalogVehicleSearchPlan";

test("engine and fuel queries retain every vehicle constraint on the canonical path", () => {
  for (const extra of ["engine=S68", "fuel=petrol", "engine=S68&fuel=hybrid"]) {
    const plan = buildShopCatalogVehicleSearchPlan(
      new URLSearchParams(`make=BMW&model=M5&chassis=G90&year=2025&${extra}`)
    );
    assert.equal(plan.canonical, true);
    assert.equal(plan.constraints.make, "BMW");
    assert.equal(plan.constraints.model, "M5");
    assert.equal(plan.constraints.generation, "G90");
    assert.equal(plan.constraints.year, 2025);
  }
});

test("the coverage bridge remains available for broad vehicle selection", () => {
  assert.equal(
    buildShopCatalogVehicleSearchPlan(new URLSearchParams("make=BMW&model=M5&generation=G90"))
      .canonical,
    false
  );
  const plan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams("scope=moto&make=BMW&model=S+1000+RR&engine=999cc&year=9999")
  );
  assert.equal(plan.canonical, true);
  assert.equal(plan.constraints.model, "S 1000 RR");
  assert.equal(plan.constraints.year, null);
});

test("projection mode keeps broad vehicle constraints without the legacy bridge", () => {
  for (const query of [
    "make=BMW&model=M5&chassis=G90&year=2025",
    "scope=moto&make=BMW&model=S+1000+RR&year=2024",
  ]) {
    const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams(query), {
      readerMode: "projection",
    });
    assert.equal(plan.reader, "projection");
    assert.equal(plan.canonical, true);
    assert.ok(plan.constraints.make);
    assert.ok(plan.constraints.model);
  }
});

test("default and invalid reader modes remain legacy", () => {
  for (const readerMode of [undefined, "", "native", "ProjectionX"]) {
    const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams("make=BMW&model=M5"), {
      readerMode,
    });
    assert.equal(plan.reader, "legacy");
    assert.equal(plan.canonical, false);
  }
});

test("OPF selection stays native and is not discarded", () => {
  const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams("make=BMW&opfGpf=with"));
  assert.equal(plan.canonical, true);
  assert.equal(plan.constraints.opfGpf, "with");
});

test("invalid OPF selections fail closed before the legacy bridge can run", () => {
  for (const opfGpf of ["unknown", "with;without", "any"]) {
    assert.throws(
      () => buildShopCatalogVehicleSearchPlan(new URLSearchParams(`make=BMW&opfGpf=${opfGpf}`)),
      /opfGpf must be with or without/
    );
  }
  assert.throws(
    () => buildShopCatalogVehicleSearchPlan(new URLSearchParams(`opfGpf=${"x".repeat(321)}`)),
    /opfGpf exceeds 320 characters/
  );
});
