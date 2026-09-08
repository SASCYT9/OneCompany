/** Read a small ID window, then its payload pages concurrently in stable order. */
export async function readCatalogRowsWithSizeFallback<T>(
  ids: string[],
  readRows: (ids: string[]) => Promise<T[]>
): Promise<T[]> {
  try {
    return await readRows(ids);
  } catch (error) {
    // Prisma Postgres/Accelerate P6009 means the response exceeded its byte
    // limit. Split only that failure; auth, connection and SQL errors propagate.
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P6009" ||
      ids.length < 2
    )
      throw error;
    const middle = Math.ceil(ids.length / 2);
    // Sequential children preserve the outer page worker's concurrency budget.
    const first = await readCatalogRowsWithSizeFallback(ids.slice(0, middle), readRows);
    const second = await readCatalogRowsWithSizeFallback(ids.slice(middle), readRows);
    return first.concat(second);
  }
}

export async function* boundedCatalogPages<T>(options: {
  pageSize: number;
  concurrency: number;
  readIds: (after: string | undefined, limit: number) => Promise<string[]>;
  readRows: (ids: string[]) => Promise<T[]>;
}): AsyncGenerator<T[]> {
  const { pageSize, concurrency, readIds, readRows } = options;
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1
  ) {
    throw new Error("Catalog page size and concurrency must be positive integers");
  }
  const windowSize = pageSize * concurrency;
  let cursor: string | undefined;
  while (true) {
    const ids = await readIds(cursor, windowSize);
    if (ids.length === 0) return;
    const requests: Promise<T[]>[] = [];
    for (let offset = 0; offset < ids.length; offset += pageSize) {
      requests.push(readRows(ids.slice(offset, offset + pageSize)));
    }
    const pages = await Promise.all(requests);
    for (const page of pages) yield page;
    if (ids.length < windowSize) return;
    const nextCursor = ids.at(-1);
    if (!nextCursor || nextCursor === cursor) throw new Error("Catalog cursor did not advance");
    cursor = nextCursor;
  }
}
