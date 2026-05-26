import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("Navigating to product page...");
  await page.goto("http://localhost:3000/ua/shop/akrapovic/products/akrapovic-s-b10e10-aplt-1", {
    waitUntil: "domcontentloaded",
  });

  console.log("Waiting 5 seconds for hydration...");
  await page.waitForTimeout(5000);

  console.log("Extracting images from DOM...");
  const images = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs
      .map((img) => ({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt"),
        className: img.className,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }))
      .filter(
        (img) =>
          img.src &&
          (img.src.includes("ImageServer") ||
            img.src.includes("akra_img") ||
            img.src.includes("cb4470e0") ||
            img.src.includes("1e8fdb5a") ||
            img.src.includes("_next/image") ||
            img.src.includes("products"))
      );
  });

  console.log("Images found:");
  console.log(JSON.stringify(images, null, 2));

  console.log("Taking screenshot...");
  await page.screenshot({
    path: "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\akra_gallery_dom.png",
  });

  await browser.close();
  console.log("Browser closed.");
}

main().catch(console.error);
