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
4. Follow-up comparison found a P2 consistency issue: source images with different aspect ratios produced visibly different subject sizes and white square thumbnails. Fixed by standardizing the main media stage at 16:10 with a 520 px maximum width and `object-cover`, and every rail thumbnail at 80 × 56 px with the same crop behavior. Akrapovič, Brabus, and Öhlins states were switched manually and checked after the fix. Post-fix evidence: `implementation-hero-final.png` and the lower half of `design-qa-comparison.png`.

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
