/**
 * Adro A14A40-1301 (rear diffuser) and A14A40-1401 (side skirts) are
 * physically M4-only parts (per official Adro / Lethal Performance / FCP Euro),
 * but their DB titles list both "M3 (G80) / M4 (G82/G83)". This pollutes the
 * model→chassis filter (e.g. picking BMW M3 G80 surfaces M4-only hardware) and
 * the bmw-m4 collection cross-fits these into M3 collections.
 *
 * The M3-equivalent SKUs already exist as A14A50-1301 / A14A50-1401, so this
 * is purely a title typo on the source rows — no inventory consolidation
 * needed. Run with --apply to write.
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const FIXES: Array<{
  sku: string;
  rewriteEn: (title: string) => string | null;
  rewriteUa: (title: string) => string | null;
}> = [
  {
    sku: 'A14A40-1301',
    rewriteEn: (t) =>
      t.replace(
        /for\s+BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
        'for BMW M4 (G82/G83)',
      ),
    rewriteUa: (t) =>
      t
        .replace(
          /для\s+BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
          'для BMW M4 (G82/G83)',
        )
        .replace(
          /BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
          'BMW M4 (G82/G83)',
        ),
  },
  {
    sku: 'A14A40-1401',
    rewriteEn: (t) =>
      t.replace(
        /for\s+BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
        'for BMW M4 (G82/G83)',
      ),
    rewriteUa: (t) =>
      t
        .replace(
          /для\s+BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
          'для BMW M4 (G82/G83)',
        )
        .replace(
          /BMW\s+M3\s*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\(G82(?:\s*\/\s*G83)?\)/i,
          'BMW M4 (G82/G83)',
        ),
  },
];

async function main() {
  for (const fix of FIXES) {
    const row = await p.shopProduct.findFirst({
      where: { sku: fix.sku },
      select: { id: true, slug: true, sku: true, titleEn: true, titleUa: true },
    });

    if (!row) {
      console.log(`! ${fix.sku} — not found`);
      continue;
    }

    const newEn = row.titleEn ? fix.rewriteEn(row.titleEn) : null;
    const newUa = row.titleUa ? fix.rewriteUa(row.titleUa) : null;

    const enChanged = newEn != null && newEn !== row.titleEn;
    const uaChanged = newUa != null && newUa !== row.titleUa;

    console.log(`\n${fix.sku}  (slug=${row.slug})`);
    if (row.titleEn) console.log(`  EN was: ${row.titleEn}`);
    if (enChanged) console.log(`  EN now: ${newEn}`);
    if (row.titleUa) console.log(`  UA was: ${row.titleUa}`);
    if (uaChanged) console.log(`  UA now: ${newUa}`);
    if (!enChanged && !uaChanged) {
      console.log(`  (no change — pattern did not match)`);
      continue;
    }

    if (apply) {
      await p.shopProduct.update({
        where: { id: row.id },
        data: {
          ...(enChanged ? { titleEn: newEn! } : {}),
          ...(uaChanged ? { titleUa: newUa! } : {}),
        },
      });
      console.log(`  ✓ written`);
    } else {
      console.log(`  (dry-run; pass --apply to write)`);
    }
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  p.$disconnect();
  process.exit(1);
});
