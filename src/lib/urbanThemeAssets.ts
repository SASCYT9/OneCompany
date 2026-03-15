const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

export function resolveUrbanThemeAssetUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (
    ABSOLUTE_URL_RE.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const safePath = trimmed
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/urban-theme-assets/${safePath}`;
}
