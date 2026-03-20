import 'dotenv/config';
import { prisma } from '@/lib/prisma';

type TranslateTarget = {
  model: 'product' | 'collection' | 'category';
  id: string;
  field: string;
  source: string;
};

type DeepLResponse = {
  translations?: Array<{
    text: string;
  }>;
};

const STORE_KEY = process.argv.find((value) => value.startsWith('--store='))?.split('=')[1] ?? 'urban';
const SHOULD_APPLY = process.argv.includes('--apply');
const LIMIT = Number(process.argv.find((value) => value.startsWith('--limit='))?.split('=')[1] ?? 200);
const DEEPL_KEY = process.env.DEEPL_API_KEY || process.env.DEEPL_AUTH_KEY;
const DEEPL_URL = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
const CYRILLIC_RE = /[А-Яа-яІіЇїЄєҐґ]/;

function needsTranslation(source: string | null | undefined, target: string | null | undefined) {
  const ua = String(source ?? '').trim();
  const en = String(target ?? '').trim();
  if (!ua) return false;
  if (!en) return true;
  if (CYRILLIC_RE.test(en)) return true;
  return ua === en;
}

async function translateBatch(texts: string[]) {
  const body = new URLSearchParams();
  body.set('auth_key', DEEPL_KEY ?? '');
  body.set('source_lang', 'UK');
  body.set('target_lang', 'EN-US');
  texts.forEach((text) => body.append('text', text));

  const response = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`DeepL request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as DeepLResponse;
  return payload.translations?.map((entry) => entry.text.trim()) ?? [];
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function main() {
  if (!DEEPL_KEY) {
    throw new Error('DEEPL_API_KEY or DEEPL_AUTH_KEY is required');
  }

  const [products, collections, categories] = await Promise.all([
    prisma.shopProduct.findMany({
      where: { storeKey: STORE_KEY },
      select: {
        id: true,
        titleUa: true,
        titleEn: true,
        categoryUa: true,
        categoryEn: true,
        collectionUa: true,
        collectionEn: true,
        shortDescUa: true,
        shortDescEn: true,
        longDescUa: true,
        longDescEn: true,
        seoTitleUa: true,
        seoTitleEn: true,
        seoDescriptionUa: true,
        seoDescriptionEn: true,
      },
      take: LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.shopCollection.findMany({
      where: { storeKey: STORE_KEY },
      select: {
        id: true,
        titleUa: true,
        titleEn: true,
        descriptionUa: true,
        descriptionEn: true,
      },
      take: LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.shopCategory.findMany({
      where: { storeKey: STORE_KEY },
      select: {
        id: true,
        titleUa: true,
        titleEn: true,
        descriptionUa: true,
        descriptionEn: true,
      },
      take: LIMIT,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const targets: TranslateTarget[] = [];

  products.forEach((product) => {
    if (needsTranslation(product.titleUa, product.titleEn)) {
      targets.push({ model: 'product', id: product.id, field: 'titleEn', source: product.titleUa });
    }
    if (needsTranslation(product.categoryUa, product.categoryEn)) {
      targets.push({ model: 'product', id: product.id, field: 'categoryEn', source: product.categoryUa ?? '' });
    }
    if (needsTranslation(product.collectionUa, product.collectionEn)) {
      targets.push({ model: 'product', id: product.id, field: 'collectionEn', source: product.collectionUa ?? '' });
    }
    if (needsTranslation(product.shortDescUa, product.shortDescEn)) {
      targets.push({ model: 'product', id: product.id, field: 'shortDescEn', source: product.shortDescUa ?? '' });
    }
    if (needsTranslation(product.longDescUa, product.longDescEn)) {
      targets.push({ model: 'product', id: product.id, field: 'longDescEn', source: product.longDescUa ?? '' });
    }
    if (needsTranslation(product.seoTitleUa, product.seoTitleEn)) {
      targets.push({ model: 'product', id: product.id, field: 'seoTitleEn', source: product.seoTitleUa ?? '' });
    }
    if (needsTranslation(product.seoDescriptionUa, product.seoDescriptionEn)) {
      targets.push({ model: 'product', id: product.id, field: 'seoDescriptionEn', source: product.seoDescriptionUa ?? '' });
    }
  });

  collections.forEach((collection) => {
    if (needsTranslation(collection.titleUa, collection.titleEn)) {
      targets.push({ model: 'collection', id: collection.id, field: 'titleEn', source: collection.titleUa });
    }
    if (needsTranslation(collection.descriptionUa, collection.descriptionEn)) {
      targets.push({ model: 'collection', id: collection.id, field: 'descriptionEn', source: collection.descriptionUa ?? '' });
    }
  });

  categories.forEach((category) => {
    if (needsTranslation(category.titleUa, category.titleEn)) {
      targets.push({ model: 'category', id: category.id, field: 'titleEn', source: category.titleUa });
    }
    if (needsTranslation(category.descriptionUa, category.descriptionEn)) {
      targets.push({ model: 'category', id: category.id, field: 'descriptionEn', source: category.descriptionUa ?? '' });
    }
  });

  if (!targets.length) {
    console.log(JSON.stringify({ storeKey: STORE_KEY, apply: SHOULD_APPLY, translated: 0, targets: 0 }, null, 2));
    return;
  }

  const translatedTargets: Array<TranslateTarget & { translated: string }> = [];
  for (const group of chunk(targets, 40)) {
    const translated = await translateBatch(group.map((entry) => entry.source));
    group.forEach((entry, index) => {
      const translatedText = translated[index]?.trim();
      if (translatedText) {
        translatedTargets.push({ ...entry, translated: translatedText });
      }
    });
  }

  if (SHOULD_APPLY) {
    await prisma.$transaction(
      translatedTargets.map((entry) => {
        if (entry.model === 'product') {
          return prisma.shopProduct.update({
            where: { id: entry.id },
            data: { [entry.field]: entry.translated },
          });
        }

        if (entry.model === 'collection') {
          return prisma.shopCollection.update({
            where: { id: entry.id },
            data: { [entry.field]: entry.translated },
          });
        }

        return prisma.shopCategory.update({
          where: { id: entry.id },
          data: { [entry.field]: entry.translated },
        });
      })
    );
  }

  console.log(
    JSON.stringify(
      {
        storeKey: STORE_KEY,
        apply: SHOULD_APPLY,
        translated: translatedTargets.length,
        preview: translatedTargets.slice(0, 12),
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

