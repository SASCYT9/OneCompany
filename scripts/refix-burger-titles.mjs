// Re-fix burger titles: replace earlier "(brands: m1, m2, m3, m4 +N more)" format
// with cleaner " — brands m1, m2, ..." form when ≤ 7 models.

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
const prisma = new PrismaClient();

const GENERIC = new Set(['Cooper', 'turbo', 'Turbo', 'R', 'GT', 'Genesis']);

function getModels(tags) {
  return (tags || []).filter((t) => t.startsWith('model:')).map((t) => t.slice(6)).filter((m) => !GENERIC.has(m));
}
function getBrands(tags) {
  return (tags || []).filter((t) => t.startsWith('brand:')).map((t) => t.slice(6)).filter((b) => b !== 'Universal');
}

// Map model → most likely brand. Used to pick a single dominant brand when
// the product is cross-tagged (e.g. Audi product with brand:VW because of EA888).
const MODEL_TO_BRAND = {};
const BRAND_MODELS = {
  Audi: ['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','S3','S4','S5','S6','S7','S8','RS3','RS4','RS5','RS6','RS7','TT','R8'],
  VW: ['Golf','GTI','Jetta','Passat','Tiguan','Atlas','Arteon','Beetle','Polo'],
  BMW: ['1-Series','2-Series','3-Series','4-Series','5-Series','6-Series','7-Series','8-Series','M2','M3','M4','M5','X1','X2','X3','X3M','X4','X4M','X5','X5M','X6','X6M','X7','XM','Z4','i3','i4','i5','i7','i8'],
  Mini: ['Cooper S','Clubman','Countryman','Paceman','Roadster','Cooper JCW'],
  Toyota: ['Supra','Tundra','Tacoma','4Runner','Sequoia','Land Cruiser','GR Yaris','GR Corolla','Highlander','Crown'],
  Hyundai: ['G70','G80','G90','Sonata','Veloster','Elantra','Genesis','Stinger'],
  Kia: ['Stinger','G70','G80','G90','Sonata','Veloster','Elantra','Genesis'],
  Mercedes: ['C-Class','E-Class','S-Class','G-Class','GLA 45','GLC 63','GLC 43','GLE 53','GLE 250','GLA 45','GLA 35','GLA 250','GLS 450','GLE 43','GLC 300','AMG GT','C43 AMG','C63 AMG','E43 AMG'],
  Ford: ['F-150','F-250','Mustang','Raptor','Bronco','Explorer','Edge','Maverick','Ranger','Focus','Fiesta'],
  Porsche: ['911','Macan','Cayenne','Panamera','Cayman','Boxster','Carrera','Targa','GT4','Turbo S'],
  Subaru: ['WRX','STI','BRZ','Legacy','Crosstrek','Impreza','Forester','Outback','Ascent'],
};
for (const [brand, models] of Object.entries(BRAND_MODELS)) {
  for (const m of models) {
    if (!MODEL_TO_BRAND[m]) MODEL_TO_BRAND[m] = brand;
  }
}

// Pick the dominant brand(s) actually represented by the models we'll show
function pickBrands(models, allBrands) {
  const modelBrands = new Set();
  for (const m of models) {
    const b = MODEL_TO_BRAND[m];
    if (b && allBrands.includes(b)) modelBrands.add(b);
  }
  // If models map to a subset of tagged brands, use only those
  if (modelBrands.size > 0) return [...modelBrands];
  return allBrands;
}
function bmwGroup(model) {
  if (/-Series$/.test(model)) return 0;
  if (/^M\d/.test(model)) return 1;
  if (/^X\d/.test(model) || model === 'XM') return 2;
  if (/^Z\d/.test(model)) return 3;
  if (/^i\d/.test(model)) return 4;
  return 5;
}
function sortModels(models) {
  return [...models].sort((a, b) => {
    const ga = bmwGroup(a), gb = bmwGroup(b);
    if (ga !== gb) return ga - gb;
    const na = parseInt((a.match(/\d+/) || [999])[0]);
    const nb = parseInt((b.match(/\d+/) || [999])[0]);
    return na - nb;
  });
}

function buildSuffix(models, brands, locale) {
  const sorted = sortModels(models);
  if (sorted.length > 7) {
    return locale === 'ua'
      ? ` (${brands.join('/')}: ${sorted.slice(0, 5).join(', ')} та ще ${sorted.length - 5})`
      : ` (${brands.join('/')}: ${sorted.slice(0, 5).join(', ')} +${sorted.length - 5} more)`;
  }
  return ` — ${brands.join('/')} ${sorted.join(', ')}`;
}

// Strip any earlier suffix that we added (with " — " or "(brand: ...)" format)
function stripEarlierSuffix(title) {
  if (!title) return title;
  // Match " — Brand[/Brand2] models..."
  let t = title.replace(/\s+—\s+(?:[A-Za-zА-Яа-яІіЇїЄє]+(?:\/[A-Za-zА-Яа-яІіЇїЄє]+)*)\s+[A-Za-zА-Яа-яІіЇїЄє0-9\-,\s]+$/u, '');
  // Match "(Brand: m1, m2... +N more)" or "(Brand: m1, m2... та ще N)"
  t = t.replace(/\s*\([A-Za-zА-Яа-яІіЇїЄє\/, ]+:\s+[^)]+(?:\+\d+\s*more|та ще \d+)\)\s*$/u, '');
  // Generic "(brand: ..." parens at end with models
  t = t.replace(/\s*\([A-Za-zА-Яа-яІіЇїЄє\/, ]+:\s+[A-Za-zА-Яа-яІіЇїЄє0-9\-,\s+]+\)\s*$/u, '');
  return t.trim();
}

async function main() {
  const products = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports' },
    select: { id: true, titleEn: true, titleUa: true, tags: true },
  });

  let changed = 0;
  for (const p of products) {
    const models = getModels(p.tags);
    if (models.length === 0) continue;
    const brands = getBrands(p.tags);
    if (brands.length === 0) continue;

    // Strip old suffix
    const baseEn = stripEarlierSuffix(p.titleEn);
    const baseUa = stripEarlierSuffix(p.titleUa || '');

    // Skip if title already has any specific model name in base
    const hasSpecific = models.some((m) => baseEn.includes(m) || baseUa.includes(m));
    if (hasSpecific) {
      // Just persist the stripped title (no suffix)
      const data = {};
      if (baseEn !== p.titleEn) data.titleEn = baseEn;
      if (baseUa !== (p.titleUa || '')) data.titleUa = baseUa;
      if (Object.keys(data).length > 0) {
        await prisma.shopProduct.update({ where: { id: p.id }, data });
        changed++;
      }
      continue;
    }

    const dominantBrands = pickBrands(models, brands);
    const suffixEn = buildSuffix(models, dominantBrands, 'en');
    const suffixUa = buildSuffix(models, dominantBrands, 'ua');
    const newEn = baseEn + suffixEn;
    const newUa = baseUa + suffixUa;

    const data = {};
    if (newEn !== p.titleEn) data.titleEn = newEn;
    if (newUa !== p.titleUa) data.titleUa = newUa;
    if (Object.keys(data).length > 0) {
      await prisma.shopProduct.update({ where: { id: p.id }, data });
      changed++;
    }
  }
  console.log('Updated:', changed);

  // Sample
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: 'Burger Motorsports', titleEn: { contains: 'Group 11' } },
    select: { titleEn: true, titleUa: true },
  });
  if (sample) {
    console.log('\nGroup 11 final:');
    console.log('  EN:', sample.titleEn);
    console.log('  UA:', sample.titleUa);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
