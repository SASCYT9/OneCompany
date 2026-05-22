/**
 * Pull random samples from the 70 newly-translated Ilmberger products
 * so the user can audit translation quality.
 */
import { PrismaClient } from "@prisma/client";

const argv = process.argv.slice(2);
const n = parseInt(argv[0] ?? "3", 10);

// Slugs from batches 1..14
const slugs = [
  "ilmberger-cg-cal-003-1xr20",
  "ilmberger-cg-sdr-010-mxr24",
  "ilmberger-cg-hpl-028-s10xr",
  "ilmberger-cg-whr-018-mxr24",
  "ilmberger-cg-hvl-005-mxr24",
  "ilmberger-cg-wak-012-1xr20",
  "ilmberger-cg-kvo-040-1xr20",
  "ilmberger-cg-sib-002-s121n",
  "ilmberger-cg-veo-030-1xr20",
  "ilmberger-cg-vfl-011-mxr24",
  "ilmberger-cg-wkl-003-m123n",
  "ilmberger-cg-sdl-015-1xr20",
  "ilmberger-cg-wkr-004-m123n",
  "ilmberger-cg-veo-001-m125n",
  "ilmberger-mm-kvo-004-s119s",
  "ilmberger-cg-veu-038-mxr24",
  "ilmberger-cg-veo-013-1xr20",
  "ilmberger-cg-sia-016-mxr24",
  "ilmberger-rhl-019-sxr24-k",
  "ilmberger-cg-veo-004-s121n",
  "ilmberger-cg-lmd-042-1xr20",
  "ilmberger-cg-vfr-007-m123n",
  "ilmberger-cg-nho-014-mxr24",
  "ilmberger-cg-vfl-006-m123n",
  "ilmberger-cg-tao-001-1xr20",
  "ilmberger-cg-rha-001-s121n",
  "ilmberger-cg-scl-006-1xr20",
];

// Pick N random
const picked = [];
const pool = [...slugs];
for (let i = 0; i < n && pool.length; i++) {
  const idx = Math.floor(Math.random() * pool.length);
  picked.push(pool.splice(idx, 1)[0]);
}

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { slug: { in: picked } },
  select: {
    sku: true,
    slug: true,
    titleEn: true,
    titleUa: true,
    bodyHtmlEn: true,
    bodyHtmlUa: true,
  },
});

for (const r of rows) {
  console.log("════════════════════════════════════════════════════════════════════");
  console.log(`SKU:      ${r.sku}`);
  console.log(`slug:     ${r.slug}`);
  console.log();
  console.log(`titleEn:  ${r.titleEn}`);
  console.log(`titleUa:  ${r.titleUa}`);
  console.log();
  console.log("─── bodyHtmlEn ───");
  console.log(r.bodyHtmlEn);
  console.log();
  console.log("─── bodyHtmlUa (final) ───");
  console.log(r.bodyHtmlUa);
  console.log();
}

await prisma.$disconnect();
