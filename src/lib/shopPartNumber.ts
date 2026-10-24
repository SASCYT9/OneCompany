/**
 * Part numbers shown to customers. Internal catalogue codes (Burger's
 * `BURGER-123` / `BURGER-V-123`) are not manufacturer numbers, so they stay
 * hidden, as on the old Burger page.
 */
export function displayPartNumber(sku: string | null | undefined): string | null {
  const value = String(sku ?? "").trim();
  if (!value) return null;
  if (/^BURGER-(?:V-)?\d+$/i.test(value)) return null;
  return value;
}
