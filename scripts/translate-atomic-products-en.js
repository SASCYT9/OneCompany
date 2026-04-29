/* eslint-disable no-console */
/**
 * Targeted EN backfill for Atomic-sourced products.
 *
 * Strategy:
 * 1. Reuse existing English `bodyHtmlEn` when it is already clean.
 * 2. Extract product title from English HTML headings when available.
 * 3. Translate only the remaining gaps from UA -> EN via Gemini.
 *
 * Usage:
 *   node scripts/translate-atomic-products-en.js --dry-run
 *   node scripts/translate-atomic-products-en.js --commit
 *   node scripts/translate-atomic-products-en.js --commit --translate-html
 *   node scripts/translate-atomic-products-en.js --commit --brands=ADRO,CSF
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_BRANDS = ['ADRO', 'AKRAPOVIC', 'CSF', 'OHLINS'];
const GENERIC_TITLE_PATTERNS = [
  /^(technical specifications|technical data|specifications|description|features|feature|general features|general characteristics|key features|front features|rear features|front suspension features|rear suspension features|package contents|kit contents|part kit|kit includes|oem part numbers?|overview|applications?|power|torque|sound|sound level|disclaimer|mandatory product|download documents|installation time|fitment notice|fitment|notes?|warning|please note|when ordering the kit, the following components must be ordered additionally)[: ]*$/i,
  /^weight(?:\s*[-:+])?$/i,
];
const QUESTION_TITLE_PATTERN = /^what\s+(?:is|are)\b/i;
const SENTENCE_TITLE_PATTERNS = [
  /^the\b/i,
  /^designed\b/i,
  /\bmust be ordered\b/i,
  /\bdirect replacement\b/i,
  /\btype-approv/i,
  /\bece\b/i,
  /\bcertificate\b/i,
  /\bis installed\b/i,
  /\bat\s+\d{3,5}\s*rpm\b/i,
  /\bpower\s*[+-]?\d/i,
  /\btorque\s*[+-]?\d/i,
];

function parseArgs(argv) {
  const args = {
    commit: false,
    dryRun: true,
    translateHtml: false,
    brands: [...DEFAULT_BRANDS],
    limit: 0,
    delayMs: 150,
    publishedOnly: false,
    provider: 'auto',
  };

  for (const raw of argv) {
    if (raw === '--commit') {
      args.commit = true;
      args.dryRun = false;
    }
    if (raw === '--dry-run') {
      args.dryRun = true;
      args.commit = false;
    }
    if (raw === '--translate-html') args.translateHtml = true;
    if (raw === '--published-only') args.publishedOnly = true;
    if (raw.startsWith('--brands=')) {
      const nextBrands = raw
        .split('=')[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (nextBrands.length > 0) {
        args.brands = nextBrands;
      }
    }
    if (raw.startsWith('--limit=')) {
      args.limit = Math.max(0, Number(raw.split('=')[1] || 0) || 0);
    }
    if (raw.startsWith('--delay-ms=')) {
      args.delayMs = Math.max(0, Number(raw.split('=')[1] || 0) || 0);
    }
    if (raw.startsWith('--provider=')) {
      const provider = String(raw.split('=')[1] || '').trim().toLowerCase();
      if (provider === 'auto' || provider === 'gemini') {
        args.provider = provider;
      }
    }
  }

  return args;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
  return normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsCyrillic(value) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(String(value ?? ''));
}

function hasEncodingArtifacts(value) {
  const text = String(value ?? '');
  return text.includes('�') || /[A-Za-z]\?[A-Za-z]/.test(text) || /\b[A-Za-z][A-Za-z0-9&.\-]{2,}\?(?=\s|$|[()/,-])/.test(text);
}

function isGenericExtractedTitle(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripHtml(value) {
  return normalizeText(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function looksBrokenEn(value, uaValue, options = {}) {
  const en = normalizeText(value);
  const ua = normalizeText(uaValue);
  const checkSentence = options.checkSentence === true;
  const checkIdentity = options.checkIdentity === true;
  if (!en) return true;
  if (containsCyrillic(en)) return true;
  if (hasEncodingArtifacts(en)) return true;
  if (QUESTION_TITLE_PATTERN.test(en)) return true;
  if (checkSentence && SENTENCE_TITLE_PATTERNS.some((pattern) => pattern.test(en))) return true;
  if (checkIdentity && violatesTitleIdentity(en, ua)) return true;
  if (isGenericExtractedTitle(en)) return true;
  if (ua && en.toLowerCase() === ua.toLowerCase()) return true;
  return false;
}

function extractTitleIdentity(title) {
  const normalized = normalizeText(String(title ?? '').replace(/[?]/g, ''));
  const match = normalized.match(/^([A-Z0-9][A-Z0-9&+./-]*)\s+([A-Z0-9][A-Z0-9&+./-]*)/);
  if (!match) return null;
  return {
    brand: match[1],
    sku: match[2],
  };
}

function violatesTitleIdentity(enValue, uaValue) {
  const identity = extractTitleIdentity(uaValue);
  if (!identity) return false;

  const enComparable = normalizeComparable(enValue);
  const brandComparable = normalizeComparable(identity.brand);
  const skuComparable = normalizeComparable(identity.sku);

  if (!enComparable.startsWith(`${brandComparable} `)) return true;
  if (skuComparable && !enComparable.includes(skuComparable)) return true;

  return false;
}

function normalizeTranslationSource(value) {
  return normalizeText(String(value ?? '').replace(/Akrapovi\?/gi, 'Akrapovic'));
}

function translateTitleRuleBasedFromUa(value) {
  const source = normalizeTranslationSource(value);
  if (!source) return '';

  let next = source
    .replace(/Радіатор кондиціонера/gi, 'A/C Condenser')
    .replace(/Високопродуктивний комплект для охолодження масла/gi, 'High Performance Oil Cooler Kit')
    .replace(/Високопродуктивні інтеркулери/gi, 'High-Performance Intercoolers')
    .replace(/Високопродуктивний радіатор/gi, 'High-Performance Radiator')
    .replace(/Комплект зовнішнього охолоджувача трансмісійної оливи/gi, 'External Transmission Oil Cooler Kit')
    .replace(/Комплект подвійного охолоджувача наддувного повітря/gi, 'Dual Charge Air Cooler Kit')
    .replace(/Комплект Твін Інтеркулерів/gi, 'Twin Intercooler Kit')
    .replace(/Колектор охолоджувача наддувного повітря/gi, 'Charge-Air Cooler Manifold')
    .replace(/К-т інтеркулерів/gi, 'Intercooler Kit')
    .replace(/К-т інтеркулера/gi, 'Intercooler Kit')
    .replace(/Масляний радіатор/gi, 'Oil Cooler')
    .replace(/Набір підйомних адаптерів/gi, 'Lift Adapter Kit')
    .replace(/Комплект задніх верхніх кріплень/gi, 'Rear Upper Mount Kit')
    .replace(/Комплект передніх верхніх опор/gi, 'Front Upper Mount Kit')
    .replace(/Комплект амортизаторів Off-Road\s*&\s*Adventure/gi, 'Off-Road & Adventure Damper Kit')
    .replace(/Комплект амортизаторів OFF-ROAD\s*&\s*ADVENTURE/gi, 'Off-Road & Adventure Damper Kit')
    .replace(/Комплект амортизаторів Adventure/gi, 'Adventure Damper Kit')
    .replace(/Комплект амортизаторів Advanced Trackday TTX/gi, 'Advanced Trackday TTX Damper Kit')
    .replace(/Комплект амортизаторів Advanced Trackday/gi, 'Advanced Trackday Damper Kit')
    .replace(/комплект електронного демпфірування/gi, 'Electronic Damping Kit')
    .replace(/Половинний радіатор охолодження/gi, 'Half-Size Cooling Radiator')
    .replace(/Двохходовий радіатор охолодження/gi, 'Dual-Pass Cooling Radiator')
    .replace(/Подвійний радіатор/gi, 'Dual Radiator')
    .replace(/Радіатор охолодження/gi, 'Cooling Radiator')
    .replace(/Радіатор RACE/gi, 'Race Radiator')
    .replace(/Радіатор/gi, 'Radiator')
    .replace(/Інтеркулер/gi, 'Intercooler')
    .replace(/Маслоохолоджувачем/gi, 'Oil Cooler')
    .replace(/Маслоохолоджувач/gi, 'Oil Cooler')
    .replace(/Впускний колектор/gi, 'Intake Manifold')
    .replace(/кожух вентилятора/gi, 'Fan Shroud')
    .replace(/вентилятором/gi, 'Fan')
    .replace(/з кожухом/gi, 'with Shroud')
    .replace(/Алюмінієвий/gi, 'Aluminum')
    .replace(/алюмінієвий/gi, 'Aluminum')
    .replace(/чорний/gi, 'Black')
    .replace(/Комплект койловерів\s+Road\s*&\s*Track/gi, 'Road & Track Coilover Kit')
    .replace(/Комплект койловерів\s+ROAD\s*&\s*TRACK/gi, 'Road & Track Coilover Kit')
    .replace(/Койловери комплект\s+Road\s*&\s*Track/gi, 'Road & Track Coilover Kit')
    .replace(/Койловери комплект\s+ROAD\s*&\s*TRACK/gi, 'Road & Track Coilover Kit')
    .replace(/Комплект койловерів\s+Road&Track/gi, 'Road & Track Coilover Kit')
    .replace(/Койловери комплект\s+Road&Track/gi, 'Road & Track Coilover Kit')
    .replace(/Комплект койловерів/gi, 'Coilover Kit')
    .replace(/Койловери комплект/gi, 'Coilover Kit')
    .replace(/Амортизатор передній лівий/gi, 'Front Left Shock Absorber')
    .replace(/Амортизатор передній правий/gi, 'Front Right Shock Absorber')
    .replace(/Амортизатор передній/gi, 'Front Shock Absorber')
    .replace(/Амортизатор задній лівий/gi, 'Rear Left Shock Absorber')
    .replace(/Амортизатор задній правий/gi, 'Rear Right Shock Absorber')
    .replace(/Амортизатор задній/gi, 'Rear Shock Absorber')
    .replace(/Амортизатор задний/gi, 'Rear Shock Absorber')
    .replace(/звуковий комплект/gi, 'Sound Kit')
    .replace(/трекове налаштування/gi, 'Track Setup')
    .replace(/\sвкл\.\s*/gi, ' incl. ')
    .replace(/серії/gi, 'Series')
    .replace(/для\s*/gi, 'for ')
    .replace(/без xDrive/gi, 'excluding xDrive')
    .replace(/ліфт\s*3\.?5\s*-\s*5"/gi, '3.5-5" Lift')
    .replace(/ліфт\s*2\s*-\s*3"/gi, '2-3" Lift')
    .replace(/пружини\s*\/\s*комплект для підйому продається окремо/gi, 'springs / lift kit sold separately')
    .replace(/пружини та аксесуари купуються окремо/gi, 'springs and accessories sold separately')
    .replace(/пружини та аксесуари придбаваються окремо/gi, 'springs and accessories sold separately')
    .replace(/пружини купуються окремо/gi, 'springs sold separately')
    .replace(/\sне\s+GT3/gi, ' excluding GT3')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (containsCyrillic(next)) return '';
  if (QUESTION_TITLE_PATTERN.test(next)) return '';
  if (hasEncodingArtifacts(next)) return '';

  return next;
}

function sanitizeExtractedTitle(value) {
  let next = decodeHtmlEntities(stripHtml(value));
  if (!next) return '';

  next = next
    .replace(/^description[:\s-]+/i, '')
    .replace(/^product description[:\s-]+/i, '')
    .replace(/\s+description$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!next || containsCyrillic(next)) return '';
  if (!/^(ADRO|AKRAPOVIC|CSF|OHLINS|ÖHLINS)\b/i.test(next)) return '';
  if (QUESTION_TITLE_PATTERN.test(next) || /^when\s+/i.test(next)) return '';
  if (SENTENCE_TITLE_PATTERNS.some((pattern) => pattern.test(next))) return '';
  if (isGenericExtractedTitle(next)) return '';
  return next;
}

function extractEnglishTitleFromHtml(html) {
  const source = String(html ?? '');
  if (!source || containsCyrillic(source)) return '';

  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
    /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    /<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*<\/p>/gi,
    /<strong[^>]*>([\s\S]*?)<\/strong>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const extracted = sanitizeExtractedTitle(match?.[1] ?? '');
      if (extracted) return extracted;
    }
  }

  return '';
}

function removeTitlePrefix(text, title) {
  const source = normalizeText(text);
  const prefix = normalizeText(title);
  if (!source || !prefix) return source;

  if (source.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normalizeText(source.slice(prefix.length));
  }

  return source;
}

function excerpt(text, maxLength = 240) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;

  const sliced = normalized.slice(0, maxLength + 1);
  const sentenceBoundary = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '));
  if (sentenceBoundary >= Math.floor(maxLength * 0.55)) {
    return sliced.slice(0, sentenceBoundary + 1).trim();
  }

  const wordBoundary = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, wordBoundary > 0 ? wordBoundary : maxLength).trim()}...`;
}

function plainTextFromEnglishBody(bodyHtmlEn, extractedTitle) {
  const plain = stripHtml(bodyHtmlEn);
  if (!plain) return '';
  return removeTitlePrefix(plain, extractedTitle)
    .replace(/^description[:\s-]+/i, '')
    .trim();
}

function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithGemini(text, { isHtml = false } = {}) {
  if (isHtml) {
    throw new Error('GEMINI_HTML_NOT_SUPPORTED');
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const sourceText = normalizeTranslationSource(text);

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = [
    'You translate Ukrainian automotive aftermarket product titles into high-quality English for a premium ecommerce catalog.',
    'Rules:',
    '1. Output only the translated product title.',
    '2. Keep brand names, SKUs, part numbers, and vehicle names unchanged.',
    '3. Use natural automotive English, not transliteration.',
    '4. Preserve finish/material terms correctly: carbon fiber, matte, gloss, titanium, stainless steel, intercooler, radiator, diffuser, link pipe, exhaust system, intake manifold, etc.',
    '5. Do not add marketing copy or extra punctuation.',
    '6. The result must be a single English title line.',
    '7. Never output a question, FAQ heading, or explanatory sentence.',
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Translate this exact product title into English:\n${sourceText}` }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.1,
        topP: 0.9,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('retry-after') || NaN);
    const details = await response.text().catch(() => '');
    const error = new Error(details || response.statusText);
    error.status = response.status;
    error.retryAfterMs = Number.isFinite(retryAfter) ? Math.max(0, retryAfter) * 1000 : null;
    throw error;
  }

  const json = await response.json();
  const translated = normalizeText(json?.candidates?.[0]?.content?.parts?.[0]?.text)
    .replace(/^```(?:text)?/i, '')
    .replace(/```$/i, '')
    .replace(/Akrapovi\?/gi, 'Akrapovic')
    .trim();

  if (!translated) {
    throw new Error('GEMINI_EMPTY_TRANSLATION');
  }

  if (containsCyrillic(translated)) {
    throw new Error('GEMINI_NON_ENGLISH_OUTPUT');
  }

  if (QUESTION_TITLE_PATTERN.test(translated)) {
    throw new Error('GEMINI_GENERIC_QUESTION_OUTPUT');
  }

  return translated;
}

async function translateWithRetry(text, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await translateWithGemini(text, options);
    } catch (error) {
      lastError = error;
      const status = typeof error === 'object' && error ? Number(error.status) : null;
      if (status === 400 || status === 403) {
        break;
      }
      const retryAfterMs =
        typeof error === 'object' && error && Number.isFinite(error.retryAfterMs)
          ? Number(error.retryAfterMs)
          : 750 * Math.pow(2, attempt);
      await sleep(Math.max(750 * (attempt + 1), retryAfterMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Translation failed');
}

function buildWhereClause(args) {
  return {
    status: 'ACTIVE',
    brand: { in: args.brands },
    ...(args.publishedOnly ? { isPublished: true } : {}),
  };
}

function collectPlannedUpdate(product, args) {
  const validBodyEn = normalizeText(product.bodyHtmlEn) && !containsCyrillic(product.bodyHtmlEn) ? String(product.bodyHtmlEn) : '';
  const extractedTitle = extractEnglishTitleFromHtml(validBodyEn);
  const englishBodyText = plainTextFromEnglishBody(validBodyEn, extractedTitle);
  const ruleBasedTitle = translateTitleRuleBasedFromUa(product.titleUa);

  const plan = {
    titleEn: null,
    seoTitleEn: null,
    shortDescEn: null,
    longDescEn: null,
    bodyHtmlEn: null,
    strategy: [],
    extractedTitle,
  };

  if (looksBrokenEn(product.titleEn, product.titleUa, { checkSentence: true, checkIdentity: true })) {
    if (ruleBasedTitle) {
      plan.titleEn = ruleBasedTitle;
      plan.strategy.push('title:rule');
    } else if (extractedTitle) {
      plan.titleEn = extractedTitle;
      plan.strategy.push('title:bodyHtmlEn');
    } else if (normalizeText(product.titleUa)) {
      plan.titleEn = { translate: normalizeText(product.titleUa), cacheKey: `title:${normalizeText(product.titleUa).toLowerCase()}` };
      plan.strategy.push('title:gemini');
    }
  }

  if (looksBrokenEn(product.seoTitleEn, product.seoTitleUa || product.titleUa, { checkSentence: true, checkIdentity: true })) {
    const seoSource = normalizeText(product.seoTitleUa);
    const titleSource = normalizeText(product.titleUa);
    const seoMatchesTitleSource = !seoSource || seoSource.toLowerCase() === titleSource.toLowerCase();

    if (plan.titleEn && seoMatchesTitleSource) {
      plan.seoTitleEn = plan.titleEn;
      plan.strategy.push(typeof plan.titleEn === 'string' ? 'seo:title' : 'seo:title-plan');
    } else if (extractedTitle) {
      plan.seoTitleEn = extractedTitle;
      plan.strategy.push('seo:bodyHtmlEn');
    } else if (seoSource) {
      plan.seoTitleEn = { translate: seoSource, cacheKey: `seo:${seoSource.toLowerCase()}` };
      plan.strategy.push('seo:gemini');
    } else if (normalizeText(product.titleUa)) {
      plan.seoTitleEn = { translate: normalizeText(product.titleUa), cacheKey: `seo-fallback:${normalizeText(product.titleUa).toLowerCase()}` };
      plan.strategy.push('seo:gemini-fallback');
    }
  }

  if (looksBrokenEn(product.shortDescEn, product.shortDescUa)) {
    if (englishBodyText) {
      plan.shortDescEn = excerpt(englishBodyText, 220);
      plan.strategy.push('short:bodyHtmlEn');
    } else if (normalizeText(product.shortDescUa)) {
      const source = normalizeText(product.shortDescUa);
      plan.shortDescEn = { translate: source, cacheKey: `short:${source.toLowerCase()}` };
      plan.strategy.push('short:gemini');
    }
  }

  if (looksBrokenEn(product.longDescEn, product.longDescUa || stripHtml(product.bodyHtmlUa))) {
    if (englishBodyText) {
      plan.longDescEn = englishBodyText;
      plan.strategy.push('long:bodyHtmlEn');
    } else {
      const source = normalizeText(product.longDescUa || stripHtml(product.bodyHtmlUa));
      if (source) {
        plan.longDescEn = { translate: source, cacheKey: `long:${source.toLowerCase()}` };
        plan.strategy.push('long:gemini');
      }
    }
  }

  if (args.translateHtml && looksBrokenEn(stripHtml(product.bodyHtmlEn), stripHtml(product.bodyHtmlUa))) {
    const sourceHtml = String(product.bodyHtmlUa ?? '').trim();
    if (sourceHtml) {
      plan.bodyHtmlEn = { translate: sourceHtml, cacheKey: `html:${sourceHtml.toLowerCase()}`, isHtml: true };
      plan.strategy.push('html:gemini');
    }
  }

  return plan;
}

async function resolvePlannedValue(planValue, cache) {
  if (!planValue) return null;
  if (typeof planValue === 'string') return planValue;

  const cached = cache.get(planValue.cacheKey);
  if (cached) return cached;

  const translated = await translateWithRetry(planValue.translate, { isHtml: planValue.isHtml === true });
  cache.set(planValue.cacheKey, translated);
  return translated;
}

async function safelyResolvePlannedValue(planValue, cache, translationState) {
  if (!planValue) {
    return { value: null, error: null, skipped: false };
  }

  if (typeof planValue === 'string') {
    return { value: planValue, error: null, skipped: false };
  }

  if (translationState.disabled) {
    return { value: null, error: null, skipped: true };
  }

  try {
    const value = await resolvePlannedValue(planValue, cache);
    return { value, error: null, skipped: false };
  } catch (error) {
    return { value: null, error, skipped: false };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = getGeminiApiKey();

  if (args.commit && !apiKey) {
    throw new Error('GEMINI_API_KEY is required for --commit');
  }

  const products = await prisma.shopProduct.findMany({
    where: buildWhereClause(args),
    orderBy: [{ brand: 'asc' }, { slug: 'asc' }],
    select: {
      id: true,
      slug: true,
      brand: true,
      isPublished: true,
      titleUa: true,
      titleEn: true,
      seoTitleUa: true,
      seoTitleEn: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
    },
  });

  const candidates = products
    .map((product) => ({ product, plan: collectPlannedUpdate(product, args) }))
    .filter(({ plan }) => plan.strategy.length > 0);

  const limitedCandidates = args.limit > 0 ? candidates.slice(0, args.limit) : candidates;

  const dryRunItems = limitedCandidates.slice(0, 20).map(({ product, plan }) => ({
    brand: product.brand,
    slug: product.slug,
    strategies: plan.strategy,
    extractedTitle: plan.extractedTitle || null,
  }));

  const preSummary = {
    mode: args.commit ? 'commit' : 'dry-run',
    brands: args.brands,
    totalLoaded: products.length,
    candidates: candidates.length,
    selected: limitedCandidates.length,
    translateHtml: args.translateHtml,
    publishedOnly: args.publishedOnly,
    provider: args.provider,
    sample: dryRunItems,
  };

  console.log(JSON.stringify(preSummary, null, 2));

  if (!args.commit) {
    return;
  }

  const cache = new Map();
  const stats = {
    updated: 0,
    failed: 0,
    stoppedBecauseQuota: false,
    skippedTranslationFields: 0,
    titleFromBody: 0,
    titleTranslated: 0,
    seoFromExisting: 0,
    seoTranslated: 0,
    shortFromBody: 0,
    shortTranslated: 0,
    longFromBody: 0,
    longTranslated: 0,
    htmlTranslated: 0,
  };
  const errors = [];
  const translationState = {
    disabled: false,
    reason: null,
    provider: args.provider,
  };

  for (const { product, plan } of limitedCandidates) {
    const data = {};

    const titleResult = await safelyResolvePlannedValue(plan.titleEn, cache, translationState);
    const seoResult = await safelyResolvePlannedValue(plan.seoTitleEn, cache, translationState);
    const shortResult = await safelyResolvePlannedValue(plan.shortDescEn, cache, translationState);
    const longResult = await safelyResolvePlannedValue(plan.longDescEn, cache, translationState);
    const htmlResult = await safelyResolvePlannedValue(plan.bodyHtmlEn, cache, translationState);

    const fieldErrors = [
      { field: 'titleEn', result: titleResult },
      { field: 'seoTitleEn', result: seoResult },
      { field: 'shortDescEn', result: shortResult },
      { field: 'longDescEn', result: longResult },
      { field: 'bodyHtmlEn', result: htmlResult },
    ].filter((entry) => entry.result.error);

    stats.skippedTranslationFields += [titleResult, seoResult, shortResult, longResult, htmlResult].filter((entry) => entry.skipped).length;

    if (titleResult.value && titleResult.value !== product.titleEn) {
      data.titleEn = titleResult.value;
      if (plan.strategy.includes('title:bodyHtmlEn')) stats.titleFromBody += 1;
      if (plan.strategy.includes('title:gemini')) stats.titleTranslated += 1;
    }

    if (seoResult.value && seoResult.value !== product.seoTitleEn) {
      data.seoTitleEn = seoResult.value;
      if (plan.strategy.some((item) => item.startsWith('seo:title') || item.startsWith('seo:bodyHtmlEn'))) {
        stats.seoFromExisting += 1;
      } else {
        stats.seoTranslated += 1;
      }
    }

    if (shortResult.value && shortResult.value !== product.shortDescEn) {
      data.shortDescEn = shortResult.value;
      if (plan.strategy.includes('short:bodyHtmlEn')) stats.shortFromBody += 1;
      if (plan.strategy.includes('short:gemini')) stats.shortTranslated += 1;
    }

    if (longResult.value && longResult.value !== product.longDescEn) {
      data.longDescEn = longResult.value;
      if (plan.strategy.includes('long:bodyHtmlEn')) stats.longFromBody += 1;
      if (plan.strategy.includes('long:gemini')) stats.longTranslated += 1;
    }

    if (htmlResult.value && htmlResult.value !== product.bodyHtmlEn) {
      data.bodyHtmlEn = htmlResult.value;
      stats.htmlTranslated += 1;
    }

    if (Object.keys(data).length > 0) {
      await prisma.shopProduct.update({
        where: { id: product.id },
        data,
      });
      stats.updated += 1;
    }

    if (fieldErrors.length > 0) {
      stats.failed += 1;
      errors.push({
        slug: product.slug,
        message: fieldErrors
          .map((entry) => `${entry.field}: ${entry.result.error instanceof Error ? entry.result.error.message : 'Translation failed'}`)
          .join(' | '),
      });
    }

    if (translationState.disabled) {
      stats.stoppedBecauseQuota = true;
    }

    if (args.delayMs) {
      await sleep(args.delayMs);
    }
  }

  console.log(
    JSON.stringify(
      {
        ...preSummary,
        updated: stats.updated,
        failed: stats.failed,
        stoppedBecauseQuota: stats.stoppedBecauseQuota,
        translationDisabledReason: translationState.reason,
        strategyBreakdown: {
          skippedTranslationFields: stats.skippedTranslationFields,
          titleFromBody: stats.titleFromBody,
          titleTranslated: stats.titleTranslated,
          seoFromExisting: stats.seoFromExisting,
          seoTranslated: stats.seoTranslated,
          shortFromBody: stats.shortFromBody,
          shortTranslated: stats.shortTranslated,
          longFromBody: stats.longFromBody,
          longTranslated: stats.longTranslated,
          htmlTranslated: stats.htmlTranslated,
        },
        errors: errors.slice(0, 20),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
