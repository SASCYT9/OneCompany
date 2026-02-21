"use client";

import { usePathname } from "next/navigation";
import { BreadcrumbSchema } from "./StructuredData";
import { absoluteUrl } from "@/lib/seo";

const translations: Record<string, Record<string, string>> = {
    ua: {
        home: "Головна",
        auto: "Авто Тюнінг",
        moto: "Мото Тюнінг",
        brands: "Бренди",
        europe: "Європейські",
        usa: "Американські",
        oem: "OEM",
        racing: "Racing",
        blog: "Блог",
        categories: "Категорії",
        contact: "Контакти",
        about: "Про нас",
        partnership: "Співпраця",
        choice: "Як обрати",
        terms: "Правила",
        privacy: "Конфіденційність",
        cookies: "Cookies",
    },
    en: {
        home: "Home",
        auto: "Auto Tuning",
        moto: "Moto Tuning",
        brands: "Brands",
        europe: "European",
        usa: "American",
        oem: "OEM",
        racing: "Racing",
        blog: "Blog",
        categories: "Categories",
        contact: "Contact",
        about: "About",
        partnership: "Partnership",
        choice: "How to Choose",
        terms: "Terms",
        privacy: "Privacy",
        cookies: "Cookies",
    }
};

function formatSegment(segment: string, locale: 'ua' | 'en') {
    const lowerSegment = segment.toLowerCase();
    if (translations[locale][lowerSegment]) {
        return translations[locale][lowerSegment];
    }
    // Convert slug to readable text (e.g. "exhaust-systems" -> "Exhaust Systems")
    return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export default function AutoBreadcrumbs() {
    const pathname = usePathname();
    if (!pathname) return null;

    const segments = pathname.split('/').filter(Boolean);

    // Extract locale from URL
    const localeIndex = (segments[0] === 'en' || segments[0] === 'ua') ? 0 : -1;
    const locale = localeIndex === 0 ? (segments[0] as 'ua' | 'en') : 'ua';

    const items = [
        {
            name: translations[locale].home,
            url: absoluteUrl(`/${locale}`)
        }
    ];

    let currentPath = `/${locale}`;
    const startIdx = localeIndex + 1;

    for (let i = startIdx; i < segments.length; i++) {
        const slug = segments[i];

        // Skip pagination segments or utility segments if needed
        if (slug === 'page' && !isNaN(Number(segments[i + 1]))) continue;

        currentPath += `/${slug}`;
        items.push({
            name: formatSegment(slug, locale),
            url: absoluteUrl(currentPath)
        });
    }

    // Only render if we have actual segments beyond home
    if (items.length <= 1) return null;

    return <BreadcrumbSchema items={items} />;
}
