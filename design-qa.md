# Design QA — active Brands navigation

- Source visual truth: `C:/Users/sascy/AppData/Local/Temp/codex-clipboard-a3b23206-af05-4b06-b507-480fb64da288.png`
- Implementation full screenshot: `D:/One Company/OneCompany/.codex-artifacts/brand-arrow-qa/implementation-full.png`
- Focused implementation screenshot: `D:/One Company/OneCompany/.codex-artifacts/brand-arrow-qa/implementation-nav.png`
- Side-by-side comparison: `D:/One Company/OneCompany/.codex-artifacts/brand-arrow-qa/comparison.png`
- Viewport: requested 1641 × 700; browser content capture 1626 × 694 due to native scrollbar/chrome
- Route: `http://localhost:3000/ua/shop`
- State: Brands is the active shop section

## Full-view comparison evidence

The existing three-card navigation layout, typography, spacing, colors, borders, radii, icons, copy, and responsive structure were preserved. The implementation changes only the directional affordance and active-card destination requested by the annotation.

## Focused region comparison evidence

The side-by-side focused comparison confirms that the active Brands card now uses a downward arrow in the same icon slot and visual weight as the previous diagonal arrow. Catalog and vehicle-selection cards retain their diagonal arrows.

## Findings

- No actionable P0, P1, or P2 differences within the requested scope.
- Fonts and typography: unchanged.
- Spacing and layout rhythm: unchanged; no card resizing or wrapping introduced.
- Colors and visual tokens: unchanged; the existing theme tokens remain intact.
- Image quality and asset fidelity: unchanged; no image assets were modified.
- Copy and content: unchanged.
- Interaction: clicking Brands updates the URL to `#shop-brands` and scrolls to the `15 брендів` section without reloading the page.
- Accessibility: the destination is a real anchor target; keyboard and standard link behavior are preserved.
- Console errors: none observed.

## Comparison history

- Initial issue: the active Brands card used an up-right arrow and linked back to the same page root.
- Fix: changed the active Brands direction icon to ArrowDown and its destination to `#shop-brands`; added the matching scroll target with header offset.
- Post-fix evidence: focused comparison and successful browser interaction at `/ua/shop#shop-brands`.

## Follow-up polish

- None required for this scoped change.

final result: passed

---

# Design QA — supplied sport-bike SVG

- Source visual truth: `D:/sport-bike-motorcycle-icon.svg`
- Implementation screenshot: `C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/catalog-user-moto-svg-implementation.png`
- Side-by-side focused comparison: `C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/catalog-user-moto-svg-comparison.png`
- Viewport: 1280 × 720
- Route: `http://localhost:3000/ua/shop/catalog?q=M3+2018`
- State: Moto selected, light theme

## Full-view comparison evidence

The supplied sport-bike silhouette is used directly as the Moto mask asset. The vehicle toggle retains the existing catalog layout, typography, spacing, borders, colors, and interaction behavior.

## Focused region comparison evidence

The side-by-side comparison confirms identical motorcycle geometry between the source SVG and the rendered Moto control. Its wide aspect ratio is accommodated with a 28 × 20 px slot so the fairing and wheels remain legible without touching the icon container.

## Findings

- No actionable P0, P1, or P2 differences within the requested scope.
- Fonts and typography: unchanged.
- Spacing and layout rhythm: unchanged; the wider Moto icon remains centered within the existing 32 px container.
- Colors and visual tokens: the CSS mask inherits the selected and unselected theme colors.
- Image quality and asset fidelity: native vector rendering; no rasterization, stretching, clipping, or transparency halo.
- Copy and content: unchanged.
- Interaction: Auto/Moto selection remains functional.
- Console errors: none observed.

## Comparison history

- Earlier implementation: generic library motorcycle glyph did not match the requested sport-bike character.
- Fix: replaced it with the user-supplied SVG and adjusted only its display width for the source aspect ratio.
- Post-fix evidence: focused source/implementation comparison shows matching geometry and a legible active state.

## Follow-up polish

- Verify the same asset in dark theme during the next broader catalog QA pass.

final result: passed
