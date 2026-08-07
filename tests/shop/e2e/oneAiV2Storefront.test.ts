import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.SHOP_E2E_BASE_URL || "http://localhost:3001";

const strictQuery =
  "scope=auto&category=exhaust&make=BMW&model=M3&chassis=F80&year=2018" +
  "&engine=S55&opfGpf=without&productKind=system&strict=1";

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
