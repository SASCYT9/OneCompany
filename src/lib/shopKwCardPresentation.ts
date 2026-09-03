function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function isKwBrand(brand: string | null | undefined) {
  const value = normalizeWhitespace(brand ?? "").toLowerCase();
  return value === "kw" || value === "kw suspensions" || value === "kw automotive ukraine";
}

function firstVehicleLabel(value: string) {
  const beforeFitmentDetails = value.split(/\s+\(/u, 1)[0] ?? value;
  return normalizeWhitespace(beforeFitmentDetails.replace(/[,:;\s]+$/u, ""));
}

function shortenAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength + 1).replace(/\s+\S*$/u, "").trim();
  return `${candidate || value.slice(0, maxLength).trim()}…`;
}

function polishProductLabel(value: string, locale: string) {
  if (locale === "en") {
    return value
      .replace(/\s*\((?:including|incl\.)\s+(?:an?\s+)?electronic\s+damper\s+cancellation\s+kit\)/giu, " with cancellation kit")
      .replace(/\s+/gu, " ")
      .trim();
  }
  return value
    .replace(/\s*\((?:включаючи|вкл\.)\s+комплект\s+для\s+(?:скасування|деактивації)\s+електронних\s+амортизаторів\)/giu, " з модулем деактивації")
    .replace(/\s*\(з\s+деактивацією\s+електронних\s+амортизаторів\)/giu, " з модулем деактивації")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Produces a compact storefront-card title without mutating canonical Shopify
 * copy. Full vehicle/engine compatibility remains in the product record and
 * its canonical fitment policy.
 */
export function getKwCardTitle(input: {
  brand: string | null | undefined;
  title: string;
  locale: string;
}) {
  const title = normalizeWhitespace(input.title);
  if (!isKwBrand(input.brand)) return title;

  const separator = title.match(/\s+[—–]\s+/u);
  if (!separator?.index) return shortenAtWord(title, 118);

  const productLabel = polishProductLabel(title.slice(0, separator.index).trim(), input.locale);
  const fitmentText = title.slice(separator.index + separator[0].length).trim();
  const vehicleLabel = firstVehicleLabel(fitmentText);
  if (!vehicleLabel) return shortenAtWord(productLabel, 118);

  const hasMoreVehicles = fitmentText.slice(vehicleLabel.length).includes(",");
  const suffix = hasMoreVehicles ? (input.locale === "en" ? " and others" : " та інші") : "";
  return shortenAtWord(`${productLabel} — ${vehicleLabel}${suffix}`, 138);
}
