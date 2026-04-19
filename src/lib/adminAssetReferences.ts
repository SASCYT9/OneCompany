function countUrlOccurrences(value: string, url: string) {
  if (!value || !url) return 0;

  let count = 0;
  let index = value.indexOf(url);

  while (index !== -1) {
    count += 1;
    index = value.indexOf(url, index + url.length);
  }

  return count;
}

export function countReferencedAssetUrls(payload: unknown, urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  const counts = new Map<string, number>(uniqueUrls.map((url) => [url, 0]));

  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      for (const url of uniqueUrls) {
        const matches = countUrlOccurrences(value, url);
        if (matches > 0) {
          counts.set(url, (counts.get(url) ?? 0) + matches);
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry);
      }
      return;
    }

    if (value && typeof value === 'object') {
      for (const entry of Object.values(value as Record<string, unknown>)) {
        visit(entry);
      }
    }
  };

  visit(payload);
  return counts;
}
