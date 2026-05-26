require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  // Find a product with sounds
  console.log("Finding a product with sounds in database...");
  const metafield = await prisma.shopProductMetafield.findFirst({
    where: {
      namespace: "akrapovic",
      key: "sounds",
    },
    include: {
      product: true,
    },
  });

  if (!metafield || !metafield.product) {
    console.error("No product with sounds found in database.");
    await prisma.$disconnect();
    return;
  }

  const slug = metafield.product.slug;
  const productUrl = `http://localhost:3000/ua/shop/akrapovic/products/${slug}`;
  console.log(`Found product slug: ${slug}. Target URL: ${productUrl}`);

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  // Set viewport
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log("Navigating to product page...");
  await page.goto(productUrl);
  await page.waitForTimeout(3000);

  // Scroll to sound section
  console.log("Scrolling down to sound section...");
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h3"));
    const soundHeading = headings.find((h) => h.textContent.includes("Звук вихлопу"));
    if (soundHeading) {
      soundHeading.scrollIntoView({ block: "center" });
    } else {
      window.scrollTo(0, 500); // fallback
    }
  });
  await page.waitForTimeout(2000);

  const screenshotPath =
    "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\sounds_screenshot.png";
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  await browser.close();
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
