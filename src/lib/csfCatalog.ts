import type { ShopProduct } from '@/lib/shopCatalog';

type CsfCatalogProduct = Pick<ShopProduct, 'title' | 'slug' | 'category' | 'sku' | 'stock'>;

type VehicleMakePattern = {
  label: string;
  patterns: RegExp[];
};

export type CsfCatalogFitment = {
  make: string | null;
  models: string[];
  chassisCodes: string[];
  yearStart: number | null;
  yearEnd: number | null;
  yearLabel: string | null;
};

const MAKE_PATTERNS: VehicleMakePattern[] = [
  { label: 'BMW', patterns: [/\bBMW\b/i] },
  { label: 'Porsche', patterns: [/\bPORSCHE\b/i] },
  { label: 'Toyota', patterns: [/\bTOYOTA\b/i] },
  { label: 'Nissan', patterns: [/\bNISSAN\b/i] },
  { label: 'Ford', patterns: [/\bFORD\b/i] },
  { label: 'Subaru', patterns: [/\bSUBARU\b/i] },
  { label: 'Chevrolet', patterns: [/\bCHEVROLET\b/i, /\bCORVETTE\b/i] },
  { label: 'Audi', patterns: [/\bAUDI\b/i] },
  { label: 'Honda', patterns: [/\bHONDA\b/i] },
  { label: 'Mercedes-Benz', patterns: [/\bMERCEDES(?:-BENZ)?\b/i] },
  { label: 'Mitsubishi', patterns: [/\bMITSUBISHI\b/i] },
  { label: 'Mazda', patterns: [/\bMAZDA\b/i] },
  { label: 'Ferrari', patterns: [/\bFERRARI\b/i] },
  { label: 'Jeep', patterns: [/\bJEEP\b/i] },
  { label: 'Dodge', patterns: [/\bDODGE\b/i] },
  { label: 'Hyundai', patterns: [/\bHYUNDAI\b/i] },
  { label: 'McLaren', patterns: [/\bMCLAREN\b/i] },
  { label: 'Volkswagen / Audi', patterns: [/\bVAG\b/i] },
  { label: 'Lexus', patterns: [/\bLEXUS\b/i] },
  { label: 'Lamborghini', patterns: [/\bLAMBORGHINI\b/i] },
  { label: 'Alfa Romeo', patterns: [/\bALFA\s+ROMEO\b/i] },
  { label: 'Cadillac', patterns: [/\bCADILLAC\b/i] },
  { label: 'Mini', patterns: [/\bMINI\b/i] },
  { label: 'Volkswagen', patterns: [/\bVOLKSWAGEN\b/i, /\bVW\b/i] },
  { label: 'Lotus', patterns: [/\bLOTUS\b/i] },
];

const MODEL_NOISE_PATTERNS = [
  /\bmanual transmission only\b/gi,
  /\bautomatic transmission only\b/gi,
  /\bmt only\b/gi,
  /\bat only\b/gi,
  /\bhigh[- ]performance\b/gi,
  /\ball[- ]aluminum\b/gi,
  /\baluminum\b/gi,
  /\bauxiliary\b/gi,
  /\bexternal\b/gi,
  /\bengine oil cooler\b/gi,
  /\btransmission oil cooler\b/gi,
  /\boil cooler kit\b/gi,
  /\bheat exchanger and transmission cooler module\b/gi,
  /\ba\/c condenser\b/gi,
  /\ba\/c evaporator\b/gi,
  /\bradiator\b/gi,
  /\bintercoolers?\b/gi,
  /\bcooling radiator\b/gi,
  /\bdual-pass\b/gi,
  /\bblack\b/gi,
  /\bgray\b/gi,
  /\bleft\b/gi,
  /\bright\b/gi,
  /\bcenter\b/gi,
  /\bkit\b/gi,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractFitmentSection(title: string) {
  const match = title.match(/\bfor\s+(.+)$/i);
  return normalizeWhitespace(match?.[1] ?? '');
}

function detectVehicleMake(section: string) {
  for (const entry of MAKE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(section))) {
      return entry.label;
    }
  }

  return null;
}

function extractYearRange(section: string) {
  const yearRangeMatch = section.match(/\b(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}))\b/);
  if (yearRangeMatch) {
    const yearStart = Number(yearRangeMatch[1]);
    const yearEnd = Number(yearRangeMatch[2]);
    return {
      yearStart,
      yearEnd,
      yearLabel: `${yearStart}-${yearEnd}`,
    };
  }

  const yearPlusMatch = section.match(/\b(19\d{2}|20\d{2})\s*\+\b/);
  if (yearPlusMatch) {
    const yearStart = Number(yearPlusMatch[1]);
    return {
      yearStart,
      yearEnd: null,
      yearLabel: `${yearStart}+`,
    };
  }

  const singleYearMatch = section.match(/\b(19\d{2}|20\d{2})\b/);
  if (singleYearMatch) {
    const year = Number(singleYearMatch[1]);
    return {
      yearStart: year,
      yearEnd: year,
      yearLabel: String(year),
    };
  }

  return {
    yearStart: null,
    yearEnd: null,
    yearLabel: null,
  };
}

function extractChassisCodes(section: string) {
  const codes: string[] = [];
  const parentheticalMatches = section.match(/\(([^)]+)\)/g) ?? [];

  for (const group of parentheticalMatches) {
    const inner = group.slice(1, -1).trim();
    if (!inner || /\b(19\d{2}|20\d{2})\b/.test(inner)) {
      continue;
    }

    const tokens = inner.split(/[\/,]/).map((token) => normalizeWhitespace(token));
    for (const token of tokens) {
      const chassisMatch = token.match(/\b([A-Z]{0,4}\d{1,3}(?:\.\d)?[A-Z]{0,2})\b/i);
      if (chassisMatch) {
        codes.push(chassisMatch[1].toUpperCase());
      }
    }
  }

  return uniqueValues(codes);
}

function stripVehicleMakePrefix(section: string, make: string | null) {
  if (!make) {
    return section;
  }

  return normalizeWhitespace(section.replace(new RegExp(`^${make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), ''));
}

function extractVehicleModels(section: string, make: string | null) {
  const withoutMake = stripVehicleMakePrefix(section, make);
  const withoutMeta = normalizeWhitespace(
    MODEL_NOISE_PATTERNS.reduce((current, pattern) => current.replace(pattern, ' '), withoutMake)
      .replace(/\(([^)]+)\)/g, ' ')
      .replace(/\b(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}))?\+?\b/g, ' ')
      .replace(/[+]/g, ' ')
  );

  if (!withoutMeta) {
    return [];
  }

  const segments = withoutMeta
    .split(/\s*\/\s*/)
    .map((segment) =>
      normalizeWhitespace(
        segment
          .replace(/\bfor\b/gi, ' ')
          .replace(/\bwith\b.+$/i, ' ')
          .replace(/\bonly\b/gi, ' ')
      )
    )
    .filter(Boolean);

  return uniqueValues(segments);
}

export function extractCsfCatalogFitment(product: CsfCatalogProduct): CsfCatalogFitment {
  const title = product.title.en || product.title.ua || product.slug;
  const fitmentSection = extractFitmentSection(title);
  const make = detectVehicleMake(fitmentSection);
  const years = extractYearRange(fitmentSection);

  return {
    make,
    models: extractVehicleModels(fitmentSection, make),
    chassisCodes: extractChassisCodes(fitmentSection),
    yearStart: years.yearStart,
    yearEnd: years.yearEnd,
    yearLabel: years.yearLabel,
  };
}

export function detectCsfStockState(stock: string | null | undefined) {
  const normalized = String(stock ?? '').trim();

  if (normalized === 'inStock') {
    return 'in-stock';
  }

  if (normalized === 'preOrder') {
    return 'pre-order';
  }

  return 'out-of-stock';
}
