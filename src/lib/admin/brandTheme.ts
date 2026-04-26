/**
 * Admin brand theming.
 *
 * When the admin catalog is filtered by a single brand, the page renders a
 * cinematic hero panel themed to that brand. This module is the source of
 * truth for brand display name, accent color, gradient stops, and optional
 * logo. Falls back to the default OneCompany Blue accent when the brand is
 * unknown or when no brand filter is active.
 */

export type AdminBrandTheme = {
  id: string;
  displayName: string;
  tagline?: string;
  /** Accent color in hex — used for gradient stops, chip border, sparkline tone. */
  tintHex: string;
  /** Soft background tint (~12% opacity) for hero gradient. */
  bgSoft: string;
  /** Stronger tint for borders/glow. */
  bgMedium: string;
  /** Border color for accent surfaces. */
  border: string;
  /** Tailwind class for the display heading font. */
  fontClass: string;
  /** Path under /public/. Optional. */
  logoSrc?: string;
  /** Tracking style — luxe brands like Urban use looser letter-spacing. */
  trackingClass: string;
};

const URBAN: AdminBrandTheme = {
  id: 'Urban Automotive',
  displayName: 'Urban Automotive',
  tagline: 'Wide-body kits, premium aero, signature finishes.',
  tintHex: '#c29d59',
  bgSoft: 'rgba(194, 157, 89, 0.12)',
  bgMedium: 'rgba(194, 157, 89, 0.28)',
  border: 'rgba(194, 157, 89, 0.45)',
  fontClass: 'font-display',
  logoSrc: '/images/shop/urban/svgs/logo.svg',
  trackingClass: 'tracking-[0.04em]',
};

const AKRAPOVIC: AdminBrandTheme = {
  id: 'Akrapovic',
  displayName: 'Akrapovič',
  tagline: 'Titanium exhausts. Race-bred sound.',
  tintHex: '#e50000',
  bgSoft: 'rgba(229, 0, 0, 0.10)',
  bgMedium: 'rgba(229, 0, 0, 0.28)',
  border: 'rgba(229, 0, 0, 0.45)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.18em] uppercase',
  logoSrc: '/logos/akrapovic.png',
};

const BRABUS: AdminBrandTheme = {
  id: 'Brabus',
  displayName: 'BRABUS',
  tagline: 'Stuttgart performance. Bespoke power.',
  tintHex: '#cc0000',
  bgSoft: 'rgba(204, 0, 0, 0.10)',
  bgMedium: 'rgba(204, 0, 0, 0.26)',
  border: 'rgba(204, 0, 0, 0.40)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.22em] uppercase',
  logoSrc: '/logos/brabus.svg',
};

const RACECHIP: AdminBrandTheme = {
  id: 'RaceChip',
  displayName: 'RaceChip',
  tagline: 'Plug-in tuning modules.',
  tintHex: '#f97316',
  bgSoft: 'rgba(249, 115, 22, 0.10)',
  bgMedium: 'rgba(249, 115, 22, 0.24)',
  border: 'rgba(249, 115, 22, 0.40)',
  fontClass: 'font-sans',
  trackingClass: 'tracking-tight',
  logoSrc: '/logos/racechip.png',
};

const ADRO: AdminBrandTheme = {
  id: 'ADRO',
  displayName: 'ADRO',
  tagline: 'Carbon aero, motorsport silhouettes.',
  tintHex: '#84cc16',
  bgSoft: 'rgba(132, 204, 22, 0.10)',
  bgMedium: 'rgba(132, 204, 22, 0.22)',
  border: 'rgba(132, 204, 22, 0.36)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.22em] uppercase',
  logoSrc: '/images/shop/adro/adro-logo-white.svg',
};

const BURGER: AdminBrandTheme = {
  id: 'Burger Motorsports',
  displayName: 'Burger Motorsports',
  tagline: 'JB4, intakes, intercoolers.',
  tintHex: '#facc15',
  bgSoft: 'rgba(250, 204, 21, 0.10)',
  bgMedium: 'rgba(250, 204, 21, 0.22)',
  border: 'rgba(250, 204, 21, 0.36)',
  fontClass: 'font-sans',
  trackingClass: 'tracking-tight',
  logoSrc: '/logos/burger-motorsport.svg',
};

const CSF: AdminBrandTheme = {
  id: 'CSF',
  displayName: 'CSF',
  tagline: 'High-performance cooling.',
  tintHex: '#3b82f6',
  bgSoft: 'rgba(59, 130, 246, 0.10)',
  bgMedium: 'rgba(59, 130, 246, 0.22)',
  border: 'rgba(59, 130, 246, 0.36)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.22em] uppercase',
  logoSrc: '/images/shop/csf/csf-logo-white.png',
};

const DO88: AdminBrandTheme = {
  id: 'DO88',
  displayName: 'DO88',
  tagline: 'Swedish-engineered cooling.',
  tintHex: '#22d3ee',
  bgSoft: 'rgba(34, 211, 238, 0.10)',
  bgMedium: 'rgba(34, 211, 238, 0.22)',
  border: 'rgba(34, 211, 238, 0.36)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.22em] uppercase',
  logoSrc: '/logos/do88.png',
};

const GIRODISC: AdminBrandTheme = {
  id: 'GiroDisc',
  displayName: 'GiroDisc',
  tagline: 'Two-piece rotors built for the track.',
  tintHex: '#f43f5e',
  bgSoft: 'rgba(244, 63, 94, 0.10)',
  bgMedium: 'rgba(244, 63, 94, 0.22)',
  border: 'rgba(244, 63, 94, 0.36)',
  fontClass: 'font-sans',
  trackingClass: 'tracking-tight',
  logoSrc: '/images/shop/girodisc/girodisc-logo-white.png',
};

const MHT: AdminBrandTheme = {
  id: 'MHT',
  displayName: 'MHT Wheels',
  tagline: 'Forged wheel programs.',
  tintHex: '#a3a3a3',
  bgSoft: 'rgba(163, 163, 163, 0.10)',
  bgMedium: 'rgba(163, 163, 163, 0.22)',
  border: 'rgba(163, 163, 163, 0.36)',
  fontClass: 'font-condensed',
  trackingClass: 'tracking-[0.22em] uppercase',
};

const MISHIMOTO: AdminBrandTheme = {
  id: 'Mishimoto',
  displayName: 'Mishimoto',
  tagline: 'Performance cooling, oil management.',
  tintHex: '#06b6d4',
  bgSoft: 'rgba(6, 182, 212, 0.10)',
  bgMedium: 'rgba(6, 182, 212, 0.22)',
  border: 'rgba(6, 182, 212, 0.36)',
  fontClass: 'font-sans',
  trackingClass: 'tracking-tight',
};

const OHLINS: AdminBrandTheme = {
  id: 'OHLINS',
  displayName: 'Öhlins',
  tagline: 'Premium suspension. Swedish craft.',
  tintHex: '#eab308',
  bgSoft: 'rgba(234, 179, 8, 0.10)',
  bgMedium: 'rgba(234, 179, 8, 0.22)',
  border: 'rgba(234, 179, 8, 0.36)',
  fontClass: 'font-display',
  trackingClass: 'tracking-[0.04em]',
  logoSrc: '/logos/ohlins.svg',
};

export const ADMIN_BRAND_THEMES: Record<string, AdminBrandTheme> = {
  'Urban Automotive': URBAN,
  Urban: URBAN,
  Akrapovic: AKRAPOVIC,
  'Akrapovič': AKRAPOVIC,
  Brabus: BRABUS,
  RaceChip: RACECHIP,
  ADRO,
  'Burger Motorsports': BURGER,
  Burger: BURGER,
  CSF,
  DO88,
  GiroDisc: GIRODISC,
  Girodisc: GIRODISC,
  MHT,
  Mishimoto: MISHIMOTO,
  OHLINS,
  Ohlins: OHLINS,
};

const DEFAULT: AdminBrandTheme = {
  id: 'DEFAULT',
  displayName: 'Каталог',
  tintHex: '#3B82F6',
  bgSoft: 'rgba(59, 130, 246, 0.10)',
  bgMedium: 'rgba(59, 130, 246, 0.22)',
  border: 'rgba(59, 130, 246, 0.36)',
  fontClass: 'font-sans',
  trackingClass: 'tracking-tight',
};

export function adminBrandTheme(brand: string | null | undefined): AdminBrandTheme {
  if (!brand || brand === 'ALL') return DEFAULT;
  const direct = ADMIN_BRAND_THEMES[brand];
  if (direct) return direct;
  // Try case-insensitive lookup
  const key = Object.keys(ADMIN_BRAND_THEMES).find((k) => k.toLowerCase() === brand.toLowerCase());
  return key ? ADMIN_BRAND_THEMES[key] : { ...DEFAULT, displayName: brand };
}

export function isBrandFilterActive(brand: string | null | undefined): boolean {
  return Boolean(brand && brand !== 'ALL');
}
