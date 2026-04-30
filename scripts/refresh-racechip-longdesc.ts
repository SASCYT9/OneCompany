/**
 * Regenerate longDesc / bodyHtml for RaceChip products whose HTML still
 * matches the auto-generated <div class="racechip-specs">…</div> shape.
 * Manually edited descriptions stay untouched.
 *
 * Why a separate script? The first apply pass focused on price/short desc
 * and skipped HTML blocks for safety. With pattern-gated regeneration we
 * can safely sweep the long descriptions too — products where the user
 * hand-edited the body keep their content.
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

type ScrapedProduct = {
  url: string;
  makeSlug: string;
  modelSlug: string;
  engineSlug: string;
  baseHp: number;
  baseKw: number;
  baseNm: number;
  ccm: number;
  gainHp: number;
  gainNm: number;
  selectedTier?: string;
};

function generateSlug(p: ScrapedProduct): string {
  return `racechip-gts5-${p.makeSlug}-${p.modelSlug}-${p.engineSlug}`
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 200);
}

function formatMake(slug: string): string {
  const special: Record<string, string> = {
    bmw: 'BMW', vw: 'Volkswagen', 'mercedes-benz': 'Mercedes-Benz',
    'alfa-romeo': 'Alfa Romeo', 'land-rover': 'Land Rover',
  };
  if (special[slug]) return special[slug];
  return slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function formatModel(slug: string): string {
  return slug
    .replace(/-from-\d+/, '')
    .replace(/-\d+-to-\d+/, '')
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function generateDescEn(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const totalHp = p.baseHp + p.gainHp;
  const totalNm = p.baseNm + p.gainNm;
  return `<div class="racechip-specs">
<h3>Performance Upgrade</h3>
<ul>
  <li><strong>Vehicle:</strong> ${make} ${model}</li>
  <li><strong>Engine:</strong> ${p.ccm}cc / ${p.baseHp} HP (${p.baseKw} kW) / ${p.baseNm} Nm</li>
  <li><strong>Power Gain:</strong> +${p.gainHp} HP / +${p.gainNm} Nm</li>
  <li><strong>Total After Tuning:</strong> ${totalHp} HP / ${totalNm} Nm</li>
  <li><strong>Module:</strong> RaceChip GTS 5 — Maximum Driving Dynamics</li>
  <li><strong>App Control:</strong> ✅ Included in price — full smartphone control via RaceChip App</li>
</ul>
<h3>What's Included</h3>
<ul>
  <li>RaceChip GTS 5 tuning module</li>
  <li>RaceChip App Control module (included, no extra cost)</li>
  <li>7 fine tuning mappings</li>
  <li>RaceChip safety package</li>
  <li>Lifetime software updates</li>
  <li>Up to 15% fuel savings</li>
</ul>
<p><em>Easy plug & play installation. No permanent modifications to your vehicle.</em></p>
</div>`;
}

function generateDescUa(p: ScrapedProduct): string {
  const make = formatMake(p.makeSlug);
  const model = formatModel(p.modelSlug);
  const totalHp = p.baseHp + p.gainHp;
  const totalNm = p.baseNm + p.gainNm;
  return `<div class="racechip-specs">
<h3>Збільшення потужності</h3>
<ul>
  <li><strong>Автомобіль:</strong> ${make} ${model}</li>
  <li><strong>Двигун:</strong> ${p.ccm}cc / ${p.baseHp} к.с. (${p.baseKw} кВт) / ${p.baseNm} Нм</li>
  <li><strong>Приріст:</strong> +${p.gainHp} к.с. / +${p.gainNm} Нм</li>
  <li><strong>Після тюнінгу:</strong> ${totalHp} к.с. / ${totalNm} Нм</li>
  <li><strong>Модуль:</strong> RaceChip GTS 5 — Максимальна динаміка</li>
  <li><strong>App Control:</strong> ✅ Вже включено в ціну — повне керування зі смартфону через RaceChip App</li>
</ul>
<h3>Що входить в комплект</h3>
<ul>
  <li>Тюнінг-модуль RaceChip GTS 5</li>
  <li>Модуль RaceChip App Control (включено, без додаткових витрат)</li>
  <li>7 точних налаштувань картографії</li>
  <li>Пакет безпеки RaceChip</li>
  <li>Довічні оновлення софту</li>
  <li>Економія палива до 15%</li>
</ul>
<p><em>Проста plug & play установка. Без постійних модифікацій автомобіля.</em></p>
</div>`;
}

// Auto pattern: starts with the racechip-specs div opener and contains the
// "Приріст" / "Power Gain" line. Manual edits won't have both.
function isAutoUa(html: string | null | undefined): boolean {
  if (!html) return false;
  return /<div class="racechip-specs">/.test(html) && /Приріст:.*\+\d+\s*к\.с\./.test(html);
}
function isAutoEn(html: string | null | undefined): boolean {
  if (!html) return false;
  return /<div class="racechip-specs">/.test(html) && /Power Gain:.*\+\d+\s*HP/.test(html);
}

async function main() {
  const data: ScrapedProduct[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'racechip-products.json'), 'utf-8')
  );
  console.log(`📦 ${data.length} products in JSON`);

  let checked = 0;
  let longUa = 0, longEn = 0, bodyUa = 0, bodyEn = 0;
  let untouched = 0;

  for (const p of data) {
    const slug = generateSlug(p);
    const row = await prisma.shopProduct.findUnique({
      where: { slug },
      select: {
        id: true,
        longDescUa: true,
        longDescEn: true,
        bodyHtmlUa: true,
        bodyHtmlEn: true,
      },
    });
    if (!row) continue;
    checked++;

    const patch: Record<string, string> = {};
    const freshUa = generateDescUa(p);
    const freshEn = generateDescEn(p);

    if (isAutoUa(row.longDescUa) && row.longDescUa !== freshUa) { patch.longDescUa = freshUa; longUa++; }
    if (isAutoEn(row.longDescEn) && row.longDescEn !== freshEn) { patch.longDescEn = freshEn; longEn++; }
    if (isAutoUa(row.bodyHtmlUa) && row.bodyHtmlUa !== freshUa) { patch.bodyHtmlUa = freshUa; bodyUa++; }
    if (isAutoEn(row.bodyHtmlEn) && row.bodyHtmlEn !== freshEn) { patch.bodyHtmlEn = freshEn; bodyEn++; }

    if (Object.keys(patch).length === 0) {
      untouched++;
      continue;
    }
    await prisma.shopProduct.update({ where: { id: row.id }, data: patch });
  }

  console.log(`\nChecked: ${checked}
  longDescUa updated: ${longUa}
  longDescEn updated: ${longEn}
  bodyHtmlUa updated: ${bodyUa}
  bodyHtmlEn updated: ${bodyEn}
  Untouched (manual or already current): ${untouched}`);

  const cachePath = path.join(process.cwd(), '.shop-products-dev-cache.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Dev cache: deleted');
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
