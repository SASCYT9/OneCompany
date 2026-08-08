import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.SHOP_E2E_BASE_URL || "http://localhost:3000";

const strictQuery =
  "scope=auto&category=exhaust&make=BMW&model=M3&chassis=F80&year=2018" +
  "&engine=S55&opfGpf=without&productKind=system&strict=1";

function mockedAssistantProduct(input: {
  id: string;
  brand: string;
  status: "exact" | "requires_verification";
  missingFacts?: string[];
}) {
  return {
    id: input.id,
    name: `${input.brand} ${input.id}`,
    brand: input.brand,
    partNumber: `SKU-${input.id}`,
    description: "Reviewed fixture",
    category: "Exhaust",
    thumbnail: null,
    inStock: true,
    price: 1_000,
    priceSet: { eur: 1_000, usd: 1_100, uah: 45_000 },
    originalPrice: null,
    originalPriceSet: null,
    slug: input.id,
    href: `/en/shop/product/${input.id}`,
    variantId: null,
    turn14Id: "",
    matchStatus: input.status,
    matchBasis: "fitment",
    compatibility: input.status === "exact" ? "confirmed" : "needs_review",
    missingFacts: input.missingFacts ?? [],
    facts: {
      material: "titanium",
      materialVerified: input.status === "exact",
      productKind: "system",
      productKindVerified: input.status === "exact",
    },
  };
}

function mockedTieredAssistantResponse() {
  const products = [
    mockedAssistantProduct({ id: "exact-one", brand: "Akrapovic", status: "exact" }),
    mockedAssistantProduct({ id: "exact-two", brand: "Milltek", status: "exact" }),
    mockedAssistantProduct({
      id: "review-one",
      brand: "Remus",
      status: "requires_verification",
      missingFacts: ["engine"],
    }),
  ];
  return {
    conversationId: "conversation-e2e",
    runId: "run-e2e",
    mode: "results",
    answer: "Each card shows its own fitment status.",
    message: "Each card shows its own fitment status.",
    counts: { exact: 2, requiresVerification: 1 },
    products,
    totalItems: 3,
    plan: {
      intent: "recommend",
      goal: "sound",
      vehicle: {
        type: "car",
        make: "BMW",
        model: "M3",
        chassis: "F80",
        year: 2018,
        engine: "S55",
      },
      category: "exhaust",
      searchQuery: "BMW M3 F80 exhaust",
      minPrice: null,
      maxPrice: null,
      stockOnly: false,
      needsClarification: false,
      clarification: null,
    },
    followUps: [],
    searchHref: "/en/shop/catalog?category=exhaust&make=BMW&model=M3&chassis=F80",
    catalogHref: "/en/shop/catalog?category=exhaust&make=BMW&model=M3&chassis=F80",
    managerHref: "/en/contact?source=one-ai",
    managerContext: {
      createdAt: Date.now(),
      runId: "run-e2e",
      conversationId: "conversation-e2e",
      vehicleType: "auto",
      vehicle: "BMW M3 F80",
      request: "Find exhaust for BMW M3 F80",
      products: products.map((product) => ({
        productId: product.id,
        variantId: product.variantId,
        brand: product.brand,
        sku: product.partNumber,
        name: product.name,
        matchStatus: product.matchStatus,
        missingFacts: product.missingFacts,
      })),
    },
    degraded: false,
    pipeline: "v2",
  };
}

async function openBrowser(t: TestContext) {
  if (process.env.SHOP_BROWSER_E2E !== "1") {
    t.skip("Set SHOP_BROWSER_E2E=1 to run One AI V2 browser smoke");
    return null;
  }

  const probe = await fetch(`${baseUrl}/ua/shop/catalog?${strictQuery}`).catch(() => null);
  if (!probe?.ok) {
    t.skip(`Shop base URL is not reachable at ${baseUrl}`);
    return null;
  }

  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    t.skip(`Playwright browser is not available: ${(error as Error).message}`);
    return null;
  }
}

async function withPage(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = {}
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  return { context, page: await context.newPage() };
}

test("One AI V2 groups exact and reviewable products and hands reviewable context to a manager", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const events: Array<Record<string, unknown>> = [];
  await page.route("**/api/shop/stock/assistant", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockedTieredAssistantResponse()),
    });
  });
  await page.route("**/api/shop/stock/assistant/events", async (route) => {
    events.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"accepted":true}',
    });
  });

  await page.goto(`${baseUrl}/en/shop/catalog`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("stock-ai-launcher").click();
  const panel = page.getByTestId("stock-ai-panel");
  const textbox = panel.getByRole("textbox", { name: "Message for One AI", exact: true });
  await textbox.fill("Find exhaust for BMW M3 F80");
  await textbox.press("Enter");

  const exactGroup = panel.getByRole("region", { name: "Confirmed for your vehicle" });
  const reviewGroup = panel.getByRole("region", { name: "Requires verification" });
  await assert.doesNotReject(() => exactGroup.waitFor());
  await assert.doesNotReject(() => reviewGroup.waitFor());
  assert.equal(await exactGroup.getByText("Exact fitment", { exact: true }).count(), 2);
  assert.equal(
    await reviewGroup.getByText("Fitment requires verification", { exact: true }).count(),
    1
  );
  await assert.doesNotReject(() =>
    panel.getByRole("region", { name: "Comparison" }).getByText("Titanium").first().waitFor()
  );
  await assert.doesNotReject(() =>
    reviewGroup.getByRole("link", { name: "Details", exact: true }).waitFor()
  );

  await reviewGroup.getByRole("link", { name: "Verify with a manager", exact: true }).click();
  await page.waitForURL(/\/en\/contact\?source=one-ai/);
  await page.waitForTimeout(50);
  assert.equal(
    events.some((event) => event.event === "manager_handoff"),
    true
  );
  const handoff = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("onecompany:one-ai-manager-handoff") || "null")
  );
  assert.equal(handoff?.selectedProduct?.productId, "review-one");
  assert.equal(handoff?.selectedProduct?.matchStatus, "requires_verification");
  assert.deepEqual(handoff?.selectedProduct?.missingFacts, ["engine"]);
  const managerRequest = await page.locator('textarea[name="wishes"]').inputValue();
  assert.match(managerRequest, /runId=run-e2e/);
  assert.match(managerRequest, /conversationId=conversation-e2e/);
  assert.match(managerRequest, /productId=review-one/);
  assert.match(managerRequest, /status=requires_verification/);
  assert.match(managerRequest, /missingFacts=engine/);
});

test("One AI V2 distinguishes technical degradation and exposes retry", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 390, height: 844 } });
  t.after(() => context.close());
  let requestCount = 0;
  await page.route("**/api/shop/stock/assistant", async (route) => {
    requestCount += 1;
    const response = mockedTieredAssistantResponse();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...response,
        mode: "no_match",
        answer: "Selection is temporarily limited.",
        message: "Selection is temporarily limited.",
        counts: { exact: 0, requiresVerification: 0 },
        products: [],
        totalItems: 0,
        searchHref: null,
        catalogHref: null,
        degraded: true,
        degradedReason: "retrieval",
      }),
    });
  });

  await page.goto(`${baseUrl}/en/shop/catalog`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("stock-ai-launcher").click();
  const panel = page.getByTestId("stock-ai-panel");
  const textbox = panel.getByRole("textbox", { name: "Message for One AI", exact: true });
  await textbox.fill("Find exhaust for BMW M3 F80");
  await textbox.press("Enter");

  await panel.getByText("Technical limitation", { exact: true }).waitFor();
  const retryRequest = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/api/shop/stock/assistant")
  );
  await panel.getByRole("button", { name: "Try again", exact: true }).click();
  await retryRequest;
  assert.equal(requestCount, 2);
});

test("One AI V2 keeps strict UA context editable and restores focus", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());

  await page.goto(`${baseUrl}/ua/shop/catalog?${strictQuery}`, {
    waitUntil: "domcontentloaded",
  });

  await assert.doesNotReject(() =>
    page.getByRole("button", { name: "Двигун: S55", exact: true }).waitFor()
  );
  await assert.doesNotReject(() =>
    page.getByRole("button", { name: "Без OPF/GPF", exact: true }).waitFor()
  );
  await assert.doesNotReject(() =>
    page.getByRole("button", { name: "Тип: повна вихлопна система", exact: true }).waitFor()
  );

  const launcher = page.getByTestId("stock-ai-launcher");
  await launcher.click();
  const panel = page.getByTestId("stock-ai-panel");
  await assert.doesNotReject(() => panel.waitFor());

  const engineChip = panel.getByRole("button", {
    name: "Прибрати контекст: Двигун: S55",
    exact: true,
  });
  await engineChip.click();
  await assert.doesNotReject(() => engineChip.waitFor({ state: "detached" }));
  await page.waitForTimeout(250);
  await assert.doesNotReject(() =>
    panel.getByRole("button", { name: "Прибрати контекст: F80", exact: true }).waitFor()
  );

  await panel.getByRole("textbox").press("Escape");
  await assert.doesNotReject(() => panel.waitFor({ state: "detached" }));
  assert.equal(await launcher.evaluate((element) => element === document.activeElement), true);
});

test("One AI V2 is a mobile bottom-sheet and keeps the mobile navigation available", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, {
    viewport: { width: 390, height: 844 },
  });
  t.after(() => context.close());

  await page.goto(`${baseUrl}/ua/shop/catalog?${strictQuery}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("stock-ai-launcher").click();

  const panel = page.getByTestId("stock-ai-panel");
  await page.waitForTimeout(450);
  const box = await panel.boundingBox();
  assert.ok(box, "One AI panel should be visible");
  assert.equal(Math.round(box.x), 0);
  assert.equal(Math.round(box.x + box.width), 390);
  assert.equal(Math.round(box.y + box.height), 844);
  assert.equal(
    await panel.evaluate((element) => getComputedStyle(element).borderRadius),
    "8px 8px 0px 0px"
  );

  await panel.getByRole("button", { name: "Закрити", exact: true }).click();
  const mobileNavigation = page.getByRole("navigation", {
    name: "Основна мобільна навігація",
    exact: true,
  });
  await assert.doesNotReject(() => mobileNavigation.waitFor());
  await assert.doesNotReject(() =>
    mobileNavigation.getByRole("link", { name: "Магазин", exact: true }).waitFor()
  );
});

test("One AI V2 renders localized EN controls and follows the active theme", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());

  await page.goto(`${baseUrl}/en/shop/catalog?${strictQuery}`, {
    waitUntil: "domcontentloaded",
  });

  const initialTheme = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.body).color,
  }));
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  const changedTheme = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.body).color,
  }));
  assert.notEqual(changedTheme.background, initialTheme.background);
  assert.notEqual(changedTheme.color, initialTheme.color);

  await page.getByTestId("stock-ai-launcher").click();
  const panel = page.getByTestId("stock-ai-panel");
  await assert.doesNotReject(() =>
    panel.getByRole("button", { name: "Remove context: Engine: S55", exact: true }).waitFor()
  );
  await assert.doesNotReject(() =>
    panel.getByRole("button", { name: "Remove context: Without OPF/GPF", exact: true }).waitFor()
  );
});

test("One AI API is fail-closed and preserves the full vehicle context across turns", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 1280, height: 900 } });
  t.after(() => context.close());

  await page.goto(`${baseUrl}/en/shop/catalog`, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const openResponse = await fetch("/api/shop/stock/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What should I change first?",
        context: { locale: "en", currency: "EUR", scope: "auto" },
        conversationId: null,
      }),
    });
    const openData = await openResponse.json();
    const firstConversationId = openData.conversationId ?? null;
    const vehicleResponse = await fetch("/api/shop/stock/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Find exhaust for BMW X6 G06 30d mild hybrid 2020",
        context: { locale: "en", currency: "EUR", scope: "auto" },
        conversationId: firstConversationId,
      }),
    });
    const vehicleData = await vehicleResponse.json();
    const secondConversationId = vehicleData.conversationId ?? firstConversationId;
    const continuationResponse = await fetch("/api/shop/stock/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "BMW X6 2020 without OPF",
        context: { locale: "en", currency: "EUR", scope: "auto" },
        conversationId: secondConversationId,
      }),
    });
    const continuationData = await continuationResponse.json();

    return {
      open: { status: openResponse.status, data: openData },
      vehicle: { status: vehicleResponse.status, data: vehicleData },
      continuation: { status: continuationResponse.status, data: continuationData },
    };
  });

  assert.equal(result.open.status, 200);
  assert.equal(result.open.data.mode, "clarification");
  assert.deepEqual(result.open.data.products ?? [], []);

  const vehiclePlan = result.vehicle.data.plan;
  assert.equal(result.vehicle.status, 200);
  assert.equal(vehiclePlan?.category, "exhaust");
  assert.equal(vehiclePlan?.vehicle?.make, "BMW");
  assert.equal(vehiclePlan?.vehicle?.model, "X6");
  assert.equal(vehiclePlan?.vehicle?.chassis, "G06");
  assert.equal(vehiclePlan?.vehicle?.year, 2020);
  assert.equal(vehiclePlan?.vehicle?.engine, "B57");
  assert.equal(vehiclePlan?.vehicle?.fuel, "hybrid");
  assert.equal(vehiclePlan?.opfGpf, null);
  assert.deepEqual(result.vehicle.data.products ?? [], []);
  assert.deepEqual(result.vehicle.data.managerContext?.vehicleDetails, {
    make: "BMW",
    model: "X6",
    chassis: "G06",
    year: 2020,
    engine: "B57",
    fuel: "hybrid",
    bodyStyle: null,
    opfGpf: null,
  });
  assert.equal(typeof result.vehicle.data.runId, "string");

  const continuationPlan = result.continuation.data.plan;
  assert.equal(result.continuation.status, 200);
  assert.equal(continuationPlan?.category, "exhaust");
  assert.equal(continuationPlan?.vehicle?.chassis, "G06");
  assert.equal(continuationPlan?.vehicle?.engine, "B57");
  assert.equal(continuationPlan?.opfGpf, "without");
  assert.ok(
    (result.continuation.data.products ?? []).every(
      (product: { matchStatus?: string; matchBasis?: string }) =>
        product.matchStatus === "exact" && product.matchBasis !== "identity"
    )
  );
  if (result.continuation.data.degraded) {
    assert.deepEqual(result.continuation.data.products ?? [], []);
  }
  assert.equal(result.continuation.data.counts?.requiresVerification ?? 0, 0);
});

test("One AI restores its session conversation after reload and clears it explicitly", async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  t.after(() => browser.close());

  const { context, page } = await withPage(browser, { viewport: { width: 1280, height: 900 } });
  t.after(() => context.close());

  const message = "What should I change first?";
  await page.goto(`${baseUrl}/en/shop/catalog`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("stock-ai-launcher").click();
  const textbox = page.getByRole("textbox", { name: "Message for One AI", exact: true });
  await textbox.fill(message);
  await textbox.press("Enter");
  await page.getByText(message, { exact: true }).waitFor();
  await page.waitForTimeout(100);

  assert.equal(
    await page.evaluate(() => Boolean(sessionStorage.getItem("onecompany:one-ai-conversation:v1"))),
    true
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("stock-ai-launcher").click();
  await page.getByText(message, { exact: true }).waitFor();

  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByText(message, { exact: true }).waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("onecompany:one-ai-conversation:v1")),
    null
  );
});
