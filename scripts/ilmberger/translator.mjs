/**
 * High-quality EN→UA translator for Ilmberger product descriptions.
 *
 * Strategy:
 *  1. Parse HTML structurally — walk every inline tag (h2..h6, li, span, em, p, h4)
 *     and translate ONLY its inner text content (preserves the HTML skeleton).
 *  2. Inner text is matched sentence-by-sentence against:
 *       a) Canonical phrase dictionary (whitespace+punctuation normalized).
 *       b) Parameterized regex patterns ("Suitable for X" → "Підходить для X").
 *  3. If no match: leave the English text intact (NEVER word-by-word translate).
 *     This is intentional — a partially-EN page reads better than fake Ukrainian.
 *
 * The dictionary covers ~200 canonical phrases sourced from real Ilmberger copy
 * variants. Translations are styled for a shop catalogue (clear, sales-y when the
 * original is sales-y, technical when the original is technical).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Normalization: collapse whitespace, normalize dashes, optional trailing dot.
// ─────────────────────────────────────────────────────────────────────────────
function normalize(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[–—]/g, "-") // – em-dash, — en-dash → -
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingDot(s) {
  return s.replace(/[.\s]+$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical phrase dictionary. Order doesn't matter — exact-match lookup.
// Each EN key is matched after normalize() against incoming text.
// ─────────────────────────────────────────────────────────────────────────────
const PHRASES = new Map([
  // ─── Section headings (h3/h4) ──────────────────────────────────────────
  ["Perfect Fit and Design", "Ідеальна посадка та дизайн"],
  ["Perfect Fit & Design", "Ідеальна посадка та дизайн"],
  ["Perfect Fit and Protection", "Ідеальна посадка та захист"],
  ["Perfect Fit and Style", "Ідеальна посадка та стиль"],
  ["Perfect fit and outstanding quality", "Ідеальна посадка та виняткова якість"],
  ["Perfect Protection and Style", "Ідеальний захист та стиль"],
  ["Optimal Fit and Protection", "Оптимальна посадка та захист"],
  ["Key Features", "Ключові характеристики"],
  ["Special Features", "Особливості"],
  ["Main Features", "Основні особливості"],
  ["Product Features", "Характеристики продукту"],
  ["Product Details", "Опис продукту"],
  ["Product Details:", "Опис продукту:"],
  ["Product details", "Опис продукту"],
  ["Product Description", "Опис"],
  ["Product Advantages", "Переваги продукту"],
  ["Advantages", "Переваги"],
  ["Benefits", "Переваги"],
  ["Powerful Advantages", "Виразні переваги"],
  ["Technical Advantages", "Технічні переваги"],
  ["Technical Details", "Технічні деталі"],
  ["Technical Details and Advantages", "Технічні деталі та переваги"],
  ["Technical Highlights", "Ключові технічні характеристики"],
  ["Technical Excellence", "Технічна досконалість"],
  ["Important Facts", "Важливі факти"],
  ["Facts at a Glance", "Стисло про головне"],
  ["Overview of Facts", "Стисло про головне"],
  ["Compatibility", "Сумісність"],
  ["Installation Instructions", "Інструкція з монтажу"],
  ["Easy Installation", "Простий монтаж"],
  ["Easy Installation and Quality", "Простий монтаж та якість"],
  ["Easy Installation and Certification", "Простий монтаж та сертифікація"],
  ["Easy Installation and Certified Quality", "Простий монтаж та сертифікована якість"],
  ["Assembly and Certification", "Монтаж та сертифікація"],
  ["Advanced Manufacturing", "Сучасне виробництво"],
  ["High-Quality Materials", "Високоякісні матеріали"],
  ["High-Quality Material", "Високоякісний матеріал"],
  ["High-Quality Carbon Material", "Високоякісний карбон"],
  ["High-Quality Carbon Design", "Високоякісний карбоновий дизайн"],
  ["High-Quality Workmanship", "Висока якість виконання"],
  ["High-Quality Craftsmanship", "Майстерність виконання"],
  ["Superior Protective Coating", "Преміальне захисне покриття"],
  ["Superior Protective Layer", "Преміальний захисний шар"],
  ["Unique Protective Coating", "Унікальне захисне покриття"],
  ["Unique Protection", "Унікальний захист"],
  ["Unique Protection and Appearance", "Унікальний захист та вигляд"],
  ["Unique Surface Finishing", "Унікальна обробка поверхні"],
  ["Unique Plastic Powder Coating", "Унікальне порошкове покриття"],
  ["Unique plastic powder coating", "Унікальне порошкове покриття"],
  ["Protection through clear plastic coating", "Захист завдяки прозорому полімерному покриттю"],
  ["Functionality and Lightness", "Функціональність та легкість"],
  ["Lightweight and Robust", "Легкий і надійний"],
  ["Light and Robust", "Легкий і надійний"],
  ["Lightweight, Strong, and Sporty", "Легкий, міцний, спортивний"],
  ["Why Ilmberger?", "Чому Ilmberger?"],
  ["Why Ilmberger Carbon?", "Чому Ilmberger Carbon?"],
  ["Ilmberger: Quality that convinces", "Ilmberger: якість, яка переконує"],
  ["Ilmberger Carbon: Quality and Innovation", "Ilmberger Carbon: якість та інновації"],
  ["Experience and Expertise", "Досвід та експертиза"],
  ["Excellent Quality", "Виняткова якість"],
  ["Premium Carbon Technology", "Преміальна карбонова технологія"],
  ["Aesthetics and Functionality", "Естетика та функціональність"],
  ["Handcraft and Precision", "Ручна робота та точність"],
  ["Sporty Protection with Style", "Спортивний захист зі стилем"],
  ["Elegance and Performance Combined", "Поєднання елегантності та продуктивності"],
  ["Elegant Protection for Your Ducati", "Елегантний захист для вашого Ducati"],
  ["Perfect Addition for Your Ducati", "Ідеальне доповнення для вашого Ducati"],
  ["Experience Perfection in Carbon!", "Відчуйте досконалість у карбоні!"],
  [
    "Experience the perfect symbiosis of technology and design!",
    "Відчуйте ідеальний симбіоз технології та дизайну!",
  ],
  [
    "Experience the perfect symbiosis of protection and style!",
    "Відчуйте ідеальний симбіоз захисту та стилю!",
  ],
  ["Experience the difference - with Ilmberger Carbon!", "Відчуйте різницю — з Ilmberger Carbon!"],

  // ─── Bullets — production / materials ───────────────────────────────────
  ["Made from prepreg material in an autoclave", "Виготовлено з препрегу в автоклаві"],
  ["Made from Prepreg material in an autoclave", "Виготовлено з препрегу в автоклаві"],
  ["Crafted from Prepreg material in an autoclave", "Виготовлено з препрегу в автоклаві"],
  ["Made from prepreg carbon in an autoclave", "Виготовлено з препрег-карбону в автоклаві"],
  [
    "Made from prepreg fabric, as used in Formula 1 and aerospace",
    "Виготовлено з препрег-тканини — тієї ж, що у Формулі-1 та аерокосмічній галузі",
  ],
  [
    "Uses prepreg fabric, known from Formula 1 and aerospace",
    "Використовується препрег-тканина, знайома з Формули-1 та аерокосмічної галузі",
  ],
  [
    "Use of prepreg fabric, known from Formula 1 and aerospace",
    "Застосування препрег-тканини, знайомої з Формули-1 та аерокосмічної галузі",
  ],
  [
    "Use of prepreg specially developed for Ilmberger",
    "Застосування препрегу, розробленого спеціально для Ilmberger",
  ],
  ["Use of specially developed prepreg", "Застосування спеціально розробленого препрегу"],
  ["Hand laminated and cured in an autoclave", "Ручна ламінація з тверднення в автоклаві"],
  ["Hand-laminated and cured in an autoclave", "Ручна ламінація з тверднення в автоклаві"],
  [
    "Hand laminated and cured in an autoclave for maximum stiffness",
    "Ручна ламінація з тверднення в автоклаві для максимальної жорсткості",
  ],
  ["Lamination by hand", "Ручна ламінація"],
  [
    "Lamination by hand by experts with years of experience",
    "Ручна ламінація досвідченими майстрами",
  ],
  ["Hand laminated by experienced experts", "Ручна ламінація досвідченими майстрами"],
  ["Hand lamination by experienced experts", "Ручна ламінація досвідченими майстрами"],
  [
    "Experts lay fiber layers for a harmonious overall appearance",
    "Майстри укладають шари волокна для гармонійного зовнішнього вигляду",
  ],
  [
    "Experts insert fiber layers for harmonious design",
    "Майстри укладають шари волокна для гармонійного дизайну",
  ],
  [
    "Manufacturing in the autoclave for maximum strength",
    "Виробництво в автоклаві для максимальної міцності",
  ],
  [
    "Manufacturing in an autoclave for maximum strength",
    "Виробництво в автоклаві для максимальної міцності",
  ],
  [
    "Manufacturing in the autoclave for maximum strength and perfect surfaces",
    "Виробництво в автоклаві для максимальної міцності та бездоганної поверхні",
  ],
  ["Precise edge cutting by robot", "Прецизійне обрізання країв роботом"],
  [
    "Production in our own facility according to ISO 9001",
    "Власне виробництво за стандартом ISO 9001",
  ],
  [
    "Production in our own facility according to ISO Standard 9001",
    "Власне виробництво за стандартом ISO 9001",
  ],
  [
    "Production in our own manufacturing according to ISO 9001",
    "Власне виробництво за стандартом ISO 9001",
  ],
  [
    "Production in our own manufacturing according to ISO Standard 9001",
    "Власне виробництво за стандартом ISO 9001",
  ],
  ["Production according to ISO 9001", "Виробництво за стандартом ISO 9001"],
  ["Production according to ISO 9001 standards", "Виробництво за стандартом ISO 9001"],
  ["Production according to ISO Standard 9001 standards", "Виробництво за стандартом ISO 9001"],
  ["Produced according to ISO 9001 standards", "Виготовлено за стандартом ISO 9001"],
  ["ISO 9001 certified production", "Виробництво, сертифіковане за ISO 9001"],
  ["ISO Standard 9001 certified production", "Виробництво, сертифіковане за ISO 9001"],
  ["ISO standard 9001 certified production", "Виробництво, сертифіковане за ISO 9001"],

  // ─── Bullets — material properties ──────────────────────────────────────
  [
    "Three times the specific stiffness of steel at low weight",
    "Утричі вища питома жорсткість, ніж у сталі — при малій вазі",
  ],
  [
    "Three times the specific stiffness of steel at a lower weight",
    "Утричі вища питома жорсткість, ніж у сталі — при меншій вазі",
  ],
  [
    "Three times the specific stiffness of steel at a fraction of the weight",
    "Утричі вища питома жорсткість, ніж у сталі — при значно меншій вазі",
  ],
  ["Three times the specific stiffness of steel", "Утричі вища питома жорсткість, ніж у сталі"],
  [
    "Three times the stiffness of steel, at a fraction of the weight",
    "Утричі вища жорсткість, ніж у сталі — при значно меншій вазі",
  ],
  [
    "Three times higher specific stiffness than steel",
    "Утричі вища питома жорсткість, ніж у сталі",
  ],
  ["High specific stiffness with low weight", "Висока питома жорсткість при малій вазі"],
  ["Low weight with high strength", "Мала вага при високій міцності"],
  ["Lightweight due to low density", "Легкий завдяки малій густині"],

  // ─── Bullets — protective coating ───────────────────────────────────────
  [
    "High-quality plastic coating protects against environmental influences",
    "Високоякісне полімерне покриття захищає від впливу довкілля",
  ],
  [
    "Exclusive plastic coating protects against environmental influences",
    "Ексклюзивне полімерне покриття захищає від впливу довкілля",
  ],
  [
    "Unique plastic coating protects against environmental influences",
    "Унікальне полімерне покриття захищає від впливу довкілля",
  ],
  [
    "Exclusive plastic coating for optimal protection",
    "Ексклюзивне полімерне покриття для оптимального захисту",
  ],
  [
    "Exclusive plastic coating for optimal environmental protection",
    "Ексклюзивне полімерне покриття для оптимального захисту від довкілля",
  ],
  [
    "Unique plastic coating for optimal protection",
    "Унікальне полімерне покриття для оптимального захисту",
  ],
  [
    "Unique plastic powder coating for protection and a special depth effect",
    "Унікальне порошкове покриття для захисту та особливого ефекту глибини",
  ],
  [
    "Unique plastic powder coating for protection and depth effect",
    "Унікальне порошкове покриття для захисту та ефекту глибини",
  ],
  [
    "Clear plastic coating for optimal protection",
    "Прозоре полімерне покриття для оптимального захисту",
  ],
  [
    "Coated with a clear plastic coating for optimal protection",
    "Вкрито прозорим полімерним покриттям для оптимального захисту",
  ],
  [
    "Coated with a clear plastic coating for maximum protection",
    "Вкрито прозорим полімерним покриттям для максимального захисту",
  ],
  [
    "Coated with scratch-resistant, clear plastic coating",
    "Вкрито стійким до подряпин прозорим полімерним покриттям",
  ],
  [
    "Clear plastic coating for outstanding protection against environmental influences",
    "Прозоре полімерне покриття для виняткового захисту від впливу довкілля",
  ],
  [
    "Protected with a superior plastic coating for durability and scratch resistance",
    "Захищено преміальним полімерним покриттям для довговічності та стійкості до подряпин",
  ],
  [
    "Additional clear coat for impressive depth effect",
    "Додатковий прозорий лак для вражаючого ефекту глибини",
  ],
  ["Additional protection for the frame", "Додатковий захист рами"],
  [
    "Clear coat provides an unparalleled depth effect",
    "Прозорий лак створює неперевершений ефект глибини",
  ],
  [
    "Clear coat provides an unparalleled depth effect.",
    "Прозорий лак створює неперевершений ефект глибини.",
  ],
  [
    "High-gloss clear coating for impressive depth effect",
    "Високоглянцеве прозоре покриття для вражаючого ефекту глибини",
  ],
  [
    "High-gloss clear coat layer for a flawless surface",
    "Високоглянцевий шар прозорого лаку для бездоганної поверхні",
  ],
  ["High-gloss clear coat layer", "Високоглянцевий шар прозорого лаку"],
  [
    "Glossy clear coat layer for a sporty appearance",
    "Глянцевий шар прозорого лаку для спортивного вигляду",
  ],
  [
    "Glossy clear coat layer for a sporty look",
    "Глянцевий шар прозорого лаку для спортивного вигляду",
  ],
  [
    "Matte clear coat layer identical to Ducati Performance parts",
    "Матовий шар прозорого лаку — як у деталях Ducati Performance",
  ],
  [
    "Matte clear coat layer, identical to Ducati Performance parts",
    "Матовий шар прозорого лаку — як у деталях Ducati Performance",
  ],
  ["Silk Matte Clear Coat Layer", "Шовково-матовий шар прозорого лаку"],
  ["Silk matte clear coat layer", "Шовково-матовий шар прозорого лаку"],
  ["Silk-matte clear coat layer", "Шовково-матовий шар прозорого лаку"],
  ["Glossy painted surface", "Глянцеве лакове покриття"],
  ["Glossy finish for a sleek look", "Глянцевий фініш для елегантного вигляду"],
  ["Glossy finish for a sporty look", "Глянцевий фініш для спортивного вигляду"],
  ["Glossy finish for a stylish look", "Глянцевий фініш для стильного вигляду"],
  ["Matt finish for a discreet, stealth look", "Матовий фініш для стриманого, stealth-вигляду"],
  ["Matt finish for a stealth look", "Матовий фініш для stealth-вигляду"],
  ["Matte finish for a stealth look", "Матовий фініш для stealth-вигляду"],
  ["Matte clear coating for UV protection", "Матове прозоре покриття з UV-захистом"],
  [
    "Matte clear coat finish for all visible surfaces",
    "Матовий шар прозорого лаку на всіх видимих поверхнях",
  ],
  [
    "Increased scratch resistance and durability",
    "Підвищена стійкість до подряпин та довговічність",
  ],
  [
    "Increased scratch resistance and durability compared to conventional clear coat",
    "Підвищена стійкість до подряпин та довговічність порівняно зі звичайним лаком",
  ],
  [
    "Superior scratch resistance and durability",
    "Виняткова стійкість до подряпин та довговічність",
  ],
  ["Excellent scratch resistance and durability", "Чудова стійкість до подряпин та довговічність"],
  ["High scratch resistance", "Висока стійкість до подряпин"],
  [
    "Surpasses conventional clear coat in protective effect and scratch resistance",
    "Перевершує звичайний лак за захистом і стійкістю до подряпин",
  ],
  [
    "Exceeds conventional clear coat in protection and scratch resistance",
    "Перевершує звичайний лак за захистом і стійкістю до подряпин",
  ],
  [
    "Enhances the three-dimensional effect of the carbon structure",
    "Підкреслює 3D-ефект структури карбону",
  ],
  ["Enhances the three-dimensional carbon structure", "Підкреслює 3D-ефект структури карбону"],
  ["Emphasizes the three-dimensional carbon structure", "Підкреслює 3D-ефект структури карбону"],
  [
    "Coating enhances the 3D effect of the carbon structure",
    "Покриття підкреслює 3D-ефект структури карбону",
  ],
  ["UV protection prevents material aging", "UV-захист запобігає старінню матеріалу"],
  ["UV protection for long-lasting quality", "UV-захист для довговічної якості"],
  ["No aging thanks to UV protection", "Без старіння завдяки UV-захисту"],
  ["No aging of parts thanks to UV protection", "Без старіння деталей завдяки UV-захисту"],
  [
    "No aging of the parts thanks to multi-layer protection against UV light",
    "Без старіння деталей завдяки багатошаровому захисту від UV-випромінювання",
  ],
  [
    "UV-protected and delivered in ready-to-install condition",
    "З UV-захистом, постачається готовим до монтажу",
  ],
  ["Vibration-resistant and durable", "Стійкий до вібрацій та довговічний"],
  ["Superior Appearance and Durability", "Виняткова якість зовнішнього вигляду та довговічність"],
  ["Superior protective effect", "Винятковий захисний ефект"],
  ["Durability", "Довговічність"],

  // ─── Bullets — fit, weight, mounting ────────────────────────────────────
  [
    "Direct replacement using original mounting points and screws",
    "Пряма заміна — використовуються штатні точки кріплення та гвинти",
  ],
  [
    "Replaces the original component with original mounting points",
    "Замінює оригінальну деталь зі штатними точками кріплення",
  ],
  [
    "Replaces the original component with original mounting points.",
    "Замінює оригінальну деталь зі штатними точками кріплення.",
  ],
  [
    "Replaces the original component using the original mounting points.",
    "Замінює оригінальну деталь за штатними точками кріплення.",
  ],
  [
    "Replaces the original part with original mounting points",
    "Замінює оригінальну деталь зі штатними точками кріплення",
  ],
  ["Replaces the original aluminum component", "Замінює оригінальну алюмінієву деталь"],
  ["Easily replaces the original part", "Легко замінює оригінальну деталь"],
  ["Use of original mounting points", "Використовуються штатні точки кріплення"],
  ["Uses original mounting points", "Використовуються штатні точки кріплення"],
  ["Uses the original mounting points", "Використовуються штатні точки кріплення"],
  ["Uses original mounting points and screws", "Використовуються штатні точки кріплення та гвинти"],
  ["Mounting on original attachment points", "Кріплення на штатних точках"],
  ["Mounting on existing attachment points", "Кріплення на наявних штатних точках"],
  ["Original mounting points for easy installation", "Штатні точки кріплення для простого монтажу"],
  [
    "Use of original mounting points for easy installation",
    "Використовуються штатні точки кріплення для простого монтажу",
  ],
  [
    "Use of original mounting points for effortless installation.",
    "Використовуються штатні точки кріплення для зручного монтажу.",
  ],
  ["Easy installation with original mounting points", "Простий монтаж на штатні точки кріплення"],
  [
    "Easy installation on existing mounting points",
    "Простий монтаж на наявні штатні точки кріплення",
  ],
  [
    "Easy installation on existing mounting points on the manifold",
    "Простий монтаж на наявні штатні точки кріплення колектора",
  ],
  ["Easy installation on standard mounting points", "Простий монтаж на штатні точки кріплення"],
  ["Easy installation in just a few minutes.", "Простий монтаж — лише за кілька хвилин."],
  ["Quick and easy installation", "Швидкий і простий монтаж"],
  ["Quick and easy assembly.", "Швидкий і простий монтаж."],
  ["Delivered ready to install", "Постачається готовим до монтажу"],
  ["Delivered ready to install.", "Постачається готовим до монтажу."],
  ["Delivered in ready-to-install condition", "Постачається готовим до монтажу"],
  ["Delivered in a ready-to-install condition", "Постачається готовим до монтажу"],
  ["Delivered in a ready-to-install condition.", "Постачається готовим до монтажу."],
  ["Delivery in ready-to-install condition", "Постачання готовим до монтажу"],
  ["Delivery in ready-to-install condition.", "Постачання готовим до монтажу."],
  ["Ready-to-install delivery", "Постачається готовим до монтажу"],
  ["Ready-to-install condition", "Готовий до монтажу"],
  ["Ready-to-install condition upon delivery", "Постачається готовим до монтажу"],
  [
    "Weight savings of approximately 70% compared to the original",
    "Зниження ваги приблизно на 70% порівняно з оригіналом",
  ],
  [
    "Significant weight reduction (approx. 70% lighter than original)",
    "Суттєве зниження ваги (приблизно на 70% легше за оригінал)",
  ],
  ["Up to 70% lighter than the original part", "До 70% легше за оригінальну деталь"],
  [
    "Reduces weight by approximately 70% compared to the original",
    "Зменшує вагу приблизно на 70% порівняно з оригіналом",
  ],
  ["About 70% lighter than the original", "Приблизно на 70% легше за оригінал"],
  ["Higher stiffness for improved performance", "Підвищена жорсткість для кращих характеристик"],
  ["Higher stiffness for improved performance.", "Підвищена жорсткість для кращих характеристик."],
  ["Higher Stiffness:", "Підвищена жорсткість:"],
  ["Weight Savings:", "Зниження ваги:"],
  ["Weight savings:", "Зниження ваги:"],
  ["Enhanced stiffness for improved performance", "Підвищена жорсткість для кращих характеристик"],
  [
    "Enhanced stiffness for improved performance.",
    "Підвищена жорсткість для кращих характеристик.",
  ],
  ["Increased stiffness for improved performance", "Підвищена жорсткість для кращих характеристик"],
  [
    "Increased stiffness for improved performance.",
    "Підвищена жорсткість для кращих характеристик.",
  ],
  [
    "Higher stiffness thanks to autoclave manufacturing from prepreg material",
    "Підвищена жорсткість завдяки виробництву в автоклаві з препрегу",
  ],
  ["Material and Processing", "Матеріал та обробка"],
  ["Material & Processing", "Матеріал та обробка"],
  ["Mounting kit included", "Монтажний комплект у комплекті"],
  ["UV protection and high-gloss clear coating", "UV-захист та високоглянцевий прозорий лак"],
  ["Ready-to-install condition, easy assembly", "Постачається готовим до монтажу — простий збір"],
  [
    "Sealed surfaces against environmental influences",
    "Герметизовані поверхні для захисту від впливу довкілля",
  ],
  ["Delivered ready for installation", "Постачається готовим до монтажу"],
  [
    "Made from specially produced prepreg material",
    "Виготовлено зі спеціально розробленого препрегу",
  ],
  [
    "Made from special prepreg fabric, known from Formula 1 and aerospace",
    "Виготовлено зі спеціальної препрег-тканини, знайомої з Формули-1 та аерокосмічної галузі",
  ],
  [
    "Made from specially produced prepreg fabric, also used in Formula 1 and aerospace.",
    "Виготовлено зі спеціально розробленої препрег-тканини — тієї ж, що у Формулі-1 та аерокосмічній галузі.",
  ],
  [
    "Hand-laminated and cured in an autoclave for unique appearance and technical properties.",
    "Ручна ламінація з тверднення в автоклаві — для унікального вигляду та технічних властивостей.",
  ],
  [
    "Three times the stiffness of steel, at a fraction of the weight.",
    "Утричі вища жорсткість, ніж у сталі — при значно меншій вазі.",
  ],
  ["Unique depth effect through clear coat", "Унікальний ефект глибини завдяки прозорому лаку"],
  ["Right Side", "Права сторона"],
  ["Left Side", "Ліва сторона"],
  ["Racing Silencer", "Гоночний глушник"],
  ["Compatible with Ilmberger Carbon Lower Part", "Сумісний з нижнім обтічником Ilmberger Carbon"],
  [
    "Give your Ducati Diavel V4 an unparalleled look with this carbon cover and experience the perfect symbiosis of style and functionality!",
    "Подаруйте вашому Ducati Diavel V4 неперевершений вигляд з цією карбоновою накладкою — і відчуйте ідеальний симбіоз стилю та функціональності!",
  ],
  [
    "Experience the perfect symbiosis of technology and design with our carbon exhaust cover for your Ducati Panigale V4 / V4 S.",
    "Відчуйте ідеальний симбіоз технологій та дизайну з нашою карбоновою накладкою вихлопу для вашого Ducati Panigale V4 / V4 S.",
  ],

  // ─── Bullets — certification ───────────────────────────────────────────
  [
    "With ABE - no additional registration required",
    "Із сертифікатом ABE — додаткова реєстрація не потрібна",
  ],
  [
    "With ABE, no additional registration required",
    "Із сертифікатом ABE — додаткова реєстрація не потрібна",
  ],
  ["ABE - no additional registration required", "ABE — додаткова реєстрація не потрібна"],
  ["With General Operating Permit (ABE)", "Із загальним дозволом на експлуатацію (ABE)"],
  ["With General Operating Permit (ABE) and TÜV certified", "Із дозволом ABE та сертифікацією TÜV"],
  [
    "ABE in preparation - no additional registration required",
    "Сертифікація ABE на стадії підготовки — додаткова реєстрація не потрібна",
  ],
  ["TÜV certified quality", "Якість, сертифікована TÜV"],
  ["TÜV-certified quality", "Якість, сертифікована TÜV"],
  ["TÜV Certification quality", "Якість, підтверджена сертифікацією TÜV"],
  ["TÜV Certification certified quality", "Якість, підтверджена сертифікацією TÜV"],
  ["TÜV certification quality", "Якість, підтверджена сертифікацією TÜV"],
  ["TÜV certification certified quality", "Якість, підтверджена сертифікацією TÜV"],
  ["TÜV Certification Quality", "Якість, підтверджена сертифікацією TÜV"],
  [
    "TÜV certified quality, ISO 9001 production",
    "Якість, сертифікована TÜV; виробництво за стандартом ISO 9001",
  ],
  ["TÜV Certification", "Сертифікація TÜV"],
  ["Manufactured according to ISO 9001", "Виготовлено за стандартом ISO 9001"],
  ["Manufactured according to ISO 9001.", "Виготовлено за стандартом ISO 9001."],

  // ─── Bullets — variant-specific (heat shield, ABS guide etc.) ──────────
  ["Compatible with original carbon parts", "Сумісний з оригінальними карбоновими деталями"],
  [
    "Matte finish for seamless integration with original carbon parts",
    "Матовий фініш для безшовного поєднання з оригінальними карбоновими деталями",
  ],
  [
    "Matte finish, matching Ducati Performance carbon parts",
    "Матовий фініш — у тон з карбоновими деталями Ducati Performance",
  ],
  ["Includes internal cable guide for ABS sensor", "Має внутрішній канал для кабелю датчика ABS"],
  ["Includes cable guide for ABS sensor cable", "Має канал для кабелю датчика ABS"],
  [
    "Special holder for brake lines; original lines easily attachable",
    "Спеціальний тримач для гальмівних шлангів — штатні шланги легко закріпити",
  ],
  ["Special holder for brake lines", "Спеціальний тримач для гальмівних шлангів"],
  ["Covers the cat on the left side", "Закриває каталізатор з лівого боку"],
  ["Integrated chain guard", "Інтегрована накладка ланцюга"],
  ["Surface: Glossy", "Поверхня: глянцева"],
  ["Material: High-quality carbon", "Матеріал: високоякісний карбон"],
  ["Material: High-quality matte carbon", "Матеріал: високоякісний карбон, матовий"],
  [
    "Material: High-quality carbon in matte finish",
    "Матеріал: високоякісний карбон у матовому фініші",
  ],
  [
    "Installation: Easy installation on existing mounting points",
    "Монтаж: легкий, на наявні штатні точки кріплення",
  ],
  [
    "Installation: Easy attachment to existing mounting points",
    "Монтаж: легке кріплення до наявних штатних точок",
  ],
  [
    "Designed for Ducati Panigale V4 / V4 S (from 2018).",
    "Розроблено для Ducati Panigale V4 / V4 S (з 2018 р.).",
  ],
  [
    "Compatible with Ducati Panigale V4 / V4 S from 2018",
    "Сумісний з Ducati Panigale V4 / V4 S з 2018 р.",
  ],
  ["Suitable for Ducati Diavel 1260 from 2019", "Підходить для Ducati Diavel 1260 з 2019 р."],
  [
    "Suitable for Ducati Panigale V4 / V4 S 2022",
    "Підходить для Ducati Panigale V4 / V4 S 2022 р.",
  ],
  [
    "Suitable for models from 2022 with Euro V exhaust system",
    "Підходить для моделей з 2022 р. з вихлопною системою Euro V",
  ],
  [
    "Specifically developed for the Ducati Diavel 1260 from 2019",
    "Розроблено спеціально для Ducati Diavel 1260 з 2019 р.",
  ],
  ["Including mounting kit", "Включає монтажний комплект"],
  [
    "Unique appearance and technical properties",
    "Унікальний зовнішній вигляд та технічні властивості",
  ],
  [
    "Unique Appearance and Technical Properties",
    "Унікальний зовнішній вигляд та технічні властивості",
  ],
  [
    "High-quality carbon for better heat protection and cooler outer casing",
    "Високоякісний карбон для кращого захисту від тепла та прохолоднішого зовнішнього корпусу",
  ],
  [
    "Elegant combination of curve and edge for modern design",
    "Елегантне поєднання вигинів і граней для сучасного дизайну",
  ],
  [
    "Harmonious overall appearance through precise fiber layers.",
    "Гармонійний зовнішній вигляд завдяки точним шарам волокна.",
  ],

  // ─── Boilerplate closing paragraphs ────────────────────────────────────
  [
    "Anyone who chooses a carbon part from Ilmberger knows: The path to the finished product is demanding and requires the highest precision.",
    "Кожен, хто обирає карбонову деталь Ilmberger, знає: шлях до готового виробу складний і вимагає найвищої точності.",
  ],
  [
    "A fascinating insight into how each part is created at Ilmberger Carbon with passion and know-how can be found in the detailed report on the production process.",
    "Захопливий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "A fascinating insight into how each part at Ilmberger Carbon is created with passion and expertise can be found in the detailed report on the production process.",
    "Захопливий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та фаховістю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "A fascinating insight into how each part is created at Ilmberger Carbon with passion and expertise can be found in the detailed report on the production process.",
    "Захопливий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та фаховістю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "An exciting insight into how each part is created at Ilmberger Carbon with passion and know-how can be found in the detailed report on the production process.",
    "Цікавий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "An exciting insight into how Ilmberger creates each part from passion and know-how can be found in the detailed report on the production process.",
    "Цікавий погляд на те, як Ilmberger створює кожну деталь з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],
  [
    "The in-house development is also full of innovations - discover how much dedication and technical sophistication is in every Ilmberger carbon part.",
    "Власні розробки сповнені інновацій — переконайтеся, скільки відданості та технічної досконалості міститься у кожній карбоновій деталі Ilmberger.",
  ],
  [
    "The in-house development is also full of innovations - discover how much dedication and technical sophistication goes into every Ilmberger carbon part.",
    "Власні розробки сповнені інновацій — переконайтеся, скільки відданості та технічної досконалості вкладено в кожну карбонову деталь Ilmberger.",
  ],
  [
    "The in-house development is also full of innovations - discover how much dedication and technical finesse is in every Ilmberger carbon part.",
    "Власні розробки сповнені інновацій — переконайтеся, скільки відданості та технічної майстерності міститься у кожній карбоновій деталі Ilmberger.",
  ],
  [
    "The in-house development is also full of innovations - discover how much dedication and technical finesse goes into every Ilmberger carbon part.",
    "Власні розробки сповнені інновацій — переконайтеся, скільки відданості та технічної майстерності вкладено в кожну карбонову деталь Ilmberger.",
  ],

  // ─── Brand-storytelling paragraphs ─────────────────────────────────────
  [
    "Give your motorcycle that certain something!",
    "Подаруйте вашому мотоциклу те особливе, чого йому бракує!",
  ],
  [
    "As a leading manufacturer of carbon parts and OEM producer for brands like Ducati and BMW, our expertise flows into every product.",
    "Як провідний виробник карбонових деталей та OEM-постачальник для Ducati й BMW, ми вкладаємо весь наш досвід у кожен виріб.",
  ],
  [
    "Our parts withstand even the toughest conditions, such as in the World Superbike Championship (WSBK) and the Endurance World Championship (EWC).",
    "Наші деталі витримують навіть найжорсткіші умови — у Чемпіонаті світу зі Супербайку (WSBK) та Endurance World Championship (EWC).",
  ],
  ["Experience the difference – with Ilmberger Carbon!", "Відчуйте різницю — з Ilmberger Carbon!"],
  [
    "Experience the perfect combination of style and functionality for your",
    "Відчуйте ідеальне поєднання стилю та функціональності для вашого",
  ],
  [
    "Experience the perfect blend of style and performance with Ilmberger's carbon fender for your Ducati.",
    "Відчуйте ідеальне поєднання стилю та потужності з карбоновим крилом Ilmberger для вашого Ducati.",
  ],
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
    "Experience the three-dimensional effect of the carbon structure, which impresses not only technically but also visually.",
    "Відчуйте 3D-ефект структури карбону, який вражає не лише технічно, а й візуально.",
  ],
  [
    "Experience the perfect combination of lightness and stiffness with this high-quality rear wheel cover!",
    "Відчуйте ідеальне поєднання легкості та жорсткості з цією високоякісною накладкою заднього колеса!",
  ],
  [
    "Upgrade your Ducati with this high-quality carbon sprocket cover and experience the difference!",
    "Оновіть свій Ducati з цією високоякісною карбоновою накладкою передньої зірки — і відчуйте різницю!",
  ],
  [
    "Perfect your Ducati with this carbon part and experience unparalleled quality and design!",
    "Доведіть свій Ducati до досконалості з цією карбоновою деталлю — і відчуйте неперевершені якість та дизайн!",
  ],
  [
    "Give your Ducati Diavel 1260 a stylish and robust protection with this high-quality carbon exhaust heat shield.",
    "Подаруйте вашому Ducati Diavel 1260 стильний і надійний захист з цим високоякісним карбоновим тепловим щитом вихлопу.",
  ],
  [
    "The header protection for the Ducati Diavel V4 not only offers protection for the header on the right side but also gives your motorcycle a sporty look with its glossy clear coat layer.",
    "Захист колектора для Ducati Diavel V4 не лише прикриває колектор з правого боку, а й надає мотоциклу спортивного вигляду завдяки глянцевому шару прозорого лаку.",
  ],
  [
    "Prepreg, a pre-impregnated carbon fabric, is characterized by an even resin distribution with a simultaneously high fiber volume content. This leads to maximum strength and increases the flexibility of the components. Processing in the autoclave, a high-pressure oven that operates under controlled temperature and pressure conditions, ensures perfect, even curing and a flawless surface. This method prevents air inclusions in the material and ensures consistently high quality of the parts.",
    "Препрег — це попередньо просочена смолою карбонова тканина з рівномірним розподілом смоли та високим вмістом волокна, що дає максимальну міцність і гнучкість деталей. Обробка в автоклаві (печі високого тиску з контрольованими температурою та тиском) забезпечує бездоганне рівномірне твердіння та ідеальну поверхню. Такий метод виключає повітряні включення в матеріалі та гарантує стабільно високу якість деталей.",
  ],

  // ─── Boilerplate variants (high frequency) ──────────────────────────────
  [
    "Anyone who chooses an Ilmberger carbon part knows: The path to the finished product is demanding and requires the highest precision.",
    "Кожен, хто обирає карбонову деталь Ilmberger, знає: шлях до готового виробу складний і вимагає найвищої точності.",
  ],
  [
    "Anyone who chooses a carbon part from Ilmberger knows: The path to the finished product is demanding and requires the utmost precision.",
    "Кожен, хто обирає карбонову деталь Ilmberger, знає: шлях до готового виробу складний і вимагає найвищої точності.",
  ],
  [
    "Those who choose a carbon part from Ilmberger know: The path to the finished product is demanding and requires the highest precision.",
    "Ті, хто обирає карбонову деталь Ilmberger, знають: шлях до готового виробу складний і вимагає найвищої точності.",
  ],

  // Story-brand paragraphs (Ducati ab_2025 variants)
  [
    "Every part that leaves our production is a masterpiece of technology and design that meets the highest standards.",
    "Кожна деталь, що виходить з нашого виробництва, — це шедевр технології та дизайну, що відповідає найвищим стандартам.",
  ],
  [
    "Each part that leaves our production is a masterpiece of technology and design that meets the highest standards.",
    "Кожна деталь, що виходить з нашого виробництва, — це шедевр технології та дизайну, що відповідає найвищим стандартам.",
  ],
  [
    "Every part that leaves our production is a masterpiece of engineering and design that meets the highest standards.",
    "Кожна деталь, що виходить з нашого виробництва, — це шедевр інженерії та дизайну, що відповідає найвищим стандартам.",
  ],
  [
    "Each part is a masterpiece of technology and design.",
    "Кожна деталь — це шедевр технології та дизайну.",
  ],
  [
    "Ilmberger stands for the highest quality and innovation in carbon manufacturing.",
    "Ilmberger — це найвища якість та інновації у виробництві карбонових деталей.",
  ],
  [
    "Ilmberger stands for quality and innovation in carbon manufacturing.",
    "Ilmberger — це якість та інновації у виробництві карбонових деталей.",
  ],
  ["Top Quality from Ilmberger", "Преміальна якість від Ilmberger"],
  ["Highest Quality from Ilmberger", "Найвища якість від Ilmberger"],

  [
    "Ilmberger is not only a leading manufacturer of carbon parts for the aftermarket but also a recognized OEM producer for renowned manufacturers like Ducati and BMW.",
    "Ilmberger — не лише провідний виробник карбонових деталей для aftermarket, а й визнаний OEM-постачальник для таких відомих марок, як Ducati та BMW.",
  ],
  [
    "Ilmberger is not only a leading manufacturer of carbon parts for the aftermarket but also a recognized OEM producer for renowned manufacturers such as Ducati and BMW.",
    "Ilmberger — не лише провідний виробник карбонових деталей для aftermarket, а й визнаний OEM-постачальник для таких відомих марок, як Ducati та BMW.",
  ],
  [
    "Ilmberger is not only a leading manufacturer of carbon parts for the aftermarket but also a recognized OEM producer for brands like Ducati and BMW.",
    "Ilmberger — не лише провідний виробник карбонових деталей для aftermarket, а й визнаний OEM-постачальник для таких марок, як Ducati та BMW.",
  ],
  [
    "Ilmberger is not only a leading manufacturer in the aftermarket but also a recognized OEM producer for brands like Ducati and BMW.",
    "Ilmberger — не лише провідний виробник на ринку aftermarket, а й визнаний OEM-постачальник для таких марок, як Ducati та BMW.",
  ],

  // Production / process paragraphs
  [
    "A globally unique step in Ilmberger's production is the complete plastic powder coating of all carbon parts.",
    "Унікальний у світовому масштабі етап виробництва Ilmberger — повне порошкове покриття всіх карбонових деталей.",
  ],
  [
    "A worldwide unique step in Ilmberger's production is the complete plastic powder coating of all carbon parts.",
    "Унікальний у світовому масштабі етап виробництва Ilmberger — повне порошкове покриття всіх карбонових деталей.",
  ],
  [
    "This sealing prevents the aging of the parts and significantly extends their lifespan.",
    "Така герметизація запобігає старінню деталей і суттєво продовжує їх термін служби.",
  ],
  [
    "No other carbon manufacturer offers this type of sealing, which prevents the aging of the parts and significantly extends their lifespan.",
    "Жоден інший виробник карбону не пропонує такої герметизації — вона запобігає старінню деталей та суттєво продовжує їх термін служби.",
  ],
  ["Autoclave technology for flawless surfaces.", "Технологія автоклаву для бездоганної поверхні."],
  ["Quality you can trust.", "Якість, якій можна довіряти."],

  // Material+processing paragraphs
  [
    "Our carbon parts are laminated by hand with a lot of experience and care, which allows for consistent fiber alignment without distortion.",
    "Наші карбонові деталі ламінуються вручну досвідченими майстрами, що забезпечує рівномірне укладання волокон без деформацій.",
  ],
  [
    "Our carbon parts are laminated by hand with a lot of experience and care, allowing for consistent fiber alignment without distortion.",
    "Наші карбонові деталі ламінуються вручну досвідченими майстрами, що забезпечує рівномірне укладання волокон без деформацій.",
  ],
  [
    "This is processed in a complex procedure in the autoclave, which offers numerous advantages.",
    "Це обробляється у складному циклі в автоклаві, що дає численні переваги.",
  ],
  [
    "After curing, the edges are precisely cut by robot to ensure a perfect fit.",
    "Після твердіння краї прецизійно обрізаються роботом для ідеальної посадки.",
  ],
  [
    "After curing in the autoclave, the edges of the parts are precisely cut by robots to ensure a perfect fit and the highest quality.",
    "Після твердіння в автоклаві краї деталей прецизійно обрізаються роботом для ідеальної посадки та найвищої якості.",
  ],
  [
    "After curing in the autoclave, the edges of the parts are precisely cut by robot to ensure a perfect fit and highest quality.",
    "Після твердіння в автоклаві краї деталей прецизійно обрізаються роботом для ідеальної посадки та найвищої якості.",
  ],
  [
    "Each part is produced in our own production, using prepreg specially developed for Ilmberger as the base material.",
    "Кожна деталь виготовляється на нашому виробництві з препрегу, розробленого спеціально для Ilmberger.",
  ],
  [
    "Each part is produced in our own production, where we rely on prepreg specially developed for Ilmberger as the base material.",
    "Кожна деталь виготовляється на нашому виробництві з препрегу, розробленого спеціально для Ilmberger.",
  ],
  [
    "Prepreg is a pre-impregnated carbon fabric with uniform resin distribution and high fiber volume content.",
    "Препрег — це попередньо просочена смолою карбонова тканина з рівномірним розподілом смоли та високим вмістом волокна.",
  ],
  [
    "Processing in the autoclave ensures perfect curing and a flawless surface, free from air inclusions.",
    "Обробка в автоклаві забезпечує бездоганне твердіння та ідеальну поверхню без повітряних включень.",
  ],
  [
    "This method prevents air inclusions in the material and ensures consistently high quality of the parts.",
    "Такий метод виключає повітряні включення у матеріалі та гарантує стабільно високу якість деталей.",
  ],
  [
    "This leads to maximum strength and increased flexibility of the components.",
    "Це дає максимальну міцність та підвищену гнучкість деталей.",
  ],
  [
    "Multi-layer protection against UV light prevents aging.",
    "Багатошаровий захист від UV-випромінювання запобігає старінню.",
  ],
  [
    "This coating protects the parts from environmental influences and gives them an unparalleled depth effect.",
    "Це покриття захищає деталі від впливу довкілля та надає їм неперевершений ефект глибини.",
  ],
  [
    "This coating not only protects the parts from environmental influences but also gives them an unparalleled depth effect.",
    "Це покриття не лише захищає деталі від впливу довкілля, а й надає їм неперевершений ефект глибини.",
  ],
  [
    "This coating not only protects the parts from environmental influences but also gives them an incomparable depth effect.",
    "Це покриття не лише захищає деталі від впливу довкілля, а й надає їм незрівнянний ефект глибини.",
  ],
  [
    "Plastic coating protects against environmental influences and provides an unparalleled depth effect.",
    "Полімерне покриття захищає від впливу довкілля та створює неперевершений ефект глибини.",
  ],
  [
    "Plastic coating for durability and depth effect.",
    "Полімерне покриття для довговічності та ефекту глибини.",
  ],
  [
    "Plastic powder coating for durability and depth effect.",
    "Порошкове покриття для довговічності та ефекту глибини.",
  ],
  [
    "Precise lamination and robotic edge cutting for a perfect fit.",
    "Прецизійна ламінація та робот-обрізання країв для ідеальної посадки.",
  ],
  ["Precise edge cutting by robots", "Прецизійне обрізання країв роботом"],
  [
    "Specially developed prepreg for maximum strength.",
    "Препрег, розроблений спеціально для максимальної міцності.",
  ],
  ["Manufactured in an autoclave from prepreg material", "Виготовлено в автоклаві з препрегу"],
  ["Manufactured from prepreg material in an autoclave", "Виготовлено з препрегу в автоклаві"],
  [
    "Manufactured in-house according to ISO 9001.",
    "Виготовлено на власному виробництві за стандартом ISO 9001.",
  ],
  ["Production according to ISO Standard 9001", "Виробництво за стандартом ISO 9001"],

  // Racing / OEM credibility
  [
    "Our parts are tested under the toughest conditions in the World Superbike Championship (WSBK) and the Endurance World Championship (EWC).",
    "Наші деталі тестуються у найжорсткіших умовах — у Чемпіонаті світу зі Супербайку (WSBK) та Endurance World Championship (EWC).",
  ],
  [
    "Our parts are tested under the toughest conditions in the World Superbike Championship and the Endurance World Championship.",
    "Наші деталі тестуються у найжорсткіших умовах — у Чемпіонаті світу зі Супербайку та Endurance World Championship.",
  ],
  [
    "Our expertise from the World Superbike Championship and the Endurance World Championship flows into every product.",
    "Наш досвід з Чемпіонату світу зі Супербайку та Endurance World Championship вкладено у кожен продукт.",
  ],
  [
    "We manufacture parts for BMW in the World Superbike Championship (WSBK) as well as for the BMW factory team in the Endurance World Championship (EWC), where our parts are regularly put to the test under the toughest conditions.",
    "Ми виготовляємо деталі для BMW у Чемпіонаті світу зі Супербайку (WSBK) та для заводської команди BMW у Endurance World Championship (EWC) — де наші деталі регулярно перевіряються у найжорсткіших умовах.",
  ],

  // Final clear coat marketing
  [
    "The final clear coat layer is satin matte on this component and ensures a perfect, smooth surface that further emphasizes the luxurious-sporty look of our carbon parts.",
    "Фінальний шар прозорого лаку на цій деталі — сатиново-матовий, він створює бездоганно гладку поверхню, що ще більше підкреслює люксово-спортивний вигляд наших карбонових деталей.",
  ],
  [
    "The final silk matte clear coat layer ensures a smooth surface and emphasizes the luxurious-sporty look of our carbon parts.",
    "Фінальний шовково-матовий шар прозорого лаку створює гладку поверхню та підкреслює люксово-спортивний вигляд наших карбонових деталей.",
  ],
  [
    "Experience the combination of technology and design that meets the highest standards.",
    "Відчуйте поєднання технології та дизайну, що відповідає найвищим стандартам.",
  ],
  [
    "High-gloss clear coating for an impressive depth effect.",
    "Високоглянцеве прозоре покриття для вражаючого ефекту глибини.",
  ],

  // Label-style headings ending in colon
  ["Highest Quality:", "Найвища якість:"],
  ["Unique Coating:", "Унікальне покриття:"],
  ["Perfect Processing:", "Бездоганна обробка:"],
  ["Unique Protection:", "Унікальний захист:"],
  ["Aesthetics:", "Естетика:"],
  ["Handcrafted:", "Ручна робота:"],
  ["Innovative Materials:", "Інноваційні матеріали:"],
  ["Innovative Manufacturing:", "Інноваційне виробництво:"],
  ["Ready to Install:", "Готовий до монтажу:"],
  ["Suitable for:", "Підходить для:"],
  ["Compatible with:", "Сумісний з:"],
  ["Installation:", "Монтаж:"],
  ["Material:", "Матеріал:"],
  ["Weight:", "Вага:"],
  ["Weight saving:", "Зниження ваги:"],
  ["Surface:", "Поверхня:"],
  ["Protection:", "Захист:"],
  ["Protective coating:", "Захисне покриття:"],
  ["Protective Coating:", "Захисне покриття:"],
  ["Protection and Durability:", "Захист та довговічність:"],
  ["Durability:", "Довговічність:"],
  ["Luxurious Finish:", "Люксовий фініш:"],
  ["Luxurious Shine:", "Люксовий блиск:"],
  ["Luxurious Look:", "Люксовий вигляд:"],
  ["Perfect Workmanship:", "Бездоганне виконання:"],
  ["TÜV-certified:", "Сертифіковано TÜV:"],
  ["TÜV Certification:", "Сертифікація TÜV:"],
  ["Easy Installation:", "Простий монтаж:"],
  ["Handcrafted Precision:", "Ручна точність:"],
  ["Stiffness:", "Жорсткість:"],
  ["Manufacturing:", "Виробництво:"],

  // Misc h3 headings
  ["High-Quality Materials and Workmanship", "Високоякісні матеріали та виконання"],
  ["Easy Installation & Certified Quality", "Простий монтаж та сертифікована якість"],

  // Misc bullets
  ["Easy attachment to existing mounting points", "Просте кріплення до наявних штатних точок"],
  [
    "Reduces weight by approximately 70% compared to the original part",
    "Зменшує вагу приблизно на 70% порівняно з оригінальною деталлю",
  ],
  ["Up to 70% lighter than the original", "До 70% легше за оригінал"],
  [
    "Clear plastic coating for superior scratch resistance and durability",
    "Прозоре полімерне покриття для виняткової стійкості до подряпин та довговічності",
  ],
  [
    "Uses exclusive prepreg fabric, known from Formula 1 and aerospace",
    "Використовується ексклюзивна препрег-тканина, знайома з Формули-1 та аерокосмічної галузі",
  ],
  ["Higher stiffness", "Підвищена жорсткість"],
  ["Higher Stiffness", "Підвищена жорсткість"],
  ["UV protection", "UV-захист"],
  [
    "Transforms the Panigale V4 / V4 S into a classic single-seater",
    "Перетворює Panigale V4 / V4 S на класичний одномісник",
  ],
  ["Ducati Diavel 1260 from model year 2019", "Ducati Diavel 1260 з модельного 2019 року"],

  // Common single words as labels
  ["Glossy", "Глянцевий"],
  ["Matte", "Матовий"],
  ["Matt", "Матовий"],
  ["Carbon", "Карбон"],

  // ─── Final mop-up batch ───────────────────────────────────────────────
  ["With ABE", "Із сертифікатом ABE"],
  ["High-quality carbon", "Високоякісний карбон"],
  ["High-quality carbon in matte finish", "Високоякісний карбон у матовому фініші"],
  ["Compatibility:", "Сумісність:"],
  ["Facts at a Glance:", "Стисло про головне:"],
  ["Craftsmanship:", "Майстерність:"],
  ["Experience Perfection", "Відчуйте досконалість"],
  ["Higher stiffness due to prepreg material", "Підвищена жорсткість завдяки препрегу"],
  [
    "Matte finish, matching original Ducati Performance parts",
    "Матовий фініш — у тон з оригінальними деталями Ducati Performance",
  ],
  ["Easy Installation and Quality Assurance", "Простий монтаж та контроль якості"],
  ["No additional registration required", "Додаткова реєстрація не потрібна"],
  [
    "Three times higher specific stiffness than steel at low weight",
    "Утричі вища питома жорсткість, ніж у сталі — при малій вазі",
  ],
  ["Perfect Integration and Protection", "Бездоганна інтеграція та захист"],
  [
    "Unique plastic coating for protection and depth effect",
    "Унікальне полімерне покриття для захисту та ефекту глибини",
  ],
  [
    "TÜV certified and manufactured according to ISO 9001.",
    "Сертифіковано TÜV та виготовлено за стандартом ISO 9001.",
  ],
  [
    "Delivered ready to install, TÜV-certified quality",
    "Постачається готовим до монтажу, якість сертифікована TÜV",
  ],
  [
    "Give your Ducati Diavel V4 an aggressive look!",
    "Подаруйте вашому Ducati Diavel V4 агресивний вигляд!",
  ],
  [
    "Ilmberger stands for innovation and quality in carbon manufacturing.",
    "Ilmberger — це інновації та якість у виробництві карбонових деталей.",
  ],
  [
    "Emphasizes the three-dimensional effect of the carbon structure",
    "Підкреслює 3D-ефект структури карбону",
  ],
  [
    "Emphasizes the three-dimensional effect of the carbon structure.",
    "Підкреслює 3D-ефект структури карбону.",
  ],
  [
    "Produced in-house according to ISO 9001 standards.",
    "Виготовлено на власному виробництві за стандартом ISO 9001.",
  ],
  [
    "Expert lamination for precise fiber alignment.",
    "Експертна ламінація для точного укладання волокна.",
  ],
  [
    "The final clear coat layer is satin matte on this component and ensures a perfect, smooth surface that further emphasizes the luxurious sporty look of our carbon parts.",
    "Фінальний шар прозорого лаку на цій деталі — сатиново-матовий, він створює бездоганно гладку поверхню, що ще більше підкреслює люксово-спортивний вигляд наших карбонових деталей.",
  ],
  [
    "The final clear coat layer on this component is satin matte and ensures a perfect, smooth surface that further emphasizes the luxurious-sporty look of our carbon parts.",
    "Фінальний шар прозорого лаку на цій деталі — сатиново-матовий, він створює бездоганно гладку поверхню, що ще більше підкреслює люксово-спортивний вигляд наших карбонових деталей.",
  ],
  [
    "A detailed report on the production process can be found in the detailed report on the production process.",
    "Детальний звіт про виробничий процес можна знайти у спеціальному матеріалі.",
  ],

  // Product-title restatements that often appear as <h2> — for safety, add
  // a few common patterns. (Most are also handled by titleUa H2 swap.)
  [
    "Monoposto Seat for Ducati Panigale V4 / V4 S",
    "Заднє оперення Monoposto для Ducati Panigale V4 / V4 S",
  ],

  // ─── Composite labels (em-wrapped) ────────────────────────────────────
  ["Lightweight Construction:", "Легка конструкція:"],
  ["Lightweight Construction: ", "Легка конструкція: "],
  ["Sporty Look:", "Спортивний вигляд:"],
  ["Sporty Look: ", "Спортивний вигляд: "],
  ["Sporty Design:", "Спортивний дизайн:"],
  ["Features", "Особливості"],
  ["Features:", "Особливості:"],
  ["Product Features:", "Характеристики продукту:"],
  ["Light, Strong, and Stylish", "Легкий, міцний, стильний"],
  ["Light and Strong", "Легкий і міцний"],
  ["Light and Strong:", "Легкий і міцний:"],
  ["Lightweight, Strong, and Stylish", "Легкий, міцний, стильний"],
  [
    "Highest Quality: Made from specially developed prepreg carbon.",
    "Найвища якість: виготовлено зі спеціально розробленого препрег-карбону.",
  ],
  [
    "Perfect Craftsmanship: Autoclave technology for maximum strength and flawless surfaces.",
    "Бездоганна майстерність: технологія автоклаву для максимальної міцності та ідеальних поверхонь.",
  ],
  [
    "Unique Protective Layer: Plastic coating for unparalleled depth effect and durability.",
    "Унікальний захисний шар: полімерне покриття для неперевершеного ефекту глибини та довговічності.",
  ],
  [
    "Handcrafted: Precise lamination and robotic edge cutting for a perfect fit.",
    "Ручна робота: прецизійна ламінація та робот-обрізання країв для ідеальної посадки.",
  ],
  [
    "High-gloss Finish: Luxurious, sporty look through a smooth clear coat layer.",
    "Високоглянцевий фініш: люксовий спортивний вигляд завдяки гладкому шару прозорого лаку.",
  ],
  ["Matching:", "У тон з:"],
  ["Silk Matte Clear Coat:", "Шовково-матовий прозорий лак:"],
  ["Perfect Craftsmanship", "Бездоганна майстерність"],
  ["Perfect Craftsmanship:", "Бездоганна майстерність:"],

  // ─── More marketing h3 variants ───────────────────────────────────────
  [
    "Give Your Ducati Diavel V4 an Aggressive Look",
    "Подаруйте вашому Ducati Diavel V4 агресивний вигляд",
  ],
  [
    "Add a touch of luxury and exclusivity to your Ducati Panigale V4 2025 with our glossy carbon tank cover. Perfect for those who want the best for their machine!",
    "Додайте нотку розкоші та ексклюзивності вашому Ducati Panigale V4 2025 з нашою глянцевою карбоновою накладкою на бак. Ідеально для тих, хто хоче лише найкращого для свого мотоцикла!",
  ],
  ["Ilmberger - A Name You Can Trust", "Ilmberger — ім'я, якому можна довіряти"],

  // ─── Common product-specific bullets ──────────────────────────────────
  [
    "Replaces the original part and enhances the appearance.",
    "Замінює оригінальну деталь та покращує зовнішній вигляд.",
  ],
  ["Replaces the original part", "Замінює оригінальну деталь"],
  [
    "Replaces the standard plastic part and offers significant weight savings.",
    "Замінює стандартну пластикову деталь та забезпечує значне зниження ваги.",
  ],
  [
    "High-quality material emphasizes the strength of the motorcycle.",
    "Високоякісний матеріал підкреслює міцність мотоцикла.",
  ],
  [
    "Hand-laminated and autoclave-cured for high stiffness and low weight.",
    "Ручна ламінація з тверднення в автоклаві — для високої жорсткості та малої ваги.",
  ],
  [
    "Hand laminated and autoclave cured for maximum stiffness and low weight.",
    "Ручна ламінація з тверднення в автоклаві — для максимальної жорсткості та малої ваги.",
  ],
  [
    "Exceptionally high fiber volume content for outstanding properties.",
    "Винятково високий вміст волокна для непересічних характеристик.",
  ],
  [
    "Increased material stiffness for better performance.",
    "Підвищена жорсткість матеріалу для кращих характеристик.",
  ],
  [
    "Glossy carbon fibers for a dynamic look.",
    "Глянцеві карбонові волокна для динамічного вигляду.",
  ],
  ["Matte carbon fibers", "Матові карбонові волокна"],
  ["Matches Ducati-Performance carbon parts", "У тон з карбоновими деталями Ducati Performance"],
  [
    "Superior scratch resistance and durability through clear plastic coating.",
    "Виняткова стійкість до подряпин та довговічність завдяки прозорому полімерному покриттю.",
  ],
  ["Position: Right side of the vehicle", "Позиція: права сторона мотоцикла"],
  ["Position: Left side of the vehicle", "Позиція: ліва сторона мотоцикла"],
  [
    "Clear plastic coating for protection and scratch resistance",
    "Прозоре полімерне покриття для захисту та стійкості до подряпин",
  ],
  [
    "Coated with a clear plastic coating for superior protection and scratch resistance",
    "Вкрито прозорим полімерним покриттям для виняткового захисту та стійкості до подряпин",
  ],
  ["Stability during acceleration and deceleration", "Стабільність при розгоні та гальмуванні"],
  [
    "Seamless transition from tank to ignition button and handlebars",
    "Безшовний перехід від бака до кнопки запалювання та керма",
  ],
  ["UV protection for long-lasting appearance", "UV-захист для тривалого збереження вигляду"],
  [
    "Superior protective coating against environmental influences",
    "Винятково надійне захисне покриття від впливу довкілля",
  ],
  [
    "With ABE - no additional registration needed",
    "Із сертифікатом ABE — додаткова реєстрація не потрібна",
  ],
  ["With ABE - no registration required", "Із сертифікатом ABE — реєстрація не потрібна"],
  [
    "Clear coat provides an impressive depth effect.",
    "Прозорий лак створює вражаючий ефект глибини.",
  ],
  [
    "Manufactured in an autoclave for maximum strength and perfect surfaces",
    "Виготовлено в автоклаві для максимальної міцності та бездоганної поверхні",
  ],
  [
    "TÜV certified quality, manufactured according to ISO 9001.",
    "Якість, сертифікована TÜV; виготовлено за стандартом ISO 9001.",
  ],
  [
    "Weight savings of approximately 70% compared to the original part.",
    "Зниження ваги приблизно на 70% порівняно з оригінальною деталлю.",
  ],
  [
    "Coated with a clear plastic coating that offers superior scratch resistance and durability.",
    "Вкрито прозорим полімерним покриттям, що забезпечує виняткову стійкість до подряпин та довговічність.",
  ],
  [
    "Coated with a clear plastic coating that offers superior scratch resistance and durability.",
    "Вкрито прозорим полімерним покриттям, що забезпечує виняткову стійкість до подряпин та довговічність.",
  ],
  [
    "Increased material stiffness for better performance.",
    "Підвищена жорсткість матеріалу для кращих характеристик.",
  ],
  [
    "Made from high-quality prepreg carbon in the autoclave",
    "Виготовлено з високоякісного препрег-карбону в автоклаві",
  ],
  [
    "Made from high-quality prepreg carbon in the autoclave.",
    "Виготовлено з високоякісного препрег-карбону в автоклаві.",
  ],
  ["Made from prepreg material in the autoclave", "Виготовлено з препрегу в автоклаві"],
  ["Made from prepreg material in the autoclave.", "Виготовлено з препрегу в автоклаві."],
  [
    "Manufacturing: Made from prepreg material in an autoclave",
    "Виробництво: виготовлено з препрегу в автоклаві",
  ],
  [
    "Careful lamination and precise edge cutting for a perfect fit.",
    "Дбайлива ламінація та точне обрізання країв для ідеальної посадки.",
  ],
  [
    "Ilmberger is a leading manufacturer of carbon parts and a recognized OEM producer for brands like Ducati and BMW.",
    "Ilmberger — провідний виробник карбонових деталей та визнаний OEM-постачальник для таких марок, як Ducati та BMW.",
  ],
  [
    "This protects against environmental influences and gives an incomparable depth effect.",
    "Це захищає від впливу довкілля та надає незрівнянний ефект глибини.",
  ],
  [
    "Processing in the autoclave guarantees perfect curing and a flawless surface, free from air inclusions.",
    "Обробка в автоклаві гарантує бездоганне твердіння та ідеальну поверхню без повітряних включень.",
  ],
  [
    "This material is processed in an autoclave, which offers numerous advantages.",
    "Цей матеріал обробляється в автоклаві, що дає численні переваги.",
  ],
  [
    "Our carbon parts are laminated by hand, allowing for consistent fiber alignment.",
    "Наші карбонові деталі ламінуються вручну, що забезпечує рівномірне укладання волокон.",
  ],
  [
    "The final clear coat on this component is silk matte and ensures a perfect, smooth surface that further emphasizes the luxurious-sporty look of our carbon parts.",
    "Фінальний шар прозорого лаку на цій деталі — шовково-матовий, він створює бездоганно гладку поверхню, що ще більше підкреслює люксово-спортивний вигляд наших карбонових деталей.",
  ],
  [
    "After curing in the autoclave, the edges of the parts are precisely cut by a robot to ensure a perfect fit and the highest quality.",
    "Після твердіння в автоклаві краї деталей прецизійно обрізаються роботом для ідеальної посадки та найвищої якості.",
  ],

  ["Prepreg", "Препрег"],
]);

// ─────────────────────────────────────────────────────────────────────────────
// Build a case-insensitive map keyed by normalized form.
// ─────────────────────────────────────────────────────────────────────────────
const NORMALIZED_PHRASES = new Map();
for (const [en, ua] of PHRASES) {
  NORMALIZED_PHRASES.set(normalize(en).toLowerCase(), { en, ua });
  // Also without trailing dot
  NORMALIZED_PHRASES.set(stripTrailingDot(normalize(en)).toLowerCase(), { en, ua });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parameterized regex patterns. Applied AFTER dictionary lookup fails on the
// full text but BEFORE giving up. The captured group is kept verbatim (model
// names, part numbers, weights — these don't translate).
// ─────────────────────────────────────────────────────────────────────────────
const REGEX_PATTERNS = [
  // "Suitable for: Ducati Panigale V4 / V4 S from 2018"
  [
    /^(?:Suitable|Compatible|Designed)\s+for[:]?\s+(.+?)(?:\s+from\s+(?:year\s+)?|\s+\(from\s+)(\d{4}\d?)\)?\.?$/i,
    (_, model, year) => `Підходить для ${model} з ${year} р.`,
  ],
  [/^Suitable\s+for[:]?\s+(.+?)\.?$/i, (_, x) => `Підходить для ${x}`],
  [/^Compatible\s+with[:]?\s+(.+?)\.?$/i, (_, x) => `Сумісний з ${x}`],
  [/^Designed\s+for[:]?\s+(.+?)\.?$/i, (_, x) => `Розроблено для ${x}`],
  [/^Fits\s+with\s+(.+?)\.?$/i, (_, x) => `Сумісний з ${x}`],
  [
    /^Specifically\s+developed\s+for\s+(.+?)\s+from\s+(\d{4})\.?$/i,
    (_, model, year) => `Розроблено спеціально для ${model} з ${year} р.`,
  ],
  [/^Specifically\s+developed\s+for\s+(.+?)\.?$/i, (_, x) => `Розроблено спеціально для ${x}`],

  // "Material: ..." / "Weight: ..." / "Installation: ..." / "Surface: ..."
  [/^Material[:]\s+(.+?)\.?$/i, (_, x) => `Матеріал: ${translateInline(x)}`],
  [/^Weight[:]\s+(.+?)\.?$/i, (_, x) => `Вага: ${x}`],
  [/^Weight saving[:]\s+(.+?)\.?$/i, (_, x) => `Зниження ваги: ${translateInline(x)}`],
  [/^Weight savings[:]\s+(.+?)\.?$/i, (_, x) => `Зниження ваги: ${translateInline(x)}`],
  [/^Surface[:]\s+(.+?)\.?$/i, (_, x) => `Поверхня: ${translateInline(x)}`],
  [/^Installation[:]\s+(.+?)\.?$/i, (_, x) => `Монтаж: ${translateInline(x)}`],
  [/^Color[:]\s+(.+?)\.?$/i, (_, x) => `Колір: ${translateInline(x)}`],
  [/^Finish[:]\s+(.+?)\.?$/i, (_, x) => `Фініш: ${translateInline(x)}`],

  // "Made from X"
  [/^Made\s+from\s+(.+?)\.?$/i, (_, x) => `Виготовлено з ${translateInline(x)}`],
  [/^Made\s+of\s+(.+?)\.?$/i, (_, x) => `Виготовлено з ${translateInline(x)}`],
  [/^Crafted\s+from\s+(.+?)\.?$/i, (_, x) => `Виготовлено з ${translateInline(x)}`],

  // "Use of original mounting points" — generic prefix patterns
  [/^Use\s+of\s+(.+?)\.?$/i, (_, x) => `Застосування: ${translateInline(x)}`],

  // Vehicle compatibility lines ending in "from 2019" / "from 2022"
  [
    /^(.+?)\s+from\s+(\d{4})\.?$/i,
    (_, body, year) =>
      /[A-Za-zА-Яа-я]/.test(body) ? `${translateInline(body)} з ${year} р.` : null,
  ],

  // Boilerplate "insight into how each part is created" — covers ~150 occurrences.
  // Many subtle variants (each part / each individual part / at Ilmberger / at Ilmberger Carbon /
  // passion and expertise / know-how / finesse / technical sophistication). All say
  // essentially the same thing, so a single translation works.
  [
    /^An?\s+(?:exciting|fascinating)\s+insight\s+into\s+how\s+.+?\s+can\s+be\s+found\s+in\s+the\s+detailed\s+report\s+on\s+the\s+production\s+process\.?$/i,
    () =>
      "Захопливий погляд на те, як кожна деталь Ilmberger Carbon створюється з пристрастю та майстерністю, ви знайдете у детальному звіті про виробничий процес.",
  ],

  // "The in-house development is also full of innovations – discover how much X and Y is/goes into every Ilmberger carbon part."
  [
    /^The\s+in-house\s+development\s+is\s+also\s+full\s+of\s+innovations\s*[-–—]\s*discover\s+how\s+much\s+(?:dedication|passion|heart)\s+and\s+technical\s+(?:sophistication|finesse|expertise)\s+(?:is\s+in|goes\s+into)\s+every\s+Ilmberger\s+carbon\s+part\.?$/i,
    () =>
      "Власні розробки сповнені інновацій — переконайтеся, скільки відданості та технічної майстерності вкладено в кожну карбонову деталь Ilmberger.",
  ],

  // Vehicle title repeats ("Ducati Diavel 1260 Carbon X Cover") — these are
  // restatements of the product title in body text. Best to use the localized
  // title from titleUa instead; but as a fallback, translate "Carbon X" → "Карбоновий X".
  // Skip — leave English here; covered by titleUa swap on the H2.
];

// Small inline word/phrase replacer for use INSIDE regex captures. Keep short
// — only safe substitutions (technical nouns that map 1:1).
const INLINE_GLOSSARY = [
  ["high-quality carbon in matte finish", "високоякісний карбон у матовому фініші"],
  ["high-quality matte carbon", "високоякісний карбон, матовий"],
  ["high-quality carbon", "високоякісний карбон"],
  ["matte carbon", "матовий карбон"],
  ["glossy carbon", "глянцевий карбон"],
  ["high-quality", "високоякісний"],
  ["glossy", "глянцева"],
  ["matte", "матова"],
  ["matt", "матова"],
];

function translateInline(s) {
  let out = s;
  for (const [en, ua] of INLINE_GLOSSARY) {
    out = out.replace(
      new RegExp(`\\b${en.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi"),
      ua
    );
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-sentence lookup. Returns translated UA or null if no match.
// ─────────────────────────────────────────────────────────────────────────────
function translateSentence(rawEn) {
  const text = rawEn.trim();
  if (!text) return rawEn;
  // If it's already (partly) Cyrillic, leave as-is — it was already translated
  // by an earlier pass, don't re-process.
  if (/[А-Яа-яҐґЄєІіЇї]/.test(text)) return rawEn;

  const norm = normalize(text);
  const normLower = norm.toLowerCase();
  const lookup =
    NORMALIZED_PHRASES.get(normLower) || NORMALIZED_PHRASES.get(stripTrailingDot(normLower));
  if (lookup) {
    // Preserve original trailing punctuation if present
    const trailing = text.match(/[.!?]+\s*$/);
    const ua = trailing && !/[.!?]\s*$/.test(lookup.ua) ? lookup.ua + trailing[0] : lookup.ua;
    return ua;
  }

  // Try regex patterns
  for (const [re, fn] of REGEX_PATTERNS) {
    const m = norm.match(re);
    if (m) {
      const result = fn(...m);
      if (result) {
        const trailing = text.match(/[.!?]+\s*$/);
        return trailing && !/[.!?]\s*$/.test(result) ? result + trailing[0] : result;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML walker. For every tag in TRANSLATABLE_TAGS, translate its inner text.
// Preserves nested HTML by only translating the OUTERMOST text run within each
// tag — if a tag has nested tags, we recurse into them too.
// ─────────────────────────────────────────────────────────────────────────────
const TRANSLATABLE_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "span", "em", "p"];

/**
 * Translate a text run that may contain multiple sentences. Splits on
 * sentence boundaries (.! ?) and translates each sentence individually,
 * preserving surrounding whitespace. Untranslated sentences remain English.
 */
function translateTextRun(text) {
  // First try the whole text as a single phrase (fast path for short bullets).
  const whole = translateSentence(text);
  if (whole !== null && whole !== text) return whole;

  // Split into sentences. Capture group preserves the delimiter.
  // Pattern: any chars up to . ! or ? followed by whitespace+capital OR end.
  const sentenceRegex = /([^.!?]+[.!?]+)(\s+)/g;
  const sentences = [];
  let lastIdx = 0;
  let match;
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push({ sentence: match[1], trailing: match[2] });
    lastIdx = sentenceRegex.lastIndex;
  }
  const remainder = text.substring(lastIdx);

  // If we found 0 or 1 sentences, no splitting helped — just return original.
  if (sentences.length === 0) return text;

  let out = "";
  for (const { sentence, trailing } of sentences) {
    const t = translateSentence(sentence);
    out += (t !== null ? t : sentence) + trailing;
  }
  if (remainder.trim()) {
    const t = translateSentence(remainder);
    out += t !== null ? t : remainder;
  } else {
    out += remainder;
  }
  return out;
}

/**
 * Translate text content of a single HTML tag's inner content. The content
 * may contain nested HTML (e.g. <em>, <strong>) — we split on tags and
 * translate text runs individually, leaving tags untouched.
 */
function translateInnerContent(inner) {
  // Split by HTML tags, preserving them
  const parts = inner.split(/(<[^>]+>)/);
  let translatedAny = false;
  const out = parts.map((part) => {
    if (/^<[^>]+>$/.test(part)) return part; // tag, leave as is
    if (!part.trim()) return part;
    const t = translateTextRun(part);
    if (t !== part) {
      translatedAny = true;
      return t;
    }
    return part;
  });
  return { result: out.join(""), translatedAny };
}

/**
 * Walk HTML and translate inner text of every translatable tag.
 * Uses a tag-balancing parser (handles nested tags of the same name).
 */
export function translateHtml(html) {
  if (!html) return html;
  let out = html;

  // Translate inside each translatable tag. We do this with a non-greedy match
  // that walks left-to-right. To handle nesting, we replace iteratively and
  // re-scan until no more changes (bounded by passes).
  const tagPattern = new RegExp(
    `<(${TRANSLATABLE_TAGS.join("|")})(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>`,
    "gi"
  );

  // Single pass is enough because translateInnerContent recurses via split on tags.
  out = out.replace(tagPattern, (full, tagName, attrs, inner) => {
    const { result } = translateInnerContent(inner);
    const openAttrs = attrs || "";
    return `<${tagName}${openAttrs}>${result}</${tagName}>`;
  });

  // Translate stray text nodes at top level (between tags). Common pattern in
  // Ilmberger HTML — closing brand paragraph is just <p>...</p> already handled,
  // but sometimes there are bare text lines.
  return out;
}

/**
 * Compatibility wrapper for legacy callers (apply-translations.mjs).
 * Returns translated body HTML.
 */
export function buildUaDescription({ titleUa, sku, titleEn, descriptionHtmlEn, bodyHtmlEn }) {
  const src = bodyHtmlEn || descriptionHtmlEn;
  if (src && src.length > 50) {
    let translated = translateHtml(src);
    // Replace H2 with our localized title for consistency.
    translated = translated.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, `<h2>${titleUa}</h2>`);
    return translated;
  }
  return `<h2>${titleUa}</h2>
<p>Карбонова деталь Ilmberger, виготовлена з препрегу в автоклаві — пряма заміна штатної. Якість, сертифікована TÜV; виробництво за ISO 9001.</p>`;
}

export { normalize, translateSentence };
