import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(process.env.OUT_DIR)
  : path.resolve(process.cwd(), 'output', 'playwright', 'mobile-sweep');

const TARGET_PATHS = [
  '/ua',
  '/en',
  '/ua/shop',
  '/ua/shop/urban',
  '/ua/shop/urban/collections',
  '/ua/shop/cart',
  '/ua/shop/checkout',
  '/ua/shop/account',
  '/admin',
  '/admin/shop',
  '/admin/shop/orders',
];

const DEVICE_PROFILES = [
  { name: 'iphone-14', device: devices['iPhone 14'] },
  { name: 'pixel-7', device: devices['Pixel 7'] },
  { name: 'ipad-mini', device: devices['iPad Mini'] },
];

function safeName(input) {
  return input
    .replace(/^https?:\/\//, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const logPath = path.join(OUT_DIR, 'run-log.txt');
  fs.writeFileSync(logPath, `BASE_URL=${BASE_URL}\nStarted=${new Date().toISOString()}\n\n`, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const contextBase = await browser.newContext();
  await contextBase.close();

  for (const profile of DEVICE_PROFILES) {
    const context = await browser.newContext({
      ...profile.device,
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.on('pageerror', (err) => {
      fs.appendFileSync(logPath, `[pageerror] ${profile.name}: ${String(err)}\n`, 'utf8');
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        fs.appendFileSync(
          logPath,
          `[console:${msg.type()}] ${profile.name}: ${msg.text()}\n`,
          'utf8'
        );
      }
    });

    for (const p of TARGET_PATHS) {
      const url = `${BASE_URL}${p}`;
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
      } catch (err) {
        // Fall back to domcontentloaded to still capture layout issues.
        await page.goto(url, { waitUntil: 'domcontentloaded' });
      }

      // Give animations/layout a moment to settle.
      await page.waitForTimeout(2500);

      const loadingStillVisible =
        (await page.getByText('Завантаження', { exact: false }).count()) > 0 ||
        (await page.getByText('Loading', { exact: false }).count()) > 0;
      if (loadingStillVisible) {
        fs.appendFileSync(logPath, `[warn] ${profile.name} ${p}: still shows loading text\n`, 'utf8');
      }

      const fileName = `${profile.name}__${safeName(p)}.png`;
      const outPath = path.join(OUT_DIR, fileName);
      await page.screenshot({ path: outPath, fullPage: true });
      // eslint-disable-next-line no-console
      console.log(`[ok] ${profile.name} ${p} -> ${path.relative(process.cwd(), outPath)}`);
    }

    await context.close();
  }

  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`\nDone. Screenshots in: ${OUT_DIR}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

