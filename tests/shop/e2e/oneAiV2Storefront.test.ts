import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const baseUrl = process.env.SHOP_E2E_BASE_URL || "http://127.0.0.1:3001";

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
  const box = await panel.boundingBox();
  assert.ok(box, "One AI panel should be visible");
  assert.equal(Math.round(box.x), 0);
  assert.equal(Math.round(box.x + box.width), 390);
  assert.equal(Math.round(box.y + box.height), 844);
  assert.equal(
    await panel.evaluate((element) => getComputedStyle(element).borderRadius),
    "24px 24px 0px 0px"
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
