import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import * as cheerio from "cheerio";

const ROOT = resolve("backups/local-translations");
const MODEL = process.env.LOCAL_TRANSLATION_MODEL ?? "translategemma:12b";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const TRANSLATION_PIPELINE_VERSION = 18;
const brandArg = process.argv.find((value) => value.startsWith("--brand="))?.slice(8) ?? "kw";
const limitArg = process.argv.find((value) => value.startsWith("--limit="))?.slice(8);
const limit = limitArg ? Number(limitArg) : 5;
const offsetArg = process.argv.find((value) => value.startsWith("--offset="))?.slice(9);
const offset = offsetArg ? Number(offsetArg) : 0;
const KW_VENDOR_ALIASES = new Set(["kw", "kw automotive ukraine"]);

if (!Number.isInteger(limit) || limit < 1)
  throw new TypeError("--limit must be a positive integer");
if (!Number.isInteger(offset) || offset < 0)
  throw new TypeError("--offset must be a non-negative integer");
if (!new Set(["kw", "fi"]).has(brandArg)) throw new TypeError("--brand must be kw or fi");

const GLOSSARY = [
  ["койловерна підвіска", "coilover suspension"],
  ["койловери", "coilovers"],
  ["нержавіюча сталь", "stainless steel"],
  ["нержавіючої сталі", "stainless steel"],
  ["верхня опора", "top mount"],
  ["регулювання відбою", "rebound adjustment"],
  ["регулювання стиснення", "compression adjustment"],
  ["регулювання висоти", "height adjustment"],
  ["пружини", "springs"],
  ["вихлопна система", "exhaust system"],
  ["клапанна вихлопна система", "valvetronic exhaust system"],
  ["комплектація", "kit contents"],
  ["сумісність", "fitment"],
];

const EXACT_TRANSLATIONS = new Map([
  ["мм", "mm"],
  ["кг", "kg"],
  ["Марка", "Make"],
  ["Модель", "Model"],
  ["Модифікація", "Variant"],
  ["Партномер:", "Part number:"],
  ["Ключові характеристики", "Key features"],
  ["Основні характеристики:", "Key features:"],
  ["Сумісність (авто від 2018 року)", "Fitment (vehicles from 2018 onwards)"],
  ["Система керування:", "Control system:"],
  ["Facelift версія 9YA.2 (2023+)", "Facelift version 9YA.2 (2023+)"],
  ["Допуск/сертифікація:", "Approval / certification:"],
  ["Навантаження на вісь перед/зад:", "Front / rear axle load:"],
  ["Регулювання демпфування:", "Damping adjustment:"],
  ["Регулювання відбою і стиснення", "Rebound and compression adjustment"],
  ["Регулювання відбійу і стиснення", "Rebound and compression adjustment"],
  ["Регулювання відбійу", "Rebound adjustment"],
  ["Регулювання відбою", "Rebound adjustment"],
  ["Керованість:", "Handling:"],
  [
    "- Регульована амортизація відбійу з 16 точними клацаннями",
    "- Rebound damping adjustable through 16 precise clicks",
  ],
  ["– Амортизація відбою: 16 точних клацань", "– Rebound damping: 16 precise clicks"],
  ["– Низькошвидкісне стиснення: 6 точних клацань", "– Low-speed compression: 6 precise clicks"],
  ["– Високошвидкісне стиснення: 14 точних клацань", "– High-speed compression: 14 precise clicks"],
  ["– Безступінчасте регулювання висоти", "– Stepless height adjustment"],
  ["– Стійки з нержавіючої сталі", "– Stainless-steel struts"],
  [
    "- Регульоване демпфування стиснення з 12 точними клацаннями",
    "- Compression damping adjustable through 12 precise clicks",
  ],
  [
    "- Технологія регульованої амортизації для амортизації відбійу та стиснення",
    "- Adjustable rebound and compression damping technology",
  ],
  ['- Технологія нержавіючої сталі "inox-line"', "- Stainless-steel inox-line technology"],
  ["- Індивідуальне безперервне зниження", "- Individual, continuously adjustable lowering"],
  ["- Індивідуальне регулювання висоти", "- Individual height adjustment"],
  ["- Готове до встановлення повне рішення", "- Complete, ready-to-install solution"],
  ["- Оптимально налаштований", "- Optimally tuned"],
  ["Діапазон років (з каталогу):", "Model-year range (catalogue):"],
  ["часткове схвалення (§19.3)", "Parts approval (§19.3)"],
  ["схвалення частини (§19.3)", "Parts approval (§19.3)"],
  ["немає", "None"],
  ["Опція", "Option"],
  ["Ціна, EUR", "Price, EUR"],
  ["Базова", "Base"],
  ["Колір пружини", "Spring colour"],
  ["Текст на пружині", "Spring lettering"],
  ["Колір + текст", "Colour + lettering"],
  [
    "Завдяки делікатній обробці та використанню високоякісних компонентів стійки койловера KW V2 Comfort з нержавіючої сталі на 100 відсотків стійкі до корозії та мають необмежений термін служби.",
    "Thanks to careful manufacturing and high-quality components, the stainless-steel KW V2 Comfort coilover struts are 100 percent corrosion-resistant and have an unlimited service life.",
  ],
]);

const TRANSLITERATION_MARKERS = [
  /\bkoliov/iu,
  /\bnerzhav/iu,
  /\bstali\b/iu,
  /\bpidvisk/iu,
  /\breguliuv/iu,
  /\bkomplektatsi/iu,
  /\bsumisnist/iu,
];

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractTechnicalTokens(value) {
  const matches =
    String(value ?? "").match(
      /(?:https?:\/\/[^\s<>"']+|\b(?:[A-Z]{1,6}[0-9][A-Z0-9._/-]*|[0-9]+(?:[.,][0-9]+)?\s?(?:mm|cm|kg|kW|hp|ccm|Nm|bar|inch|in|%|°)|§?\d+(?:[.,/-]\d+)+|\d{4})\b)/gu
    ) ?? [];
  return [...new Set(matches)].sort();
}

function extractNumbers(value) {
  return (
    String(value ?? "")
      .match(/\d+(?:[.,]\d+)*/gu)
      ?.sort() ?? []
  );
}

function canonicalNumber(value) {
  return value.replace(",", ".");
}

function htmlShape(value) {
  return (
    String(value ?? "")
      .match(/<\/?[a-z][^>]*>/giu)
      ?.map((tag) => tag.match(/^<\/?([a-z0-9]+)/iu)?.[1]?.toLowerCase())
      .filter(Boolean) ?? []
  );
}

function protectTechnicalLiterals(source) {
  const candidates = [...new Set([...extractTechnicalTokens(source), ...extractNumbers(source)])]
    .filter((literal) => literal && !/[\u0400-\u04ff]/u.test(literal))
    .sort((left, right) => right.length - left.length);
  const literals = candidates.filter(
    (literal) => !candidates.some((longer) => longer !== literal && longer.includes(literal))
  );
  let protectedSource = source;
  for (const literal of literals) {
    const placeholder = `<code>${literal}</code>`;
    if (!protectedSource.includes(literal)) continue;
    protectedSource = protectedSource.split(literal).join(placeholder);
  }
  return {
    source: protectedSource,
    restore(value) {
      return value.replace(/<\/?code\b[^>]*>/giu, "");
    },
  };
}

function validate(source, translated, kind) {
  const issues = [];
  if (!normalize(translated)) issues.push("empty_translation");
  if (/[\u0400-\u04ff]/u.test(translated)) issues.push("english_contains_cyrillic");
  if (TRANSLITERATION_MARKERS.some((pattern) => pattern.test(translated)))
    issues.push("probable_transliteration");

  const sourceNumbers = [...new Set(extractNumbers(source).map(canonicalNumber))].sort();
  const targetNumbers = [...new Set(extractNumbers(translated).map(canonicalNumber))].sort();
  if (JSON.stringify(sourceNumbers) !== JSON.stringify(targetNumbers))
    issues.push("numbers_changed");

  const missingTokens = extractTechnicalTokens(source).filter((token) => {
    if (translated.includes(token)) return false;
    if (/^\d+,\d+$/u.test(token) && translated.includes(token.replace(",", "."))) return false;
    return true;
  });
  if (missingTokens.length) issues.push(`technical_tokens_missing:${missingTokens.join("|")}`);
  const requiredUnits = [
    [/(?:^|[^\p{L}])кг(?!\p{L})/iu, /(?:^|[^\p{L}])kg(?!\p{L})/iu, "kg"],
    [/(?:^|[^\p{L}])мм(?!\p{L})/iu, /(?:^|[^\p{L}])(?:mm|millimet(?:er|re)s?)(?!\p{L})/iu, "mm"],
  ];
  for (const [sourcePattern, targetPattern, unit] of requiredUnits) {
    if (sourcePattern.test(source) && !targetPattern.test(translated))
      issues.push(`unit_missing:${unit}`);
  }
  const duplicateSurface =
    kind === "html"
      ? cheerio.load(translated, { decodeEntities: false }, false).text()
      : translated;
  const sourceDuplicateSurface =
    kind === "html" ? cheerio.load(source, { decodeEntities: false }, false).text() : source;
  if (
    /\b([a-z]{2,})\s+\1\b/iu.test(duplicateSurface) &&
    !/\b([a-zа-яіїєґ]{2,})\s+\1\b/iu.test(sourceDuplicateSurface)
  ) {
    issues.push("duplicate_word");
  }
  const requiredTerms = [
    [/відбій(?!ник)/iu, /\brebound\b/iu, "rebound"],
    [/стиснен/iu, /\bcompression\b/iu, "compression"],
    [/койловер/iu, /\bcoilovers?\b/iu, "coilover"],
    [/нержав/iu, /\bstainless[- ]steel\b/iu, "stainless_steel"],
    [
      /(?:занижен|опускан|знижен)/iu,
      /(?:\blower(?:ing|ed)\b|\breduction in (?:ride )?height\b|\b(?:ride )?height reduction\b|\breduced ride height\b)/iu,
      "lowering",
    ],
  ];
  for (const [sourcePattern, targetPattern, term] of requiredTerms) {
    if (term === "lowering" && /знижен[а-яіїєґ]*\s+цін/iu.test(source)) continue;
    if (sourcePattern.test(source) && !targetPattern.test(translated))
      issues.push(`required_term_missing:${term}`);
  }

  if (
    kind === "html" &&
    JSON.stringify(htmlShape(source)) !== JSON.stringify(htmlShape(translated))
  ) {
    issues.push("html_shape_changed");
  }
  return issues;
}

async function translateProse(source) {
  const exact = EXACT_TRANSLATIONS.get(source.trim());
  if (exact) return exact;
  const prompt = `You are a professional Ukrainian (uk) to English (en) translator. Your goal is to accurately convey the meaning and nuances of the original Ukrainian text while adhering to English grammar, vocabulary, and cultural sensitivities. Preserve every <code> element and its contents exactly.\nProduce only the English translation, without any additional explanations or commentary. Please translate the following Ukrainian text into English:\n\n\n${source}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0, top_p: 0.9, num_ctx: 8192 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  return String(payload.response ?? "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .trim()
    .replace(/^```(?:html|text)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

async function ollamaTranslate(source, kind) {
  const exact = EXACT_TRANSLATIONS.get(source.trim());
  if (exact) return exact;
  const protectedInput = protectTechnicalLiterals(source);
  const translated = protectedInput.restore(await translateProse(protectedInput.source));
  let normalized = translated;
  for (const [ua, en] of GLOSSARY) {
    if (!source.toLocaleLowerCase("uk-UA").includes(ua.toLocaleLowerCase("uk-UA"))) continue;
    if (en === "coilover suspension")
      normalized = normalized.replace(/coil[- ]?over suspension/giu, en);
    if (en === "stainless steel")
      normalized = normalized.replace(/stainless(?:[-\s]+steel)?/giu, en);
  }
  normalized = normalized.replace(
    /\bcoilovers?\s+suspension(?:\s+system)?\b/giu,
    "Coilover suspension"
  );
  return kind === "title" ? normalized.replace(/[.]$/u, "") : normalized;
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(resolve(ROOT, "cache.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function translateCached(cache, source, kind) {
  if (!normalize(source)) return { translated: "", cached: true };
  const exact = EXACT_TRANSLATIONS.get(source.trim());
  if (exact) return { translated: exact, cached: true };
  const key = sha(`${TRANSLATION_PIPELINE_VERSION}\0${MODEL}\0${kind}\0${source}`);
  if (cache[key]) {
    const translated =
      kind === "title"
        ? cache[key]
            .replace(/\bcoilovers?\s+suspension(?:\s+system)?\b/giu, "Coilover suspension")
            .replace(/[.]$/u, "")
        : cache[key];
    return { translated, cached: true };
  }
  const translated = await ollamaTranslate(source, kind);
  cache[key] = translated;
  await writeFile(resolve(ROOT, "cache.json"), `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return { translated, cached: false };
}

async function loadKwDrafts() {
  const productsPath = resolve("backups/shopify/kw-suspensions/2026-09-02/products.jsonl");
  return (
    (await readFile(productsPath, "utf8"))
      .split(/\r?\n/u)
      .filter(Boolean)
      .map(JSON.parse)
      .filter((product) => String(product.id ?? "").includes("/Product/"))
      // Keep this aligned with selectKwShopifyProducts(): ST shares the export,
      // but is explicitly outside the approved One Company migration scope.
      .filter((product) =>
        KW_VENDOR_ALIASES.has(
          String(product.vendor ?? "")
            .trim()
            .toLowerCase()
        )
      )
      .map((product) => ({
        brand: "KW Suspensions",
        slug: product.handle,
        sku: product.variants?.[0]?.sku ?? null,
        titleUa: product.title,
        bodyHtmlUa: product.descriptionHtml ?? null,
      }))
  );
}

async function loadFiDrafts() {
  const productsPath = resolve("backups/shopify/fi-exhaust/2026-09-03/products.json");
  return JSON.parse(await readFile(productsPath, "utf8")).map((product) => ({
    brand: "Fi EXHAUST",
    slug: product.handle,
    sku: product.variants?.[0]?.sku ?? null,
    titleUa: product.title,
    bodyHtmlUa: product.body_html ?? null,
  }));
}

function cleanHtmlForTranslation(html) {
  if (!html) return null;
  const $ = cheerio.load(html, { decodeEntities: false }, false);
  return $.html().trim();
}

async function translateHtmlTextNodes(cache, html) {
  const $ = cheerio.load(html, { decodeEntities: false }, false);
  const nodes = $("*")
    .contents()
    .toArray()
    .filter((node) => {
      if (node.type !== "text" || !/[\u0400-\u04ff]/u.test(node.data ?? "")) return false;
      const parentName = node.parent?.type === "tag" ? node.parent.name?.toLowerCase() : "";
      return parentName !== "script" && parentName !== "style";
    });
  let cacheHits = 0;
  const issues = [];
  for (const node of nodes) {
    const original = node.data ?? "";
    const leading = original.match(/^\s*/u)?.[0] ?? "";
    const trailing = original.match(/\s*$/u)?.[0] ?? "";
    const source = original.trim();
    if (!source) continue;
    const chunks = source
      .split(/(?<=[.!?])([\s\n]+)|(?<=;)(\s+)/gu)
      .filter((chunk) => chunk !== undefined && chunk !== "");
    const translatedChunks = [];
    let nodeFullyCached = true;
    for (const chunk of chunks) {
      if (!/[\u0400-\u04ff]/u.test(chunk)) {
        translatedChunks.push(chunk);
        continue;
      }
      const result = await translateCached(cache, chunk, "text");
      if (!result.cached) nodeFullyCached = false;
      issues.push(
        ...validate(chunk, result.translated, "text").filter(
          (issue) =>
            issue !== "numbers_changed" &&
            !issue.startsWith("technical_tokens_missing:") &&
            !issue.startsWith("required_term_missing:") &&
            !issue.startsWith("unit_missing:")
        )
      );
      translatedChunks.push(result.translated);
    }
    if (nodeFullyCached) cacheHits += 1;
    node.data = `${leading}${translatedChunks.join("")}${trailing}`;
  }
  return {
    translated: $.html().trim(),
    cached: nodes.length > 0 && cacheHits === nodes.length,
    issues: [...new Set(issues)].sort(),
  };
}

function translateFiTitle(source) {
  return source
    .replace(/\s+для\s+/giu, " for ")
    .replace(/\s+та\s+/giu, " and ")
    .replace(/\s+і\s+/giu, " and ")
    .trim();
}

function canonicalizeKwTitle(source, translated) {
  if (/^Комплект пружин з регулюванням висоти KW HAS для /iu.test(source)) {
    return source.replace(
      /^Комплект пружин з регулюванням висоти KW HAS для /iu,
      "KW HAS height-adjustable spring kit for "
    );
  }
  const [sourcePrefix, ...sourceSuffixParts] = source.split(/\s+[—–]\s+/u);
  if (!sourceSuffixParts.length) return translated;
  let prefix = sourcePrefix
    .replace(/^Вирівнювання підвіски/iu, "Coilover suspension")
    .replace(/^Комфортна підвіска/iu, "Comfort coilover suspension")
    .replace(/^Підвіска V5/iu, "Coilover suspension V5")
    .replace(
      /^(?:Койловерна підвіска|Койловер підвіски|Койловер підвіска|Підвіска койловер)/iu,
      "Coilover suspension"
    )
    .replace(
      /^набір регульованих по висоті пружин \(занижуючі пружини\)/iu,
      "Height-adjustable spring kit (lowering springs)"
    )
    .replace(
      /^Занижуючі пружини KW Height Adjustable Spring Kit/iu,
      "KW height-adjustable spring kit"
    )
    .replace(
      /^Комплект пружин з регулюванням висоти KW HAS/iu,
      "KW HAS height-adjustable spring kit"
    )
    .replace(
      /^Комплект койловера (V\d+) з\.\s*Гідравлічна підйомна система (HLS \d+)/iu,
      "$1 coilover kit with $2 hydraulic lift system"
    )
    .replace(
      /^Гідравлічна підйомна система (HLS \d+) для OEM пароварки/iu,
      "$1 hydraulic lift system for OEM dampers"
    )
    .replace(
      /^(HLS \d+) Гідравлічна підйомна система f\. Демпфер KW/iu,
      "$1 hydraulic lift system for KW dampers"
    )
    .replace(
      /^(HLS \d+) Гідравлічна підйомна система f\. Підвіски KW та OEM/iu,
      "$1 hydraulic lift system for KW and OEM suspension"
    )
    .replace(/^Clubsport верхня опора/iu, "Clubsport top mount")
    .replace(/з нержавіючої сталі/giu, "stainless steel")
    .replace(/вкл\. верхні опори/giu, "incl. top mounts")
    .replace(/з верхніми опорами FA/giu, "with front-axle top mounts")
    .replace(/з верхніми опорами/giu, "with top mounts")
    .replace(/FA або RA/giu, "front or rear axle")
    .replace(/FA справа/giu, "front axle, right")
    .replace(/FA ліворуч/giu, "front axle, left")
    .replace(/RA справа/giu, "rear axle, right")
    .replace(/RA ліворуч/giu, "rear axle, left")
    .replace(/\bFA\b/gu, "front axle")
    .replace(/\bRA\b/gu, "rear axle")
    .replace(/\(з регулюванням розвалу та кол(?:еса|іщаток)\)/giu, "(camber and caster adjustable)")
    .replace(/\(з регулюванням розвалу\)/giu, "(camber adjustable)")
    .replace(/\(без регулювання розвалу\)/giu, "(without camber adjustment)")
    .replace(
      /\(включаючи комплект для скасування електронних амортизаторів\)/giu,
      "(including electronic damper cancellation kit)"
    )
    .replace(
      /\(включно з комплектом для скасування електронних амортизаторів\)/giu,
      "(including electronic damper cancellation kit)"
    )
    .replace(
      /\(з деактивацією електронних амортизаторів\)/giu,
      "(with electronic damper deactivation)"
    )
    .replace(
      /\(включаючи комплект для деактивація електронних амортизаторів\)/giu,
      "(including electronic damper deactivation kit)"
    )
    .replace(/з гідравлічним ліфтом (HLS \d+)/giu, "with $1 hydraulic lift system")
    .replace(/з гідравлічною підйомною системою (HLS \d+)/giu, "with $1 hydraulic lift system")
    .replace(/алюміній/giu, "aluminium");
  prefix = prefix
    .replace(
      /^DDC - ECU койловери inox з (HLS \d+)/iu,
      "DDC ECU stainless-steel coilover suspension with $1"
    )
    .replace(/^DDC - ECU койловери inox/iu, "DDC ECU stainless-steel coilover suspension")
    .replace(
      /^DDC - койловери Plug & Play (?:з нержавіючої сталі|stainless steel)/iu,
      "DDC Plug & Play stainless-steel coilover suspension"
    )
    .replace(/\s+/gu, " ")
    .trim();
  const suffix = sourceSuffixParts.join(" — ").replace(/\s+та ін\./giu, " and others");
  return /[\u0400-\u04ff]/u.test(prefix) ? translated : `${prefix} — ${suffix}`;
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  const cache = await loadCache();
  const sourceProducts = brandArg === "kw" ? await loadKwDrafts() : await loadFiDrafts();
  const products = sourceProducts.slice(offset, offset + limit);
  const results = [];

  for (const [index, product] of products.entries()) {
    process.stdout.write(`[${index + 1}/${products.length}] ${product.slug}\n`);
    const rawTitleResult =
      brandArg === "fi"
        ? { translated: translateFiTitle(product.titleUa), cached: true }
        : await translateCached(cache, product.titleUa, "title");
    const titleResult =
      brandArg === "kw"
        ? {
            ...rawTitleResult,
            translated: canonicalizeKwTitle(product.titleUa, rawTitleResult.translated),
          }
        : rawTitleResult;
    const bodySource = cleanHtmlForTranslation(product.bodyHtmlUa);
    const bodyResult = bodySource
      ? await translateHtmlTextNodes(cache, bodySource)
      : { translated: null, cached: true };
    const issues = [
      ...validate(product.titleUa, titleResult.translated, "title").map(
        (issue) => `title:${issue}`
      ),
      ...(bodyResult.issues ?? []).map((issue) => `body-segment:${issue}`),
      ...(bodySource
        ? validate(bodySource, bodyResult.translated, "html").map((issue) => `body:${issue}`)
        : []),
    ];
    results.push({
      ...product,
      titleEn: titleResult.translated,
      bodyHtmlEn: bodyResult.translated,
      cached: { title: titleResult.cached, body: bodyResult.cached },
      status: issues.length ? "REVIEW_REQUIRED" : "PASS",
      issues,
    });
  }

  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const outputPath = resolve(ROOT, `${brandArg}-sample-${stamp}.json`);
  const reportPath = resolve(ROOT, `${brandArg}-sample-${stamp}.audit.json`);
  const report = {
    model: MODEL,
    brand: brandArg,
    processed: results.length,
    offset,
    passed: results.filter((entry) => entry.status === "PASS").length,
    reviewRequired: results.filter((entry) => entry.status === "REVIEW_REQUIRED").length,
    issueCounts: Object.fromEntries(
      [...new Set(results.flatMap((entry) => entry.issues))]
        .sort()
        .map((issue) => [issue, results.filter((entry) => entry.issues.includes(issue)).length])
    ),
    databaseWrites: 0,
  };
  await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, reportPath, ...report }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
