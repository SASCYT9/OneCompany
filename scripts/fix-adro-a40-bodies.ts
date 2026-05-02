/**
 * Sister to fix-adro-a40-titles.ts: cleans the H2 heading inside bodyHtml
 * so the on-page description matches the corrected title (M4-only, not M3+M4).
 * Run with --apply to write.
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();
const apply = process.argv.includes('--apply');

const SLUGS = ['adro-a14a40-1301', 'adro-a14a40-1401'];

// Both EN and UA H2 headings mention "M3 (G80) / M4 (G82 / G83)" with optional
// &nbsp; entities inside the parens. Collapse to "M4 (G82/G83)".
const EN_RE = /for\s+BMW\s+M3(?:&nbsp;|\s)*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\((?:&nbsp;|\s)*G82(?:\s*\/(?:&nbsp;|\s)*G83)?\)/gi;
const UA_RE = /для\s+BMW\s+M3(?:&nbsp;|\s)*\(G80(?:\s*\/\s*G81)?\)\s*\/\s*M4\s*\((?:&nbsp;|\s)*G82(?:\s*\/(?:&nbsp;|\s)*G83)?\)/gi;

const EN_REPLACE = 'for BMW M4 (G82/G83)';
const UA_REPLACE = 'для BMW M4 (G82/G83)';

async function main() {
  for (const slug of SLUGS) {
    const row = await p.shopProduct.findFirst({
      where: { slug },
      select: { id: true, slug: true, sku: true, bodyHtmlEn: true, bodyHtmlUa: true },
    });
    if (!row) {
      console.log(`! ${slug} — not found`);
      continue;
    }

    const newEn = row.bodyHtmlEn?.replace(EN_RE, EN_REPLACE) ?? null;
    const newUa = row.bodyHtmlUa?.replace(UA_RE, UA_REPLACE) ?? null;

    const enChanged = newEn != null && newEn !== row.bodyHtmlEn;
    const uaChanged = newUa != null && newUa !== row.bodyHtmlUa;

    console.log(`\n${row.sku}  (${row.slug})`);
    if (enChanged) {
      const bef = row.bodyHtmlEn!.match(EN_RE)?.[0] ?? '';
      console.log(`  EN body  : ${bef}  →  ${EN_REPLACE}`);
    } else {
      console.log(`  EN body  : (no match)`);
    }
    if (uaChanged) {
      const bef = row.bodyHtmlUa!.match(UA_RE)?.[0] ?? '';
      console.log(`  UA body  : ${bef}  →  ${UA_REPLACE}`);
    } else {
      console.log(`  UA body  : (no match)`);
    }

    if (apply && (enChanged || uaChanged)) {
      await p.shopProduct.update({
        where: { id: row.id },
        data: {
          ...(enChanged ? { bodyHtmlEn: newEn! } : {}),
          ...(uaChanged ? { bodyHtmlUa: newUa! } : {}),
        },
      });
      console.log(`  ✓ written`);
    }
  }

  if (!apply) console.log(`\n(dry-run; pass --apply to write)`);
  await p.$disconnect();
}
main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
