import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

type CatalogItem = {
  sku: string;
  title?: string;
  titleEn?: string;
  titleUa?: string;
};

const OUT_PATH = resolve(process.cwd(), 'data/brabus-factory-only-skus.json');

// Title patterns that imply factory installation / paint job / professional fitting.
// Matched case-insensitively against EN/UA/DE titles.
const FACTORY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Body kits & packages (EN)
  { re: /\bbody\s*(kit|package)\b/i, reason: 'body kit/package' },
  { re: /\bbody\s*&\s*sound\s+pack/i, reason: 'body & sound package' },
  { re: /\bmasterpiece\b/i, reason: 'masterpiece package' },
  { re: /\bwidestar\b/i, reason: 'widestar body kit' },
  { re: /\bwidetrack\b/i, reason: 'widetrack body kit' },
  { re: /\bwidebody\b/i, reason: 'widebody kit' },
  { re: /\bsignature\s+pack/i, reason: 'signature package' },
  { re: /\badventure\b/i, reason: 'adventure package' },
  { re: /\bcompletion\b/i, reason: 'completion package' },
  { re: /\brocket\b.*\b(1000|900|800|700|edition)/i, reason: 'rocket engine conversion' },
  { re: /\bengine\s+conversion\b/i, reason: 'engine conversion' },
  { re: /\bbasic\s+package\b/i, reason: 'basic install package' },
  { re: /\bbasispaket\b/i, reason: 'basic install package (DE)' },

  // Body parts (German)
  { re: /\bfrontsch(ü|u)rze\b/i, reason: 'front bumper (DE)' },
  { re: /\bhecksch(ü|u)rze\b/i, reason: 'rear bumper (DE)' },
  { re: /\bheckdiffusor\b/i, reason: 'rear diffuser (DE)' },
  { re: /\bfrontspoiler\b/i, reason: 'front spoiler (DE)' },
  { re: /\bheckspoiler(aufsatz)?\b/i, reason: 'rear spoiler (DE)' },
  { re: /\bspoileraufsatz\b/i, reason: 'spoiler attachment (DE)' },
  { re: /\bspoilerlippe\b/i, reason: 'spoiler lip (DE)' },
  { re: /\bschwellerverkleidung\b/i, reason: 'side skirt (DE)' },
  { re: /\bfrontgrille?(insätze|nins)/i, reason: 'front grille inserts (DE)' },
  { re: /\bdachspoiler\b/i, reason: 'roof spoiler (DE)' },
  { re: /\bmotorhaube\b/i, reason: 'bonnet (DE)' },

  // Body parts (English)
  { re: /\b(front|rear|side)\s+(skirt|bumper|diffuser|splitter|spoiler|fender|valance|wing|fascia|grille)\b/i, reason: 'body panel' },
  { re: /\brear\s+(wing|spoiler)\b/i, reason: 'rear wing' },
  { re: /\bfront\s+grille\s+insert/i, reason: 'grille insert' },
  { re: /\b(wide|over)\s*fender(s)?\b/i, reason: 'fender flares' },
  { re: /\broof\s+(spoiler|wing|cover)\b/i, reason: 'roof part' },
  { re: /\bbonnet|hood\s+vent\b/i, reason: 'bonnet/hood vent' },
  { re: /\bpowerdome\b/i, reason: 'powerdome (hood vent)' },
  { re: /\bunderride\s+protection\b/i, reason: 'underride protection panel' },
  { re: /\bfender\s+add-?on\b/i, reason: 'fender add-on' },
  { re: /\bfront\s+fascia\s+attachment/i, reason: 'front fascia attachment' },
  { re: /\brear\s+fascia\s+attachment/i, reason: 'rear fascia attachment' },

  // Interior install (full leather, dashboard, steering wheel, seats)
  { re: /\bleather\s+interior\b/i, reason: 'leather interior install' },
  { re: /^leather\b/i, reason: 'leather interior install' },
  { re: /\bleather\s+(armrest|dashboard|trunk|vehicle\s+flooring|trunk\s+mat|steering|upper|lower|center)/i, reason: 'leather interior part' },
  { re: /^leathertrimmed/i, reason: 'leather-trimmed install' },
  { re: /\balcantara\b/i, reason: 'alcantara install' },
  { re: /\bsteering\s+wheel\b(?!.*pad)/i, reason: 'steering wheel install' },
  { re: /\bdashboard\b/i, reason: 'dashboard install' },
  { re: /\bcenter\s+console\b/i, reason: 'center console install' },
  { re: /\bbucket\s+seat/i, reason: 'bucket seats install' },
  { re: /\bseat\s+(cover|upholstery|trim)\b/i, reason: 'seat upholstery' },
  { re: /\bexecutive\s+seat/i, reason: 'executive seats install' },
  { re: /\barmaturenbrett\b/i, reason: 'dashboard (DE)' },
  { re: /\blenkrad\b/i, reason: 'steering wheel (DE)' },
  { re: /\bsitzen\b/i, reason: 'seats (DE)' },
  { re: /\binterior\s+package\b/i, reason: 'full interior package' },
  { re: /\bcarbon\s+interior\s+package\b/i, reason: 'carbon interior install' },
  { re: /\bcarbon\s+package\s+interior\b/i, reason: 'carbon interior install' },

  // Carbon body parts (paint+install required)
  { re: /^carbon\s+(front|rear|side|roof|hood|bonnet|fender|spoiler|wing|diffuser|splitter|skirt|powerdome|underride|fascia|grille|trim)/i, reason: 'carbon body part' },
  { re: /\bcarbon\s+body\b/i, reason: 'carbon body kit' },
  { re: /\bcarbon\s+package\b/i, reason: 'carbon body/interior package' },

  // Painted glazed elements
  { re: /\bglazed\b/i, reason: 'glazed paint job' },
  { re: /\bmatte\s+(black|painted|finish)\b/i, reason: 'matte paint job' },

  // Sport springs / suspension (need workshop)
  { re: /\bsport\s+springs\b/i, reason: 'suspension install' },
  { re: /\bcoilover\s+adjustment\b/i, reason: 'coilover suspension' },
  { re: /\bridecontrol\b/i, reason: 'ride control suspension' },
  { re: /\bair\s+suspension\b/i, reason: 'air suspension install' },

  // Exhaust full system
  { re: /\bexhaust\s+system\b/i, reason: 'exhaust system install' },
  { re: /\bvalve\s+controlled\s+sport/i, reason: 'valve-controlled sport exhaust' },
  { re: /\bsport\s+exhaust\s+system/i, reason: 'sport exhaust system' },
  { re: /\bsportabgasanlage\b/i, reason: 'sport exhaust (DE)' },

  // Sound packages (typically full muffler+ECU)
  { re: /^sound\s+pack/i, reason: 'sound package install' },

  // Ukrainian patterns (DB titleUa is translated cleanly)
  { re: /\bкарбоновий\b.*(спойлер|пакет|пауердом|підбій|підбіж|кузов|дифузор|капот|бампер|накладк|вставк|розширюва|захист)/i, reason: 'UA: carbon body/interior part' },
  { re: /\bкарбонов(і|их|ому)\b.*(вставк|розширюва|накладк|подовжувач|захист)/i, reason: 'UA: carbon body part' },
  { re: /\bкарбоновий\s+пакет\b/i, reason: 'UA: carbon package' },
  { re: /\bбазовий\s+пакет/i, reason: 'UA: basic install package' },
  { re: /\bпакет\s+(інтер'?єру|кузова)/i, reason: 'UA: interior/body package' },
  { re: /\bшкіряний\s+(салон|пакет|інтер|підлокітн|килимок|багажник|амортизатор|стійкий)/i, reason: 'UA: leather interior part' },
  { re: /\bшкіряни(й|х|ми)\b.*(салон|сидінн|кер(ма|мо)|панел|приладів)/i, reason: 'UA: leather interior' },
  { re: /\bпакет\s+інтер'?єру\b/i, reason: 'UA: interior package' },
  { re: /\bпередній\s+спойлер\b/i, reason: 'UA: front spoiler' },
  { re: /\bзадній\s+(спойлер|дифузор|карбоновий)/i, reason: 'UA: rear body part' },
  { re: /\b(передн|задн).*бампер/i, reason: 'UA: bumper part' },
  { re: /\bкомплект\s+(кузова|обвісу|обвеса)/i, reason: 'UA: body kit' },
  { re: /\bпакет\s+обвісу/i, reason: 'UA: body kit package' },
  { re: /\bMasterpiece\b/i, reason: 'masterpiece (any lang)' },
];

// Top-level category placeholder pages — also factory-only (they're not real products).
const CATEGORY_PAGE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /^Tuning\s+based\s+on/i, reason: 'category placeholder page' },
];

function classify(item: CatalogItem) {
  const titles = [item.title, item.titleEn, item.titleUa].filter(Boolean) as string[];
  for (const title of titles) {
    for (const { re, reason } of FACTORY_PATTERNS) {
      if (re.test(title)) return { factoryOnly: true, reason };
    }
    for (const { re, reason } of CATEGORY_PAGE_PATTERNS) {
      if (re.test(title)) return { factoryOnly: true, reason };
    }
  }
  return { factoryOnly: false, reason: '' };
}

async function main() {
  const prisma = new PrismaClient();
  const dbProducts = await prisma.shopProduct.findMany({
    where: { brand: 'Brabus' },
    select: { sku: true, titleEn: true, titleUa: true },
  });
  await prisma.$disconnect();
  const items: CatalogItem[] = dbProducts.map((p) => ({
    sku: p.sku,
    titleEn: p.titleEn ?? '',
    titleUa: p.titleUa ?? '',
  }));

  const factoryOnly: string[] = [];
  const reasons: Record<string, { reason: string; title: string }> = {};
  const reasonHist = new Map<string, number>();

  for (const item of items) {
    const { factoryOnly: isFactory, reason } = classify(item);
    if (isFactory) {
      if (!factoryOnly.includes(item.sku)) {
        factoryOnly.push(item.sku);
        reasons[item.sku] = { reason, title: item.title ?? item.titleEn ?? item.sku };
      }
      reasonHist.set(reason, (reasonHist.get(reason) ?? 0) + 1);
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'prisma:ShopProduct where brand=Brabus',
    total: items.length,
    uniqueInputSkus: new Set(items.map((i) => i.sku)).size,
    factoryOnlyCount: factoryOnly.length,
    skus: factoryOnly.sort(),
    reasons,
  };

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\nBrabus catalog audit (title-based factory-only classifier)`);
  console.log(`==============================================================`);
  console.log(`Source:               DB (Prisma ShopProduct, brand=Brabus)`);
  console.log(`Total products:       ${items.length}`);
  console.log(`Unique input SKUs:    ${out.uniqueInputSkus}`);
  console.log(`Factory-only SKUs:    ${factoryOnly.length}`);
  console.log(`Purchasable SKUs:     ${out.uniqueInputSkus - factoryOnly.length}\n`);

  console.log(`Top reasons:`);
  const sortedReasons = [...reasonHist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [r, n] of sortedReasons.slice(0, 20)) {
    console.log(`  ${n.toString().padStart(4)} × ${r}`);
  }

  console.log(`\nFirst 15 factory-only titles:`);
  for (const sku of factoryOnly.slice(0, 15)) {
    console.log(`  [${sku}] (${reasons[sku].reason}) ${reasons[sku].title}`);
  }

  console.log(`\nFirst 15 KEPT (purchasable) titles:`);
  let shown = 0;
  const seenKept = new Set<string>();
  for (const item of items) {
    if (factoryOnly.includes(item.sku) || seenKept.has(item.sku)) continue;
    seenKept.add(item.sku);
    console.log(`  [${item.sku}] ${item.title ?? item.titleEn ?? item.sku}`);
    if (++shown >= 15) break;
  }

  console.log(`\nWritten: ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
