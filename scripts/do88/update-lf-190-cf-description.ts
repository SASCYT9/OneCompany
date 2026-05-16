/**
 * One-shot description update for do88 LF-190-CF (carbon fiber intake).
 *
 * Source: scraped from https://www.do88.se/sv/artiklar/do88-v2-insugssystem-kolfiber-vag-18-20-tsi-ea888.html
 * Method: SV → UA translation, with the PP-variant translation in
 *   scripts/do88/scraped/do88-rich-translated.json reused as a base for the
 *   shared feature list. CF-specific paragraphs (carbon construction +
 *   clearcoat) translated fresh.
 *
 * Run:
 *   npm run -- ts-node scripts/do88/update-lf-190-cf-description.ts -- --dry-run
 *   npm run -- ts-node scripts/do88/update-lf-190-cf-description.ts -- --apply
 *
 * Touches: ShopProduct.longDescUa + ShopProduct.longDescEn for sku=LF-190-CF.
 * No other fields. Per the project's "no prod changes" rule, --dry-run is
 * the default; pass --apply explicitly to write.
 */

import { PrismaClient } from "@prisma/client";

const SKU = "LF-190-CF";

const LONG_DESC_UA = `<p><strong>Ми з гордістю представляємо систему впуску do88 V2 для двигунів VAG 1.8 2.0 TSI EA888 — розроблену для ідеальної сумісності з платформами MQB та MQB EVO (EA888 Gen 4).</strong></p>
<p>Впуск do88 V2 має величезний отвір по всій ширині рамки радіатора, який подає рівний потік прохолодного зовнішнього повітря до великого спеціально розробленого бавовняного повітряного фільтра. Така конструкція забезпечує пряму та безперешкодну дорогу повітря до турбіни, зберігаючи при цьому повноцінну фільтрацію.</p>
<p>Спрощена обтічна форма поєднує функцію та естетику — прямі, чисті лінії доповнюють моторний відсік, а якість виконання підкреслює рівень всієї системи.</p>
<p>Корпус виготовлений із вакуумно-формованого карбону prepreg вищої якості (плетіння 2×2) — це гарантує жорсткість, довговічність та преміальний вигляд. Зверху наноситься УФ- та термостійкий високоглянцевий лак, який повністю виключає пожовтіння з часом.</p>
<p>Система сумісна як з оригінальними, так і з підвищеної продуктивності патрубками наддуву (turbo inlet hoses) — підходить до більшості тюнінг-конфігурацій. У парі з продуктивними патрубками do88 (продаються окремо) ви повністю усуваєте обмеження потоку повітря перед компресором.</p>
<h3>Ключові характеристики</h3>
<ul>
<li>Великий спеціально розроблений бавовняний повітряний фільтр зі щільним плетінням. Фільтр постачається попередньо змащеним та готовим до використання.</li>
<li>Мийний і багаторазовий повітряний фільтр для оптимальної продуктивності та тривалого терміну служби. Рекомендоване чищення — кожні 20 000 км (інструкція додається).</li>
<li>Повноширокий фронтальний отвір — безперешкодний потік повітря до фільтра.</li>
<li>Оптимізовано під тюнінговані двигуни, гібридні турбіни та великі turbo-комплекти.</li>
<li>Приріст до <em>+16 к.с. / +30 Нм</em> на VW Golf GTI Mk7 зі Stage 3.</li>
<li>Збільшення потоку повітря до <em>44%</em> з оригінальним патрубком наддуву (виміряно на VW Golf Mk8 GTI Clubsport) і до <em>84%</em> у поєднанні з продуктивним патрубком do88 (<strong>DO88-KIT240</strong>).</li>
<li>Сумісний з продуктивними патрубками do88, з оригінальними, а також з aftermarket-патрубками, адаптованими під оригінальний корпус повітряного фільтра.</li>
<li>Зменшене падіння тиску — менше навантаження на оригінальні компоненти.</li>
<li>Покращена реакція педалі газу та швидший spool турбіни.</li>
<li>Прямий плавний шлях потоку — без різких вигинів і перешкод.</li>
<li>Більш виразний звук впуску від турбокомпресора та перепускного клапана (dump/blow-off).</li>
<li>Сумісний із більшістю майбутніх модифікацій, наприклад апгрейдом турбіни.</li>
<li>Швидкий монтаж — на оригінальні точки кріплення повітряного фільтра.</li>
<li>Працює на авто з/без SAI. Для авто з SAI фільтр можна докупити окремо.</li>
<li>Корпус має нижній дренажний отвір для відведення води.</li>
<li>УФ- та термостійкий високоглянцевий лак — довготривалий захист корпусу.</li>
</ul>
<h3>Підходить до</h3>
<p><strong>EA888 Gen 3:</strong></p>
<ul>
<li>Volkswagen: Golf Mk7 / Mk7.5 (GTI, Clubsport, R, 1.8 TSI) 2013+ (5G); Passat 2.0 TSI B8 2015+ (3G); Arteon 2.0 TSI 2017+; T-Roc R 2.0 TSI 2019+</li>
<li>Audi: A3 (2.0 / 1.8 TSI) 2013+ (8V); S3 2013+ (8V); TT 2.0 TSI III 2014+ (8S); SQ2 2018+; Q3 45TFSI 2.0 TSI 2018+</li>
<li>SEAT: Leon Cupra Mk3 / 1.8 TSI 2014+ (5F); Ateca Cupra 2.0 TSI 2018+</li>
<li>Škoda: Octavia vRS Mk3 2.0 TSI 2014+ (5E); Superb Mk3 (1.8 / 2.0 TSI) 2015+ (B8 3V)</li>
</ul>
<p><strong>EA888 Gen 4 EVO</strong> (Continental та Garrett turbos):</p>
<ul>
<li>Volkswagen: Golf Mk8 (GTI, GTI Clubsport, R) 2020+; Tiguan II 2.0 TSI 245 / R 320 2021+; Arteon R 2.0 TSI 320 2020+</li>
<li>Audi: A3 2.0 TSI 2020+ (8Y); S3 2020+ (8Y)</li>
<li>Cupra: Leon IV (245 TSI FW, 300 TSI FW) 2020+; Formentor (245, 310) 2020+</li>
<li>Škoda: Octavia IV vRS 2.0 TSI 245 2020+ (NX)</li>
</ul>
<p><strong>OE-референси:</strong> 5Q0129607AC, 5Q0129620B, 5WA129607, 5Q0129620D</p>`;

const LONG_DESC_EN = `<p><strong>We proudly present the do88 V2 Intake System for VAG 1.8 2.0 TSI EA888 engines — developed for a perfect fit on both MQB and MQB EVO (EA888 Gen 4) platforms.</strong></p>
<p>The do88 V2 intake features a huge front-facing opening that spans the full width of the radiator support, delivering a steady stream of cool ambient air to the oversized, custom-designed cotton air filter. The layout ensures a direct, unobstructed path to the turbo while preserving proper filtration.</p>
<p>Streamlined design where form meets function — clean straight lines complement the engine bay, and the level of finish underlines the quality of the entire system.</p>
<p>The airbox is built from top-grade vacuum-formed prepreg carbon fiber (2×2 weave) for rigidity, durability and a premium look. It ships finished in a UV- and heat-resistant high-gloss clearcoat — no yellowing over time.</p>
<p>Compatible with both stock and larger aftermarket turbo inlet hoses, fitting most tuning configurations. Pair it with do88's performance turbo inlet hoses (sold separately) to eliminate every airflow restriction ahead of the compressor and let the turbo breathe without limits.</p>
<h3>Key features</h3>
<ul>
<li>Large, custom-designed cotton air filter with dense weave. Ships pre-oiled, ready to use.</li>
<li>Washable and reusable filter for optimal performance and long lifespan. Recommended cleaning interval: every 20,000 km (procedure in the install guide).</li>
<li>Full-width front opening for unobstructed airflow to the filter.</li>
<li>Optimized for tuned engines, hybrid turbos and large turbo kits.</li>
<li>Up to <em>+16 HP / +30 Nm</em> on a Stage 3 tuned VW Golf GTI Mk7.</li>
<li>Increases airflow up to <em>44%</em> with the stock turbo inlet hose (measured on a VW Golf Mk8 GTI Clubsport) and up to <em>84%</em> combined with the do88 performance turbo inlet hose (<strong>DO88-KIT240</strong>).</li>
<li>Compatible with do88 performance turbo inlet hoses, stock hoses, and all aftermarket hoses adapted to the stock airbox connection.</li>
<li>Reduced pressure drop — less strain on stock components.</li>
<li>Improved throttle response and faster spool.</li>
<li>Straight, smooth flow path — no sharp bends or obstructions.</li>
<li>Enhanced intake sound from the turbocharger and bypass / dump valve.</li>
<li>Compatible with most future modifications, e.g. a turbo upgrade.</li>
<li>Quick install — mounts to the stock airbox mounting points.</li>
<li>Works on cars with and without SAI. For SAI cars, a filter is available separately.</li>
<li>Airbox has a water drainage outlet at the bottom.</li>
<li>UV- and heat-resistant high-gloss clearcoat for long-term protection.</li>
</ul>
<h3>Fits</h3>
<p><strong>EA888 Gen 3:</strong></p>
<ul>
<li>Volkswagen: Golf Mk7 / Mk7.5 (GTI, Clubsport, R, 1.8 TSI) 2013+ (5G); Passat 2.0 TSI B8 2015+ (3G); Arteon 2.0 TSI 2017+; T-Roc R 2.0 TSI 2019+</li>
<li>Audi: A3 (2.0 / 1.8 TSI) 2013+ (8V); S3 2013+ (8V); TT 2.0 TSI III 2014+ (8S); SQ2 2018+; Q3 45TFSI 2.0 TSI 2018+</li>
<li>SEAT: Leon Cupra Mk3 / 1.8 TSI 2014+ (5F); Ateca Cupra 2.0 TSI 2018+</li>
<li>Škoda: Octavia vRS Mk3 2.0 TSI 2014+ (5E); Superb Mk3 (1.8 / 2.0 TSI) 2015+ (B8 3V)</li>
</ul>
<p><strong>EA888 Gen 4 EVO</strong> (Continental and Garrett turbos):</p>
<ul>
<li>Volkswagen: Golf Mk8 (GTI, GTI Clubsport, R) 2020+; Tiguan II 2.0 TSI 245 / R 320 2021+; Arteon R 2.0 TSI 320 2020+</li>
<li>Audi: A3 2.0 TSI 2020+ (8Y); S3 2020+ (8Y)</li>
<li>Cupra: Leon IV (245 TSI FW, 300 TSI FW) 2020+; Formentor (245, 310) 2020+</li>
<li>Škoda: Octavia IV vRS 2.0 TSI 245 2020+ (NX)</li>
</ul>
<p><strong>OE references:</strong> 5Q0129607AC, 5Q0129620B, 5WA129607, 5Q0129620D</p>`;

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const prisma = new PrismaClient();

  try {
    const before = await prisma.shopProduct.findFirst({
      where: { sku: SKU },
      select: {
        id: true,
        slug: true,
        sku: true,
        titleUa: true,
        longDescUa: true,
        longDescEn: true,
        bodyHtmlUa: true,
        bodyHtmlEn: true,
      },
    });

    if (!before) {
      console.error(`✗ Product with sku=${SKU} not found in DB. Aborting.`);
      process.exit(1);
    }

    console.log(`Found product: slug=${before.slug} id=${before.id}`);
    console.log(`  current longDescUa length: ${before.longDescUa?.length ?? 0} chars`);
    console.log(`  current longDescEn length: ${before.longDescEn?.length ?? 0} chars`);
    console.log(`  new longDescUa length:     ${LONG_DESC_UA.length} chars`);
    console.log(`  new longDescEn length:     ${LONG_DESC_EN.length} chars`);
    console.log();

    if (dryRun) {
      console.log("DRY-RUN — no changes written. Re-run with --apply to update.");
      console.log();
      console.log("=== Preview UA (first 800 chars) ===");
      console.log(LONG_DESC_UA.slice(0, 800));
      console.log();
      console.log("=== Preview EN (first 800 chars) ===");
      console.log(LONG_DESC_EN.slice(0, 800));
      return;
    }

    // Update bodyHtml* as well — in mapDbToCatalog (shopCatalogServer) the
    // priority is `row.bodyHtmlUa ?? row.longDescUa`, so a stale bodyHtmlUa
    // (from the original generic-fallback writer) would shadow our updated
    // longDescUa otherwise. Mirror the same content into both fields so the
    // PDP picks it up regardless of which the renderer prefers.
    const result = await prisma.shopProduct.update({
      where: { id: before.id },
      data: {
        longDescUa: LONG_DESC_UA,
        longDescEn: LONG_DESC_EN,
        bodyHtmlUa: LONG_DESC_UA,
        bodyHtmlEn: LONG_DESC_EN,
      },
      select: { id: true, slug: true, sku: true },
    });

    console.log(`✓ Updated ${result.sku} (id=${result.id})`);
    console.log(`  longDescUa: ${before.longDescUa?.length ?? 0} → ${LONG_DESC_UA.length} chars`);
    console.log(`  longDescEn: ${before.longDescEn?.length ?? 0} → ${LONG_DESC_EN.length} chars`);
    console.log(`  bodyHtmlUa: ${before.bodyHtmlUa?.length ?? 0} → ${LONG_DESC_UA.length} chars`);
    console.log(`  bodyHtmlEn: ${before.bodyHtmlEn?.length ?? 0} → ${LONG_DESC_EN.length} chars`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
