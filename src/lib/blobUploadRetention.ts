export function collectReferencedBlobUrls(
  value: unknown,
  candidates: ReadonlySet<string>,
  output = new Set<string>()
): Set<string> {
  if (typeof value === "string") {
    for (const candidate of candidates) if (value.includes(candidate)) output.add(candidate);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedBlobUrls(item, candidates, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectReferencedBlobUrls(item, candidates, output);
    }
  }
  return output;
}

export function getUnreferencedUploadedBlobUrls(
  uploadedThisRun: ReadonlySet<string>,
  persistedReferences: ReadonlySet<string>
): string[] {
  return [...uploadedThisRun].filter((url) => !persistedReferences.has(url)).sort();
}
