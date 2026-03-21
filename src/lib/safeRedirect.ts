export function sanitizeNextPath(input: string | null | undefined, fallback: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) return fallback;

  // Only allow same-origin relative paths.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return fallback;

  // Avoid backslashes (can be treated as path separators in some contexts).
  if (raw.includes('\\')) return fallback;

  return raw;
}

