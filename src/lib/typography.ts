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
    const isUa = locale === 'ua';

    return {
        // Hero sections
        heroTitle: isUa
            ? 'text-xl sm:text-2xl lg:text-3xl'
            : 'text-2xl sm:text-3xl lg:text-4xl',
        heroSubtitle: isUa
            ? 'text-xs sm:text-sm'
            : 'text-sm sm:text-base',
        heroBadge: 'text-[8px] sm:text-[10px] md:text-[11px]',

        // Headings
        h1: isUa
            ? 'text-xl sm:text-2xl lg:text-3xl'
            : 'text-2xl sm:text-3xl lg:text-4xl',
        h2: isUa
            ? 'text-lg sm:text-xl'
            : 'text-xl sm:text-2xl',
        h3: isUa
            ? 'text-base sm:text-lg'
            : 'text-lg sm:text-xl',
        h4: isUa
            ? 'text-sm sm:text-base'
            : 'text-base sm:text-lg',
        sectionHeading: isUa
            ? 'text-2xl sm:text-3xl md:text-4xl'
            : 'text-3xl sm:text-4xl md:text-5xl',

        // Body text
        body: isUa
            ? 'text-xs sm:text-sm'
            : 'text-sm sm:text-base',
        bodySmall: isUa
            ? 'text-[10px] sm:text-xs'
            : 'text-xs sm:text-sm',
        bodyTiny: 'text-[9px] sm:text-[10px]',

        // Stats & numbers
        statValue: isUa
            ? 'text-lg sm:text-xl'
            : 'text-xl sm:text-2xl',
        statLabel: 'text-[8px] sm:text-[9px]',

        // Badges & labels
        badge: 'text-[8px] sm:text-[10px]',
        label: isUa
            ? 'text-[10px] sm:text-xs'
            : 'text-xs sm:text-sm',
        labelSmall: 'text-[8px] sm:text-[9px]',

        // Buttons
        buttonText: isUa
            ? 'text-xs sm:text-sm'
            : 'text-sm sm:text-base',
        buttonTextSmall: 'text-[10px] sm:text-xs',
    };
};

/**
 * Helper to resolve locale from string
 */
export const resolveLocale = (locale: string | undefined): Locale => {
    return locale === 'en' ? 'en' : 'ua';
};
