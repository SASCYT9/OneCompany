/**
 * UA description builder for Ilmberger products.
 *
 * STRATEGY: Translate the REAL Ilmberger EN body HTML by replacing fixed
 * phrases (Ilmberger uses ~4 structured copy templates with ~80 repeating
 * sentences) — NOT a one-size-fits-all template. Preserves HTML tags by
 * doing case-insensitive whole-phrase replacement.
 *
 * Used by both auto-translate.mjs (Ducati) and apply-translations.mjs (BMW).
 */

// ── Phrase dictionary — sourced verbatim from Ilmberger EN descriptions.
// Order matters: long phrases must come BEFORE shorter ones that overlap.
// Sentences are kept whole to preserve punctuation & flow.
const PHRASES = [
  // ─── Closing boilerplate (same across all 174 products) ────────────
  [
    "Anyone who chooses a carbon part from Ilmberger knows: The path to the finished product is demanding and requires the highest precision.",
    "Кожен, хто обирає карбонову деталь Ilmberger, знає: шлях до готового виробу складний і вимагає найвищої точності.",
  ],
  [
    "A fascinating insight into how each part is created at Ilmberger Carbon with passion and know-how can be found in the detailed report on the production process.",
    "Захопливий погляд на те, як кожна деталь створюється в Ilmberger Carbon з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "A fascinating insight into how each part at Ilmberger Carbon is created with passion and expertise can be found in the detailed report on the production process.",
    "Захопливий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та фаховістю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "An exciting insight into how each part is created at Ilmberger Carbon with passion and know-how can be found in the detailed report on the production process.",
    "Цікавий погляд на те, як кожна деталь створюється в Ilmberger Carbon з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "An exciting insight into how Ilmberger creates each part from passion and know-how can be found in the detailed report on the production process.",
    "Цікавий погляд на те, як Ilmberger створює кожну деталь з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "The in-house development is also full of innovations – discover how much dedication and technical sophistication is in every Ilmberger carbon part.",
    "Власні розробки повні інновацій — переконайтеся, скільки відданості та технічної досконалості міститься в кожній карбоновій деталі Ilmberger.",
  ],
  [
    "The in-house development is also full of innovations – discover how much dedication and technical sophistication goes into every Ilmberger carbon part.",
    "Власні розробки повні інновацій — переконайтеся, скільки відданості та технічної досконалості вкладено в кожну карбонову деталь Ilmberger.",
  ],
  [
    "The in-house development is also full of innovations – discover how much dedication and technical finesse is in every Ilmberger carbon part.",
    "Власні розробки повні інновацій — переконайтеся, скільки відданості та технічної майстерності міститься в кожній карбоновій деталі Ilmberger.",
  ],

  // ─── Pattern A: BMW structured copy ─────────────────────────────────
  ["Perfect fit and outstanding quality", "Ідеальне посадкове місце та виняткова якість"],
  [
    "Replaces the original component with original mounting points.",
    "Замінює штатну деталь — використовуються оригінальні точки кріплення.",
  ],
  [
    "Experts insert fiber layers for harmonious design.",
    "Фахівці укладають шари волокна для гармонійного дизайну.",
  ],
  [
    "Made from prepreg fabric, as used in Formula 1 and aerospace.",
    "Виготовлено з препрег-тканини, як у Формулі 1 та аерокосмічній індустрії.",
  ],
  ["Unique material properties", "Унікальні властивості матеріалу"],
  [
    "Three times the specific stiffness of steel at low weight.",
    "Втричі вища питома жорсткість порівняно зі сталлю — при значно меншій вазі.",
  ],
  [
    "High-quality plastic coating protects against environmental influences.",
    "Високоякісне пластикове покриття захищає від впливу довкілля.",
  ],
  [
    "Clear coat provides an unparalleled depth effect.",
    "Прозорий лак створює неперевершений ефект глибини.",
  ],
  ["Easy installation and tested safety", "Простий монтаж та перевірена безпека"],
  [
    "With ABE - no additional registration required.",
    "Із сертифікатом <strong>ABE</strong> — додаткова реєстрація не потрібна.",
  ],
  [
    "UV-protected and delivered in ready-to-install condition.",
    "З UV-захистом, постачається готовим до монтажу.",
  ],
  [
    "TÜV certified quality, ISO 9001 production.",
    "Якість, сертифікована <strong>TÜV</strong>; виробництво за стандартом <strong>ISO 9001</strong>.",
  ],
  ["Quick and easy assembly.", "Швидкий та простий монтаж."],

  // ─── Pattern B: Ducati ab_2018 (Key Features / Benefits / Advanced) ─
  ["Key Features", "Ключові характеристики"],
  [
    "Designed for Ducati Panigale V4 / V4 S (from 2018).",
    "Розроблено для Ducati Panigale V4 / V4 S (з 2018 р.).",
  ],
  ["Glossy finish for a sleek look.", "Глянцевий фініш для елегантного вигляду."],
  ["Matt finish for a discreet, stealth look.", "Матовий фініш для стриманого, стелс-вигляду."],
  ["Matte finish for a stealth look.", "Матовий фініш для стелс-вигляду."],
  [
    "Direct replacement using original mounting points and screws.",
    "Пряма заміна — використовуються штатні точки кріплення та гвинти.",
  ],
  ["Includes internal cable guide for ABS sensor.", "Має внутрішній канал для кабелю датчика ABS."],
  [
    "Special holder for brake lines; original lines easily attachable.",
    "Спеціальний тримач для гальмівних шлангів — штатні шланги легко закріпити.",
  ],
  ["Benefits", "Переваги"],
  [
    "Significant weight reduction (approx. 70% lighter than original).",
    "Суттєве зниження ваги (приблизно на 70% легше за оригінал).",
  ],
  ["Enhanced stiffness for improved performance.", "Підвищена жорсткість для кращої керованості."],
  ["Advanced Manufacturing", "Сучасне виробництво"],
  [
    "Crafted from Prepreg material in an autoclave.",
    "Виготовлено з препрег-матеріалу в автоклаві.",
  ],
  [
    "Protected with a superior plastic coating for durability and scratch resistance.",
    "Захищено високоякісним пластиковим покриттям для довговічності та стійкості до подряпин.",
  ],
  [
    "Coating enhances the 3D effect of the carbon structure.",
    "Покриття підкреслює 3D-ефект структури карбону.",
  ],

  // ─── Pattern C: Ducati ab_2022 (Optimal Fit / High-Quality / Surface) ─
  ["Optimal Fit and Protection", "Оптимальне посадкове місце та захист"],
  [
    "Suitable for models from 2022 with Euro V exhaust system",
    "Підходить для моделей з 2022 р. з вихлопною системою Euro V",
  ],
  [
    "Elegant combination of curve and edge for modern design",
    "Витончене поєднання кривих та граней для сучасного дизайну",
  ],
  [
    "High-quality carbon for better heat protection and cooler outer casing",
    "Високоякісний карбон для кращого захисту від нагрівання та прохолоднішого зовнішнього корпусу",
  ],
  ["High-Quality Materials", "Високоякісні матеріали"],
  [
    "Use of prepreg fabric, known from Formula 1 and aerospace",
    "Застосування препрег-тканини, відомої з Формули 1 та аерокосмічної індустрії",
  ],
  [
    "Hand laminated and cured in an autoclave for maximum stiffness",
    "Ручна ламінація з твердненням в автоклаві для максимальної жорсткості",
  ],
  ["Low weight with high strength", "Мала вага при високій міцності"],
  ["Unique Surface Finishing", "Унікальна обробка поверхні"],
  [
    "Exclusive plastic coating for optimal environmental protection",
    "Ексклюзивне пластикове покриття для оптимального захисту від впливу довкілля",
  ],
  [
    "High-gloss clear coating for impressive depth effect",
    "Високоглянцевий прозорий лак для вражаючого ефекту глибини",
  ],
  ["UV protection for long-lasting quality", "UV-захист для довговічної якості"],
  ["Assembly and Certification", "Монтаж та сертифікація"],
  ["Delivered in ready-to-install condition", "Постачається готовим до монтажу"],
  [
    "Use of original mounting points for easy installation",
    "Використовуються оригінальні точки кріплення для простого встановлення",
  ],
  [
    "With General Operating Permit (ABE) and TÜV certified",
    "Із сертифікатом <strong>ABE</strong> та підтвердженою якістю <strong>TÜV</strong>",
  ],
  [
    "Production according to ISO 9001 standards",
    "Виробництво за стандартом <strong>ISO 9001</strong>",
  ],

  // ─── Pattern D: Ducati ab_2025 (brand storytelling) ─────────────────
  [
    "Give your motorcycle that certain something!",
    "Подаруйте мотоциклу те особливе, чого йому бракує!",
  ],
  ["Why Ilmberger?", "Чому Ilmberger?"],
  [
    "Production in our own facility according to ISO 9001",
    "Власне виробництво за стандартом <strong>ISO 9001</strong>",
  ],
  [
    "ABE in preparation - no additional registration required",
    "Сертифікація <strong>ABE</strong> у процесі — додаткова реєстрація не потрібна",
  ],
  ["Use of specially developed prepreg", "Застосування спеціально розробленого препрегу"],
  [
    "Manufacturing in an autoclave for maximum strength",
    "Виробництво в автоклаві для максимальної міцності",
  ],
  [
    "Unique plastic powder coating for protection and depth effect",
    "Унікальне порошкове покриття для захисту та ефекту глибини",
  ],
  ["Hand laminated by experienced experts", "Ручна ламінація досвідченими майстрами"],
  ["Precise edge cutting by robot", "Прецизійне обрізання країв роботом"],
  [
    "High-gloss clear coat layer for a flawless surface",
    "Високоглянцевий шар прозорого лаку для бездоганної поверхні",
  ],
  ["No aging thanks to UV protection", "Без старіння завдяки UV-захисту"],
  ["Ready-to-install delivery", "Постачання готовим до монтажу"],
  ["TÜV-certified quality", "Якість, сертифікована <strong>TÜV</strong>"],
  ["Ilmberger: Quality that convinces", "Ilmberger: якість, яка переконує"],
  [
    "As a leading manufacturer of carbon parts and OEM producer for brands like Ducati and BMW, our expertise flows into every product.",
    "Як провідний виробник карбонових деталей та OEM-постачальник для Ducati й BMW, ми вкладаємо весь досвід у кожен виріб.",
  ],
  [
    "Our parts withstand even the toughest conditions, such as in the World Superbike Championship (WSBK) and the Endurance World Championship (EWC).",
    "Наші деталі витримують навіть найжорсткіші умови — у Чемпіонаті світу зі Супербайку (WSBK) та Endurance World Championship (EWC).",
  ],
  ["Experience the difference – with Ilmberger Carbon!", "Відчуйте різницю — з Ilmberger Carbon!"],

  // ─── Generic tagline patterns (italic em closing) ───────────────────
  [
    "Experience the perfect combination of style and functionality for your",
    "Відчуйте ідеальне поєднання стилю та функціональності для вашого",
  ],
  [
    "Experience the perfect blend of style and performance with Ilmberger's carbon fender for your Ducati.",
    "Відчуйте ідеальне поєднання стилю та потужності з карбоновим крилом Ilmberger для вашого Ducati.",
  ],
  [
    "Experience the perfect blend of style and performance with Ilmberger's carbon",
    "Відчуйте ідеальне поєднання стилю та потужності з карбоновою деталлю Ilmberger",
  ],
  [" for your Ducati.", " для вашого Ducati."],
  [" for your BMW.", " для вашого BMW."],
  [
    "Experience the perfect symbiosis of technology and design with our carbon heat shield for your Ducati.",
    "Відчуйте ідеальний симбіоз технологій та дизайну з нашим карбоновим тепловим щитом для вашого Ducati.",
  ],
  [
    "Experience the perfect symbiosis of style and functionality with the glossy carbon instrument cover from Ilmberger.",
    "Відчуйте ідеальний симбіоз стилю та функціональності з глянцевою карбоновою накладкою приладової панелі від Ilmberger.",
  ],
  [
    "Experience the perfect symbiosis of style and functionality with the matt carbon instrument cover from Ilmberger.",
    "Відчуйте ідеальний симбіоз стилю та функціональності з матовою карбоновою накладкою приладової панелі від Ilmberger.",
  ],
  [
    "This cover not only enhances the cockpit area of your",
    "Ця накладка не лише візуально підкреслює зону кокпіту вашого",
  ],
  [
    "visually but also offers optimal protection for your instruments.",
    "а й забезпечує оптимальний захист приладів.",
  ],

  // ─── Section titles short ───────────────────────────────────────────
  ["Carbon Front Fender", "Карбонове переднє крило"],
  ["Carbon Heat Shield", "Карбоновий тепловий щит"],
  ["Carbon Instrument Cover", "Карбонова накладка приладової панелі"],
  ["Tank cover top", "Накладка на бак (верхня)"],
  ["from year", "з"],
  ["from MY", "MY"],
  [" from ", " з "],

  // ─── Common phrases that appear in title-restated <h2> ──────────────
  ["Elegant Carbon Instrument Cover for the", "Елегантна карбонова накладка приладової панелі для"],
];

/**
 * Detect carbon finish from SKU prefix / suffix or title.
 *  - Ducati V4P24 series: CG.* = gloss, CM.* = matt
 *  - Ducati 2018-2022:    *.DPV4G.K, *.V422G.K = gloss; *.DPV4M.K, *.V422M.K = matt
 *  - BMW & default:       gloss
 */
export function detectFinish(sku, titleEn) {
  if (/^CM\./.test(sku) || /M\.K$/i.test(sku)) return "matt";
  if (/\bmatt\b/i.test(titleEn)) return "matt";
  return "gloss";
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Translate Ilmberger EN body HTML → UA. Preserves all HTML tags (only
 * textual content inside tags is replaced via case-insensitive phrase
 * lookup).
 *
 * For fragments that don't match any phrase in the dictionary, the text
 * is left as-is (still in English). This is intentional — we'd rather
 * show a few English fragments than fabricate translations.
 */
export function translateEnDescription(htmlEn) {
  let out = htmlEn;
  // Longest phrases first (already roughly ordered, but enforce strictly).
  const sorted = [...PHRASES].sort((a, b) => b[0].length - a[0].length);
  for (const [en, ua] of sorted) {
    const re = new RegExp(escapeRegex(en), "gi");
    out = out.replace(re, ua);
  }
  return out;
}

/**
 * Compatibility wrapper — accepts product shape, returns translated body.
 * If product has no bodyHtmlEn / descriptionHtmlEn, returns a minimal
 * placeholder so something is still shown.
 */
export function buildUaDescription({ titleUa, sku, titleEn, descriptionHtmlEn }) {
  if (descriptionHtmlEn && descriptionHtmlEn.length > 50) {
    let translated = translateEnDescription(descriptionHtmlEn);
    // Replace the H2 (Ilmberger restates the title in EN) with our titleUa,
    // so the heading is consistent with our localized title.
    translated = translated.replace(/<h2>[\s\S]*?<\/h2>/i, `<h2>${titleUa}</h2>`);
    return translated;
  }
  // Fallback for products where the scraper missed the description block.
  return `<h2>${titleUa}</h2>
<p>Карбонова деталь Ilmberger, виготовлена з препрегу в автоклаві — пряма заміна штатної. Якість, сертифікована TÜV; виробництво за ISO 9001.</p>`;
}
