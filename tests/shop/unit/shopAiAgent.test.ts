import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { registerHooks } from "./testHooks.mjs";

import {
  buildOneAiCatalogHref,
  buildOneAiSearchAttempts,
  buildOneAiSearchParams,
  cleanOneAiSearchArgs,
  describeOneAiProductForModel,
  needsOneAiVehicle,
  registerOneAiProduct,
  resolveOneAiAvailability,
  resolveOneAiBrand,
  titleMentionsChassis,
} from "../../../src/lib/shopAiAgent/catalogQuery";
import {
  buildOneAiCards,
  cleanOneAiReplies,
  stripOneAiRefs,
} from "../../../src/lib/shopAiAgent/presentation";
import type { OneAiConversationState, OneAiProduct } from "../../../src/lib/shopAiAgent/types";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const runTurnModule = import("../../../src/lib/shopAiAgent/runTurn");

function product(ref: string, overrides: Partial<OneAiProduct> = {}): OneAiProduct {
  return {
    ref,
    id: `id-${ref}`,
    slug: `slug-${ref}`,
    href: `/ua/shop/slug-${ref}`,
    brand: "AKRAPOVIC",
    name: `Product ${ref}`,
    sku: `SKU-${ref}`,
    image: null,
    priceSet: { eur: 1000, usd: 1150, uah: 50000 },
    compareAtSet: null,
    availability: "onOrder",
    category: "Вихлоп",
    summary: "Titanium slip-on",
    ...overrides,
  };
}

function state(products: OneAiProduct[]): OneAiConversationState {
  return {
    kind: "one-ai-agent",
    version: 1,
    history: [],
    products: Object.fromEntries(products.map((item) => [item.ref, item])),
    nextRef: products.length + 1,
    lastCatalogHref: null,
  };
}

test("brand names resolve to the catalog spelling", () => {
  assert.equal(resolveOneAiBrand("Akrapovič"), "AKRAPOVIC");
  assert.equal(resolveOneAiBrand("акрапович"), "AKRAPOVIC");
  assert.equal(resolveOneAiBrand("Öhlins"), "OHLINS");
  assert.equal(resolveOneAiBrand("JB4"), "Burger Motorsports");
  assert.equal(resolveOneAiBrand("KW"), "KW Suspensions");
  assert.equal(resolveOneAiBrand("iPE"), "iPE exhaust");
  assert.equal(resolveOneAiBrand("Capristo"), "Capristo");
  assert.equal(resolveOneAiBrand("  "), null);
});

test("model arguments are cleaned before they reach the catalog", () => {
  const args = cleanOneAiSearchArgs({
    query: "<b>exhaust</b>",
    category: "rockets",
    min_price: 9000,
    max_price: 3000,
    year: 1700,
    limit: 99,
    brand: "Akrapovič",
    vehicle_type: "boat",
  });
  assert.equal(args.query, "exhaust");
  assert.equal(args.category, undefined);
  assert.equal(args.min_price, 3000);
  assert.equal(args.max_price, 9000);
  assert.equal(args.year, undefined);
  assert.equal(args.limit, 12);
  assert.equal(args.brand, "AKRAPOVIC");
  assert.equal(args.vehicle_type, undefined);
  assert.equal(args.sort, "relevance");
  assert.equal(cleanOneAiSearchArgs({ category: "exhaust" }).category, "exhaust");
});

test("the make is filled in for models customers type without it", () => {
  assert.equal(cleanOneAiSearchArgs({ model: "Golf", chassis: "MK8" }).make, "Volkswagen");
  assert.equal(cleanOneAiSearchArgs({ model: "Urus" }).make, "Lamborghini");
  assert.equal(cleanOneAiSearchArgs({ model: "S 1000 RR" }).make, "BMW");
  assert.equal(cleanOneAiSearchArgs({ model: "G-Class" }).make, "Mercedes-Benz");
  assert.equal(cleanOneAiSearchArgs({ make: "Audi", model: "Golf" }).make, "Audi");
  assert.equal(cleanOneAiSearchArgs({ model: "Unknown X" }).make, undefined);
  assert.equal(
    buildOneAiSearchParams(cleanOneAiSearchArgs({ model: "Golf" }), {
      locale: "ua",
      currency: "EUR",
    }).get("allowFallback"),
    "0"
  );
});

test("fitment parts are never searched without a vehicle", () => {
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ category: "exhaust" })), true);
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ query: "вихлоп" })), true);
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ query: "exhaust M3 G80" })), false);
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ query: "Urus exhaust" })), false);
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ query: "S-BM/TI/33H" })), false);
  assert.equal(
    needsOneAiVehicle(cleanOneAiSearchArgs({ category: "exhaust", brand: "Akrapovič" })),
    false
  );
  assert.equal(
    needsOneAiVehicle(cleanOneAiSearchArgs({ category: "exhaust", engine: "B58" })),
    false
  );
  assert.equal(needsOneAiVehicle(cleanOneAiSearchArgs({ category: "merch" })), false);
});

test("a title confirms the generation only when it names it", () => {
  assert.equal(
    titleMentionsChassis("BMC FB798-20 air filter for Porsche 911 (991/991.2)", "992"),
    false
  );
  assert.equal(
    titleMentionsChassis("BMC FB01075 air filter for Porsche 911 (992/992.2)", "992"),
    true
  );
  assert.equal(titleMentionsChassis("AKRAPOVIC S-BM/TI/33H для BMW M3 (G80 / G81)", "g80"), true);
  assert.equal(titleMentionsChassis("Anything", undefined), true);
});

test("search relaxes generation, then vehicle text, then brand", () => {
  const attempts = buildOneAiSearchAttempts(
    cleanOneAiSearchArgs({
      make: "BMW",
      model: "M3",
      chassis: "G80",
      brand: "Eventuri",
      query: "intake",
    })
  );
  assert.equal(attempts.length, 4);
  assert.equal(attempts[0].relaxed, null);
  assert.equal(attempts[1].args.chassis, undefined);
  assert.equal(attempts[1].args.model, "M3");
  assert.equal(attempts[2].args.make, undefined);
  assert.equal(attempts[2].args.query, "intake BMW M3 G80");
  assert.equal(attempts[3].args.brand, undefined);
  assert.equal(attempts[3].args.chassis, "G80");
  for (const attempt of attempts.slice(1)) assert.ok(attempt.relaxed);

  assert.equal(buildOneAiSearchAttempts(cleanOneAiSearchArgs({ query: "S-BM/TI/33H" })).length, 1);
});

test("extra words are dropped first when the category already says what is wanted", () => {
  const attempts = buildOneAiSearchAttempts(
    cleanOneAiSearchArgs({
      make: "Ford",
      model: "Mustang",
      category: "exhaust",
      query: "GT 5.0 loud",
    })
  );
  assert.equal(attempts[1].args.query, undefined);
  assert.equal(attempts[1].args.category, "exhaust");
  assert.equal(attempts[1].args.model, "Mustang");
  assert.match(attempts[1].relaxed ?? "", /GT 5\.0 loud/);
});

test("cards and replies accept the list under the names models tend to use", () => {
  const conversation = state([product("p1"), product("p2")]);
  const byProducts = buildOneAiCards({ products: [{ ref: "p2", reason: "x" }] }, conversation);
  assert.ok(byProducts.ok && byProducts.cards[0].ref === "p2");
  const byBareRefs = buildOneAiCards({ refs: ["p1", "p2"] }, conversation);
  assert.ok(byBareRefs.ok && byBareRefs.cards.length === 2);
  assert.deepEqual(cleanOneAiReplies({ replies: ["A", "B"] }), ["A", "B"]);
});

test("search params mirror the catalog API", () => {
  const params = buildOneAiSearchParams(
    cleanOneAiSearchArgs({
      make: "Ducati",
      model: "Panigale",
      vehicle_type: "motorcycle",
      in_stock_only: true,
      sort: "price_asc",
      max_price: 2000,
    }),
    { locale: "ua", currency: "EUR" }
  );
  assert.equal(params.get("scope"), "moto");
  assert.equal(params.get("stock"), "inStock");
  assert.equal(params.get("sort"), "price_asc");
  assert.equal(params.get("maxPrice"), "2000");
  assert.equal(params.get("currency"), "EUR");
  assert.equal(params.get("limit"), "8");

  const href = buildOneAiCatalogHref(cleanOneAiSearchArgs({ make: "BMW", model: "M3" }), {
    locale: "en",
    currency: "USD",
  });
  assert.equal(href, "/en/shop/catalog?make=BMW&model=M3");
});

test("refs stay stable for the same product across searches", () => {
  const conversation = state([]);
  const first = registerOneAiProduct(conversation, "a", (ref) => product(ref, { id: "a" }));
  const second = registerOneAiProduct(conversation, "b", (ref) => product(ref, { id: "b" }));
  const again = registerOneAiProduct(conversation, "a", (ref) =>
    product(ref, { id: "a", name: "Renamed" })
  );
  assert.equal(first.ref, "p1");
  assert.equal(second.ref, "p2");
  assert.equal(again.ref, "p1");
  assert.equal(conversation.products.p1.name, "Renamed");
  assert.equal(conversation.nextRef, 3);
});

test("availability keeps transit separate from supplier orders", () => {
  assert.equal(resolveOneAiAvailability({ inStock: true, availability: null }), "inStock");
  assert.equal(
    resolveOneAiAvailability({ inStock: false, availability: "inTransit" }),
    "inTransit"
  );
  assert.equal(resolveOneAiAvailability({ inStock: false, availability: null }), "onOrder");
});

test("the model sees prices in the customer's currency", () => {
  const view = describeOneAiProductForModel(
    product("p1", { compareAtSet: { eur: 1200, usd: 1380, uah: 60000 } }),
    { locale: "en", currency: "USD" }
  );
  assert.match(view.price, /1,150/);
  assert.match(view.old_price ?? "", /1,380/);
  assert.equal(view.availability, "on order from the supplier");
  const noPrice = describeOneAiProductForModel(product("p2", { priceSet: null }), {
    locale: "ua",
    currency: "EUR",
  });
  assert.equal(noPrice.price, "price on request");
});

test("cards accept only products the conversation has seen", () => {
  const conversation = state([product("p1"), product("p2"), product("p3")]);
  const result = buildOneAiCards(
    {
      layout: "compare",
      items: [
        { ref: "p1", reason: "Найгучніший" },
        { ref: "p9", reason: "invented" },
        { ref: "p1", reason: "duplicate" },
        { ref: "p3", reason: "<b>Дешевший</b>" },
      ],
      rows: [
        { label: "Матеріал", values: ["Титан", "?", "Титан", "Сталь"] },
        { label: "", values: ["x"] },
      ],
    },
    conversation
  );
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(
    result.cards.map((card) => card.ref),
    ["p1", "p3"]
  );
  assert.equal(result.cards[1].reason, "Дешевший");
  assert.equal(result.layout, "compare");
  assert.deepEqual(result.comparison?.rows, [{ label: "Матеріал", values: ["Титан", "Сталь"] }]);
  assert.equal("summary" in result.cards[0], false);

  const single = buildOneAiCards({ layout: "compare", items: [{ ref: "p2" }] }, conversation);
  assert.ok(single.ok && single.layout === "cards" && single.comparison === null);
  assert.equal(buildOneAiCards({ items: [{ ref: "nope" }] }, conversation).ok, false);
});

test("quick replies are trimmed, unique and at most four", () => {
  assert.deepEqual(
    cleanOneAiReplies({ options: [" Дешевше ", "Дешевше", "", "A", "B", "C", "D"] }),
    ["Дешевше", "A", "B", "C"]
  );
  assert.deepEqual(cleanOneAiReplies({}), []);
  assert.deepEqual(cleanOneAiReplies({ options: ["Порівняй p3 та p4", "Порівняй do88 і CSF"] }), [
    "Порівняй do88 і CSF",
  ]);
});

test("history replays shown cards as a marker line", async () => {
  const { buildOneAiHistoryContents } = await runTurnModule;
  const conversation = state([product("p1"), product("p2")]);
  conversation.history = [
    { role: "user", text: "вихлоп на M3" },
    { role: "assistant", text: "Ось два варіанти.", shownRefs: ["p1", "p2", "p7"] },
  ];
  const contents = buildOneAiHistoryContents(conversation, { locale: "ua", currency: "EUR" });
  assert.equal(contents.length, 2);
  assert.equal(contents[1].role, "model");
  const text = contents[1].parts?.[0]?.text ?? "";
  assert.match(text, /^Ось два варіанти\./);
  assert.match(text, /⟦shown⟧ p1 AKRAPOVIC SKU-p1/);
  assert.match(text, /p2 AKRAPOVIC SKU-p2/);
  assert.doesNotMatch(text, /p7/);
});

test("One AI stays dark unless the owner switches it on", async () => {
  const { isOneAiAgentEnabled } = await import("../../../src/lib/shopAiAgent/featureFlag");
  const previous = process.env.SHOP_AI_AGENT_ENABLED;
  try {
    delete process.env.SHOP_AI_AGENT_ENABLED;
    assert.equal(isOneAiAgentEnabled(), false);
    process.env.SHOP_AI_AGENT_ENABLED = "true";
    assert.equal(isOneAiAgentEnabled(), false);
    process.env.SHOP_AI_AGENT_ENABLED = "1";
    assert.equal(isOneAiAgentEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.SHOP_AI_AGENT_ENABLED;
    else process.env.SHOP_AI_AGENT_ENABLED = previous;
  }
  const route = readFileSync("src/app/api/shop/stock/assistant/agent/route.ts", "utf8");
  assert.match(
    route,
    /if \(!isOneAiAgentEnabled\(\)\) \{\s*return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);/
  );
  // The shop-wide daily ceiling and the per-visitor limit both guard the paid model.
  assert.match(route, /keyParts: \["one-ai-agent", ownerKey\]/);
  assert.match(route, /keyParts: \["one-ai-agent-daily"\]/);
});

test("Russian is answered in Ukrainian; car names keep the conversation's language", async () => {
  const { resolveOneAiReplyLanguage, oneAiLanguageNote } = await runTurnModule;
  assert.equal(resolveOneAiReplyLanguage("что лучше на RS3 8Y?", [], "ua"), "uk");
  assert.equal(resolveOneAiReplyLanguage("I want more power on my M340i", [], "ua"), "en");
  assert.equal(resolveOneAiReplyLanguage("BMW M2 G87, 2024", ["підбери вихлоп"], "en"), "uk");
  assert.equal(
    resolveOneAiReplyLanguage("Audi RS6 C8", ["I need an intake for my car"], "ua"),
    "en"
  );
  assert.equal(resolveOneAiReplyLanguage("S-BM/TI/33H", [], "ua"), "uk");
  assert.equal(resolveOneAiReplyLanguage("S-BM/TI/33H", [], "en"), "en");
  assert.match(oneAiLanguageNote("uk"), /українською/);
});

test("internal refs never reach the customer's text", () => {
  assert.equal(
    stripOneAiRefs("Лінк-пайпи (p17) легші, даунпайп (p18, p19) гучніший; p3 — дешевший"),
    "Лінк-пайпи легші, даунпайп гучніший;  — дешевший"
  );
  assert.equal(stripOneAiRefs("McLaren P1 і p-zero"), "McLaren P1 і p-zero");
});

test("cost estimate uses list prices and discounts cached input", async () => {
  const { estimateOneAiCostUsd } = await runTurnModule;
  const cost = estimateOneAiCostUsd("gemini-3.8-flash", {
    inputTokens: 20_000,
    cachedTokens: 8_000,
    outputTokens: 600,
    thoughtTokens: 400,
  });
  // 12k fresh × 1.5 + 8k cached × 0.375 + 1k out × 7.5 (per 1M)
  assert.equal(cost, 0.0285);
});
