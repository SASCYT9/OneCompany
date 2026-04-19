export type AdminBulkProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type AdminProductDeleteMode = 'archive' | 'hard';

export function parseAdminProductBulkStatusInput(input: unknown) {
  const payload = (input && typeof input === 'object' ? input : {}) as {
    ids?: unknown;
    status?: unknown;
  };

  if (!Array.isArray(payload.ids)) {
    throw new Error('Product ids are required');
  }

  const ids = Array.from(
    new Set(
      payload.ids
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    throw new Error('At least one product id is required');
  }

  const status = String(payload.status ?? '').trim().toUpperCase();
  if (status !== 'ACTIVE' && status !== 'DRAFT' && status !== 'ARCHIVED') {
    throw new Error('Invalid status');
  }

  return {
    ids,
    status: status as AdminBulkProductStatus,
    isPublished: status === 'ACTIVE',
    clearPublishedAt: status !== 'ACTIVE',
  };
}

export function parseAdminProductDeleteMode(input: unknown): AdminProductDeleteMode {
  const normalized = String(input ?? '').trim().toLowerCase();
  return normalized === 'hard' ? 'hard' : 'archive';
}

export function buildAdminProductArchiveMutation() {
  return {
    status: 'ARCHIVED' as const,
    isPublished: false,
    publishedAt: null as null,
  };
}
