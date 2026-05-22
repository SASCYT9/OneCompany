/**
 * Search-quality audit for /api/shop/stock/search.
 * Tests keyword search, vehicle filter combinations, brand combo, edge cases.
 * Compares API response vs direct DB query so any drift is visible.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE = "http://localhost:3000";

type Test = {
  label: string;
  url: string;
  expect?: (data: any) => string | null; // returns error message or null
  show?: number;
};

function pad(s: any, n: number) {
  return String(s).padEnd(n);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const tests: Test[] = [
    // ── Keyword search ─────────────────────────────────────────
    {
      label: 'keyword "cat-back" (popular bundle type)',
      url: "/api/shop/stock/search?source=shop&q=cat-back",
      show: 3,
    },
    {
      label: 'keyword "sound controller"',
      url: "/api/shop/stock/search?source=shop&q=sound%20controller",
      show: 3,
    },
    {
      label: 'keyword "gpf" (GPF-back exhausts)',
      url: "/api/shop/stock/search?source=shop&q=gpf",
      show: 3,
    },
    {
      label: 'keyword "carbon"',
      url: "/api/shop/stock/search?source=shop&q=carbon",
      show: 3,
    },
    // ── Exact SKU search ──────────────────────────────────────
    {
      label: 'exact SKU "0006 55SR" (urlencoded)',
      url: "/api/shop/stock/search?source=shop&q=0006%2055SR",
      show: 3,
    },
    {
      label: 'partial SKU prefix "0006"',
      url: "/api/shop/stock/search?source=shop&q=0006",
      show: 3,
    },
    // ── Cyrillic (UA) search ──────────────────────────────────
    {
      label: 'cyrillic "вихлоп" (we use EN titles so should be 0)',
      url: "/api/shop/stock/search?source=shop&q=%D0%B2%D0%B8%D1%85%D0%BB%D0%BE%D0%BF",
      show: 2,
    },
    // ── Combos ─────────────────────────────────────────────────
    {
      label: 'keyword + brand: "exhaust" + Remus',
      url: "/api/shop/stock/search?source=shop&q=exhaust&brand=Remus",
      show: 2,
    },
    {
      label: 'keyword + vehicle: "cat-back" + bmw/m2',
      url: "/api/shop/stock/search?source=shop&q=cat-back&make=bmw&model=m2",
      show: 3,
    },
    {
      label: "vehicle + sort price-asc: vw/golf-8",
      url: "/api/shop/stock/search?source=shop&make=vw&model=golf-8&sort=price-asc",
      show: 3,
    },
    {
      label: "vehicle + sort price-desc + inStock: bmw",
      url: "/api/shop/stock/search?source=shop&make=bmw&sort=price-desc&inStock=1",
      show: 3,
    },
    // ── Edge cases ────────────────────────────────────────────
    {
      label: 'no-match keyword "asdfqwerty"',
      url: "/api/shop/stock/search?source=shop&q=asdfqwerty",
      expect: (d) => (d.meta.totalItems === 0 ? null : `expected 0, got ${d.meta.totalItems}`),
    },
    {
      label: 'invalid make slug "xyz123"',
      url: "/api/shop/stock/search?source=shop&make=xyz123",
      expect: (d) => (d.meta.totalItems === 0 ? null : `expected 0, got ${d.meta.totalItems}`),
    },
    {
      label: 'special chars in q: "&%#"',
      url: "/api/shop/stock/search?source=shop&q=%26%25%23",
      show: 0,
    },
    {
      label: "empty source=all default browse",
      url: "/api/shop/stock/search?source=all",
      show: 1,
    },
    {
      label: "page 2 of bmw/m2",
      url: "/api/shop/stock/search?source=shop&make=bmw&model=m2&page=2",
      show: 1,
    },
    // ── Sanity: SKU lookup directly in DB ──────────────────────
  ];

  console.log("========================================");
  console.log("SEARCH-QUALITY AUDIT");
  console.log("========================================\n");

  for (const t of tests) {
    const res = await fetch(BASE + t.url).then((r) => r.json());
    const total = res.meta?.totalItems ?? "???";
    const returned = (res.data || []).length;
    const errMsg = t.expect ? t.expect(res) : null;
    const status = errMsg ? `FAIL: ${errMsg}` : "✓";
    console.log(`${status}  ${pad(t.label, 55)}  total=${pad(total, 5)}  returned=${returned}`);
    if (t.show && t.show > 0 && (res.data || []).length > 0) {
      for (const item of (res.data || []).slice(0, t.show)) {
        const name = String(item.name || "").slice(0, 60);
        const brand = String(item.brand || "").slice(0, 15);
        const price = item.price ? `$${item.price}` : "—";
        console.log(`         · [${pad(brand, 15)}] ${pad(name, 60)} ${price}`);
      }
    }
  }

  console.log("\n─── Search consistency check ───");
  // Verify: q=cat-back matches title/desc (not just keyword index)
  const dbCnt = await prisma.shopProduct.count({
    where: {
      brand: "Remus",
      OR: [
        { titleEn: { contains: "cat-back", mode: "insensitive" } },
        { shortDescEn: { contains: "cat-back", mode: "insensitive" } },
        { sku: { contains: "cat-back", mode: "insensitive" } },
      ],
    },
  });
  const apiRes = await fetch(BASE + "/api/shop/stock/search?source=shop&q=cat-back").then((r) =>
    r.json()
  );
  console.log(
    `  "cat-back" search: DB-match=${dbCnt}  API=${apiRes.meta.totalItems}  ${dbCnt === apiRes.meta.totalItems ? "✓" : "DRIFT"}`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
