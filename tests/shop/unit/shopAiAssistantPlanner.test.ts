import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFallbackShopAiPlan,
  normalizeShopAiPlan,
  shouldAskShopAiClarificationBeforeRetrieval,
} from "../../../src/lib/shopAiAssistantPlanner";

const context = { locale: "ua" as const, currency: "EUR" as const };

test("planner infers a tuning category and asks for missing vehicle", () => {
  const plan = buildFallbackShopAiPlan("Потрібен вихлоп", context);

  assert.equal(plan.category, "exhaust");
  assert.equal(plan.needsClarification, true);
  assert.deepEqual(plan.requiredDetails, []);
});

test("specific brand or vehicle requests can retrieve reviewable products before clarification", () => {
  const branded = buildFallbackShopAiPlan(
    'Find DO88 Blue Silicone Hose 4 - 4.25" in cooling upgrade',
    { locale: "en", currency: "EUR" }
  );
  const vehicle = buildFallbackShopAiPlan("Покажи вихлоп для Audi RS6 C8", context);
  const broad = buildFallbackShopAiPlan("Покажи вихлоп", context);

  assert.equal(branded.needsClarification, true);
  assert.equal(branded.brand, "do88");
  assert.equal(shouldAskShopAiClarificationBeforeRetrieval(branded, branded.searchQuery), false);
  assert.equal(vehicle.needsClarification, true);
  assert.equal(
    shouldAskShopAiClarificationBeforeRetrieval(vehicle, "Покажи вихлоп для Audi RS6 C8"),
    false
  );
  assert.equal(shouldAskShopAiClarificationBeforeRetrieval(broad, "Покажи вихлоп"), true);

  const titled = normalizeShopAiPlan(
    { category: "cooling", vehicle: {} },
    "Find Blue Silicone Hose 102 108 millimetres",
    { locale: "en", currency: "EUR" }
  );
  assert.equal(
    shouldAskShopAiClarificationBeforeRetrieval(
      titled,
      "Find Blue Silicone Hose 102 108 millimetres"
    ),
    false
  );
});

test("broad category requests ask for a vehicle across supported language styles", () => {
  const messages = [
    "I want an exhaust upgrade. What do you need from me?",
    "Хочу exhaust для авто upgrade, що треба уточнити?",
    "Dopomozhy pidibraty vykhlop dlia avto",
    "Хочу встановити карбоновий аерообвіс, з чого почати?",
    "Хочу установить подвеску, с чего начать?",
    "Dopomozhy pidibraty chyp tiuninh",
    "Help me choose motorcycle carbon",
    "Dopomozhy pidibraty detali salonu",
  ];

  for (const message of messages) {
    const plan = buildFallbackShopAiPlan(message, context);
    assert.equal(plan.needsClarification, true, message);
    assert.equal(shouldAskShopAiClarificationBeforeRetrieval(plan, message), true, message);
  }
});

test("planner can search merch without asking for vehicle fitment", () => {
  const plan = buildFallbackShopAiPlan("Покажи мерч Akrapovic", context);

  assert.equal(plan.category, "merch");
  assert.equal(plan.needsClarification, false);
  assert.equal(plan.clarification, null);
});

test("planner refuses an open-ended recommendation without a category", () => {
  const plan = buildFallbackShopAiPlan("Що варто змінити спочатку?", context);

  assert.equal(plan.category, null);
  assert.equal(plan.needsClarification, true);
  assert.match(plan.clarification ?? "", /що саме хочете змінити/i);
});

test("planner maps a natural sales goal deterministically", () => {
  const sound = buildFallbackShopAiPlan("Хочу кращий звук на BMW M3 F80", context);
  const handling = buildFallbackShopAiPlan("Improve handling for BMW M3 F80", {
    locale: "en",
    currency: "EUR",
  });

  assert.equal(sound.goal, "sound");
  assert.equal(sound.category, "exhaust");
  assert.equal(handling.goal, "handling");
  assert.equal(handling.category, "suspension");
});

test("planner preserves explicit performance and motorcycle-carbon categories", () => {
  const performance = buildFallbackShopAiPlan("Допоможи підібрати тюнінг двигуна", context);
  const motoCarbon = buildFallbackShopAiPlan("Help me choose motorcycle carbon", {
    locale: "en",
    currency: "EUR",
  });

  assert.equal(performance.category, "performance");
  assert.equal(motoCarbon.category, "motoCarbon");
});

test("explicit category phrases override incidental product-title words", () => {
  const carbon = buildFallbackShopAiPlan("Find Urban carbon engine cover in carbon aero", {
    locale: "en",
    currency: "EUR",
  });
  const interior = buildFallbackShopAiPlan("Find carbon fibre seat backs in interior parts", {
    locale: "en",
    currency: "EUR",
  });

  assert.equal(carbon.category, "carbonAero");
  assert.equal(interior.category, "interior");
});

test("planner resolves Ukrainian turbo-inlet intent and Audi B8 RS5 aliases", () => {
  const turboInlet = buildFallbackShopAiPlan(
    "Покажи гібридні турбо-впуски для Audi C8 RS6",
    context
  );
  const b8Intake = buildFallbackShopAiPlan(
    "Знайди карбоновий впуск Eventuri для Audi B8 RS5",
    context
  );

  assert.equal(turboInlet.category, "performance");
  assert.equal(turboInlet.productKind, "turbo_inlet");
  assert.equal(turboInlet.vehicle.make, "Audi");
  assert.equal(turboInlet.vehicle.model, "RS6");
  assert.equal(turboInlet.vehicle.chassis, "C8");
  assert.equal(b8Intake.category, "performance");
  assert.equal(b8Intake.productKind, "intake");
  assert.equal(b8Intake.vehicle.make, "Audi");
  assert.equal(b8Intake.vehicle.model, "RS5");
  assert.equal(b8Intake.vehicle.chassis, "B8");
});

test("planner resolves supported RU and transliterated category terms without a provider", () => {
  const cases = [
    ["Помоги подобрать выхлоп", "exhaust"],
    ["Dopomozhy pidibraty halma dlia avto", "brakes"],
    ["Хочу установить подвеску", "suspension"],
    ["Dopomozhy pidibraty chyp tiuninh", "chipTuning"],
    ["Dopomozhy pidibraty okholodzhennia dlia avto", "cooling"],
    ["Помоги подобрать диски", "wheels"],
    ["Help me choose lighting", "lighting"],
    ["Dopomozhy pidibraty detali salonu", "interior"],
    ["Помоги подобрать аксессуары", "accessories"],
    ["Dopomozhy pidibraty karbonovyi obvis", "carbonAero"],
  ] as const;

  for (const [message, expectedCategory] of cases) {
    assert.equal(buildFallbackShopAiPlan(message, context).category, expectedCategory, message);
  }
});

test("an explicit sound goal overrides a stale appearance category", () => {
  const queries = [
    "Що краще змінити для більш спортивного звуку?",
    "Что изменить для более спортивного звучания?",
  ];

  for (const message of queries) {
    const fallback = buildFallbackShopAiPlan(message, {
      ...context,
      category: "carbonAero",
    });
    const providerPlan = normalizeShopAiPlan(
      { goal: "appearance", category: "carbonAero", vehicle: {} },
      message,
      { ...context, category: "carbonAero" }
    );

    assert.equal(fallback.goal, "sound");
    assert.equal(fallback.category, "exhaust");
    assert.equal(providerPlan.goal, "sound");
    assert.equal(providerPlan.category, "exhaust");
  }
});

test("planner asks for the goal before the vehicle on an open request", () => {
  const plan = buildFallbackShopAiPlan("Порадь щось для тюнінгу", context);

  assert.equal(plan.category, null);
  assert.match(plan.clarification ?? "", /що саме хочете змінити/i);
});

test("provider cannot invent a category or goal for an open request", () => {
  const plan = normalizeShopAiPlan(
    { category: "exhaust", goal: "sound", vehicle: {} },
    "What should I change first?",
    { locale: "en", currency: "EUR" }
  );

  assert.equal(plan.category, null);
  assert.equal(plan.goal, null);
  assert.equal(plan.needsClarification, true);
});

test("active catalog context remains authoritative over an invented provider category", () => {
  const plan = normalizeShopAiPlan(
    { category: "brakes", goal: "braking", vehicle: {} },
    "Show me options",
    { locale: "en", currency: "EUR", category: "suspension" }
  );

  assert.equal(plan.category, "suspension");
  assert.equal(plan.goal, "handling");
});

test("planner inherits vehicle selected on the Stock page", () => {
  const plan = normalizeShopAiPlan(
    { category: "brakes", needsClarification: false, vehicle: {} },
    "Покажи гальма для цього авто",
    { ...context, make: "BMW", model: "M3", chassis: "F80" }
  );

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.chassis, "F80");
  assert.equal(plan.needsClarification, false);
});

test("planner keeps the active Moto catalog scope authoritative", () => {
  const plan = normalizeShopAiPlan({ vehicle: { type: "car" } }, "Підбери вихлоп", {
    ...context,
    scope: "moto",
  });

  assert.equal(plan.vehicle.type, "motorcycle");
});

test("fallback planner keeps Moto scope even before a make is selected", () => {
  const plan = buildFallbackShopAiPlan("Підбери вихлоп", { ...context, scope: "moto" });

  assert.equal(plan.vehicle.type, "motorcycle");
});

test("explicit SKU intent cannot be reinterpreted as a vehicle chassis", () => {
  const identity = buildFallbackShopAiPlan("SKU URB-HOO-25358201-V1", {
    locale: "en",
    currency: "EUR",
    scope: "auto",
  });
  const withVehicleContext = buildFallbackShopAiPlan("SKU URB-HOO-25358201-V1", {
    locale: "en",
    currency: "EUR",
    scope: "auto",
    make: "BMW",
    model: "M3",
    chassis: "F80",
  });

  assert.equal(identity.searchQuery, "urbhoo25358201v1");
  assert.equal(identity.vehicle.chassis, null);
  assert.equal(identity.category, null);
  assert.equal(identity.needsClarification, false);
  assert.equal(withVehicleContext.vehicle.chassis, "F80");
  assert.equal(withVehicleContext.needsClarification, false);
});

test("planner rejects unsupported categories and invalid price values", () => {
  const plan = normalizeShopAiPlan(
    { category: "phones", minPrice: -10, maxPrice: "not-a-number" },
    "Порадь щось",
    context
  );

  assert.equal(plan.category, null);
  assert.equal(plan.minPrice, null);
  assert.equal(plan.maxPrice, null);
});

test("planner does not convert absent price limits to zero", () => {
  const plan = normalizeShopAiPlan(
    { category: "exhaust", minPrice: null, maxPrice: null, vehicle: { make: "BMW", model: "M3" } },
    "Підбери вихлоп",
    context
  );

  assert.equal(plan.minPrice, null);
  assert.equal(plan.maxPrice, null);
});

test("fallback planner resolves vehicle and budget without an AI provider", () => {
  const plan = buildFallbackShopAiPlan("Підбери вихлоп для BMW M3 2018 до 3000 EUR", context);

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.year, 2018);
  assert.equal(plan.category, "exhaust");
  assert.equal(plan.maxPrice, 3000);
  assert.equal(plan.needsClarification, true);
  assert.ok(plan.requiredDetails?.includes("opfGpf"));
});

test("fallback planner inherits a year from the current Stock query", () => {
  const plan = buildFallbackShopAiPlan("Find exhaust for this car", {
    ...context,
    query: "BMW M3 2018",
    make: "BMW",
    model: "M3",
  });

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M3");
  assert.equal(plan.vehicle.year, 2018);
  assert.equal(plan.searchQuery.includes("2018"), true);
});

test("fallback planner resolves BMW X6 G06 and keeps context facts", () => {
  const plan = buildFallbackShopAiPlan(
    "Підбери вихлоп для BMW X6 G06 30d mild hybrid 2020",
    context
  );

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "X6");
  assert.equal(plan.vehicle.chassis, "G06");
  assert.equal(plan.vehicle.year, 2020);
  assert.equal(plan.vehicle.engine, "B57");
  assert.equal(plan.vehicle.fuel, "hybrid");
  assert.equal(plan.category, "exhaust");
});

test("fallback planner carries vehicle facts from the active context", () => {
  const plan = buildFallbackShopAiPlan("Підбери вихлоп для цього авто", {
    ...context,
    category: "exhaust",
    make: "BMW",
    model: "X6",
    chassis: "G06",
    year: 2020,
    engine: "B57",
    fuel: "diesel",
    bodyStyle: "suv",
  });

  assert.equal(plan.vehicle.year, 2020);
  assert.equal(plan.vehicle.engine, "B57");
  assert.equal(plan.vehicle.fuel, "diesel");
  assert.equal(plan.vehicle.bodyStyle, "suv");
});

test("planner recognizes a Ukrainian comparison request deterministically", () => {
  const plan = normalizeShopAiPlan(
    { intent: "recommend", vehicle: { make: "BMW", model: "M5" } },
    "Порівняй найкращі вихлопи",
    { locale: "ua", currency: "EUR" }
  );

  assert.equal(plan.intent, "compare");
});

test("planner keeps a verified Stock chassis instead of an AI typo", () => {
  const plan = normalizeShopAiPlan(
    {
      category: "exhaust",
      needsClarification: true,
      clarification: "G9O is not a standard M5 chassis.",
      vehicle: { make: "BMW", model: "M5", chassis: "G9O" },
    },
    "BMW m5 g9O",
    { ...context, make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.vehicle.chassis, "G90");
  assert.equal(plan.needsClarification, true);
  assert.ok(plan.requiredDetails?.includes("opfGpf"));
});

test("planner normalizes a letter O typo in a chassis code", () => {
  const plan = normalizeShopAiPlan(
    { vehicle: { make: "BMW", model: "M5", chassis: "g9O" } },
    "BMW M5 g9O",
    context
  );

  assert.equal(plan.vehicle.chassis, "G90");
});

test("planner never returns an English clarification for Ukrainian context", () => {
  const plan = normalizeShopAiPlan(
    {
      category: "exhaust",
      needsClarification: true,
      clarification: "Please confirm the exact vehicle model.",
      vehicle: {},
    },
    "Підбери вихлоп",
    context
  );

  assert.equal(plan.needsClarification, true);
  assert.match(plan.clarification ?? "", /[А-ЯІЇЄҐа-яіїєґ]/);
  assert.doesNotMatch(plan.clarification ?? "", /Please confirm/i);
});

test("planner keeps the active Stock category when a follow-up omits it", () => {
  const plan = normalizeShopAiPlan(
    { vehicle: { make: "BMW", model: "M5", chassis: "G90" } },
    "BMW m5 g9O",
    { ...context, category: "exhaust", make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.category, "exhaust");
});

test("planner treats a requested horsepower gain as chip tuning", () => {
  const plan = normalizeShopAiPlan(
    { category: "exhaust", vehicle: { make: "BMW", model: "M5", chassis: "G90" } },
    "BMW M5 G90 + 200 сил хочу",
    { ...context, category: "exhaust", make: "BMW", model: "M5", chassis: "G90" }
  );

  assert.equal(plan.category, "chipTuning");
  assert.equal(plan.powerGainHp, 200);
  assert.equal(plan.vehicle.chassis, "G90");
});

test("fallback planner normalizes a chassis typo from the message itself", () => {
  const plan = buildFallbackShopAiPlan("BMW M5 G9O +100 сил", context);

  assert.equal(plan.vehicle.make, "BMW");
  assert.equal(plan.vehicle.model, "M5");
  assert.equal(plan.vehicle.chassis, "G90");
  assert.equal(plan.powerGainHp, 100);
});

test("planner requests OPF details for an exhaust without inventing a configuration", () => {
  const plan = buildFallbackShopAiPlan("Exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.category, "exhaust");
  assert.equal(plan.opfGpf, null);
  assert.ok(plan.requiredDetails?.includes("opfGpf"));
});

test("planner recognizes an explicit NON-OPF configuration", () => {
  const plan = buildFallbackShopAiPlan("NON OPF exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.opfGpf, "without");
  assert.equal(plan.requiredDetails?.includes("opfGpf"), false);
});

test("planner recognizes Ukrainian без OPF without relying on ASCII word boundaries", () => {
  const plan = buildFallbackShopAiPlan("вихлоп на BMW M3 2018 без OPF", context);

  assert.equal(plan.opfGpf, "without");
  assert.equal(plan.requiredDetails?.includes("opfGpf"), false);
});

test("planner requests engine evidence for chip tuning", () => {
  const plan = buildFallbackShopAiPlan("RaceChip for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.category, "chipTuning");
  assert.ok(plan.requiredDetails?.includes("engine"));
});

test("fallback planner extracts a structured engine code", () => {
  const plan = buildFallbackShopAiPlan("RaceChip S68 for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.vehicle.engine, "S68");
  assert.equal(plan.requiredDetails?.includes("engine"), false);
});

test("generic exhaust intent targets a complete system", () => {
  const plan = buildFallbackShopAiPlan("Exhaust for BMW M5 G90", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.productKind, "system");
});

test("planner keeps a preferred brand soft unless the user says only", () => {
  const preferred = buildFallbackShopAiPlan("Show me Akrapovic exhaust for BMW M3 F80", {
    locale: "en",
    currency: "EUR",
  });
  const exclusive = buildFallbackShopAiPlan("Show only Akrapovic exhaust for BMW M3 F80", {
    locale: "en",
    currency: "EUR",
  });

  assert.equal(preferred.brand, "Akrapovic");
  assert.equal(preferred.brandOnly, false);
  assert.equal(exclusive.brand, "Akrapovic");
  assert.equal(exclusive.brandOnly, true);
});

test("planner recognizes an explicit in-stock constraint", () => {
  const plan = buildFallbackShopAiPlan("BMW M3 F80 exhaust, only in stock", {
    locale: "en",
    currency: "EUR",
  });

  assert.equal(plan.stockOnly, true);
});

test("downpipe intent remains distinct from a complete exhaust", () => {
  const plan = buildFallbackShopAiPlan("Downpipe for BMW M3 G80", {
    locale: "en",
    currency: "EUR",
  });
  assert.equal(plan.productKind, "downpipe");
});
