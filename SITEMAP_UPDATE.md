# Sitemap Update

The sitemap generation logic in `src/app/sitemap.ts` has been updated to provide a high-quality sitemap for `onecompany.global`.

## Changes

1.  **Domain Update**: The sitemap now correctly uses `https://onecompany.global` as the base URL (via `src/lib/seo.ts`).
2.  **Alternates (hreflang)**: Added `alternates` field to each sitemap entry. This tells search engines about the localized versions (English and Ukrainian) of each page, improving SEO for multilingual support.
3.  **Expanded Static Pages**: Added missing static pages to the sitemap:
    *   `/partnership`
    *   `/eventuri`
    *   `/fi`
    *   `/kw`
    *   `/choice`
    *   `/configurator`
    *   `/physics`
    *   `/privacy`
    *   `/terms`
    *   `/cookies`
4.  **Dynamic Routes**: Confirmed that brand pages (`/brands/[slug]`) and category pages (`/[segment]/categories/[slug]`) are correctly generated.

## Verification

*   **Robots.txt**: `src/app/robots.ts` correctly points to `https://onecompany.global/sitemap.xml`.
*   **Route Structure**: The sitemap entries match the actual file structure in `src/app/[locale]`.

## Next Steps

*   Deploy the application to Vercel (or your hosting provider).
*   Submit `https://onecompany.global/sitemap.xml` to Google Search Console.
