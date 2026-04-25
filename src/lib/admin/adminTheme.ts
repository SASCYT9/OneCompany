import type { AdminNavSectionKey } from './adminNavigation';

/**
 * "OneCompany Blue" admin design tokens.
 *
 * Premium dark with single blue accent (Stripe-style trust + automotive
 * sophistication). Backgrounds are pure warm-black; surfaces sit just above.
 * Geometry is soft (12px card radius, full pills for status). Status colors
 * stay distinct from brand blue so warnings never read as primary actions.
 */

// Surfaces — warm dark, no blue undertone
export const ADMIN_BG = '#0A0A0A';
export const ADMIN_SURFACE = '#171717';
export const ADMIN_SURFACE_2 = '#1F1F1F';
export const ADMIN_SURFACE_3 = '#262626';

// Borders — barely-visible hairlines
export const ADMIN_BORDER_HAIRLINE = 'rgba(255,255,255,0.05)';
export const ADMIN_BORDER_SOFT = 'rgba(255,255,255,0.08)';
export const ADMIN_BORDER_DEFINED = 'rgba(255,255,255,0.14)';

// Text — checked against #0A0A0A
export const ADMIN_TEXT_PRIMARY = '#FAFAFA'; // 18.4:1 (AAA)
export const ADMIN_TEXT_SECONDARY = '#D4D4D8'; // zinc-300, 12.0:1 (AAA)
export const ADMIN_TEXT_MUTED = '#A1A1AA'; // zinc-400, 7.2:1 (AAA)
export const ADMIN_TEXT_FAINT = '#71717A'; // zinc-500, 4.0:1 (AA large)

// Brand blue
export const ADMIN_BLUE = '#3B82F6'; // blue-500 — primary accent
export const ADMIN_BLUE_BRIGHT = '#60A5FA'; // blue-400 — hover/highlight
export const ADMIN_BLUE_DEEP = '#2563EB'; // blue-600 — pressed
export const ADMIN_BLUE_DARK = '#1E3A8A'; // blue-900 — icon bg behind blue icon
export const ADMIN_BLUE_GLOW = 'rgba(59,130,246,0.4)';

// Status colors — distinct from brand
export const ADMIN_SUCCESS = '#22C55E'; // green-500
export const ADMIN_WARNING = '#F59E0B'; // amber-500
export const ADMIN_DANGER = '#EF4444'; // red-500
export const ADMIN_INFO = '#3B82F6'; // shares brand blue

// Brand alias
export const ADMIN_BRAND = ADMIN_BLUE;

/**
 * Section accents — subdued. The reference screenshot uses a single blue accent
 * everywhere; we keep that consistency. Only "imports" and "logistics" get
 * minor variation so users feel a slight shift between sections.
 */
export type SectionAccent = {
  color: string;
  bgSoft: string;
  bgMedium: string;
  border: string;
  glow: string;
  textTone: string;
};

const BLUE_ACCENT: SectionAccent = {
  color: '#3B82F6',
  bgSoft: 'rgba(59,130,246,0.08)',
  bgMedium: 'rgba(59,130,246,0.15)',
  border: 'rgba(59,130,246,0.30)',
  glow: '0 0 14px rgba(59,130,246,0.45)',
  textTone: '#93C5FD',
};

const SKY_ACCENT: SectionAccent = {
  color: '#0EA5E9',
  bgSoft: 'rgba(14,165,233,0.08)',
  bgMedium: 'rgba(14,165,233,0.15)',
  border: 'rgba(14,165,233,0.28)',
  glow: '0 0 14px rgba(14,165,233,0.45)',
  textTone: '#7DD3FC',
};

const VIOLET_ACCENT: SectionAccent = {
  color: '#8B5CF6',
  bgSoft: 'rgba(139,92,246,0.08)',
  bgMedium: 'rgba(139,92,246,0.15)',
  border: 'rgba(139,92,246,0.28)',
  glow: '0 0 14px rgba(139,92,246,0.4)',
  textTone: '#C4B5FD',
};

export const ADMIN_SECTION_ACCENTS: Record<AdminNavSectionKey, SectionAccent> = {
  overview: BLUE_ACCENT,
  orders: BLUE_ACCENT,
  customers: BLUE_ACCENT,
  catalog: BLUE_ACCENT,
  imports: SKY_ACCENT,
  logistics: SKY_ACCENT,
  content: VIOLET_ACCENT,
  system: BLUE_ACCENT,
};

export const ADMIN_DEFAULT_ACCENT: SectionAccent = BLUE_ACCENT;

export function sectionAccent(key: AdminNavSectionKey | null | undefined): SectionAccent {
  if (!key) return ADMIN_DEFAULT_ACCENT;
  return ADMIN_SECTION_ACCENTS[key] ?? ADMIN_DEFAULT_ACCENT;
}
