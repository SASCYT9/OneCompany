import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopCatalogSelectedVehicleTextHint,
  buildShopCatalogVehicleSearchPlan,
} from "../../../src/lib/shopCatalogVehicleSearchPlan";

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

test("typed vehicle search queries reuse structured constraints before catalog loading", () => {
  const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams("q=BMW%20M3%20G80"));
  assert.equal(plan.constraints.make, "BMW");
  assert.equal(plan.constraints.model, "M3");
  assert.equal(plan.constraints.generation, "G80");
  assert.equal(plan.canonical, false);

  const chassisOnly = buildShopCatalogVehicleSearchPlan(new URLSearchParams("q=BMW%20G20"));
  assert.equal(chassisOnly.constraints.make, "BMW");
  assert.equal(chassisOnly.constraints.model, null);
  assert.equal(chassisOnly.constraints.generation, "G20");

  // Broad platform aliases must remain lexical until the catalog can resolve
  // the actual model family; otherwise `G8X` would over-constrain the query.
  const broad = buildShopCatalogVehicleSearchPlan(new URLSearchParams("q=BMW%20G8X"));
  assert.equal(broad.constraints.make, null);
  assert.equal(broad.constraints.model, null);
  assert.equal(broad.constraints.generation, null);
});

test("Mercedes G63 generation queries infer one canonical make and preserve explicit model identity", () => {
  for (const q of ["AMG G63 W465", "G63 W465", "Mercedes AMG G63 W465"]) {
    const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams({ q }), {
      readerMode: "projection",
    });
    assert.deepEqual(plan.constraints, {
      make: "Mercedes-Benz",
      model: "G-Class",
      generation: "W465",
      year: null,
      engine: null,
      fuel: null,
      opfGpf: null,
    });
    assert.deepEqual(plan.qualifierTerms, ["G63"]);
    assert.deepEqual(plan.modelAlternates, ["G63"]);
  }

  const selectorPlan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams("make=Mercedes-Benz&model=AMG+G+63&chassis=W465")
  );
  assert.deepEqual(selectorPlan.modelAlternates, ["AMG G 63"]);
});

test("Audi RS5 B9 keeps the selected generation and accepts KW's B8 label as an alternate", () => {
  for (const query of ["make=Audi&model=RS5&chassis=B9", "make=audi&model=rs5&generation=b9"]) {
    const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams(query));
    // Products tagged RS5 B9 (APR CBK0037) must match; KW files the same car
    // under A5 B8/F53, so B8 is accepted next to it rather than instead of it.
    assert.equal(plan.constraints.generation?.toUpperCase(), "B9", query);
    assert.deepEqual(plan.generationAlternates, ["B8"], query);
    assert.equal(plan.constraints.model, "A5", query);
    assert.deepEqual(
      plan.modelAlternates.map((model) => model.toUpperCase()),
      ["RS5"],
      query
    );
    assert.deepEqual(plan.qualifierTerms, ["RS5"], query);
  }

  const typed = buildShopCatalogVehicleSearchPlan(new URLSearchParams("q=Audi%20RS5%20B9"), {
    readerMode: "projection",
  });
  assert.equal(typed.constraints.generation, "B9");
  assert.deepEqual(typed.generationAlternates, ["B8"]);
});

test("other vehicle selections never acquire the KW RS5 generation alternate", () => {
  for (const query of [
    "make=Audi&model=RS5",
    "make=Audi&model=RS5&chassis=B8",
    "make=Audi&model=RS5&chassis=B9.5",
    "make=Audi&model=RS4&chassis=B9",
    "make=Audi&model=A5&chassis=B9",
    "make=BMW&model=M5&chassis=G90",
  ]) {
    const plan = buildShopCatalogVehicleSearchPlan(new URLSearchParams(query));
    assert.deepEqual(plan.generationAlternates, [], query);
    assert.equal(plan.constraints.generation, new URLSearchParams(query).get("chassis"), query);
  }
});

test("generic G-Class selection does not acquire the AMG G 63 model alternate", () => {
  const plan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams("make=Mercedes-Benz&model=G-Class&chassis=W465")
  );
  assert.equal(plan.constraints.model, "G-Class");
  assert.deepEqual(plan.modelAlternates, []);
});

test("mixed vehicle and product queries keep exact vehicle identity plus text search", () => {
  const plan = buildShopCatalogVehicleSearchPlan(
    new URLSearchParams("q=BMW%20M3%20G80%20Eventuri"),
    { readerMode: "projection" }
  );
  assert.deepEqual(
    [plan.constraints.make, plan.constraints.model, plan.constraints.generation],
    ["BMW", "M3", "G80"]
  );
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

test("selected vehicle text hint drops the generation suffix of the model", () => {
  assert.equal(
    buildShopCatalogSelectedVehicleTextHint("Volkswagen", "Touareg III"),
    "Volkswagen Touareg"
  );
  assert.equal(buildShopCatalogSelectedVehicleTextHint("Volkswagen", "Golf 8"), "Volkswagen Golf");
  assert.equal(buildShopCatalogSelectedVehicleTextHint("BMW", "M3"), "BMW M3");
  assert.equal(buildShopCatalogSelectedVehicleTextHint("BMW", "3 Series"), "BMW 3 Series");
  assert.equal(buildShopCatalogSelectedVehicleTextHint("Audi", null), "Audi");
  assert.equal(buildShopCatalogSelectedVehicleTextHint(null, "M3"), "");
});
