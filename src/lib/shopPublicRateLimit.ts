type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const hits = new Map<string, RateLimitEntry>();

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

export function consumeRateLimit(input: {
  keyParts: Array<string | null | undefined>;
  windowMs: number;
  maxPerWindow: number;
}) {
  const key = normalizeKey(input.keyParts);
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.windowStart > input.windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= input.maxPerWindow) {
    return false;
  }

  entry.count += 1;
  return true;
}
