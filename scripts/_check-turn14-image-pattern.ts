import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Survey Turn14 thumbnail URLs across distinct brands to confirm
 * the S/M/L suffix pattern is universal (or find edge cases).
 */
async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const samples = await prisma.$queryRaw<Array<{ brand: string; thumbnail: string }>>`
    SELECT DISTINCT ON (brand) brand, thumbnail
    FROM "Turn14Item"
    WHERE thumbnail IS NOT NULL AND thumbnail <> ''
    ORDER BY brand
    LIMIT 30
  `;
  console.log(`Surveying ${samples.length} brands…\n`);

  let hasS = 0;
  let hasOther = 0;
  const otherPatterns: string[] = [];

  for (const r of samples) {
    const m = r.thumbnail.match(/^https?:\/\/([^/]+)\/.+?([A-Z])?\.(jpg|jpeg|png|webp|gif)$/i);
    const host = m?.[1] ?? "???";
    const suffix = m?.[2] ?? "(none)";
    const ext = m?.[3] ?? "???";
    if (suffix === "S") hasS++;
    else {
      hasOther++;
      otherPatterns.push(`${r.brand}: ${r.thumbnail}`);
    }
    console.log(`  [${r.brand.padEnd(22)}] host=${host} suffix=${suffix}.${ext}`);
  }

  console.log(
    `\nResult: ${hasS}/${samples.length} use suffix=S (small) — upgradeable to L (large)`
  );
  if (otherPatterns.length) {
    console.log("Other patterns:");
    for (const p of otherPatterns.slice(0, 10)) console.log("  " + p);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
