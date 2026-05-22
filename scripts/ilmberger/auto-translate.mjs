/**
 * Auto-generate UA titles + descriptions for Ilmberger products.
 *
 * Strategy: phrase-by-phrase substitution on titleEn → titleUa.
 * Long phrases replaced first (so "Front Sprocket Cover" wins over "Cover").
 * descriptionHtmlUa rebuilt from the same universal template used for BMW.
 *
 * Run:
 *   node scripts/ilmberger/auto-translate.mjs --in tmp/ilmberger-ducati-panigale-v4-2022.json
 *   node scripts/ilmberger/auto-translate.mjs --in tmp/ilmberger-ducati-panigale-v4-2025.json
 */
import { readFileSync, writeFileSync } from "fs";
import { buildUaDescription } from "./description.mjs";

const argv = process.argv.slice(2);
const inFlag = argv.indexOf("--in");
if (inFlag < 0) {
  console.error("Usage: node auto-translate.mjs --in <json-path>");
  process.exit(1);
}
const JSON_PATH = argv[inFlag + 1];

// ── Phrase substitutions (case-insensitive, longest-first) ──────────────
// IMPORTANT: order matters — multi-word phrases must come before single
// words. Otherwise "Cover" matches and breaks "Sprocket Cover".
const PHRASES = [
  // ─── Compound directional ("on the left/right") — first to override "left"/"right" alone
  ["Panel on the", "Кришка на"],
  ["on the left", "зліва на"],
  ["on the right", "справа на"],
  ["on the", "на"],

  // ─── Specific multi-word parts
  ["Front Sprocket Cover", "Накладка передньої зірки"],
  ["Sprocket cover", "Накладка передньої зірки"],
  ["Front Mudguard", "Переднє крило"],
  ["Front Fender", "Переднє крило"],
  ["Front fender", "Переднє крило"],
  ["Rear Mudguard", "Заднє крило"],
  ["Rear Fender", "Заднє крило"],
  ["Rear fender", "Заднє крило"],
  ["Rear Hugger", "Задній бризковик"],
  ["Rear hugger", "Задній бризковик"],
  ["Upper Chainguard", "верхній захист ланцюга"],
  ["Clutch Cover", "Кришка зчеплення"],
  ["Clutch cover", "Кришка зчеплення"],
  ["Instrument cover", "Накладка приладової панелі"],
  ["Instrument Cover", "Накладка приладової панелі"],
  ["Wind Tunnel Cover", "Накладка повітряного каналу"],
  ["Wind tunnel cover", "Накладка повітряного каналу"],
  ["Inner airtube cover", "Внутрішня накладка повітропроводу"],
  ["Air tube cover", "Накладка повітропроводу"],
  ["Airtube cover", "Накладка повітропроводу"],
  ["Splash guard", "Бризковик"],
  ["Mud guard", "Бризковик"],
  ["Lampenabdeckung", "Накладка фари"],
  ["Lamp cover", "Накладка фари"],
  ["Headlight cover", "Накладка фари"],
  ["Tail cover", "Накладка хвоста"],
  ["Tail Cover", "Накладка хвоста"],
  ["Chain guard", "Захист ланцюга"],
  ["Chainguard", "Захист ланцюга"],
  ["Side cover", "Бокова накладка"],
  ["Side Cover", "Бокова накладка"],
  ["Air box cover", "Накладка повітряного фільтра"],
  ["Airbox cover", "Накладка повітряного фільтра"],
  ["Belly guard", "Захист піддону"],

  // ─── Diavel + Streetfighter additions ─────────────────────────────
  ["Single Seat Unit Special", "Спеціальне одномісне сидіння"],
  ["Single Seat Unit", "Одномісне сидіння"],
  ["Single Seat", "Одномісне сидіння"],
  ["Pillion seat cover", "Накладка пасажирського сидіння"],
  ["Pillion Seat Cover", "Накладка пасажирського сидіння"],
  ["Pillion seat", "Пасажирське сидіння"],
  ["Winglet Kit", "Комплект вінглетів"],
  ["Winglet", "Вінглет"],
  ["Headlight Mask", "Маска фари"],
  ["Headlight mask", "Маска фари"],
  ["Light Mask", "Маска фари"],
  ["Light mask", "Маска фари"],
  ["Instrumentcover", "Накладка приладової панелі"],
  ["Radiator cover", "Накладка радіатора"],
  ["Radiator Cover", "Накладка радіатора"],
  ["Engine cover", "Накладка двигуна"],
  ["Engine Cover", "Накладка двигуна"],
  ["Belt Guard", "Захист ременя"],
  ["Belt guard", "Захист ременя"],
  ["incl.Belt Guard", "+ захист ременя"],
  ["incl. Belt Guard", "+ захист ременя"],
  ["frame tail fairing", "хвостовий обтічник рами"],
  ["Frame tail fairing", "Хвостовий обтічник рами"],
  ["rear frame fairing", "задній обтічник рами"],
  ["Rear frame fairing", "Задній обтічник рами"],
  ["Side cover on tank", "Бокова накладка бака"],
  ["side cover on tank", "бокова накладка бака"],
  ["on tank", "на баку"],
  ["Airtube cover left side", "Накладка повітропроводу зліва"],
  ["Airtube cover right side", "Накладка повітропроводу справа"],
  ["left side", "лівий бік"],
  ["right side", "правий бік"],
  ["Swingarm Covers", "Накладки маятника"],
  ["Swingarm covers", "Накладки маятника"],
  ["Swingarm Cover", "Накладка маятника"],
  ["Swingarm cover", "Накладка маятника"],
  // Colors (used in seat variants)
  ["Special red", "спеціальне (червоний)"],
  ["Special black", "спеціальне (чорний)"],
  ["Special grey", "спеціальне (сірий)"],
  ["XDiavel", "XDiavel"],
  // Top suffix
  ["Top Matte", "(матовий, верх)"],
  ["Top Gloss", "(глянцевий, верх)"],
  [" Top ", " верхній "],
  // Number-plate cover
  ["Numberplate Cover", "Накладка під номер"],
  ["Numberplate cover", "Накладка під номер"],

  // ─── More Diavel/XDiavel-specific terms ─────────────────────────────
  ["Cover under the frame", "Накладка під рамою"],
  ["cover under the frame", "накладка під рамою"],
  ["Cover under the tank", "Накладка під бак"],
  ["cover under the tank", "накладка під бак"],
  ["Exhaustprotection on the manifold", "Захист випуску на колекторі"],
  ["exhaustprotection on the manifold", "захист випуску на колекторі"],
  ["Exhaustprotection", "Захист випуску"],
  ["exhaustprotection", "захист випуску"],
  ["Air tube outlet", "Випуск повітропроводу"],
  ["air tube outlet", "випуск повітропроводу"],
  ["Exhaust protector muffler", "Захист глушника"],
  ["exhaust protector muffler", "захист глушника"],
  // Standalone "muffler" appearing mid-string
  [" muffler", " глушника"],
  [" Muffler", " Глушника"],
  // Generic catch-all small fragments
  ["small", "малий"],
  ["Small", "Малий"],
  ["big", "великий"],
  ["Big", "Великий"],

  // ─── Final missing phrases ───────────────────────────────────────
  ["Ignition switch cover", "Накладка замка запалювання"],
  ["ignition switch cover", "накладка замка запалювання"],
  ["Sub Frame protector", "Захист підрамника"],
  ["Sub frame protector", "Захист підрамника"],
  ["sub frame protector", "захист підрамника"],
  ["Air tube cover", "Накладка повітропроводу"],
  ["air tube cover", "накладка повітропроводу"],
  ["Seat cover", "Накладка сидіння"],
  ["seat cover", "накладка сидіння"],
  ["Top Glossy", "(глянцевий, верх)"],
  ["top glossy", "(глянцевий, верх)"],
  ["Top Gloss", "(глянцевий, верх)"],
  ["Top Matt", "(матовий, верх)"],
  ["top matt", "(матовий, верх)"],
  ["Tank Panel front", "Передня панель бака"],
  ["Tank panel front", "Передня панель бака"],
  ["Cambelt cover horizontal cylinder", "Накладка ременя ГРМ горизонтального циліндра"],
  ["Cambelt cover vertical cylinder", "Накладка ременя ГРМ вертикального циліндра"],
  ["Cambelt cover", "Накладка ременя ГРМ"],
  ["Fairing Side Panel", "Бокова панель обтічника"],
  ["Fairing side panel", "Бокова панель обтічника"],
  // Colors (used in Special seat variants)
  [" red ", " (червоний) "],
  [" black ", " (чорний) "],
  [" grey ", " (сірий) "],
  [" gray ", " (сірий) "],
  [" Red ", " (червоний) "],
  [" Black ", " (чорний) "],
  [" Grey ", " (сірий) "],
  ["Belly Pan one piece", "Цільний нижній обтічник"],
  ["Belly pan one piece", "Цільний нижній обтічник"],
  ["Bellypan one piece", "Цільний нижній обтічник"],
  ["Belly pan", "Нижній обтічник"],
  ["Belly Pan", "Нижній обтічник"],
  ["Bellypan", "Нижній обтічник"],
  ["Upper Tank Cover", "Верхня накладка на бак"],
  ["Tank Side Panel", "Бокова панель бака"],
  ["Tank side panel", "Бокова панель бака"],
  ["tank side cover", "бокова накладка бака"],
  ["Tank side cover", "Бокова накладка бака"],
  ["Tank Side Cover", "Бокова накладка бака"],
  ["Tank cover", "Накладка на бак"],
  ["Tank Cover", "Накладка на бак"],
  ["Tankabdeckung vorne", "Передня накладка на бак"],
  ["Tankabdeckung", "Накладка на бак"],
  ["Frame Cover small", "Мала накладка рами"],
  ["Frame Cover big", "Велика накладка рами"],
  ["Frame cover", "Накладка рами"],
  ["Frame Cover", "Накладка рами"],
  ["Swing arm cover", "Захист маятника"],
  ["Swing Arm Cover", "Захист маятника"],
  ["Swingarm cover", "Захист маятника"],
  ["Heel Protector", "Захист п'яти"],
  ["Heel protector", "Захист п'яти"],
  ["Heel Guard", "Захист п'яти"],
  ["Heel guard", "Захист п'яти"],
  ["Numberplate holder", "Тримач номерного знаку"],
  ["Number plate holder", "Тримач номерного знаку"],
  ["License plate holder", "Тримач номерного знаку"],
  ["Ignition lock cover", "Накладка замка запалювання"],
  ["Ignition Rotor Cover", "Накладка ротора запалювання"],
  ["Alternator cover", "Кришка генератора"],
  ["Alternator Cover", "Кришка генератора"],
  ["Camshaft cover", "Накладка головки циліндра"],
  ["Cylinder head cover", "Накладка головки циліндра"],
  ["Cam cover", "Накладка головки циліндра"],
  ["Cylinder cover", "Накладка головки циліндра"],
  ["Electrical cable cover", "Накладка електрокабелю"],
  ["Cable cover", "Накладка кабелю"],
  ["Water pump Cover", "Накладка водяної помпи"],
  ["Water pump cover", "Накладка водяної помпи"],
  ["Passenger seat cover", "Накладка пасажирського сидіння"],
  ["Monoposto Seat Unit", "Одномісний задній верх"],
  ["Biposto Seat Unit", "Двомісний задній верх"],
  ["Seat Unit Middle Part", "Центральна вставка задньої частини"],
  ["Seat Unit", "Задній верх"],
  ["Rear Undertray", "Нижній задній обвіс"],
  ["Lower Undertray", "Нижній задній обвіс"],
  ["Muffler / Silencer Protector", "Захист глушника"],
  ["Silencer Protector", "Захист глушника"],
  ["Muffler Protector", "Захист глушника"],
  ["Exhaust Heat Shield", "Захист випуску від нагріву"],
  ["Exhaust heat shield", "Захист випуску від нагріву"],
  ["Exhaust protector", "Захист вихлопу"],
  ["Exhaust Protector", "Захист вихлопу"],
  ["Exhaust Cover", "Накладка вихлопу"],
  ["Exhaust cover", "Накладка вихлопу"],
  ["Exhaust cap", "Кришка вихлопу"],
  ["Badge Holder", "Тримач емблеми"],
  ["Badge holder", "Тримач емблеми"],
  ["Air Intake", "Повітрозабірник"],
  ["Inner Wing", "Внутрішнє крило"],
  ["Side panel", "Бокова панель"],
  ["Side Panel", "Бокова панель"],
  ["Upper fairing", "Верх обтічника"],
  ["Upper Fairing", "Верх обтічника"],
  ["Lower fairing", "Нижній обтічник"],
  ["Lower Fairing", "Нижній обтічник"],
  // Single-word fallbacks (after multi-word phrases)
  ["fender", "крило"],
  ["Fender", "Крило"],
  ["hugger", "бризковик"],
  ["fairing", "обтічник"],
  ["Fairing", "Обтічник"],

  // ─── Modifiers / directions ───────────────────────────────────────
  ["Full Version", "повна версія"],
  ["with attachments for colored OEM Panel", "з кріпленнями для кольорової OEM-панелі"],
  // Compound — "Carbon Gloss / Matte" + "glossy/matte" suffixes (longest first!)
  ["Carbon glossy", "глянцевий карбон"],
  ["carbon glossy", "глянцевий карбон"],
  ["glossy Carbon", "глянцевий карбон"],
  ["glossy carbon", "глянцевий карбон"],
  ["Carbon Glossy", "глянцевий карбон"],
  ["Carbon Matte", "матовий карбон"],
  ["carbon matte", "матовий карбон"],
  ["matte Carbon", "матовий карбон"],
  ["matt Carbon", "матовий карбон"],
  ["Carbon Gloss", "глянцевий карбон"],
  ["carbon gloss", "глянцевий карбон"],
  ["Carbon gloss", "глянцевий карбон"],
  ["Carbon Matt", "матовий карбон"],
  ["carbon matt", "матовий карбон"],
  ["Carbon matt", "матовий карбон"],
  // Single-word finish words (after Carbon-pairs).
  // IMPORTANT: "matte" BEFORE "matt", "glossy" BEFORE "gloss" — otherwise the
  // shorter match leaves a stray "e"/"y" behind ("(матовий)e", "(глянцевий)y").
  ["glossy", "(глянцевий)"],
  ["Glossy", "(глянцевий)"],
  ["matte", "(матовий)"],
  ["Matte", "(матовий)"],
  ["gloss", "(глянцевий)"],
  ["Gloss", "(глянцевий)"],
  ["glanz", "(глянцевий)"],
  ["Glanz", "(глянцевий)"],
  ["Matt", "(матовий)"],
  ["matt", "(матовий)"],
  ["Street version", "вулична версія"],
  ["street version", "вулична версія"],
  ["for Full Racing Exhaust", "для повної гоночної вихлопної системи"],
  ["for hohen Auspuff", "для високого вихлопу"],
  ["for niedrigen Auspuff", "для низького вихлопу"],
  ["Left", "лівий"],
  ["left", "лівий"],
  ["Right", "правий"],
  ["right", "правий"],

  // ─── Year/MY phrases ──────────────────────────────────────────────
  ["from MY", "від MY"],
  ["MY from", "MY з"],
  ["from", "з"],
  // German "ab" (= "from") slipped into a few EN titles
  [" ab ", " з "],

  // ─── Bike model words (keep as-is) ────────────────────────────────
  // (no-op replacements just document intent — no harm to skip them)
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function autoTranslateTitle(titleEn) {
  let t = titleEn;
  for (const [en, ua] of PHRASES) {
    // Case-insensitive global replace — handles "Wind tunnel cover" matching
    // both "Wind tunnel cover" and "wind tunnel cover" in titles.
    const re = new RegExp(escapeRegex(en), "gi");
    t = t.replace(re, ua);
  }
  return polishTitle(t);
}

/**
 * Post-process a translated title to fix:
 *  - Dangling plural "s" from "Covers"/"glossy" leftovers
 *    ("Захист маятникаs" → "Захист маятника")
 *  - English "left/right" → Ukrainian "лівий/правий" placed at the start
 *    (English calque) — move to the end of the part-noun phrase as
 *    invariable adverb "зліва"/"справа" (works for ANY noun gender).
 *  - Double spaces, trailing artifacts.
 */
function polishTitle(t) {
  // 1. Kill dangling plural-s/y after Cyrillic letters
  //    ("маятникаs" → "маятника", "(глянцевий)y" → "(глянцевий)")
  //    Note: JS \b doesn't work for Cyrillic, so we use explicit boundaries.
  t = t.replace(/([а-яіїєА-ЯІЇЄ\)])[sy](?=\s|$|[^a-zA-Z])/g, "$1");

  // 2. Move "лівий"/"правий" adjective to "(зліва)"/"(справа)" at the natural
  // end of the noun phrase. English sources have it as pre-modifier
  // ("Left fender") OR post-modifier ("Cover left"). Both become "лівий" /
  // "правий" anywhere in the UA string after dictionary lookup. We want them
  // at the end of the noun phrase as invariable adverbs (works for any gender).
  //
  // Cyrillic-aware match (no \b — use whitespace / start / end):
  const sideRe = /(?:^|\s)(лівий|Лівий|правий|Правий)(?=\s|$)/;
  const sideMatch = t.match(sideRe);
  if (sideMatch) {
    const side = /прав/i.test(sideMatch[1]) ? "(справа)" : "(зліва)";
    // Remove ALL occurrences of side adjectives
    t = t.replace(/(?:^|\s)(лівий|Лівий|правий|Правий)(?=\s|$)/g, " ");
    t = t.replace(/\s{2,}/g, " ").trim();
    // Insert side BEFORE first variant/bike anchor (or at end if none).
    const anchorRe =
      /\s+(\(глянцевий\)|\(матовий\)|глянцевий\s+карбон|матовий\s+карбон|BMW\b|Ducati\b|Panigale\b|Streetfighter\b|Diavel\b|XDiavel\b|з\s+\d{4})/;
    const m = t.match(anchorRe);
    if (m) {
      t = t.replace(anchorRe, ` ${side} $1`);
    } else {
      t = `${t.trim()} ${side}`;
    }
  }

  // 3. Remove standalone "Carbon" / "Gloss" / "Top" / "tank" English leftovers
  //    that fell out of larger phrases. Mid-string AND start-of-string.
  t = t.replace(/\s+(Carbon|Gloss|Top|tank)\s+/g, " ");
  t = t.replace(/^(Carbon|Gloss|Top|tank)\s+/i, ""); // leading leftover

  // 4. Collapse double spaces, trim.
  t = t.replace(/\s{2,}/g, " ").trim();

  // 5. Capitalize first letter if it's lowercase Cyrillic
  if (t.length > 0 && /[а-яіїє]/.test(t[0])) {
    t = t[0].toUpperCase() + t.slice(1);
  }
  return t;
}

const products = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
let titlesUpdated = 0;
let descUpdated = 0;

for (const p of products) {
  p.titleUa = autoTranslateTitle(p.titleEn);
  titlesUpdated++;
  p.descriptionHtmlUa = buildUaDescription({
    titleUa: p.titleUa,
    sku: p.sku,
    titleEn: p.titleEn,
    descriptionHtmlEn: p.descriptionHtmlEn,
  });
  descUpdated++;
}

writeFileSync(JSON_PATH, JSON.stringify(products, null, 2));
console.log(`✅ ${JSON_PATH}`);
console.log(`   ${titlesUpdated} titleUa generated`);
console.log(`   ${descUpdated} descriptionHtmlUa generated`);
console.log(`\nSamples:`);
products.slice(0, 5).forEach((p) => {
  console.log(`  [${p.sku}]`);
  console.log(`    EN: ${p.titleEn}`);
  console.log(`    UA: ${p.titleUa}`);
});
