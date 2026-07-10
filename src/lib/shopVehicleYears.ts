export type VehicleYearRange = {
  from: number;
  to: number | null;
};

const MIN_VEHICLE_YEAR = 1950;
const MAX_VEHICLE_YEAR = 2035;

function isVehicleYear(value: number) {
  return Number.isInteger(value) && value >= MIN_VEHICLE_YEAR && value <= MAX_VEHICLE_YEAR;
}

function normalizeRangeEnd(start: number, rawEnd: string) {
  const parsed = Number(rawEnd);
  if (rawEnd.length === 2) {
    const century = Math.floor(start / 100) * 100;
    return century + parsed < start ? century + 100 + parsed : century + parsed;
  }
  return parsed;
}

export function normalizeVehicleYearRanges(ranges: VehicleYearRange[]) {
  const unique = new Map<string, VehicleYearRange>();
  for (const range of ranges) {
    if (!isVehicleYear(range.from)) continue;
    const to = range.to !== null && isVehicleYear(range.to) ? range.to : null;
    const normalized =
      to !== null && to < range.from ? { from: to, to: range.from } : { from: range.from, to };
    unique.set(`${normalized.from}:${normalized.to ?? "open"}`, normalized);
  }
  return Array.from(unique.values()).sort((left, right) => left.from - right.from);
}

export function extractVehicleYearRanges(value: string | null | undefined) {
  const text = String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
  const ranges: VehicleYearRange[] = [];
  const consumedYears = new Set<number>();

  for (const match of text.matchAll(
    /\b((?:19|20)\d{2})\s*(?:-|to|through|until|до)\s*((?:19|20)?\d{2})\b/gi
  )) {
    const from = Number(match[1]);
    const to = normalizeRangeEnd(from, match[2]);
    if (!isVehicleYear(from) || !isVehicleYear(to)) continue;
    ranges.push({ from, to });
    consumedYears.add(from);
    consumedYears.add(to);
  }

  for (const match of text.matchAll(
    /\b((?:19|20)\d{2})\s*(?:\+|-(?=\s*(?:$|[|,;)]))|(?:and\s+)?(?:newer|later|onwards)|present|current|дотепер|і\s*новіш)/gi
  )) {
    const from = Number(match[1]);
    if (!isVehicleYear(from)) continue;
    ranges.push({ from, to: null });
    consumedYears.add(from);
  }

  for (const match of text.matchAll(
    /(?:\b(?:from|since)\b|(?:^|\s)(?:з|від))\s*((?:19|20)\d{2})\b/gi
  )) {
    const from = Number(match[1]);
    if (!isVehicleYear(from) || consumedYears.has(from)) continue;
    ranges.push({ from, to: null });
    consumedYears.add(from);
  }

  for (const match of text.matchAll(/\b((?:19|20)\d{2})\b(?!\s*(?:cc|ccm|cm3|hp|kw|nm)\b)/gi)) {
    const year = Number(match[1]);
    if (!isVehicleYear(year) || consumedYears.has(year)) continue;
    ranges.push({ from: year, to: year });
  }

  return normalizeVehicleYearRanges(ranges);
}

export function vehicleYearRangeContains(range: VehicleYearRange, year: number) {
  return year >= range.from && (range.to === null || year <= range.to);
}

export function formatVehicleYearRange(range: VehicleYearRange) {
  if (range.to === null) return `${range.from}+`;
  if (range.to === range.from) return String(range.from);
  return `${range.from}-${range.to}`;
}
