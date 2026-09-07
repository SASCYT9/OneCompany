/** Price-on-request items stay after priced items in either direction. */
export function compareShopStockPriceAmounts(
  left: number,
  right: number,
  direction: "asc" | "desc"
) {
  const leftPriced = Number.isFinite(left) && left > 0;
  const rightPriced = Number.isFinite(right) && right > 0;
  if (!leftPriced || !rightPriced) return Number(rightPriced) - Number(leftPriced);
  return direction === "asc" ? left - right : right - left;
}
