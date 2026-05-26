const https = require("https");
const cheerio = require("cheerio");
const fs = require("fs");

function getHtml(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    };
    https
      .get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          console.log(`Redirecting to ${res.headers.location}`);
          getHtml(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to load page: status ${res.statusCode}`));
          return;
        }
        let html = "";
        res.on("data", (chunk) => (html += chunk));
        res.on("end", () => resolve(html));
      })
      .on("error", reject);
  });
}

const targets = [
  {
    name: "BMW S 1000 RR",
    url: "https://www.akrapovic.com/en/motorcycle/product/22677?brandId=44&modelId=377",
  },
  {
    name: "Yamaha R1",
    url: "https://www.akrapovic.com/en/motorcycle/product/21135?brandId=41&modelId=327",
  },
  {
    name: "Kawasaki ZX-10R",
    url: "https://www.akrapovic.com/en/motorcycle/product/21224?brandId=31&modelId=160",
  },
  {
    name: "BMW R 1300 GS",
    url: "https://www.akrapovic.com/en/motorcycle/product/22128?brandId=44&modelId=1298",
  },
];

async function main() {
  for (const t of targets) {
    console.log(`\n========================================`);
    console.log(`Scraping page for: ${t.name}`);
    console.log(`URL: ${t.url}`);
    try {
      const html = await getHtml(t.url);
      const $ = cheerio.load(html);

      const images = new Set();

      // Extract all img tags
      $("img").each((i, el) => {
        const src = $(el).attr("src");
        if (src) images.add(src);
      });

      // Extract og:image
      $('meta[property="og:image"]').each((i, el) => {
        const content = $(el).attr("content");
        if (content) images.add(content);
      });

      // Extract from style properties (e.g. background-image)
      $("[style]").each((i, el) => {
        const style = $(el).attr("style");
        const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
        if (match) images.add(match[1]);
      });

      console.log(`Found ${images.size} raw images:`);
      Array.from(images).forEach((src) => {
        // filter or format URL
        let fullUrl = src;
        if (src.startsWith("//")) fullUrl = "https:" + src;
        else if (src.startsWith("/")) fullUrl = "https://www.akrapovic.com" + src;

        // Let's filter to keep interesting ones (usually contain documents or media)
        if (
          fullUrl.includes("Media") ||
          fullUrl.includes("Images") ||
          fullUrl.includes("og-image") ||
          fullUrl.includes("background")
        ) {
          console.log(`  - [POSSIBLE] ${fullUrl}`);
        } else {
          console.log(`  - [OTHER] ${fullUrl}`);
        }
      });
    } catch (err) {
      console.error(`Error scraping ${t.name}:`, err.message);
    }
  }
}

main();
