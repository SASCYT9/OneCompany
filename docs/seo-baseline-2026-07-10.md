# SEO baseline — 2026-07-10

This document is a measurement baseline only. It does not change storefront content, product
data, Search Console, DNS, or Vercel configuration.

## Google Search Console

Period: 2026-04-09 through 2026-07-08 (3 months).

| Metric | Baseline |
| --- | ---: |
| Clicks | 610 |
| Impressions | 28,454 |
| Average CTR | 2.1% |
| Average position | 8.5 |
| Indexed pages | 22,636 |
| Not indexed pages | 8,366 |
| Discovered, not indexed | 4,792 |
| Crawled, not indexed | 3,066 |
| Server error (5xx) URLs | 41 |
| Sitemap discovered URLs | 30,206 |
| Valid Product/Merchant items | 19 |

### Highest-impression query/page symptoms

- `one company`: 38 clicks / 1,088 impressions.
- `onecompany`: 15 / 252.
- `akrapovic ferrari f8 tributo exhaust official`: 0 / 114.
- `/en/brands/moto`: 1 / 347.
- `/en/shop/akrapovic-s-ty-t-3`: 2 / 291.
- `/en/shop/brabus/products/brabus-rrg-rr68-700-00`: 2 / 250.
- `/en/shop/akrapovic/products/akrapovic-s-fe-t-1`: 1 / 240.

## Vercel

Period: last 7 days ending 2026-07-10.

| Metric | Baseline |
| --- | ---: |
| Reported visitors | 2,216 |
| Page views | 4,764 |
| Bounce rate | 56% |
| US visitor share | 92% |
| Desktop share | 95% |
| GNU/Linux share | 93% |
| Reported google.com visitors | ~2,100 |

The Vercel audience profile and referrer volume are inconsistent with Search Console clicks and
must not be treated as verified human organic traffic.

Runtime errors observed over seven days:

- 94 Prisma connection-pool timeout errors (P2024).
- 39 database-unreachable errors (P1001).

## Read-only catalog audit

Generated from the product database without mutations.

| Metric | Baseline |
| --- | ---: |
| Products | 15,026 |
| Published products | 15,006 |
| Published and active sitemap candidates | 14,992 |
| Published but inactive | 14 |
| Missing EN description | 4,350 |
| Missing UA description | 4,314 |
| Missing category in each locale | 1,646 |
| Missing image | 142 |
| Missing product or variant price | 23 |
| Duplicate normalized title groups | 1,058 |

## Review cadence

Re-check Search Console after 7, 14, and 28 days following each production SEO release. Compare:

1. Non-brand clicks and impressions.
2. CTR for changed pages.
3. Indexed versus excluded sitemap URLs.
4. Discovered/crawled-not-indexed counts.
5. 5xx URLs and database runtime errors.
6. Product rich-result coverage.
