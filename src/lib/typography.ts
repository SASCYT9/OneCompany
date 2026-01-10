/**
 * Global typography system for OneCompany
 * Provides consistent font sizing across all pages with locale-aware scaling
 */

export type Locale = 'ua' | 'en';

export interface TypographyConfig {
    // Hero sections
    heroTitle: string;
    heroSubtitle: string;
    heroBadge: string;

    // Headings
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    sectionHeading: string; // Alias for h2

    // Body text
    body: string;
    bodySmall: string;
    bodyTiny: string;

    // Stats & numbers
    statValue: string;
    statLabel: string;

    // Badges & labels
    badge: string;
    label: string;
    labelSmall: string;

    // Buttons
    buttonText: string;
    buttonTextSmall: string;
}

/**
 * Get typography configuration based on locale
 * Ukrainian locale uses smaller fonts for better readability
 */
export const getTypography = (locale: Locale): TypographyConfig => {
    // Standardizing typography across locales (using English sizes for both)
    return {
        // Hero sections
        heroTitle: 'text-2xl sm:text-3xl lg:text-4xl',
        heroSubtitle: 'text-sm sm:text-base',
        heroBadge: 'text-[8px] min-[410px]:text-[10px] sm:text-[10px] md:text-[11px]',

        // Headings
        h1: 'text-2xl min-[410px]:text-3xl sm:text-3xl lg:text-4xl',
        h2: 'text-xl min-[410px]:text-2xl sm:text-2xl',
        h3: 'text-lg min-[410px]:text-xl sm:text-xl',
        h4: 'text-base min-[410px]:text-lg sm:text-lg',
        sectionHeading: 'text-3xl min-[410px]:text-4xl sm:text-4xl md:text-5xl',

        // Body text
        body: 'text-sm min-[410px]:text-base sm:text-base',
        bodySmall: 'text-[13px] min-[410px]:text-[15px] sm:text-[15px]',
        bodyTiny: 'text-[9px] min-[410px]:text-[10px] sm:text-[10px]',

        // Stats & numbers
        statValue: 'text-xl min-[410px]:text-2xl sm:text-2xl',
        statLabel: 'text-[8px] min-[410px]:text-[9px] sm:text-[9px]',

        // Badges & labels
        badge: 'text-[8px] min-[410px]:text-[10px] sm:text-[10px]',
        label: 'text-xs min-[410px]:text-sm sm:text-sm',
        labelSmall: 'text-[8px] min-[410px]:text-[9px] sm:text-[9px]',

        // Buttons
        buttonText: 'text-sm min-[410px]:text-base sm:text-base',
        buttonTextSmall: 'text-[10px] min-[410px]:text-xs sm:text-xs',
    };
};

/**
 * Helper to resolve locale from string
 */
export const resolveLocale = (locale: string | undefined): Locale => {
    return locale === 'en' ? 'en' : 'ua';
};
