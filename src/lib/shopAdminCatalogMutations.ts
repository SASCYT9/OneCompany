export type ExistingVariantMutationRecord = {
  id: string;
  inventoryLevelCount: number;
  cartItemCount: number;
  bundleItemCount: number;
  orderItemCount: number;
};

export type VariantMutationInput = {
  id?: string | null;
};

type VariantDeletionReason = 'inventoryLevels' | 'cartItems' | 'bundleItems' | 'orderItems';

export function planVariantMutations<T extends VariantMutationInput>(
  existingVariants: ExistingVariantMutationRecord[],
  incomingVariants: T[]
) {
  const existingIds = new Set(existingVariants.map((variant) => variant.id));
  const update = incomingVariants.filter((variant) => {
    const id = String(variant.id ?? '').trim();
    return id && existingIds.has(id);
  });
  const updateIds = update
    .map((variant) => String(variant.id ?? '').trim())
    .filter(Boolean);
  const retainedIds = new Set(updateIds);
  const create = incomingVariants.filter((variant) => !String(variant.id ?? '').trim());

  const deleteCandidates = existingVariants.filter((variant) => !retainedIds.has(variant.id));
  const blockers = deleteCandidates
    .map((variant) => {
      const reasons: VariantDeletionReason[] = [];
      if (variant.inventoryLevelCount > 0) reasons.push('inventoryLevels');
      if (variant.cartItemCount > 0) reasons.push('cartItems');
      if (variant.bundleItemCount > 0) reasons.push('bundleItems');
      if (variant.orderItemCount > 0) reasons.push('orderItems');

      return reasons.length
        ? {
            id: variant.id,
            reasons,
          }
        : null;
    })
    .filter((entry): entry is { id: string; reasons: VariantDeletionReason[] } => Boolean(entry));

  const blockedIds = new Set(blockers.map((entry) => entry.id));
  const deleteIds = deleteCandidates
    .map((variant) => variant.id)
    .filter((id) => !blockedIds.has(id));

  return {
    create,
    update,
    updateIds,
    deleteIds,
    blockers,
  };
}
