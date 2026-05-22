/**
 * QA: Playwright visual sweep — every theme-aware route in light + dark,
 * desktop + mobile. Captures full-page screenshots + console errors.
 *
 * Brand-shop sanity (always-dark) is a single desktop pass per brand.
 *
 * Output:
 *  - artifacts/qa-2026-05-13/screenshots/*.png
 *  - artifacts/qa-2026-05-13/data/visual-issues.json
 *  - artifacts/qa-2026-05-13/data/console-errors.csv
 */
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS = path.join(ROOT, "artifacts/qa-2026-05-13/screenshots");
const DATA = path.join(ROOT, "artifacts/qa-2026-05-13/data");
const BASE = process.env.QA_BASE_URL || "http://localhost:3000";

const THEME_AWARE_ROUTES = [
  "/ua",
  "/en",
  "/ua/about",
  "/en/about",
  "/ua/blog",
  "/en/blog",
  "/ua/brands",
  "/en/brands",
  "/ua/brands/europe",
  "/ua/brands/moto",
  "/ua/brands/oem",
  "/ua/brands/racing",
  "/ua/brands/usa",
  "/ua/categories",
  "/en/categories",
  "/ua/choice",
  "/ua/contact",
  "/ua/delivery",
  "/ua/moto",
  "/ua/partnership",
  "/ua/privacy",
  "/ua/cookies",
  "/ua/refund",
  "/ua/terms",
  "/ua/auto",
  "/ua/quote",
  "/ua/shop",
  "/en/shop",
];

const BRAND_SHOP_ROUTES = [
  "/ua/shop/adro",
  "/ua/shop/akrapovic",
  "/ua/shop/brabus",
  "/ua/shop/burger",
  "/ua/shop/csf",
  "/ua/shop/do88",
  "/ua/shop/forged",
  "/ua/shop/girodisc",
  "/ua/shop/ipe",
  "/ua/shop/ohlins",
  "/ua/shop/racechip",
  "/ua/shop/urban",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

interface VisualIssue {
  route: string;
  theme: string;
  viewport: string;
  type: "console-error" | "page-error" | "failed-request" | "http-error" | "invisible-text";
  detail: string;
}

interface ConsoleRow {
  route: string;
  theme: string;
  viewport: string;
  msgType: string;
  text: string;
}

const issues: VisualIssue[] = [];
const consoleRows: ConsoleRow[] = [];

function safe(s: string) {
  return s
    .replace(/[\/?]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function captureOne(
  context: BrowserContext,
  route: string,
  theme: "light" | "dark",
  viewport: { name: string; width: number; height: number },
  alwaysDark = false
) {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  const localErrs: string[] = [];
  page.on("pageerror", (err) => {
    localErrs.push(err.message);
    issues.push({ route, theme, viewport: viewport.name, type: "page-error", detail: err.message });
  });
  page.on("console", (msg) => {
    consoleRows.push({
      route,
      theme,
      viewport: viewport.name,
      msgType: msg.type(),
      text: msg.text().slice(0, 500),
    });
    if (msg.type() === "error") {
      issues.push({
        route,
        theme,
        viewport: viewport.name,
        type: "console-error",
        detail: msg.text().slice(0, 500),
      });
    }
  });
  page.on("requestfailed", (req) => {
    // skip 3rd-party / analytics
    const url = req.url();
    if (
      /google-analytics|googletagmanager|facebook|hotjar|vercel-analytics|fonts\.googleapis|fonts\.gstatic|grammarly|chrome-extension/i.test(
        url
      )
    )
      return;
    issues.push({
      route,
      theme,
      viewport: viewport.name,
      type: "failed-request",
      detail: `${req.method()} ${url} :: ${req.failure()?.errorText ?? ""}`,
    });
  });

  // pre-seed theme via init script BEFORE first nav so next-themes picks it up
  if (!alwaysDark) {
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {}
    }, theme);
  }

  let status = 0;
  try {
    const resp = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    status = resp?.status() ?? 0;
    if (status >= 400) {
      issues.push({
        route,
        theme,
        viewport: viewport.name,
        type: "http-error",
        detail: `HTTP ${status}`,
      });
    }
    // give it a moment for layout to settle (no full networkidle — dev server keeps connections open)
    await page.waitForTimeout(1200);
  } catch (err: any) {
    issues.push({
      route,
      theme,
      viewport: viewport.name,
      type: "page-error",
      detail: `nav: ${(err?.message ?? String(err)).slice(0, 200)}`,
    });
    // still try to screenshot whatever rendered
    try {
      const fnameErr = `${safe(route || "root")}__${theme}__${viewport.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS, fnameErr), fullPage: false });
    } catch {}
    await page.close();
    return;
  }

  // for theme-aware routes, double-check class on html
  if (!alwaysDark) {
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    const isDarkApplied = /\bdark\b/.test(htmlClass);
    if (theme === "dark" && !isDarkApplied) {
      // try forcing
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
    }
    if (theme === "light" && isDarkApplied) {
      await page.evaluate(() => {
        document.documentElement.classList.remove("dark");
      });
    }
    // give styles a tick
    await page.waitForTimeout(200);
  }

  // invisible-text heuristic: find any visible text node whose color is very close to its parent's background
  try {
    const lowContrast: { tag: string; text: string; color: string; bg: string }[] =
      await page.evaluate(() => {
        function parseRgb(str: string): [number, number, number] | null {
          const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return null;
          return [Number(m[1]), Number(m[2]), Number(m[3])];
        }
        function lum(c: [number, number, number]): number {
          const [r, g, b] = c.map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        function contrast(a: [number, number, number], b: [number, number, number]): number {
          const la = lum(a),
            lb = lum(b);
          const [lo, hi] = la < lb ? [la, lb] : [lb, la];
          return (hi + 0.05) / (lo + 0.05);
        }
        const results: { tag: string; text: string; color: string; bg: string }[] = [];
        const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
        for (const el of all) {
          const txt = (el.innerText || "").trim();
          if (!txt || txt.length < 4 || txt.length > 200) continue;
          if (el.children.length > 0) continue; // leaf only
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.top < -100 || rect.top > 8000) continue; // limit viewport
          const cs = window.getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.2)
            continue;
          const colorRgb = parseRgb(cs.color);
          if (!colorRgb) continue;
          // walk parents for non-transparent bg
          let bgRgb: [number, number, number] | null = null;
          let p: HTMLElement | null = el;
          while (p && !bgRgb) {
            const pcs = window.getComputedStyle(p);
            const bgc = pcs.backgroundColor;
            if (bgc && !/rgba?\([^,]+,[^,]+,[^,]+,\s*0\)/.test(bgc) && bgc !== "transparent") {
              bgRgb = parseRgb(bgc);
            }
            p = p.parentElement;
          }
          if (!bgRgb) {
            // assume body bg
            const bcs = window.getComputedStyle(document.body);
            bgRgb = parseRgb(bcs.backgroundColor) || [255, 255, 255];
          }
          const c = contrast(colorRgb, bgRgb);
          if (c < 2.0) {
            results.push({
              tag: el.tagName.toLowerCase(),
              text: txt.slice(0, 80),
              color: cs.color,
              bg: `rgb(${bgRgb.join(",")})`,
            });
            if (results.length >= 5) break;
          }
        }
        return results;
      });
    for (const lc of lowContrast) {
      issues.push({
        route,
        theme,
        viewport: viewport.name,
        type: "invisible-text",
        detail: `<${lc.tag}> "${lc.text}" color=${lc.color} bg=${lc.bg}`,
      });
    }
  } catch (err: any) {
    // ignore eval errors
  }

  const fname = `${safe(route || "root")}__${theme}__${viewport.name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS, fname), fullPage: true });
  await page.close();
}

(async () => {
  await fs.mkdir(SCREENSHOTS, { recursive: true });
  await fs.mkdir(DATA, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });

  // 4 parallel workers
  const tasks: Array<() => Promise<void>> = [];

  for (const route of THEME_AWARE_ROUTES) {
    for (const theme of ["light", "dark"] as const) {
      for (const vp of VIEWPORTS) {
        tasks.push(async () => {
          const ctx = await browser.newContext();
          await captureOne(ctx, route, theme, vp, false);
          await ctx.close();
        });
      }
    }
  }
  for (const route of BRAND_SHOP_ROUTES) {
    tasks.push(async () => {
      const ctx = await browser.newContext();
      await captureOne(ctx, route, "dark", VIEWPORTS[0], true);
      await ctx.close();
    });
  }

  const POOL = 4;
  let cursor = 0;
  let done = 0;
  const total = tasks.length;
  const startedAt = Date.now();
  await Promise.all(
    Array.from({ length: POOL }).map(async () => {
      while (true) {
        const my = cursor++;
        if (my >= tasks.length) break;
        try {
          await tasks[my]();
        } catch (err: any) {
          console.error(`task ${my} threw:`, err?.message ?? err);
        }
        done++;
        if (done % 10 === 0 || done === total) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(`  progress: ${done}/${total}  (${elapsed}s)`);
        }
      }
    })
  );

  await browser.close();

  // write outputs
  await fs.writeFile(
    path.join(DATA, "visual-issues.json"),
    JSON.stringify(issues, null, 2),
    "utf8"
  );
  const cescH = "route,theme,viewport,msgType,text";
  const escCsv = (s: any) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const cescLines = consoleRows.map((r) =>
    [r.route, r.theme, r.viewport, r.msgType, escCsv(r.text)].join(",")
  );
  await fs.writeFile(
    path.join(DATA, "console-errors.csv"),
    [cescH, ...cescLines].join("\n"),
    "utf8"
  );

  const counts = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n[qa-theme-screenshots] DONE. tasks=${total}`);
  console.log(`  issues by type:`, counts);
  console.log(`  screenshots: ${SCREENSHOTS}`);
})();
