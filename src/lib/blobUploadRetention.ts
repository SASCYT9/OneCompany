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

export type BlobCleanupFailure = {
  url: string;
  error: unknown;
};

/** Attempts every deletion so one provider failure cannot strand later current-run uploads. */
export async function deleteUploadedBlobUrls(
  urls: readonly string[],
  remove: (url: string) => Promise<unknown>
): Promise<{ deleted: string[]; failures: BlobCleanupFailure[] }> {
  const deleted: string[] = [];
  const failures: BlobCleanupFailure[] = [];

  for (const url of urls) {
    try {
      await remove(url);
      deleted.push(url);
    } catch (error) {
      failures.push({ url, error });
    }
  }

  return { deleted, failures };
}

export function assertBlobCleanupSucceeded(failures: readonly BlobCleanupFailure[]) {
  if (failures.length === 0) return;
  throw new AggregateError(
    failures.map(({ url, error }) =>
      new Error(`${url}: ${error instanceof Error ? error.message : String(error)}`)
    ),
    `Failed to remove ${failures.length} unreferenced current-run Blob upload(s)`
  );
}
