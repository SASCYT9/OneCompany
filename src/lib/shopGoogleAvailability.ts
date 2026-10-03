export function googleProductAvailability(stock: "inStock" | "preOrder", sourceDate?: string | null) {
  let availabilityDate: string | null = null;
  if (sourceDate && /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(sourceDate)) {
    const day = sourceDate.slice(0, 10);
    const date = new Date(`${day}T00:00:00Z`);
    const timestamp = sourceDate.length === 10 ? `${day}T00:00:00Z` : sourceDate;
    if (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === day &&
      Number.isFinite(new Date(timestamp).getTime())
    ) availabilityDate = timestamp;
  }
  return { availability: stock === "inStock" ? "in_stock" as const : "backorder" as const, availabilityDate: stock === "preOrder" ? availabilityDate : null };
}
