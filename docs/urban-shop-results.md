# Urban Shop — актуальний стан переносу теми

## Маршрути

- `/{locale}/shop` — портал «Наші магазини».
- `/{locale}/shop/urban` — головна Urban theme.
- `/{locale}/shop/urban/collections` — список колекцій з референсної Shopify theme.
- `/{locale}/shop/urban/collections/[handle]` — detail landing для кожної collection template з `reference/urban-shopify-theme/templates/collection.*.json`.
- `/{locale}/shop/cart`, `/{locale}/shop/checkout`, `/{locale}/shop/checkout/success` — cart/checkout flow у стилі Urban storefront.

## Що перенесено

- Urban home використовує theme-based hero, trust, showcases, fleet cards і Defender block.
- CTA на home більше не ведуть у старий generic `/shop` або anchor-only flow:
  - primary hero CTA веде на `/{locale}/shop/urban/collections`;
  - showcases та fleet cards ведуть на реальні `/{locale}/shop/urban/collections/[handle]`.
- Collection pages більше не залежать від одного ручного Defender-конфіга:
  - конфіг читається напряму з Shopify JSONC templates;
  - підтримуються секції `section-urban-cinematic-hero`, `section-urban-model-overview`, `section-urban-gallery-carousel`, `section-urban-video-pointer`, `section-urban-banner-stack`, `section-urban-blueprint-kit`, `main-collection-product-grid`;
  - це покриває всі 27 наявних `collection.*.json`.

## Ключові файли

- `src/app/[locale]/shop/data/urbanCollectionPages.server.ts` — loader/parsing для Shopify collection templates.
- `src/app/[locale]/shop/data/urbanCollectionPages.ts` — shared типи collection theme config.
- `src/app/[locale]/shop/urban/collections/[handle]/page.tsx` — render collection landing через parsed theme config.
- `src/app/[locale]/shop/components/UrbanCollectionSections.tsx` — React-секції для hero/overview/gallery/video/banner/blueprint.
- `src/app/[locale]/shop/components/UrbanCollectionProductGrid.tsx` — theme shell для `main-collection-product-grid`.
- `src/app/[locale]/shop/components/UrbanHomeSignature.tsx` — Urban home з локальними route links.
- `src/components/layout/Header.tsx` — Urban-specific header mode для `shop/urban`, `shop/cart`, `shop/checkout`.

## Поточне обмеження

- Product grid секція вже перенесена як storefront shell, але фактичне наповнення залежить від даних у shop catalog.
- Щоб товари автоматично з’являлись у конкретній Urban collection, їх потрібно зв’язати в shop catalog з відповідним collection handle або сумісною назвою collection.
