// Replace transliterated "турбо" → Latin "Turbo" in Porsche UA fields.
// Porsche keeps "Turbo" in Latin even in localized markets, so the
// Ukrainian transliteration we had ("Porsche 911 турбо (992)") was off.
//
// Targets only Porsche-branded products where titleUa contains both
// "Porsche" and "турбо" — every match is the trim-name usage.
//
// Usage:
//   DATABASE_URL=<prod-url> node scripts/fix-porsche-turbo-ua-titles.mjs
//   add --dry-run to preview without writing

import { PrismaClient } from '@prisma/client';

const DRY = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

const replace = (s) => (typeof s === 'string' ? s.replace(/турбо/g, 'Turbo') : s);

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      AND: [
        { titleUa: { contains: 'Porsche' } },
        { titleUa: { contains: 'турбо' } },
      ],
    },
    select: { id: true, slug: true, titleUa: true, shortDescUa: true, longDescUa: true },
  });

  console.log(`${DRY ? '[dry-run] ' : ''}found ${rows.length} Porsche products to fix`);
  let title = 0, short = 0, long = 0;

  for (const r of rows) {
    const data = {};
    const nt = replace(r.titleUa);
    const ns = replace(r.shortDescUa);
    const nl = replace(r.longDescUa);
    if (nt !== r.titleUa) { data.titleUa = nt; title++; }
    if (ns !== r.shortDescUa) { data.shortDescUa = ns; short++; }
    if (nl !== r.longDescUa) { data.longDescUa = nl; long++; }

    if (!Object.keys(data).length) continue;
    console.log(`  ${r.slug}: ${r.titleUa} → ${data.titleUa ?? r.titleUa}`);
    if (!DRY) {
      await prisma.shopProduct.update({ where: { id: r.id }, data });
    }
  }

  console.log(`${DRY ? '[dry-run] would update' : 'updated'} title=${title} short=${short} long=${long}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
