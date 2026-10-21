import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";
import { calculateCtCarbonPriceUsd } from "../../../src/lib/ctCarbonCatalog";
import {
  brabusSkuKey,
  compareWithCompetitor,
  competitorSkuKey,
  comparePriceWithFormula,
  compareSupplierChange,
  detectPriceWatchMassChange,
  extractJsonLdProductPrice,
  extractSenditPriceGbp,
  finishPriceWatchCheck,
  parseBrabusSitemap,
  parsePriceWatchProgress,
  pausePriceWatchProgress,
  priceWatchFindingKey,
  readSchemaAvailability,
  runPriceWatchStep,
  type PriceWatchFinding,
} from "../../../src/lib/operations/priceWatchChecks";
import {
  escapeTelegramHtml,
  formatPriceWatchMoney,
  isPriceWatchEntryReportable,
  PRICE_WATCH_MESSAGE_LIMIT,
  priceWatchItemName,
  renderPriceListReminder,
  renderPriceWatchDigest,
  ruPlural,
  type PriceWatchDigestEntry,
} from "../../../src/lib/operations/priceWatchReport";
import {
  findPriceWatchSource,
  PRICE_WATCH_SOURCES,
} from "../../../src/lib/operations/priceWatchSources";

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

const priceWatchModule = import("../../../src/lib/operations/priceWatch");
const callbacksModule = import("../../../src/lib/operations/telegramCallbacks");

const kyiv = (iso: string) => new Date(`${iso}+03:00`);

test("every brand belongs to one price source and the registry is complete", () => {
  const keys = PRICE_WATCH_SOURCES.map((source) => source.key);
  assert.equal(new Set(keys).size, keys.length);
  const brands = PRICE_WATCH_SOURCES.flatMap((source) => source.brands);
  assert.equal(new Set(brands).size, brands.length, "a brand is listed under two sources");
  for (const source of PRICE_WATCH_SOURCES) {
    if (source.kind === "formula") {
      assert.ok(source.check && source.currency && source.everyHours, `${source.key} check`);
    }
    if (source.kind === "price_list") {
      assert.ok(source.priceList, `${source.key} has a price list`);
      assert.match(source.priceList!.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(source.priceList!.everyDays >= 30);
    }
    if (source.check === "shopify-changes") assert.ok(source.shopify, `${source.key} feed`);
  }
  for (const brand of ["CT Carbon", "Brabus", "Remus", "RaceChip", "AKRAPOVIC", "Range Rover"]) {
    assert.ok(brands.includes(brand), `${brand} has a source`);
  }
});

test("our price is compared with the formula, ignoring rounding noise", () => {
  // Brabus V167-678-63 from the 21.10.2026 audit: site 7 827,82 €, brabus.com × 1,10 = 9 005,92 €.
  assert.deepEqual(comparePriceWithFormula({ ours: 7827.82, expected: 9005.92, currency: "EUR" }), {
    kind: "cheaper",
    deltaPct: 15.1,
  });
  assert.equal(comparePriceWithFormula({ ours: 2575, expected: 2580, currency: "USD" }), null);
  assert.equal(comparePriceWithFormula({ ours: 120, expected: 124, currency: "EUR" }), null);
  assert.deepEqual(comparePriceWithFormula({ ours: 1310, expected: 1125, currency: "USD" }), {
    kind: "dearer",
    deltaPct: -14.1,
  });
  assert.equal(comparePriceWithFormula({ ours: null, expected: 100, currency: "EUR" }), null);
  assert.deepEqual(compareSupplierChange({ before: 12_500, now: 13_100, currency: "UAH" }), {
    kind: "up",
    deltaPct: 4.8,
  });
  assert.equal(compareSupplierChange({ before: 12_500, now: 12_600, currency: "UAH" }), null);
});

test("a VAT switch is told apart from a real price list change", () => {
  // 21.10.2026: every CT Carbon price in the feed became exactly ×1.20.
  const vat = detectPriceWatchMassChange(Array.from({ length: 2339 }, () => 1.2));
  assert.equal(vat?.vatLike, true);
  assert.equal(vat?.ratio, 1.2);
  assert.equal(
    detectPriceWatchMassChange(Array.from({ length: 40 }, () => 1 / 1.19))?.vatLike,
    true
  );
  const raise = detectPriceWatchMassChange(
    Array.from({ length: 100 }, (_, index) => 1.05 + (index % 3) * 0.001)
  );
  assert.equal(raise?.vatLike, false);
  assert.ok(raise && Math.abs(raise.ratio - 1.05) < 0.003);
  const mixed = [...Array.from({ length: 50 }, () => 1), ...Array.from({ length: 10 }, () => 1.2)];
  assert.equal(detectPriceWatchMassChange(mixed), null);
  assert.equal(detectPriceWatchMassChange([1.2, 1.2, 1.2]), null);
});

test("finishing a check: format changes hide price findings, broken feeds become errors", () => {
  const priced = (sku: string): PriceWatchFinding => ({
    kind: "dearer",
    sku,
    title: sku,
    currency: "USD",
    ours: 120,
    expected: 100,
    deltaPct: -16.7,
  });
  const format = finishPriceWatchCheck({
    checked: 30,
    matched: 30,
    missing: 0,
    ratios: Array.from({ length: 30 }, () => 1.2),
    findings: [priced("A"), { kind: "gone", sku: "B", title: "B", currency: "USD" }],
  });
  assert.equal(format.status, "format_change");
  assert.deepEqual(
    format.findings.map((finding) => finding.kind),
    ["gone"]
  );

  const broken = finishPriceWatchCheck({
    checked: 100,
    matched: 40,
    missing: 60,
    ratios: [],
    findings: [],
  });
  assert.equal(broken.status, "error");
  assert.match(broken.summary.error ?? "", /неполный каталог/);

  // Link ECU marks the whole catalog unavailable: it sells through dealers.
  const dealersOnly = finishPriceWatchCheck({
    checked: 57,
    matched: 57,
    missing: 0,
    ratios: Array.from({ length: 57 }, () => 1),
    findings: Array.from({ length: 57 }, (_, index) => ({
      kind: "sold_out" as const,
      sku: `L${index}`,
      title: "Link",
      currency: "EUR" as const,
    })),
    summary: { soldOut: 57 },
  });
  assert.equal(dealersOnly.status, "ok");
  assert.equal(dealersOnly.summary.stockIgnored, true);
  assert.equal(dealersOnly.summary.soldOut, 0);
});

test("finding keys: the same difference stays known, a new supplier price is new", () => {
  const base: PriceWatchFinding = {
    kind: "cheaper",
    sku: "V167-678-63",
    title: "Brabus",
    currency: "EUR",
    ours: 7827.82,
    expected: 9005.92,
  };
  assert.equal(priceWatchFindingKey(base), priceWatchFindingKey({ ...base, ours: 7900 }));
  assert.notEqual(priceWatchFindingKey(base), priceWatchFindingKey({ ...base, expected: 9100 }));
  assert.equal(
    priceWatchFindingKey({
      kind: "fx",
      sku: "CT Carbon",
      title: "CT",
      currency: "USD",
      deltaPct: -3.2,
    }),
    priceWatchFindingKey({
      kind: "fx",
      sku: "CT Carbon",
      title: "CT",
      currency: "USD",
      deltaPct: -4.1,
    })
  );
});

test("supplier pages: schema.org price, Sendit regular price and the brabus.com sitemap", () => {
  const brabusPage = `<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
    <script type="application/ld+json">{"@context":"http:\\/\\/schema.org\\/","@type":"Product","name":"Frontspoiler Carbon","sku":"254-263-99","offers":{"@type":"Offer","price":4641,"priceCurrency":"EUR"}}</script>`;
  assert.deepEqual(extractJsonLdProductPrice(brabusPage), {
    price: 4641,
    currency: "EUR",
    availability: null,
    sku: "254-263-99",
    mpn: null,
  });
  assert.equal(
    extractJsonLdProductPrice("<script type='application/ld+json'>{broken</script>"),
    null
  );
  const graph = `<script type="application/ld+json">{"@graph":[{"@type":["Product"],"offers":[{"lowPrice":"99.5"}]}]}</script>`;
  assert.equal(extractJsonLdProductPrice(graph)?.price, 99.5);
  // Adrenalin Drive: their own SKU, the manufacturer part number, hryvnias and stock.
  const adrenalin = `<script type="application/ld+json">{"@type":"Product","sku":"1111-305","mpn":"D650-0010","offers":{"@type":"Offer","priceCurrency":"UAH","price":"2250.00","availability":"https://schema.org/BackOrder"}}</script>`;
  assert.deepEqual(extractJsonLdProductPrice(adrenalin), {
    price: 2250,
    currency: "UAH",
    availability: "https://schema.org/BackOrder",
    sku: "1111-305",
    mpn: "D650-0010",
  });
  assert.deepEqual(readSchemaAvailability("https://schema.org/BackOrder"), {
    available: true,
    text: "BackOrder",
  });
  assert.deepEqual(readSchemaAvailability("http://schema.org/OutOfStock"), {
    available: false,
    text: "OutOfStock",
  });
  assert.deepEqual(readSchemaAvailability(null), { available: null, text: null });
  assert.equal(competitorSkuKey("d650 0010"), competitorSkuKey("D650-0010"));

  const sendit = `"price":{"with_tax":{"formatted":"\\u00a3683.06","value":683.06,"currency":"GBP"},"without_tax":{"formatted":"\\u00a3569.22","value":569.22}}`;
  assert.equal(extractSenditPriceGbp(sendit), 683.06);
  const onSale = `${sendit.replace("683.06,", "600.00,")} "non_sale_price_with_tax":{"formatted":"\\u00a3683.06","value":683.06}`;
  assert.equal(extractSenditPriceGbp(onSale), 683.06, "the regular price, never the sale price");
  assert.equal(extractSenditPriceGbp("<html></html>"), null);

  const sitemap = `<urlset><url><loc>https://www.brabus.com/de-de/cars/supercars.html</loc></url>
    <url><loc>https://www.brabus.com/de-de/cars/tuning/auf-basis-mercedes/uebersicht/artikel/p/glc-klasse/1-x-254/amg-glc-63/254-263-99.html</loc></url>
    <url><loc>https://www.brabus.com/de-de/cars/tuning/auf-basis-mercedes/uebersicht/artikel/p/glc-klasse/1-x-254/amg-glc-43/254-263-99.html</loc></url>
    <url><loc>https://www.brabus.com/de-de/cars/tuning/artikel/p/g/M12_463A_SP.html</loc></url></urlset>`;
  const urls = parseBrabusSitemap(sitemap);
  assert.equal(urls.size, 2);
  assert.equal(
    urls.get("254-263-99")?.length,
    2,
    "an article listed under two models keeps both pages"
  );
  assert.ok(urls.get(brabusSkuKey("M12-463A-SP"))?.[0].endsWith("M12_463A_SP.html"));
});

test("a product page that redirects to the 404 page is gone, the next page of the SKU is tried", async () => {
  const def = { ...findPriceWatchSource("brabus")!, pagesPerRun: 10 };
  const dead = "https://www.brabus.com/de-de/cars/tuning/artikel/p/a/amg-a-45/r12-177-rb.html";
  const alive = "https://www.brabus.com/de-de/cars/tuning/artikel/p/a/amg-a-35/r12-177-rb.html";
  const sitemap = `<urlset>${[
    dead,
    alive,
    ...Array.from(
      { length: 120 },
      (_, index) => `https://www.brabus.com/de-de/artikel/p/x/x-${index}.html`
    ),
  ]
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join("")}</urlset>`;
  const requested: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("sitemap.xml")) return new Response(sitemap, { status: 200 });
    if (url === dead)
      return new Response(null, { status: 302, headers: { location: "/de-de/404.html" } });
    return new Response(
      `<script type="application/ld+json">{"@type":"Product","offers":{"price":1000}}</script>`,
      { status: 200 }
    );
  }) as typeof fetch;
  const product = {
    id: "b1",
    sku: "R12-177-RB",
    slug: "brabus-r12",
    titleEn: "Brabus R12",
    titleUa: "",
    priceEur: 1000,
    priceUsd: null,
    priceUah: null,
    variants: [],
    metafields: [],
  };
  const step = await runPriceWatchStep(
    def,
    {
      client: fakeCatalog([product]),
      fetchImpl,
      now: new Date(),
      deadline: Date.now() + 60_000,
      delayMs: 0,
    },
    null
  );
  assert.ok(step.done);
  const result = step.done ? step.result : null;
  assert.ok(
    !requested.some((url) => url.endsWith("404.html")),
    "the 404 page itself is never loaded"
  );
  assert.deepEqual(requested.slice(1), [dead, alive]);
  // 1 000 € on brabus.com × 1,10 = 1 100 € against our 1 000 €.
  assert.equal(result?.findings[0]?.kind, "cheaper");
  assert.equal(result?.findings[0]?.url, alive);
});

function fakeCatalog(products: unknown[]) {
  return {
    shopProduct: { findMany: async () => products },
    adminAuditLog: { findMany: async () => [], findFirst: async () => null },
    shopSettings: {
      findUnique: async () => ({
        currencyRates: { EUR: 1, USD: 1.14, UAH: 50.56, _uahReserve: 1, _rawUsdToUah: 45.03 },
      }),
    },
  } as unknown as Pick<PrismaClient, "shopProduct" | "adminAuditLog" | "shopSettings">;
}

function feedResponse(products: unknown[]) {
  return async (url: string | URL | Request) => {
    const page = Number(new URL(String(url)).searchParams.get("page"));
    return new Response(JSON.stringify({ products: page === 1 ? products : [] }), { status: 200 });
  };
}

test("CT Carbon: the feed's VAT format is detected and the bot's formula recalculated", async () => {
  const delivery = { parts: ["splitter"], medykaGbp: 285, ukraineUsd: 490, basis: "kit-list" };
  // The M5 F90 splitter V4 of 21.10.2026: £718.80 at import ($1 310), £599 now.
  const splitter = { parts: ["splitter"], medykaGbp: 65, ukraineUsd: 110, basis: "part" };
  const product = (id: number, siteGbp: number, ours: number, parcel = delivery) => ({
    id: `p${id}`,
    sku: `CTC-${id}`,
    slug: `ct-${id}`,
    titleEn: `CT Carbon BMW Kit ${id}`,
    titleUa: "",
    priceEur: null,
    priceUsd: ours,
    priceUah: null,
    variants: [
      {
        id: `v${id}`,
        sku: `CTC-${id}`,
        title: "Default",
        priceEur: null,
        priceUsd: null,
        priceUah: null,
      },
    ],
    metafields: [
      {
        key: "pricing",
        value: JSON.stringify({
          gbpUsd: 1.345,
          delivery: parcel,
          variants: [
            {
              supplierSku: `S${id}`,
              priceExVatGbp: Math.round((siteGbp / 1.2) * 100) / 100,
              sitePriceGbp: siteGbp,
              priceUsd: ours,
            },
          ],
        }),
      },
    ],
  });
  // £1 099 kit → $2 575, exactly as imported. The feed now shows prices with VAT.
  assert.equal(calculateCtCarbonPriceUsd(1099, delivery), 2575);
  assert.equal(calculateCtCarbonPriceUsd(718.8, splitter), 1310);
  const catalog = Array.from({ length: 12 }, (_, index) => product(index + 1, 1099, 2575));
  catalog.push(product(99, 718.8, 1310, splitter));
  const feed = catalog.map((entry, index) => ({
    id: Number(entry.sku.slice(4)),
    handle: `kit-${index}`,
    title: entry.titleEn,
    variants: [
      {
        id: 1000 + index,
        sku: `S${entry.sku.slice(4)}`,
        price: entry.sku === "CTC-99" ? "599.00" : "1099.00",
        compare_at_price: null,
        available: true,
      },
    ],
  }));
  const step = await runPriceWatchStep(
    findPriceWatchSource("ct-carbon")!,
    {
      client: fakeCatalog(catalog),
      fetchImpl: feedResponse(feed) as typeof fetch,
      now: new Date(),
      deadline: Date.now() + 60_000,
      delayMs: 0,
    },
    null
  );
  assert.ok(step.done);
  const result = step.done ? step.result : null;
  assert.equal(result?.summary.feedVat, "included");
  assert.equal(result?.findings.length, 1);
  assert.equal(result?.findings[0].sku, "CTC-99");
  assert.equal(result?.findings[0].kind, "dearer");
  assert.equal(result?.findings[0].expected, 1125);
});

test("Shopify change checks keep a baseline first, then report what moved", async () => {
  const def = findPriceWatchSource("girodisc")!;
  const catalog = [
    {
      id: "g1",
      sku: "D1-249",
      slug: "d1-249",
      titleEn: "GiroDisc rotor rings",
      titleUa: "",
      priceEur: null,
      priceUsd: 1241.88,
      priceUah: null,
      variants: [],
      metafields: [],
    },
  ];
  const feed = [
    {
      id: 1,
      handle: "d1-249",
      title: "D1-249",
      variants: [{ id: 11, sku: "d1-249", price: "13100.00", available: true }],
    },
  ];
  const context = {
    client: fakeCatalog(catalog),
    fetchImpl: feedResponse(feed) as typeof fetch,
    now: new Date(),
    deadline: Date.now() + 60_000,
    delayMs: 0,
  };
  const first = await runPriceWatchStep(def, context, null);
  assert.ok(first.done && first.result.status === "baseline");
  assert.deepEqual(first.done ? first.result.snapshot : null, { v11: 13100 });
  const second = await runPriceWatchStep(
    def,
    { ...context, previousSnapshot: { v11: 12500 } },
    null
  );
  assert.ok(second.done);
  const finding = second.done ? second.result.findings[0] : null;
  assert.equal(finding?.kind, "up");
  assert.equal(finding?.supplierCurrency, "UAH");
  assert.equal(finding?.ours, 1241.88);
});

test("iPE is matched by the supplier page the import kept; the first look is not news", async () => {
  const { preparePriceWatchRun } = await priceWatchModule;
  const { shopifyHandleFromUrl } = await import("../../../src/lib/operations/priceWatchChecks");
  assert.equal(
    shopifyHandleFromUrl(
      "https://ipeofficial.com/products/volkswagen-golf-r-mk7-exhaust?variant=1"
    ),
    "volkswagen-golf-r-mk7-exhaust"
  );
  assert.equal(shopifyHandleFromUrl("not a url"), null);
  const def = findPriceWatchSource("ipe")!;
  const product = (sku: string, handle: string) => ({
    id: sku,
    sku,
    slug: sku.toLowerCase(),
    titleEn: `iPE ${sku}`,
    titleUa: "",
    priceEur: null,
    priceUsd: 5900,
    priceUah: null,
    // Our variant SKUs repeat across options and differ from the supplier's.
    variants: [
      { id: `${sku}-1`, sku, title: "Valvetronic", priceEur: null, priceUsd: null, priceUah: null },
    ],
    metafields: [{ key: "official_url", value: `https://ipeofficial.com/products/${handle}` }],
  });
  const feed = [
    {
      id: 7,
      handle: "porsche-911-turbo-997-exhaust",
      title: "Porsche 911 Turbo",
      variants: [
        { id: 71, sku: "IPE-A", price: "5200.00", available: true },
        { id: 72, sku: "IPE-B", price: "6100.00", available: true },
      ],
    },
  ];
  const context = {
    client: fakeCatalog([
      product("1P996T", "porsche-911-turbo-997-exhaust"),
      product("0X-GONE", "removed-item"),
    ]),
    fetchImpl: feedResponse(feed) as typeof fetch,
    now: new Date(),
    deadline: Date.now() + 60_000,
    delayMs: 0,
  };
  const first = await runPriceWatchStep(def, context, null);
  assert.ok(first.done);
  const baseline = first.done ? first.result : null;
  assert.equal(baseline?.status, "baseline");
  assert.deepEqual(baseline?.snapshot, { v71: 5200, v72: 6100 });
  assert.deepEqual(
    baseline?.findings.map((finding) => `${finding.kind}:${finding.sku}`),
    ["gone:0X-GONE"]
  );
  const firstRun = preparePriceWatchRun({ def, result: baseline!, previous: null });
  assert.equal(firstRun.newFindings, 0, "what is missing on the first look is not news");
  const second = await runPriceWatchStep(
    def,
    { ...context, previousSnapshot: { v71: 5000, v72: 6100 } },
    null
  );
  assert.ok(second.done);
  const secondRun = preparePriceWatchRun({
    def,
    result: second.done ? second.result : baseline!,
    previous: { findings: firstRun.findings, summary: firstRun.summary },
  });
  assert.equal(secondRun.newFindings, 1);
  assert.deepEqual(
    secondRun.findings
      .filter((finding) => finding.isNew)
      .map((finding) => [finding.kind, finding.sku, finding.now]),
    [["up", "1P996T", 5200]]
  );
});

test("facts for us: supplier stock and weight, and supplier items we do not sell", async () => {
  const def = findPriceWatchSource("burger")!;
  const catalog = [
    {
      id: "b1",
      sku: "BURGER-V-11",
      slug: "jb4",
      titleEn: "JB4 for BMW",
      titleUa: "",
      priceEur: null,
      priceUsd: 815,
      priceUah: null,
      variants: [],
      metafields: [],
    },
  ];
  const feed = [
    {
      id: 1,
      handle: "jb4",
      title: "JB4",
      variants: [{ id: 11, sku: "JB4-BMW", price: "599.00", available: false, grams: 2268 }],
    },
    {
      id: 2,
      handle: "new-intake",
      title: "New intake",
      variants: [{ id: 21, price: "450.00", available: true, grams: 0 }],
    },
  ];
  const step = await runPriceWatchStep(
    def,
    {
      client: fakeCatalog(catalog),
      fetchImpl: feedResponse(feed) as typeof fetch,
      now: new Date(),
      deadline: Date.now() + 60_000,
      delayMs: 0,
    },
    null
  );
  assert.ok(step.done);
  const result = step.done ? step.result : null;
  const ours = result?.facts?.find((fact) => fact.productId === "b1");
  assert.deepEqual(
    {
      key: ours?.supplierKey,
      available: ours?.available,
      weightKg: ours?.weightKg,
      sku: ours?.sku,
    },
    { key: "v11", available: false, weightKg: 2.268, sku: "BURGER-V-11" }
  );
  const fresh = result?.facts?.find((fact) => fact.productId === null);
  assert.deepEqual(
    { key: fresh?.supplierKey, price: fresh?.price, url: fresh?.url },
    {
      key: "p2",
      price: 450,
      url: "https://burgertuning.com/products/new-intake",
    }
  );
  assert.deepEqual(
    result?.findings.map((finding) => `${finding.kind}:${finding.sku}`),
    ["sold_out:BURGER-V-11"]
  );
});

test("competitors: our hryvnia price through the price book against Atomic's", async () => {
  assert.deepEqual(compareWithCompetitor(51_560, 50_000), { deltaPct: 3.1 });
  assert.equal(compareWithCompetitor(50_100, 50_000), null, "within 200 ₴ is noise");
  assert.equal(compareWithCompetitor(49_000, 50_000), null, "cheaper than the competitor is fine");
  const def = findPriceWatchSource("competitor-atomic")!;
  const catalog = [
    {
      id: "a1",
      sku: "S-BM/T/1",
      slug: "akra",
      titleEn: "Akrapovic Slip-On",
      titleUa: "",
      brand: "AKRAPOVIC",
      priceEur: 1000,
      priceUsd: null,
      priceUah: null,
      priceSourceCurrency: "EUR",
      variants: [
        {
          id: "a1v",
          sku: "S-BM/T/1",
          title: "Default",
          priceEur: 1000,
          priceUsd: null,
          priceUah: null,
          priceSourceCurrency: "EUR",
        },
      ],
      metafields: [],
    },
  ];
  const collections: Record<string, unknown[]> = {
    akrapovic: [
      {
        id: 5,
        handle: "slip-on",
        title: "Slip-On",
        variants: [{ id: 51, sku: "s-bm/t/1", price: "50000.00", available: true }],
      },
    ],
  };
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const handle = url.pathname.split("/")[2];
    const page = Number(url.searchParams.get("page"));
    return new Response(
      JSON.stringify({
        products:
          page === 1
            ? (collections[handle] ?? [{ id: 9, handle: "x", title: "x", variants: [] }])
            : [],
      }),
      { status: 200 }
    );
  }) as typeof fetch;
  const step = await runPriceWatchStep(
    def,
    {
      client: fakeCatalog(catalog),
      fetchImpl,
      now: new Date(),
      deadline: Date.now() + 60_000,
      delayMs: 0,
    },
    null
  );
  assert.ok(step.done);
  const finding = step.done ? step.result.findings[0] : null;
  // 1 000 € × (50,56 + 1 ₴ reserve) = 51 560 ₴ against Atomic's 50 000 ₴.
  assert.deepEqual(
    { kind: finding?.kind, ours: finding?.ours, now: finding?.now, deltaPct: finding?.deltaPct },
    { kind: "competitor", ours: 51_560, now: 50_000, deltaPct: 3.1 }
  );
  assert.equal(step.done ? step.result.facts?.[0]?.currency : null, "UAH");
});

test("page checks stop at the page budget and resume from the saved progress", async () => {
  const def = { ...findPriceWatchSource("mst")!, pagesPerRun: 2 };
  const catalog = ["BW-1", "BW-2", "BW-3"].map((sku) => ({
    id: sku,
    sku,
    slug: sku.toLowerCase(),
    titleEn: sku,
    titleUa: "",
    priceEur: null,
    priceUsd: 1030,
    priceUah: null,
    variants: [],
    metafields: [
      { key: "sendit_url", value: `https://sendit.parts/${sku}` },
      { key: "sendit_inc_vat_gbp", value: "683.06" },
    ],
  }));
  const page = `"price":{"with_tax":{"formatted":"x","value":693.00,"currency":"GBP"}}`;
  const context = {
    client: fakeCatalog(catalog),
    fetchImpl: (async () => new Response(page, { status: 200 })) as typeof fetch,
    now: new Date(),
    deadline: Date.now() + 60_000,
    delayMs: 0,
  };
  const first = await runPriceWatchStep(def, context, null);
  assert.equal(first.done, false);
  const progress = first.done
    ? null
    : parsePriceWatchProgress(JSON.parse(JSON.stringify(first.progress)));
  assert.equal(progress?.offset, 2);
  const second = await runPriceWatchStep(def, context, progress);
  assert.ok(second.done);
  const result = second.done ? second.result : null;
  assert.equal(result?.checked, 3);
  // £693 × 1.10 × 1.37 = $1 044.35 → $1 045 against our $1 030.
  assert.equal(result?.findings.length, 3);
  assert.equal(result?.findings[0].expected, 1045);
});

test("one page that will not open is skipped, a site that is down stops the check", async () => {
  const def = { ...findPriceWatchSource("mst")!, pagesPerRun: 50 };
  const product = (sku: string) => ({
    id: sku,
    sku,
    slug: sku.toLowerCase(),
    titleEn: sku,
    titleUa: "",
    priceEur: null,
    priceUsd: 1045,
    priceUah: null,
    variants: [],
    metafields: [{ key: "sendit_url", value: `https://sendit.parts/${sku}` }],
  });
  const page = `"price":{"with_tax":{"formatted":"x","value":693.00,"currency":"GBP"}}`;
  const context = (broken: (url: string) => boolean, count: number) => ({
    client: fakeCatalog(Array.from({ length: count }, (_, index) => product(`BW-${index}`))),
    fetchImpl: (async (input: string | URL | Request) => {
      if (broken(String(input))) throw new TypeError("fetch failed");
      return new Response(page, { status: 200 });
    }) as typeof fetch,
    now: new Date(),
    deadline: Date.now() + 60_000,
    delayMs: 0,
    sleep: async () => {},
  });
  const flaky = await runPriceWatchStep(
    def,
    context((url) => url.endsWith("BW-1"), 3),
    null
  );
  assert.ok(flaky.done);
  assert.equal(flaky.done ? flaky.result.status : null, "ok");
  assert.equal(flaky.done ? flaky.result.summary.failedPages : null, 1);
  await assert.rejects(
    runPriceWatchStep(
      def,
      context(() => true, 10),
      null
    ),
    TypeError
  );
});

test("a week of page checks survives a site that refuses for a while", () => {
  const brabus = findPriceWatchSource("brabus")!;
  const progress = parsePriceWatchProgress({
    startedAt: "2026-10-21T08:00:00.000Z",
    offset: 560,
    checked: 560,
    matched: 540,
    missing: 12,
    noPrice: 0,
    failed: 7,
    failedInRow: 8,
    ratios: [1.1],
    findings: [{ kind: "cheaper", sku: "V167-678-63", title: "x", currency: "EUR" }],
  })!;
  const first = pausePriceWatchProgress(brabus, progress);
  assert.deepEqual(
    first && [first.offset, first.findings.length, first.failedInRow, first.pauses],
    [560, 1, 0, 1],
    "the next hourly run continues from page 560"
  );
  const second = pausePriceWatchProgress(
    brabus,
    parsePriceWatchProgress(JSON.parse(JSON.stringify(first)))
  );
  assert.equal(second?.pauses, 2);
  assert.equal(
    pausePriceWatchProgress(brabus, second),
    null,
    "the third stop in a row is an error"
  );
  assert.equal(
    pausePriceWatchProgress(findPriceWatchSource("ct-carbon")!, progress),
    null,
    "a feed is simply retried"
  );
  assert.equal(pausePriceWatchProgress(brabus, null), null);
});

function entry(partial: Partial<PriceWatchDigestEntry>): PriceWatchDigestEntry {
  return {
    key: "brabus",
    title: "Brabus",
    kind: "formula",
    site: "brabus.com (DE)",
    status: "ok",
    checked: 977,
    findingsCount: 0,
    newFindings: 0,
    findings: [],
    summary: {},
    ...partial,
  };
}

test("the digest is quiet without news and readable with it", () => {
  const now = kyiv("2026-10-22T10:00:00");
  assert.equal(
    renderPriceWatchDigest({ now, timeZone: "Europe/Kyiv", entries: [entry({})], weekly: false }),
    null
  );
  const cheaper: PriceWatchFinding = {
    kind: "cheaper",
    sku: "V167-678-63",
    title: "Brabus <Widestar>",
    url: "https://www.brabus.com/de-de/a.html",
    currency: "EUR",
    ours: 7827.82,
    expected: 9005.92,
    deltaPct: 15.1,
    isNew: true,
  };
  const gone = Array.from({ length: 30 }, (_, index) => ({
    kind: "gone" as const,
    sku: `GONE-${index}`,
    title: "x",
    currency: "EUR" as const,
    isNew: true,
  }));
  const text = renderPriceWatchDigest({
    now,
    timeZone: "Europe/Kyiv",
    weekly: false,
    entries: [
      entry({
        status: "findings",
        findingsCount: 31,
        newFindings: 31,
        findings: [cheaper, ...gone],
        summary: { counts: { cheaper: 1, gone: 30 } },
      }),
      entry({ key: "link-ecu", title: "Link ECU", checked: 57 }),
      entry({
        key: "burger",
        title: "Burger Motorsports",
        kind: "changes",
        status: "baseline",
        summary: { matched: 812 },
      }),
    ],
  });
  assert.ok(text);
  assert.match(text!, /🔴 <b>Brabus<\/b>/);
  assert.match(text!, /<a href="https:\/\/www\.brabus\.com\/de-de\/a\.html">V167-678-63<\/a>/);
  assert.match(text!, /7 827,82 € → <b>9 005,92 €<\/b> \(\+15,1 %\)/);
  assert.match(text!, /<blockquote expandable>Пропали у поставщика: 30 товаров:/);
  assert.match(text!, /🟢 В порядке: Link ECU \(57\)/);
  assert.match(text!, /🔵 Запомнил цены: Burger Motorsports \(812\)/);
  assert.ok(!text!.includes("<Widestar>"));
  assert.ok(text!.length <= PRICE_WATCH_MESSAGE_LIMIT);
});

test("a huge digest is shortened to fit Telegram, the weekly one lists price lists", () => {
  const many = Array.from({ length: 400 }, (_, index) => ({
    kind: "dearer" as const,
    sku: `SKU-${index}-${"X".repeat(30)}`,
    title: "t",
    currency: "USD" as const,
    ours: 200,
    expected: 100,
    deltaPct: -50,
    isNew: true,
  }));
  const entries = PRICE_WATCH_SOURCES.slice(0, 8).map((source) =>
    entry({
      key: source.key,
      title: source.title,
      status: "findings",
      findings: many,
      findingsCount: 400,
    })
  );
  const text = renderPriceWatchDigest({
    now: kyiv("2026-10-26T10:00:00"),
    timeZone: "Europe/Kyiv",
    entries,
    weekly: true,
    priceLists: [{ title: "Remus", nextReminderAt: "2026-08-18T00:00:00.000Z", overdue: true }],
    planned: { titles: ["RaceChip"], products: 5181 },
  });
  assert.ok(text && text.length <= PRICE_WATCH_MESSAGE_LIMIT);
  const weekly = renderPriceWatchDigest({
    now: kyiv("2026-10-26T10:00:00"),
    timeZone: "Europe/Kyiv",
    entries: [entry({ key: "link-ecu", title: "Link ECU" })],
    weekly: true,
    priceLists: [{ title: "Remus", nextReminderAt: "2026-08-18T00:00:00.000Z", overdue: true }],
    planned: { titles: ["RaceChip"], products: 5181 },
  });
  assert.match(weekly!, /обзор недели/);
  assert.match(weekly!, /Remus — пора обновить \(с 18 авг\.\)/);
  assert.match(weekly!, /⏳ Пока без автоматической проверки: RaceChip — 5 181 товар/);
});

test("reportable entries and readable names", () => {
  assert.equal(isPriceWatchEntryReportable(entry({})), false);
  assert.equal(isPriceWatchEntryReportable(entry({ status: "error" })), true);
  assert.equal(
    isPriceWatchEntryReportable(entry({ summary: { notice: "в фиде цены с НДС" } })),
    true
  );
  assert.equal(
    isPriceWatchEntryReportable(
      entry({
        status: "findings",
        findings: [{ kind: "cheaper", sku: "A", title: "A", currency: "EUR", isNew: false }],
      })
    ),
    false
  );
  assert.equal(
    priceWatchItemName({
      sku: "CTC-7866780844202",
      title: "CT Carbon BMW F90 M5 LCI (2021+) Carbon Fibre Front Splitter V4",
    }),
    "BMW F90 M5 LCI Front Splitter V4"
  );
  assert.equal(priceWatchItemName({ sku: "V167-678-63", title: "Brabus spoiler" }), "V167-678-63");
  assert.equal(escapeTelegramHtml("a<b>&c"), "a&lt;b&gt;&amp;c");
  assert.equal(ruPlural(1, "товар", "товара", "товаров"), "товар");
  assert.equal(ruPlural(3, "товар", "товара", "товаров"), "товара");
  assert.equal(ruPlural(11, "товар", "товара", "товаров"), "товаров");
  assert.equal(formatPriceWatchMoney(4820, "USD"), "$4 820");
  assert.equal(formatPriceWatchMoney(1099, "GBP"), "£1 099");
});

test("price-list reminder says how old the list is and what moved on the site", () => {
  const text = renderPriceListReminder({
    title: "iPE",
    label: "прайс iPE «апрель 2026» (USD)",
    priceListDate: new Date("2026-04-01T00:00:00Z"),
    now: kyiv("2026-10-22T10:00:00"),
    products: 111,
    formula: "цена прайса + доставка и растаможка",
    secondTime: true,
    signal: { changed: 12, site: "ipeofficial.com" },
  });
  assert.match(text, /Пора проверить прайс iPE/);
  assert.match(text, /111 товаров на сайте посчитаны по: прайс iPE «апрель 2026» \(USD\)/);
  assert.match(text, /прошло 6 месяцев/);
  assert.match(text, /ipeofficial\.com .* изменились цены у 12 товаров/);
  assert.match(text, /Напоминаю второй раз/);
});

test("checks are due by their cadence, failed ones retry after 3 hours", async () => {
  const { isPriceWatchDue, initialPriceListDates } = await priceWatchModule;
  const brabus = findPriceWatchSource("brabus")!;
  const now = new Date("2026-10-22T10:00:00Z");
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  assert.equal(
    isPriceWatchDue(brabus, { state: null, lastFinishedAt: null, lastStatus: null }, now),
    true
  );
  assert.equal(
    isPriceWatchDue(brabus, { state: null, lastFinishedAt: hoursAgo(24), lastStatus: "ok" }, now),
    false
  );
  assert.equal(
    isPriceWatchDue(brabus, { state: null, lastFinishedAt: hoursAgo(168), lastStatus: "ok" }, now),
    true
  );
  assert.equal(
    isPriceWatchDue(brabus, { state: null, lastFinishedAt: hoursAgo(3), lastStatus: "error" }, now),
    true
  );
  assert.equal(
    isPriceWatchDue(
      brabus,
      { state: { offset: 70 }, lastFinishedAt: hoursAgo(1), lastStatus: "ok" },
      now
    ),
    true
  );
  assert.equal(
    isPriceWatchDue(
      findPriceWatchSource("remus")!,
      { state: null, lastFinishedAt: null, lastStatus: null },
      now
    ),
    false
  );
  const remus = initialPriceListDates(findPriceWatchSource("remus")!);
  assert.equal(remus.nextReminderAt?.toISOString(), "2026-08-18T00:00:00.000Z");
});

test("the VAT switch of a feed is reported once, findings get new flags", async () => {
  const { preparePriceWatchRun } = await priceWatchModule;
  const def = findPriceWatchSource("ct-carbon")!;
  const finding: PriceWatchFinding = {
    kind: "dearer",
    sku: "CTC-1",
    title: "x",
    currency: "USD",
    ours: 1310,
    expected: 1125,
  };
  const result = {
    status: "findings" as const,
    checked: 1,
    findings: [finding],
    summary: { feedVat: "included" as const, counts: { dearer: 1 } },
  };
  const first = preparePriceWatchRun({ def, result, previous: null });
  assert.equal(first.status, "format_change");
  assert.match(first.summary.notice ?? "", /с НДС/);
  assert.equal(first.newFindings, 1);
  const second = preparePriceWatchRun({
    def,
    result,
    previous: { findings: first.findings, summary: first.summary },
  });
  assert.equal(second.status, "findings");
  assert.equal(second.summary.notice, undefined);
  assert.equal(second.newFindings, 0);
});

test("owners get the 10:00 digest only with news, reminders twice at most", async () => {
  const { enqueuePriceWatchNotifications } = await priceWatchModule;
  const jobs: Array<{ idempotencyKey: string; payload: Record<string, unknown>; createdAt: Date }> =
    [];
  let news = 0;
  let clock = new Date();
  const client = {
    opsJob: {
      findFirst: async () => null,
      findMany: async ({ where }: { where: { idempotencyKey: { startsWith: string } } }) =>
        jobs
          .filter((job) => job.idempotencyKey.startsWith(where.idempotencyKey.startsWith))
          .map((job) => ({ createdAt: job.createdAt }))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      createMany: async ({
        data,
      }: {
        data: Array<{ idempotencyKey: string; payload: Record<string, unknown> }>;
      }) => {
        const fresh = data.filter(
          (row) => !jobs.some((job) => job.idempotencyKey === row.idempotencyKey)
        );
        jobs.push(...fresh.map((row) => ({ ...row, createdAt: clock })));
        return { count: fresh.length };
      },
    },
    opsPriceWatchRun: { count: async () => news },
    opsPriceWatchSource: {
      findMany: async () => [
        { id: "src-remus-000001", key: "remus", nextReminderAt: new Date("2026-08-18T00:00:00Z") },
      ],
    },
  } as unknown as PrismaClient;
  const member = {
    adminUserId: "owner-000000001",
    telegramUserId: BigInt(478891619),
    timezone: "Europe/Kyiv",
    roles: [{ role: { key: "owner", permissions: ["*"] } }],
  };
  const lastLoginAt = kyiv("2026-10-20T12:00:00");
  // Kyiv moves to UTC+2 on 25.10.2026.
  const at = (iso: string) => {
    clock = new Date(`${iso}${iso >= "2026-10-25" ? "+02:00" : "+03:00"}`);
    return clock;
  };
  // Wednesday 09:30 — not the hour.
  let queued = await enqueuePriceWatchNotifications({
    client,
    now: at("2026-10-21T09:30:00"),
    member,
    lastLoginAt,
  });
  assert.deepEqual(queued, { digests: 0, reminders: 0 });
  // Wednesday 10:15, nothing new: no digest, but the overdue Remus reminder.
  queued = await enqueuePriceWatchNotifications({
    client,
    now: at("2026-10-21T10:15:00"),
    member,
    lastLoginAt,
  });
  assert.deepEqual(queued, { digests: 0, reminders: 1 });
  assert.equal(jobs[0].payload.reportPeriod, "price_list_reminder");
  // Next day there is news: the digest, and no second reminder yet.
  news = 2;
  queued = await enqueuePriceWatchNotifications({
    client,
    now: at("2026-10-22T10:15:00"),
    member,
    lastLoginAt,
  });
  assert.deepEqual(queued, { digests: 1, reminders: 0 });
  assert.equal(jobs.at(-1)?.payload.reportPeriod, "price_watch");
  // A week after the first reminder comes the second and last one.
  queued = await enqueuePriceWatchNotifications({
    client,
    now: at("2026-10-28T10:15:00"),
    member,
    lastLoginAt,
  });
  assert.equal(queued.reminders, 1);
  assert.equal(jobs.at(-1)?.payload.round, 1);
  queued = await enqueuePriceWatchNotifications({
    client,
    now: at("2026-11-05T10:15:00"),
    member,
    lastLoginAt,
  });
  assert.equal(queued.reminders, 0);
  // Not an owner: nothing.
  queued = await enqueuePriceWatchNotifications({
    client,
    now: kyiv("2026-10-22T10:15:00"),
    member: {
      ...member,
      roles: [{ role: { key: "task_member", permissions: ["ops.tasks.read"] } }],
    },
    lastLoginAt,
  });
  assert.deepEqual(queued, { digests: 0, reminders: 0 });
});

test("price buttons are valid callback actions bound to price sources", async () => {
  const { OPS_TELEGRAM_CALLBACK_ACTIONS, createOpsTelegramCallbackState } = await callbacksModule;
  for (const action of ["price_ack", "price_snooze", "price_list_task", "price_digest_task"]) {
    assert.ok((OPS_TELEGRAM_CALLBACK_ACTIONS as readonly string[]).includes(action), action);
  }
  const created: Array<{ resourceType: string }> = [];
  const client = {
    opsIdempotencyRecord: {
      create: async ({ data }: { data: { resourceType: string } }) => {
        created.push(data);
        return data;
      },
    },
  } as unknown as PrismaClient;
  const data = await createOpsTelegramCallbackState({
    client,
    action: "price_ack",
    resourceId: "src-remus-000001",
    actorAdminUserId: "owner-000000001",
    secret: "test-secret",
  });
  assert.match(String(data), /^op2:/);
  assert.equal(created[0].resourceType, "ops.price_source");
  await createOpsTelegramCallbackState({
    client,
    action: "price_digest_task",
    resourceId: "job-000000000001",
    actorAdminUserId: "owner-000000001",
    secret: "test-secret",
  });
  assert.equal(created[1].resourceType, "ops.job");
});
