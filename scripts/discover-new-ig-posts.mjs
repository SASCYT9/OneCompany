/**
 * Discover new Instagram posts since 2026-04-24 from @onecompany.global
 *
 * Tries (in order):
 *  1) Public IG profile (works ~8-12 latest if not logged-in wall)
 *  2) picuki.com/profile/onecompany.global
 *  3) imginn.com/onecompany.global/
 *
 * Writes scripts/ig-discovered-may2026.json with { shortcode, date?, captionPreview? }
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const PROFILE = "onecompany.global";
const KNOWN_SHORTCODES = new Set([
  // From last sync (ig-latest-sync.json) — newest already imported
  "DXBFMKODARA",
  "DXWM2KOJJ4O",
  "DXRCQJODMS5",
  "DXMGRSJDBNF",
  "DXHCWG4DFQJ",
  "DXD_W7PDPFX",
  // Older imports (from site-content.json brand-case-* slugs)
  "DW3qRqdDO4l",
  "DWzAIIoDHb4",
  "DWn0fWMjB1t",
  "DWlaTXVjBNO",
  "DWTU9BsDEJC",
  "DWPLJ-PjAwZ",
  "DWebA1mjNjq",
  "DWbybFkjHXp",
  "DWWGptejKmd",
  "DVBOSsajMKr",
  "DU8slwwDP1C",
  "DU56J1EjLFg",
  "DU3a9YgDGjR",
  "DVG3S66DAgX",
]);

const OUT_FILE = path.resolve("scripts/ig-discovered-may2026.json");
const SINCE = new Date("2026-04-22T00:00:00Z"); // anything strictly newer than this gets imported

async function tryInstagramPublic(page) {
  console.log(`\n[1/3] Trying public IG profile...`);
  try {
    await page.goto(`https://www.instagram.com/${PROFILE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(3000);

    // Check for login wall
    const hasLoginWall = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || "";
      return text.includes("log in") && text.includes("sign up");
    });

    const links = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (els) =>
      els
        .map((a) => a.getAttribute("href") || "")
        .map((h) => {
          const m = h.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    );

    const unique = [...new Set(links)];
    console.log(
      `   Found ${unique.length} shortcodes from public IG (login-wall: ${hasLoginWall})`
    );
    return unique;
  } catch (e) {
    console.log(`   Failed: ${e.message}`);
    return [];
  }
}

async function tryPicuki(page) {
  console.log(`\n[2/3] Trying picuki.com...`);
  try {
    await page.goto(`https://www.picuki.com/profile/${PROFILE}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2500);

    const links = await page.$$eval('a[href*="/media/"]', (els) =>
      els
        .map((a) => a.getAttribute("href") || "")
        .map((h) => {
          const m = h.match(/\/media\/(\d+)_/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    );
    console.log(`   picuki: ${links.length} media IDs (numeric, not shortcode)`);
    return links;
  } catch (e) {
    console.log(`   Failed: ${e.message}`);
    return [];
  }
}

async function tryImginn(page) {
  console.log(`\n[3/3] Trying imginn.com...`);
  try {
    await page.goto(`https://imginn.com/${PROFILE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(2500);

    const links = await page.$$eval('a[href*="/p/"]', (els) =>
      els
        .map((a) => a.getAttribute("href") || "")
        .map((h) => {
          const m = h.match(/\/p\/([A-Za-z0-9_-]+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean)
    );
    const unique = [...new Set(links)];
    console.log(`   imginn: ${unique.length} shortcodes`);
    return unique;
  } catch (e) {
    console.log(`   Failed: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log(`Discovering new posts for @${PROFILE} since ${SINCE.toISOString().slice(0, 10)}`);
  console.log(`Already-known shortcodes: ${KNOWN_SHORTCODES.size}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const ig = await tryInstagramPublic(page);
  const imginn = await tryImginn(page);
  // Skip picuki for now — gives numeric IDs, not shortcodes
  // const picuki = await tryPicuki(page);

  const all = new Set([...ig, ...imginn]);
  const candidates = [...all].filter((sc) => !KNOWN_SHORTCODES.has(sc));

  console.log(`\n────────────────────────────────────────`);
  console.log(`Total unique shortcodes seen: ${all.size}`);
  console.log(`New (not in KNOWN set): ${candidates.length}`);
  console.log(`Candidates: ${JSON.stringify(candidates, null, 2)}`);

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        profile: PROFILE,
        discoveredAt: new Date().toISOString(),
        sinceDate: SINCE.toISOString(),
        knownCount: KNOWN_SHORTCODES.size,
        sources: {
          instagram: ig,
          imginn,
        },
        newCandidates: candidates,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${OUT_FILE}`);

  await browser.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
