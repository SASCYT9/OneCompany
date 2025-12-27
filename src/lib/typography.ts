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
        heroBadge: 'text-[8px] min-[410px]:text-[10px] sm:text-[10px] md:text-[11px]',

        // Headings
        h1: isUa
            ? 'text-xl min-[410px]:text-2xl sm:text-2xl lg:text-3xl'
            : 'text-2xl min-[410px]:text-3xl sm:text-3xl lg:text-4xl',
        h2: isUa
            ? 'text-lg min-[410px]:text-xl sm:text-xl'
            : 'text-xl min-[410px]:text-2xl sm:text-2xl',
        h3: isUa
            ? 'text-base min-[410px]:text-lg sm:text-lg'
            : 'text-lg min-[410px]:text-xl sm:text-xl',
        h4: isUa
            ? 'text-sm min-[410px]:text-base sm:text-base'
            : 'text-base min-[410px]:text-lg sm:text-lg',
        sectionHeading: isUa
            ? 'text-2xl min-[410px]:text-3xl sm:text-3xl md:text-4xl'
            : 'text-3xl min-[410px]:text-4xl sm:text-4xl md:text-5xl',

        // Body text
        body: isUa
            ? 'text-xs min-[410px]:text-sm sm:text-sm'
            : 'text-sm min-[410px]:text-base sm:text-base',
        bodySmall: isUa
            ? 'text-[11px] min-[410px]:text-[13px] sm:text-[13px]'
            : 'text-[13px] min-[410px]:text-[15px] sm:text-[15px]',
        bodyTiny: 'text-[9px] min-[410px]:text-[10px] sm:text-[10px]',

        // Stats & numbers
        statValue: isUa
            ? 'text-lg min-[410px]:text-xl sm:text-xl'
            : 'text-xl min-[410px]:text-2xl sm:text-2xl',
        statLabel: 'text-[8px] min-[410px]:text-[9px] sm:text-[9px]',

        // Badges & labels
        badge: 'text-[8px] min-[410px]:text-[10px] sm:text-[10px]',
        label: isUa
            ? 'text-[10px] min-[410px]:text-xs sm:text-xs'
            : 'text-xs min-[410px]:text-sm sm:text-sm',
        labelSmall: 'text-[8px] min-[410px]:text-[9px] sm:text-[9px]',

        // Buttons
        buttonText: isUa
            ? 'text-xs min-[410px]:text-sm sm:text-sm'
            : 'text-sm min-[410px]:text-base sm:text-base',
        buttonTextSmall: 'text-[10px] min-[410px]:text-xs sm:text-xs',
    };
};

/**
 * Helper to resolve locale from string
 */
export const resolveLocale = (locale: string | undefined): Locale => {
    return locale === 'en' ? 'en' : 'ua';
};
