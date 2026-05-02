/**
 * Audit Adro SKUs to find rows whose title's claimed fitment disagrees with
 * what the SKU's 3rd block (e.g. A40, A50, A60) consistently means across the
 * rest of the catalog.
 *
 * Idea: Adro encodes chassis/trim into the third block of the SKU
 * (A14<block>-<part>). Within a block, most rows share a single dominant
 * model+chassis. Outliers — rows that bundle multiple models when the rest of
 * their block is single-model — are usually editorial mistakes (the SKU is
 * model-specific but the title was copied from the parent product page).
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const p = new PrismaClient();

type Row = { id: string; slug: string; sku: string | null; titleEn: string | null; titleUa: string | null };

// Extract the third block of an Adro SKU like A14A40-1301 → "A40", or
// A14AB10-1301 → "AB10", or A14B30-1201 → "B30". Returns null if not Adro-shaped.
function blockOf(sku: string | null): string | null {
  if (!sku) return null;
  const head = sku.split('/')[0].trim();
  const m = head.match(/^A1[0-9]([A-Z]+\d+)-/);
  return m ? m[1] : null;
}

// Parse model+chassis tokens from a title's "for ..." segment.
// Returns the set of "MODEL (CHASSIS)" pairs the title claims to fit.
function fitmentTokens(title: string | null): Set<string> {
  const out = new Set<string>();
  if (!title) return out;
  const after = title.match(/\b(?:for|для)\s+(.+)$/i)?.[1] ?? title;
  // Match BMW-style "M4 (G82)" or "M340i (G20)" tokens, normalising whitespace.
  const re = /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,2})\s*\(\s*([A-Z]?\d{1,3}[A-Z]?(?:\s*\/\s*[A-Z]?\d{1,3}[A-Z]?)*)\s*\)/g;
  let m;
  while ((m = re.exec(after)) !== null) {
    const model = m[1].replace(/\s+/g, ' ').trim();
    if (/^(BMW|TOYOTA|SUBARU|TESLA|PORSCHE|HONDA|FORD|KIA|FOR|для|FROM|HYUNDAI)$/i.test(model)) continue;
    const chassisGroup = m[2].replace(/\s+/g, '').toUpperCase();
    for (const ch of chassisGroup.split('/')) {
      out.add(`${model} (${ch})`);
    }
  }
  return out;
}

function modelOnly(token: string): string {
  return token.replace(/\s*\([^)]+\)\s*/g, '').trim();
}

async function main() {
  const rows: Row[] = await p.shopProduct.findMany({
    where: {
      isPublished: true,
      OR: [
        { brand: { contains: 'adro', mode: 'insensitive' } },
        { vendor: { contains: 'adro', mode: 'insensitive' } },
        { slug: { startsWith: 'adro-' } },
      ],
    },
    select: { id: true, slug: true, sku: true, titleEn: true, titleUa: true },
  });

  // Group by SKU block.
  const byBlock = new Map<string, Row[]>();
  const skipped: Row[] = [];
  for (const r of rows) {
    const block = blockOf(r.sku);
    if (!block) {
      skipped.push(r);
      continue;
    }
    const arr = byBlock.get(block) ?? [];
    arr.push(r);
    byBlock.set(block, arr);
  }

  // For each block: collect every unique model token. If one model appears in
  // ≥ 50% of rows AND ≥ 3 rows (so we have signal), call it the dominant model.
  // Then any row whose title claims a *different* model alongside the dominant
  // one (multi-fit) is flagged for review.
  type Suspect = { row: Row; block: string; dominant: string; titleTokens: string[] };
  const suspects: Suspect[] = [];

  console.log('=== Adro SKU-block fitment summary ===\n');

  const blocks = [...byBlock.entries()].sort();
  for (const [block, members] of blocks) {
    const tokenCounts = new Map<string, number>();
    const modelCounts = new Map<string, number>();
    const allTokensPerRow = new Map<string, Set<string>>();
    for (const r of members) {
      const tokens = fitmentTokens(r.titleEn);
      allTokensPerRow.set(r.id, tokens);
      const seenModels = new Set<string>();
      for (const tok of tokens) {
        tokenCounts.set(tok, (tokenCounts.get(tok) ?? 0) + 1);
        const mo = modelOnly(tok);
        if (!seenModels.has(mo)) {
          modelCounts.set(mo, (modelCounts.get(mo) ?? 0) + 1);
          seenModels.add(mo);
        }
      }
    }

    const sortedModels = [...modelCounts.entries()].sort((a, b) => b[1] - a[1]);
    const totalRows = members.length;
    const top = sortedModels[0];
    const dominant = top && top[1] >= 3 && top[1] / totalRows >= 0.5 ? top[0] : null;

    console.log(`block=${block.padEnd(5)}  rows=${String(totalRows).padStart(3)}  model spread:`,
      sortedModels.map(([m, c]) => `${m}×${c}`).join(', '));

    if (!dominant) {
      // Block too small or too mixed — skip flagging.
      continue;
    }

    for (const r of members) {
      const tokens = allTokensPerRow.get(r.id)!;
      const distinctModels = new Set([...tokens].map(modelOnly));
      // Suspect = title mentions models other than the dominant one,
      // AND the dominant model is also present in this row's title
      // (i.e. it's a "M3 / M4" style bundle), AND the row mentions
      // a non-dominant model that is itself a typical "specific-fit"
      // model (M3, M4, M2, M340i, M440i, etc.).
      const others = [...distinctModels].filter((m) => m !== dominant);
      if (distinctModels.has(dominant) && others.length > 0) {
        // Skip rows that legitimately bundle related-fit chassis
        // (e.g. "M340i / 3 Series" — wing fits both because trunk is shared).
        // Heuristic: only flag when "others" includes a *different M-car* model.
        const otherIsDifferentM = others.some((o) => /\bM\d+\b/i.test(o) && o !== dominant);
        if (otherIsDifferentM) {
          suspects.push({ row: r, block, dominant, titleTokens: [...tokens] });
        }
      }
    }
  }

  console.log('\n=== Suspect rows (title bundles a non-dominant M-model) ===\n');
  if (suspects.length === 0) {
    console.log('None.');
  } else {
    for (const s of suspects) {
      console.log(`block=${s.block}  dominant=${s.dominant}  SKU=${s.row.sku}`);
      console.log(`  EN: ${s.row.titleEn}`);
      console.log(`  UA: ${s.row.titleUa}`);
      console.log(`  title tokens: ${s.titleTokens.join(' | ')}`);
      console.log();
    }
  }

  console.log(`\nSkipped ${skipped.length} rows with non-Adro-shaped SKUs.`);
  await p.$disconnect();
}

main().catch((e) => { console.error(e); p.$disconnect(); process.exit(1); });
