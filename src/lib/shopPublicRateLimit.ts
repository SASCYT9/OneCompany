import { prisma } from '@/lib/prisma';

type RateLimitEntry = {
  count: number;
  bucketStart: number;
};

const fallbackHits = new Map<string, RateLimitEntry>();

function normalizeKey(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('::');
}

export function getRequestIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

function getBucketStart(now: number, windowMs: number) {
  return now - (now % windowMs);
}

function consumeFallbackRateLimit(input: {
  keyParts: Array<string | null | undefined>;
  windowMs: number;
  maxPerWindow: number;
}) {
  const key = normalizeKey(input.keyParts);
  if (!key) {
    return true;
  }

  const now = Date.now();
  const bucketStart = getBucketStart(now, input.windowMs);
  const entry = fallbackHits.get(key);

  if (!entry || entry.bucketStart !== bucketStart) {
    fallbackHits.set(key, { count: 1, bucketStart });
    return true;
  }

  if (entry.count >= input.maxPerWindow) {
    return false;
  }

  entry.count += 1;
  return true;
}

function shouldUsePersistentRateLimit() {
  return process.env.NODE_ENV !== 'test' && Boolean((process.env.DATABASE_URL || '').trim());
}

function buildPersistentRateLimitKey(key: string, windowMs: number, bucketStart: number) {
  return `${windowMs}:${bucketStart}:${key}`;
}

export async function consumeRateLimit(input: {
  keyParts: Array<string | null | undefined>;
  windowMs: number;
  maxPerWindow: number;
}) {
  const key = normalizeKey(input.keyParts);
  if (!key) {
    return true;
  }

  if (!shouldUsePersistentRateLimit()) {
    return consumeFallbackRateLimit(input);
  }

  const now = Date.now();
  const bucketStart = getBucketStart(now, input.windowMs);
  const storageKey = buildPersistentRateLimitKey(key, input.windowMs, bucketStart);
  const expiresAt = new Date(bucketStart + input.windowMs * 2);

  try {
    const entry = await prisma.requestRateLimit.upsert({
      where: { key: storageKey },
      create: {
        key: storageKey,
        count: 1,
        bucketStart: new Date(bucketStart),
        expiresAt,
      },
      update: {
        count: {
          increment: 1,
        },
        expiresAt,
      },
    });

    if (Math.random() < 0.01) {
      void prisma.requestRateLimit.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(now),
          },
        },
      });
    }

    return entry.count <= input.maxPerWindow;
  } catch (error) {
    console.error('Shared rate limit fallback engaged', error);
    return consumeFallbackRateLimit(input);
  }
}
