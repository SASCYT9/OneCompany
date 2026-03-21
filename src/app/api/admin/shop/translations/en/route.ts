import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { containsCyrillic } from '@/lib/shopText';

type TranslationCandidate = {
  id: string;
  slug: string;
  titleUa: string;
  titleEn: string;
  seoTitleUa: string | null;
  seoTitleEn: string | null;
  shortDescUa: string | null;
  shortDescEn: string | null;
  longDescUa: string | null;
  longDescEn: string | null;
  bodyHtmlUa: string | null;
  bodyHtmlEn: string | null;
};

type TranslationPayload = {
  commit: boolean;
  scan: number;
  limit: number;
  includeUnpublished: boolean;
  translateHtml: boolean;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isMissingOrSameAsUa(ua: string | null | undefined, en: string | null | undefined) {
  const uaNormalized = normalizeText(ua);
  const enNormalized = normalizeText(en);
  if (!uaNormalized) return false;
  if (!enNormalized) return true;
  return uaNormalized.toLowerCase() === enNormalized.toLowerCase();
}

function stripHtml(value: string | null | undefined) {
  return normalizeText(String(value ?? '').replace(/<[^>]+>/g, ' '));
}

function getDeepLAuthKey() {
  return (process.env.DEEPL_AUTH_KEY || process.env.DEEPL_API_KEY || '').trim();
}

function getDeepLBaseUrl(authKey: string) {
  const explicitBase = (process.env.DEEPL_BASE_URL || '').trim();
  if (explicitBase) {
    return explicitBase.replace(/\/+$/, '');
  }
  return authKey.toLowerCase().endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithDeepL(text: string, options?: { isHtml?: boolean }) {
  const authKey = getDeepLAuthKey();
  if (!authKey) {
    throw new Error('DEEPL_NOT_CONFIGURED');
  }

  const response = await fetch(`${getDeepLBaseUrl(authKey)}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      source_lang: 'UK',
      target_lang: 'EN',
      ...(options?.isHtml ? { tag_handling: 'html' } : {}),
      formality: 'prefer_more',
    }),
  });

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const details = await response.text().catch(() => '');
    const error = new Error(details || response.statusText) as Error & {
      status?: number;
      retryAfterMs?: number | null;
    };
    error.status = response.status;
    error.retryAfterMs = Number.isFinite(retryAfterSeconds) ? Math.max(0, retryAfterSeconds) * 1000 : null;
    throw error;
  }

  const payload = (await response.json()) as { translations?: Array<{ text?: string }> };
  const translated = payload.translations?.[0]?.text?.trim();
  if (!translated) {
    throw new Error('DEEPL_EMPTY_TRANSLATION');
  }
  return translated;
}

async function translateWithRetry(text: string, options?: { isHtml?: boolean }) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await translateWithDeepL(text, options);
    } catch (error) {
      lastError = error;
      const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : null;
      if (status === 456) {
        throw error;
      }
      const retryAfterMs =
        typeof error === 'object' && error && 'retryAfterMs' in error
          ? Number((error as { retryAfterMs?: unknown }).retryAfterMs)
          : NaN;
      const waitMs = Number.isFinite(retryAfterMs) ? Math.max(750 * (attempt + 1), retryAfterMs) : 750 * Math.pow(2, attempt);
      await sleep(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Translation failed');
}

function parseRequestPayload(input: unknown): TranslationPayload {
  const body = (input ?? {}) as Record<string, unknown>;
  const scanRaw = Number(body.scan ?? 500);
  const limitRaw = Number(body.limit ?? 50);
  return {
    commit: body.commit === true,
    scan: Number.isFinite(scanRaw) ? Math.min(2_000, Math.max(25, Math.trunc(scanRaw))) : 500,
    limit: Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.trunc(limitRaw))) : 50,
    includeUnpublished: body.includeUnpublished === true,
    translateHtml: body.translateHtml === true,
  };
}

function collectFields(candidate: TranslationCandidate, translateHtml: boolean) {
  const fields: string[] = [];

  if (isMissingOrSameAsUa(candidate.titleUa, candidate.titleEn) || containsCyrillic(candidate.titleEn)) {
    fields.push('titleEn');
  }

  if (isMissingOrSameAsUa(candidate.seoTitleUa, candidate.seoTitleEn) || containsCyrillic(candidate.seoTitleEn)) {
    fields.push('seoTitleEn');
  }

  if (isMissingOrSameAsUa(candidate.shortDescUa, candidate.shortDescEn)) {
    fields.push('shortDescEn');
  }

  if (isMissingOrSameAsUa(candidate.longDescUa || candidate.bodyHtmlUa, candidate.longDescEn || candidate.bodyHtmlEn)) {
    fields.push('longDescEn');
  }

  if (translateHtml && isMissingOrSameAsUa(stripHtml(candidate.bodyHtmlUa), stripHtml(candidate.bodyHtmlEn))) {
    fields.push('bodyHtmlEn');
  }

  return fields;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const payload = parseRequestPayload(await request.json().catch(() => ({})));

    if (payload.commit && !getDeepLAuthKey()) {
      return NextResponse.json({ error: 'DEEPL_AUTH_KEY is not configured' }, { status: 500 });
    }

    const rows = await prisma.shopProduct.findMany({
      where: payload.includeUnpublished ? undefined : { isPublished: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: payload.scan,
      select: {
        id: true,
        slug: true,
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

    const candidates = rows
      .map((row) => ({
        ...row,
        fields: collectFields(row, payload.translateHtml),
      }))
      .filter((row) => row.fields.length > 0);

    if (!payload.commit) {
      return NextResponse.json({
        mode: 'dry-run',
        totalLoaded: rows.length,
        candidates: candidates.length,
        scan: payload.scan,
        limit: payload.limit,
        includeUnpublished: payload.includeUnpublished,
        translateHtml: payload.translateHtml,
        items: candidates.slice(0, Math.min(payload.limit, 20)).map((row) => ({
          id: row.id,
          slug: row.slug,
          fields: row.fields,
        })),
      });
    }

    const translationCache = new Map<string, string>();
    const errors: Array<{ slug: string; message: string }> = [];
    let updated = 0;
    let failed = 0;
    let stoppedBecauseQuota = false;

    for (const candidate of candidates.slice(0, payload.limit)) {
      const data: Record<string, string> = {};

      try {
        if (candidate.fields.includes('titleEn')) {
          const source = normalizeText(candidate.titleUa);
          if (source) {
            const cacheKey = `title:${source.toLowerCase()}`;
            const translated = translationCache.get(cacheKey) ?? (await translateWithRetry(source));
            translationCache.set(cacheKey, translated);
            data.titleEn = translated;
          }
        }

        if (candidate.fields.includes('seoTitleEn')) {
          const source = normalizeText(candidate.seoTitleUa);
          if (source) {
            const cacheKey = `seo:${source.toLowerCase()}`;
            const translated = translationCache.get(cacheKey) ?? (await translateWithRetry(source));
            translationCache.set(cacheKey, translated);
            data.seoTitleEn = translated;
          }
        }

        if (candidate.fields.includes('shortDescEn')) {
          const source = normalizeText(candidate.shortDescUa);
          if (source) {
            const cacheKey = `short:${source.toLowerCase()}`;
            const translated = translationCache.get(cacheKey) ?? (await translateWithRetry(source));
            translationCache.set(cacheKey, translated);
            data.shortDescEn = translated;
          }
        }

        if (candidate.fields.includes('longDescEn')) {
          const source = normalizeText(candidate.longDescUa || stripHtml(candidate.bodyHtmlUa));
          if (source) {
            const cacheKey = `long:${source.toLowerCase()}`;
            const translated = translationCache.get(cacheKey) ?? (await translateWithRetry(source));
            translationCache.set(cacheKey, translated);
            data.longDescEn = translated;
          }
        }

        if (candidate.fields.includes('bodyHtmlEn')) {
          const source = String(candidate.bodyHtmlUa ?? '').trim();
          if (source) {
            const cacheKey = `html:${source.toLowerCase()}`;
            const translated = translationCache.get(cacheKey) ?? (await translateWithRetry(source, { isHtml: true }));
            translationCache.set(cacheKey, translated);
            data.bodyHtmlEn = translated;
          }
        }

        if (Object.keys(data).length > 0) {
          await prisma.shopProduct.update({
            where: { id: candidate.id },
            data,
          });
          updated += 1;
        }
      } catch (error) {
        const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : null;
        if (status === 456) {
          stoppedBecauseQuota = true;
          errors.push({ slug: candidate.slug, message: 'DeepL quota exceeded' });
          break;
        }
        failed += 1;
        errors.push({
          slug: candidate.slug,
          message: error instanceof Error ? error.message : 'Translation failed',
        });
      }
    }

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'products.translate_en',
      entityType: 'shop.product.translation',
      metadata: {
        updated,
        failed,
        scan: payload.scan,
        limit: payload.limit,
        includeUnpublished: payload.includeUnpublished,
        translateHtml: payload.translateHtml,
        stoppedBecauseQuota,
      },
    });

    const responsePayload = {
      mode: 'commit',
      totalLoaded: rows.length,
      candidates: candidates.length,
      updated,
      failed,
      stoppedBecauseQuota,
      scan: payload.scan,
      limit: payload.limit,
      includeUnpublished: payload.includeUnpublished,
      translateHtml: payload.translateHtml,
      errors: errors.slice(0, 10),
      items: candidates.slice(0, Math.min(payload.limit, 20)).map((row) => ({
        id: row.id,
        slug: row.slug,
        fields: row.fields,
      })),
    };

    return NextResponse.json(responsePayload, {
      status: stoppedBecauseQuota && updated === 0 ? 429 : 200,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin EN translation', error);
    return NextResponse.json({ error: 'Не вдалося запустити EN переклад' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
