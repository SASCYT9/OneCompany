# Catalog inventory hero — design QA

- Source visual truth: `C:\Users\Admin\.codex\generated_images\01a05461-4006-78a2-b87b-6081db436935\exec-142d2074-78a2-4707-9d71-7805206b1364.png`
- Browser-rendered implementation: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\implementation-hero-final.png`
- Combined comparison: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\design-qa-comparison.png`
- Route: `http://127.0.0.1:3000/ua/shop/catalog`
- State: dark theme, desktop catalog, Akrapovič inventory item selected, catalog data loaded
- Browser viewport: 1265 × 712 CSS px, device scale factor 1
- Source pixels: 2172 × 724; implementation screenshot pixels: 1265 × 712
- Normalization: the source was downsampled to 1265 × 422; the implementation hero was cropped from y=88 to y=510 at 1265 × 422. Both normalized regions are stacked in `design-qa-comparison.png`.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation preserves the light geometric display hierarchy, gold uppercase eyebrow, restrained tracking, and compact product detail treatment. The title wraps at the narrower live viewport; this is an expected responsive adaptation rather than a hierarchy change.
- Spacing and layout rhythm: the three-part composition, product-detail column, navigation, bottom product rail, and all-in-stock CTA match the source structure. The filter panel now starts below the rail and no longer obscures it.
- Colors and visual tokens: black surfaces, low-contrast separators, warm gold accent, white type, and stock-status accent match the source direction and existing OneCompany dark theme.
- Image quality and asset fidelity: the implementation uses real catalog thumbnails rather than placeholders or drawn substitutes. Transparent product assets integrate directly with the black hero; contextual product photography remains intentionally uncropped where supplied by the catalog.
- Copy and content: static copy is localized; product name, brand, regional price, availability, image, and URL come from the loaded catalog item.
- Icons and controls: library arrow icons are aligned and keyboard-focusable. Previous/next, rail-item selection, auto-rotation pause on hover/focus, product CTA, and all-in-stock CTA are implemented.
- Accessibility: semantic headings, links and buttons are present; controls have accessible names; disabled navigation state and visible focus treatment are included; automatic rotation is disabled when reduced motion is requested.

## Comparison history

1. Initial comparison found a P2 layout issue: the existing negative top margin covered most of the new product rail. Fixed by placing the vehicle filter panel below the hero with a positive section gap. Post-fix evidence: `implementation-hero-final.png` and the lower half of `design-qa-comparison.png` show the entire rail.
2. Initial comparison found a P2 fidelity issue: navigation occupied a dedicated left rail cell and the source's all-in-stock CTA was absent. Fixed by moving arrows/count beneath the product CTA and adding the right-side all-in-stock link. Post-fix evidence: the controls and rail structure are visible in `design-qa-comparison.png`.
3. Initial comparison found a P2 image-delivery issue for external product thumbnails routed through the optimizer. Fixed by rendering hero and rail catalog thumbnails unoptimized so their source URLs load reliably. Post-fix evidence: the Akrapovič main image and all three rail thumbnails render in `implementation-hero-final.png`.
4. Follow-up comparison found a P2 consistency issue: source images with different aspect ratios produced visibly different subject sizes and white square thumbnails. Fixed by standardizing the main media stage at 16:10 with a 390 px maximum width and `object-cover`, and every rail thumbnail at 80 × 56 px with the same crop behavior. Akrapovič, Brabus, Öhlins, and the confirmed Eventuri warehouse states were switched manually and checked after the fix. Post-fix evidence: `implementation-hero-final.png` and the lower half of `design-qa-comparison.png`.
5. Inventory validation found a P0 content-trust issue: the premium adapter hardcoded every product as in stock. Fixed with one exact, normalized eleven-SKU Eventuri inventory source shared by both catalog readers. Duplicate catalog records are deduplicated by SKU in the hero. The rendered counter now shows 11 items, and Brabus, Öhlins, ADRO, Urban Automotive, and unrelated Eventuri SKUs are excluded.
6. Eventuri-only review found a P2 art-direction issue: white supplier images looked like unrelated rectangles on the black hero and the product name repeated the brand. Fixed with a consistent warm-neutral media stage, multiply blending for white-background catalog photography, SKU-forward eyebrow copy, and brand-stripped product titles. `EVE-G9X-CF-CHG` now uses a verified higher-resolution photograph of the exact two-part G90/G99 M5 inlet set.
7. User review removed the visible catalog heading from the carousel. The layout was rebalanced from three columns to a focused two-column product composition: a substantially larger standardized media stage and a quieter purchase-information column. The catalog H1 remains screen-reader-only, so the visual simplification does not remove the page's semantic heading. The existing bottom rail, stock CTA, navigation, colors, and interaction model remain intact.
8. Follow-up review found that the simplified hero image still dominated the composition and that Eventuri images filled too much of filtered product cards. The hero media was reduced to a 550 × 275 px maximum stage and changed from crop-based `object-cover` to padded `object-contain`. Eventuri grid imagery now receives larger brand-specific padding. Both the hero warehouse message and reusable Eventuri availability badge use a higher-contrast emerald treatment with a lit status dot. Verified on the default catalog hero and the `brand=Eventuri` filtered grid at the live desktop viewport.
9. The warehouse slide for `EVE-W192-FTR` inherited an IND Distribution-watermarked thumbnail. It now uses a SKU-specific Eventuri Type D2 product diagram with multiple filter views and Eventuri branding. The replacement was verified directly on carousel slide 10/11; the unrelated IND logo is no longer visible.
10. The fixed 88 px site header overlapped the top of the in-stock carousel. A 32 px responsive-safe content offset was added on top of the layout's existing 64 px spacing. Browser measurements now place the header bottom at 88 px and the hero top at 96 px, leaving an intentional 8 px clearance without a large empty band.
11. Light-theme review found that the inventory carousel remained an isolated black surface. It now uses a warm ivory gradient, dark editorial typography, darker gold accents, and a translucent light product rail while retaining the established black treatment under `dark`. The availability badge was reduced and placed in its own block flow, guaranteeing separation from the detail CTA. All eleven confirmed Eventuri warehouse SKUs now have concise bilingual presentation titles and descriptions keyed by exact SKU. Both theme states were captured at the same desktop viewport, and the copy map is protected by a unit contract.
12. Raw-data follow-up adds a reproducible editorial backfill for all 15 underlying Eventuri product records represented by the 11 warehouse SKUs. Records are keyed by exact slug rather than SKU, preserving Audi RSQ8, Bentley Bentayga, Lamborghini Urus, Porsche Cayenne, and AMG gloss/matte distinctions. The command defaults to dry-run, validates product identity before mutation, writes through the catalog mutation coordinator, and publishes the resulting projections. Database execution remains gated by a verified backup and non-empty database credentials.

## Primary interactions tested

- Catalog data load and populated hero
- Automatic product rotation
- Previous/next product controls
- Selecting a product from the bottom rail
- Synchronized image, name, brand, price, stock state, counter, and product URL
- Browser console checked: no runtime errors; development-only HMR logs and LCP advisory warnings only
- TypeScript: `tsc --noEmit` passed
- Git whitespace validation: `git diff --check` passed

## Residual test gaps

- A separate device-width browser capture was not available in the selected in-app browser session; responsive behavior is covered by the component's existing Tailwind breakpoints but should receive an additional real-device smoke test before production promotion.

final result: passed
