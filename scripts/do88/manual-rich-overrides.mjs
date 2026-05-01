#!/usr/bin/env node
/**
 * Manual rich-description overrides for the 4 do88 SKUs whose source
 * pages had only one section, so Gemini produced a flat <p> output
 * without <h3> structure. Rewriting those by hand with clean
 * Передумова / Ключові характеристики / etc. sections.
 *
 * Run: node scripts/do88/manual-rich-overrides.mjs
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DEV_CACHE = path.join(ROOT, '.shop-products-dev-cache.json');

const OVERRIDES = {
  'BIG-M3-MAN': {
    bodyHtmlUa: `<p><strong>do88 з гордістю представляє значно покращену серію радіаторів для BMW M3 E90 — найкращий комплект для тих, хто хоче мати всі наші теплообмінники в одному автомобілі.</strong></p>
<h3>Що входить у комплект</h3>
<ul>
<li>Радіатор моторної оливи M3</li>
<li>Радіатор гідропідсилювача керма M3</li>
<li>Водяний радіатор M3</li>
</ul>
<h3>Передумова</h3>
<p>BMW M3 захоплює автолюбителів з часів першого E30, і серія E90 не виняток. Багато хто вважає її ідеальним поєднанням повсякденного комфорту та трекової продуктивності. Справжній спорткар з місцем для пасажирів. Збалансоване шасі, міцна конструкція та високообертовий V8 роблять її майже ідеальною основою для гоночного автомобіля — але лише майже. Перегрів води та оливи був одним з небагатьох болючих моментів цієї моделі. do88 проаналізував причини й розробив надійне рішення.</p>
<h3>Чому це важливо</h3>
<p>Big Pack — це продукт для водія, який використовує автомобіль за межами звичайної експлуатації. Підходить для трекових днів, кільцевих гонок, ендуранс-заїздів або інтенсивної дорожньої їзди, де висуваються особливі вимоги до витривалості без компромісів. Це один із продуктів в історії do88, на розробку якого пішло найбільше часу — і це чітко видно у точності встановлення, якості обробки та результатах на треку.</p>
<h3>Готовий продукт</h3>
<p>З цим Big Pack автомобіль можна нарешті використовувати так, як він був задуманий — без думок про температурні режими.</p>
<p><strong>OE-референси:</strong> WC-190</p>`,
    bodyHtmlEn: `<p><strong>do88 proudly presents a significantly upgraded cooling series for the BMW M3 E90 — the ultimate kit for owners who want every one of our heat exchangers in one car.</strong></p>
<h3>What's included</h3>
<ul>
<li>M3 engine oil cooler</li>
<li>M3 power steering cooler</li>
<li>M3 water radiator</li>
</ul>
<h3>Background</h3>
<p>The BMW M3 has captivated enthusiasts since the original E30, and the E90 series is no exception. Many regard it as the perfect blend of everyday usability and track performance — a true sports car with room for passengers. A well-tuned chassis, robust construction and a high-revving V8 make it an almost-perfect canvas for a track car. Almost. Soaring water and oil temperatures have been one of the few persistent issues with these cars. do88 analysed the causes and engineered a durable solution.</p>
<h3>Considerations</h3>
<p>The Big Pack is for the driver who pushes the car beyond ordinary use. Ideal for track days, circuit racing, endurance events, or hard street driving where uncompromising stamina is required. This is one of the longest-developed products in do88's history, and it shows — in fitment precision, finish quality, and track results.</p>
<h3>The finished product</h3>
<p>With this Big Pack the car can finally be used the way it was designed to be used — without second-guessing the temperature gauges.</p>
<p><strong>OE references:</strong> WC-190</p>`,
  },

  'BIG-M3-DCT': {
    bodyHtmlUa: `<p><strong>do88 з гордістю представляє значно покращену серію радіаторів для BMW M3 E90 з DKG/DCT — найкращий комплект для тих, хто хоче мати всі наші теплообмінники в одному автомобілі.</strong></p>
<h3>Що входить у комплект</h3>
<ul>
<li>Радіатор моторної оливи M3</li>
<li>Радіатор оливи коробки DKG / DCT</li>
<li>Радіатор гідропідсилювача керма M3</li>
<li>Водяний радіатор M3</li>
</ul>
<h3>Передумова</h3>
<p>BMW M3 захоплює автолюбителів з часів першого E30, і серія E90 не виняток. Багато хто вважає її ідеальним поєднанням повсякденного комфорту та трекової продуктивності. Справжній спорткар з місцем для пасажирів. Збалансоване шасі, міцна конструкція та високообертовий V8 роблять її майже ідеальною основою для гоночного автомобіля — але лише майже. Перегрів води та оливи був одним з небагатьох болючих моментів цієї моделі. do88 проаналізував причини й розробив надійне рішення.</p>
<h3>Чому це важливо</h3>
<p>Big Pack — це продукт для водія, який використовує автомобіль за межами звичайної експлуатації. Підходить для трекових днів, кільцевих гонок, ендуранс-заїздів або інтенсивної дорожньої їзди, де висуваються особливі вимоги до витривалості без компромісів. На відміну від ручної версії, цей комплект включає окремий теплообмінник для оливи DKG/DCT — критично важливий під час тривалих скидань і агресивної їзди на треку. Це один із продуктів в історії do88, на розробку якого пішло найбільше часу — і це чітко видно у точності встановлення, якості обробки та результатах на треку.</p>
<h3>Готовий продукт</h3>
<p>З цим Big Pack автомобіль можна нарешті використовувати так, як він був задуманий — без думок про температурні режими.</p>`,
    bodyHtmlEn: `<p><strong>do88 proudly presents a significantly upgraded cooling series for the BMW M3 E90 with DKG/DCT — the ultimate kit for owners who want every one of our heat exchangers in one car.</strong></p>
<h3>What's included</h3>
<ul>
<li>M3 engine oil cooler</li>
<li>DKG / DCT transmission oil cooler</li>
<li>M3 power steering cooler</li>
<li>M3 water radiator</li>
</ul>
<h3>Background</h3>
<p>The BMW M3 has captivated enthusiasts since the original E30, and the E90 series is no exception. Many regard it as the perfect blend of everyday usability and track performance — a true sports car with room for passengers. A well-tuned chassis, robust construction and a high-revving V8 make it an almost-perfect canvas for a track car. Almost. Soaring water and oil temperatures have been one of the few persistent issues with these cars. do88 analysed the causes and engineered a durable solution.</p>
<h3>Considerations</h3>
<p>The Big Pack is for the driver who pushes the car beyond ordinary use. Ideal for track days, circuit racing, endurance events, or hard street driving where uncompromising stamina is required. Unlike the manual variant, this kit includes a dedicated DKG/DCT transmission oil cooler — critical during sustained downshifts and hard track work. This is one of the longest-developed products in do88's history, and it shows — in fitment precision, finish quality, and track results.</p>
<h3>The finished product</h3>
<p>With this Big Pack the car can finally be used the way it was designed to be used — without second-guessing the temperature gauges.</p>`,
  },

  'ICM-350-S': {
    bodyHtmlUa: `<p><strong>Преміум-інтеркулер do88 для BMW 135i / 335i (E9X / E82, N54 / N55, 2007–2013), розроблений для простої установки на штатне місце.</strong></p>
<h3>Ключові характеристики</h3>
<ul>
<li>Об'єм теплообмінника 15 517 см³ проти 6 933 см³ — на <strong>124% більше</strong> за оригінал</li>
<li>Активна площа охолодження 1 151 см² проти 658 см² — на <strong>75% більше</strong></li>
<li>Потік повітря при перепаді тиску 0,15 бар: 498 CFM проти 357 CFM — на <strong>41% вище</strong></li>
<li>Приріст пікової потужності <strong>+13 к.с.</strong> (заміряно на 335xi N55 з прошивкою Stage 1)</li>
<li>Температура після інтеркулера: 43 °C проти 58 °C — на <strong>15 °C нижче</strong> в тих самих умовах</li>
<li>Повністю алюмінієва конструкція з суцільними зварними швами</li>
<li>Стандартні з'єднання Ø3" (76 мм) замість штатних кліп-фітингів</li>
</ul>
<h3>Передумова</h3>
<p>Штатний інтеркулер 1-/3-Series N54/N55 використовує "клік-з'єднання" на обох патрубках. Цей тип з'єднань є обмежувачем для потоку повітря і не дуже надійний при високому тиску наддуву. Гумові патрубки та пластиковий "J-пайп" (вихідний патрубок інтеркулера) — додаткові слабкі місця. Поширений міф про те, що інтеркулер не потрібно міняти, доки не досягнуто високого ступеня тюнінгу, не відповідає дійсності: у теплу погоду, при повторних прискореннях або в активному режимі їзди штатний теплообмінник перегрівається навіть на повністю стоковому автомобілі — і обіцяна потужність різко падає.</p>
<h3>Чому це важливо</h3>
<p>Об'єм теплообмінника, збільшений на 124%, відчувається на дорозі: двигун значно краще тягне у всьому діапазоні обертів і витримує багаторазові прискорення без накопичення тепла. Покращений потік плюс надійні з'єднання дають кращу динаміку, нижче падіння тиску та інсталяцію, яка справді тримає високий boost.</p>
<h3>Готовий продукт</h3>
<p>Інтеркулер максимально оптимізовано за габаритами для встановлення на штатне місце. До комплекту входить алюмінієвий J-пайп діаметром 2,5" (63 мм), вигнутий на дорні, та посилені силіконові патрубки. Наш J-пайп сумісний як зі штатним пайпом наддуву, так і з афтермаркет-пайпами, спроєктованими під спарку зі штатним пластиковим J-пайпом. Пластиковий повітропровід штатного інтеркулера потребує обрізки (див. інструкцію з монтажу) — окремий повітропровід для верхньої частини теплообмінника також входить до комплекту, щоб охолоджуюче повітря не прослизало повз радіатор.</p>
<h3>Що входить у комплект</h3>
<ul>
<li>Інтеркулер do88 у зборі</li>
<li>Алюмінієвий J-пайп Ø2,5" (63 мм)</li>
<li>Посилені силіконові патрубки</li>
<li>Пластиковий повітропровід для верхньої кромки теплообмінника</li>
<li>Гвинти, шайби, хомути</li>
<li>Інструкція з монтажу</li>
</ul>
<p><strong>OE-референси:</strong> TR-270S</p>`,
    bodyHtmlEn: `<p><strong>do88 premium intercooler for BMW 135i / 335i (E9X / E82, N54 / N55, 2007–2013), engineered for OE-position fitment.</strong></p>
<h3>Key features</h3>
<ul>
<li>Core volume 15,517 cm³ vs 6,933 cm³ — <strong>124% larger</strong> than OEM</li>
<li>Active cooling area 1,151 cm² vs 658 cm² — <strong>75% larger</strong></li>
<li>Airflow at 0.15 bar pressure drop: 498 CFM vs 357 CFM — <strong>41% higher</strong></li>
<li>Peak-power gain of <strong>+13 hp</strong> (measured on a 335xi N55 with a Stage 1 tune)</li>
<li>Post-intercooler temperature: 43 °C vs 58 °C — <strong>15 °C lower</strong> under identical conditions</li>
<li>Full aluminium construction with solid TIG welds</li>
<li>Standard Ø3" (76 mm) connections in place of OEM clip fittings</li>
</ul>
<h3>Background</h3>
<p>The OEM 1-Series / 3-Series N54/N55 intercooler uses "click" couplings on both pipes. They are flow-restrictive and not particularly reliable at higher boost. The rubber pipes and the plastic "J-pipe" (intercooler outlet) are additional weak points. The common but mistaken belief that the intercooler only matters once tuning is significant doesn't hold — on warm days, repeat acceleration runs, or hard driving the OEM core overheats even on a fully stock car, and the promised power drops away.</p>
<h3>Considerations</h3>
<p>The 124% larger core volume is genuinely felt on the road: the engine pulls noticeably harder across the rev range and tolerates repeat acceleration without heat soak. Improved flow plus solid connections deliver better response, lower pressure drop, and an installation that actually holds high boost.</p>
<h3>The finished product</h3>
<p>The intercooler is space-optimised to drop into the OE position. The kit ships with a mandrel-bent 2.5" (63 mm) aluminium J-pipe and reinforced silicone hoses. Our J-pipe is compatible with the OEM charge pipe or with aftermarket charge pipes designed to mate with the OEM plastic J-pipe. The OEM plastic air shroud must be trimmed (see install instructions) — a dedicated shroud for the top edge of the core is also included to stop cooling air from slipping past the radiator.</p>
<h3>What's in the box</h3>
<ul>
<li>do88 intercooler assembly</li>
<li>2.5" (63 mm) aluminium J-pipe</li>
<li>Reinforced silicone hoses</li>
<li>Plastic air shroud for the top of the core</li>
<li>Bolts, washers, clamps</li>
<li>Installation instructions</li>
</ul>
<p><strong>OE references:</strong> TR-270S</p>`,
  },

  'ICM-250-S-1R': {
    bodyHtmlUa: `<p><strong>Високопродуктивний інтеркулер do88 для Volvo V40 (з 2013), сумісний зі штатною інсталяцією без модифікацій кузова.</strong></p>
<h3>Ключові характеристики — Volvo V40 2013–2015</h3>
<ul>
<li>Об'єм теплообмінника 18 480 см³ проти 6 478 см³ — на <strong>185% більше</strong> за оригінал</li>
<li>Потік повітря при перепаді тиску 0,175 бар: 508 CFM проти 365 CFM — на <strong>39% вище</strong></li>
</ul>
<h3>Ключові характеристики — Volvo V40 2015 і новіші</h3>
<ul>
<li>Об'єм теплообмінника 18 480 см³ проти 7 544 см³ — на <strong>145% більше</strong> за оригінал</li>
<li>Потік повітря при перепаді тиску 0,175 бар: 481 CFM проти 297 CFM — на <strong>62% вище</strong></li>
</ul>
<h3>Передумова</h3>
<p>Поширений міф про те, що інтеркулер не потрібно міняти, доки не досягнуто високого ступеня тюнінгу, не відповідає дійсності. У спекотні дні, при повторних прискореннях, активному водінні або просто в теплому кліматі двигуну не треба багато зусиль, щоб почати генерувати небезпечно високі температури на впуску — навіть на повністю стоковому автомобілі. Ефективність штатного теплообмінника в багатьох випадках явно недостатня, і це безпосередньо позначається на потужності.</p>
<h3>Чому це важливо</h3>
<p>Збільшення об'єму теплообмінника на 185% (або 145% залежно від року випуску) — різниця, яку справді відчувається. Двигун значно краще тягне у всьому діапазоні обертів і витримує багаторазові прискорення без накопичення тепла. Тепло необхідно відводити, інакше обіцяна потужність падає вже після першого прискорення.</p>
<h3>Готовий продукт</h3>
<p>Інтеркулер виконаний повністю з алюмінію з суцільними зварними швами для довговічності та витривалості. Габарити максимально оптимізовано під штатне місце — установка не потребує жодних модифікацій оригінальної конструкції автомобіля.</p>
<h3>Що входить у комплект</h3>
<ul>
<li>Інтеркулер do88 у зборі</li>
<li>Гвинти та шайби</li>
<li>Кріпильні пластини</li>
<li>Інструкція зі встановлення</li>
</ul>`,
    bodyHtmlEn: `<p><strong>do88 high-performance intercooler for Volvo V40 (2013+), drop-in fitment with no body modifications required.</strong></p>
<h3>Key features — Volvo V40 2013–2015</h3>
<ul>
<li>Core volume 18,480 cm³ vs 6,478 cm³ — <strong>185% larger</strong> than OEM</li>
<li>Airflow at 0.175 bar pressure drop: 508 CFM vs 365 CFM — <strong>39% higher</strong></li>
</ul>
<h3>Key features — Volvo V40 2015 and newer</h3>
<ul>
<li>Core volume 18,480 cm³ vs 7,544 cm³ — <strong>145% larger</strong> than OEM</li>
<li>Airflow at 0.175 bar pressure drop: 481 CFM vs 297 CFM — <strong>62% higher</strong></li>
</ul>
<h3>Background</h3>
<p>The common but mistaken belief that the intercooler only matters once tuning is significant doesn't hold. On hot days, repeat acceleration runs, hard driving, or simply in a warm climate, the engine doesn't need much provocation to start generating dangerously high intake-air temperatures — even on a strictly stock car. The OEM core's cooling capacity is plainly insufficient in many situations, and that directly hits power output.</p>
<h3>Considerations</h3>
<p>A 185% (or 145%, depending on year) increase in core volume is a difference you genuinely feel. The engine pulls noticeably harder across the rev range and tolerates repeat acceleration without heat soak. Heat has to be dissipated; otherwise the promised power falls away after the first run.</p>
<h3>The finished product</h3>
<p>The intercooler is built entirely from aluminium with solid welds for durability and stamina. The dimensions are space-optimised for the OE location — installation requires no modifications to the original vehicle structure.</p>
<h3>What's in the box</h3>
<ul>
<li>do88 intercooler assembly</li>
<li>Bolts and washers</li>
<li>Mounting plates</li>
<li>Installation instructions</li>
</ul>`,
  },
};

async function main() {
  const prisma = new PrismaClient();
  let updated = 0;
  for (const [sku, body] of Object.entries(OVERRIDES)) {
    const product = await prisma.shopProduct.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' } },
      select: { id: true, slug: true, sku: true, bodyHtmlUa: true, bodyHtmlEn: true },
    });
    if (!product) {
      console.log(`[!] not found: ${sku}`);
      continue;
    }
    await prisma.shopProduct.update({
      where: { id: product.id },
      data: { bodyHtmlUa: body.bodyHtmlUa, bodyHtmlEn: body.bodyHtmlEn },
    });
    console.log(`[ok] ${sku} → ${product.slug} (UA ${body.bodyHtmlUa.length} / EN ${body.bodyHtmlEn.length} chars)`);
    updated++;
  }
  await prisma.$disconnect();

  // Bust dev cache
  try {
    await fs.unlink(DEV_CACHE);
    console.log(`[cache] deleted ${DEV_CACHE}`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[cache]', err.message);
  }

  console.log(`[done] updated ${updated}/${Object.keys(OVERRIDES).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
