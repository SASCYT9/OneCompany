---
tags: [brand, urban, design]
aliases: [Urban Theme]
---

# 🎨 Urban Theme — Storefront Design

> [!info] Дизайн Urban storefront, перенесений з Shopify theme в Next.js

---

## Структура Сторінки

| # | Блок | Опис |
|---|---|---|
| 0 | Back to stores | Посилання ← на `/shop` |
| 1 | Scroll progress | Прогрес скролу зверху |
| 2 | Loader | "One Company x Urban" (2.4с) |
| 3 | Hero | Fullscreen: frame, corners, particles, shimmer |
| 4 | Trust ribbon | 4 пункти довіри |
| 5 | 8 Showcases | Cinematic + Vimeo (lazy) |
| 6 | Fleet cards | 6 карток з 3D tilt |
| 7 | Defender section | Widetrack feature block |

---

## Колекції (27+)

Кожна колекція читається з Shopify JSONC templates:
- `section-urban-cinematic-hero`
- `section-urban-model-overview`
- `section-urban-gallery-carousel`
- `section-urban-video-pointer`
- `section-urban-banner-stack`
- `section-urban-blueprint-kit`
- `main-collection-product-grid`

---

## Файли

| Файл | Призначення |
|---|---|
| `shop/urban/page.tsx` | Головна Urban |
| `shop/components/UrbanHomeSignature.tsx` | Layout блоків |
| `shop/components/UrbanThemeScript.tsx` | Animations |
| `shop/data/urbanHomeData.ts` | Hero + Fleet data |
| `shop/data/urbanShowcasesData.ts` | 8 showcases |
| `styles/uh7-theme.css` | Theme CSS |
| `components/layout/Header.tsx` | Urban header mode |

---

## Зв'язки

- Бренд → [[Urban Automotive]]
- Storefront → [[Phase C — Storefront]]

← [[Home]]
