# Homepage shop entry — selected option 1 contrast pass — 2026-07-16

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-62b8e2b3-e002-49b5-92ac-8deae8e51b17.png

implementation screenshot paths:

- D:/One Company/OneCompany/output/design-qa/home-shop-entry-option-1/after-light.png
- D:/One Company/OneCompany/output/design-qa/home-shop-entry-option-1/after-dark.png

viewport and state:

- Desktop browser viewport: 1465x1272, Ukrainian `/ua`, signed-out public state.
- Compared component region: 1400x318 in both light and dark themes.
- Responsive geometry check: 390x844; document, panel, and actions have no horizontal overflow.

full-view comparison evidence:

- D:/One Company/OneCompany/output/design-qa/home-shop-entry-option-1/comparison-full-light.png
- The selected concept and implementation are combined in one image. The source concept is taller than the existing homepage slot; the implementation intentionally preserves the compact 300px desktop surface while matching its hierarchy and proportions.

focused region comparison evidence:

- D:/One Company/OneCompany/output/design-qa/home-shop-entry-option-1/comparison-focused-light.png
- The focused comparison keeps the eyebrow, proof, both actions, underline, arrows, and complete product treatment readable together.

findings:

- No actionable P0/P1/P2 issue remains.
- Fonts and typography: the established One Company Unbounded stack is preserved. The proof line is now 18px on desktop, the primary label 14px, and the secondary action 17px; the removed large heading was not reintroduced.
- Spacing and layout rhythm: the existing 1400px grid, 300px panel height, 30px radius, compact left stack, dual-action row, and right product zone remain aligned with the homepage rather than adopting the generated image's incorrect taller aspect ratio.
- Colors and visual tokens: the panel uses a translucent theme-native surface with backdrop blur, not a fixed black card. Light uses the red conversion CTA; dark uses the previously approved white/black CTA. Proof and secondary text now use high foreground contrast, with red limited to brand accents and the light primary action.
- Image quality and asset fidelity: the existing official transparent Akrapovič PNG is retained. Desktop object-cover placement uses the transparent canvas to enlarge the whole exhaust without an opaque plate, placeholder, CSS drawing, or generated replacement.
- Copy and content: `Магазин One Company`, `200+ брендів · 15 фірмових колекцій`, `Відкрити каталог`, and `Підібрати деталь` remain unchanged and continue to present one unified shop.
- Accessibility: both actions are semantic links with visible focus rings. The primary target is 52px on mobile and 64px from the small breakpoint. At 390x844, body `scrollWidth` equals `clientWidth`, the panel `scrollWidth` equals `clientWidth`, and both actions fit without clipping.
- Responsive test gap: the in-app browser returned correct 390x844 layout metrics but its screenshot command timed out at that temporary viewport. The desktop visual target and both desktop theme screenshots were captured successfully; this does not leave a target-fidelity issue.

comparison history:

- P1 low contrast: the proof used `text-foreground/55` and the secondary action used `/70` over a moving transparent hero background. Fix: introduced a translucent theme-native surface and raised text/border contrast to `/90`, `/95`, and `/60` equivalents.
- P2 weak product presence: transform scaling pushed the square transparent asset toward the edge and made it look smaller than the selected concept. Fix: switched the desktop image to object-cover within a measured right-side zone, preserving the complete visible product.
- P2 typography drift: the first implementation pass remained optically smaller than the selected concept. Fix: increased only the proof and action typography while preserving the existing font and compact component height.
- Post-fix evidence: the final full and focused comparison images show the same eyebrow → proof → actions hierarchy, similar CTA width, a stronger secondary affordance, and the product isolated on the right with no text collision.

primary interactions tested:

- `Відкрити каталог` navigates to `http://localhost:3000/ua/shop/catalog`; the catalog title resolves as `Каталог товарів | OneCompany`.
- `Підібрати деталь` navigates to `http://localhost:3000/ua/contact#selection-form`; the `#selection-form` target exists.
- Real light/dark theme switching was exercised through the header control; the page was restored to the user's original light theme afterward.
- Browser console after the final interaction pass: 0 errors.

verification:

- Focused ESLint for `src/app/[locale]/page.tsx`: passed.
- TypeScript: passed.
- `git diff --check` for the edited page: passed; line-ending notice only.
- Visual comparison: passed against the selected option at the live desktop viewport in both themes.

final result: passed

---

# Titanium Pressure Pulse loading reveal — 2026-07-18

source visual truth path:

- C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/call_h087OeFbNyX36BwBvJskIGqn.png

implementation screenshot path:

- blocked: the Codex in-app browser connection failed to initialize (`Cannot redefine property: process`); direct local Playwright capture still requires explicit user approval.

viewport and state:

- Intended desktop comparison: 1440x1024, Ukrainian `/ua`, initial reveal.
- Intended mobile comparison: 390x844, Ukrainian `/ua`, initial reveal.
- Light and dark themes both require capture.

full-view comparison evidence:

- Blocked until the local browser-rendered implementation can be captured.

focused region comparison evidence:

- The generated cold and energized exhaust assets were inspected directly and preserve the selected composition.
- Browser evidence is still required for the SVG logo, crossfade timing, responsive crop and theme treatment.

findings:

- The selected exhaust concept is implemented with separate 1600x900 cold and energized AVIF frames.
- Total new loading media weight is 139,859 bytes.
- The original SVG logo remains a separate sharp layer.
- Focused ESLint passes, `git diff --check` passes, and `/ua` returns HTTP 200.
- Visual comparison and console verification remain blocked by the browser connection.

final result: blocked

---

# Branded forged-wheel loading reveal — 2026-07-17

source visual truth path:

- C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/call_UkdY9aXKF73KynEulroaNq1z.png
- Logo material reference: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/call_8hMNee4MHP6HKYcROw2Hxtav.png

implementation screenshot path:

- blocked: the Codex in-app browser automation connection could not initialize, and direct local Playwright capture requires explicit user approval under the active browser workflow.

viewport and state:

- Intended desktop comparison: 1440x1024, Ukrainian `/ua`, first-load reveal, light and dark themes.
- Intended mobile comparison: 390x844, first-load reveal, light and dark themes.

full-view comparison evidence:

- Blocked until a browser-rendered implementation screenshot can be captured.

focused region comparison evidence:

- Blocked until the metallic logo sweep and progress treatment can be captured at native scale.

findings:

- Source implementation and optimized 11 KB AVIF wheel background are present.
- Focused ESLint passes for every edited TS/TSX file.
- The local `/ua` route responds with HTTP 200 and contains the branded reveal.
- Existing unrelated One AI V2 TypeScript errors remain outside this change.
- Visual fidelity, animation timing, theme matching, responsive crop, and console state still require browser capture.

final result: blocked

---

# Interactive car catalog picker design QA — 2026-07-16

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-9e143485-9b15-4fd0-8c75-00fae55c0483.png

implementation screenshot paths:

- D:/One Company/OneCompany/output/design-qa/interactive-car-catalog/desktop-poster.png
- D:/One Company/OneCompany/output/design-qa/interactive-car-catalog/desktop-3d.png
- D:/One Company/OneCompany/output/design-qa/interactive-car-catalog/mobile-poster.png
- D:/One Company/OneCompany/output/design-qa/interactive-car-catalog/comparison.png

viewport and state:

- Desktop: 1440x1000, Ukrainian `/ua/shop/catalog`, Auto scope, light theme, both poster and explicit 3D states.
- Mobile: 390x844, Ukrainian Auto scope, light theme, poster-first state.
- Moto: `/ua/shop/catalog?scope=moto`, where the car module is intentionally absent.

comparison evidence:

- The selected concept and final 3D implementation were placed side by side in `comparison.png` and reviewed together.
- The implementation retains the concept hierarchy: premium vehicle stage, six selectable vehicle zones, selected-zone product count, category action, existing filters, and real product grid.
- The implementation deliberately keeps the existing One Company typography, floating navigation, theme tokens, filters, and real catalog content instead of replacing the surrounding product design.

findings:

- No actionable P0/P1/P2 issue remains.
- Desktop becomes a true two-column vehicle/details layout at the large breakpoint; an invalid initial arbitrary grid value was corrected during QA.
- Mobile has no horizontal overflow (`scrollWidth` equals `clientWidth` at 390px), hides the small visual hotspots, and exposes the same six zones as touch-friendly category tiles.
- The poster uses a full-car contain treatment on mobile and a stronger editorial crop on desktop.
- Light and dark surfaces use the existing site theme; selection uses the active theme accent.
- The 3D canvas is not present in the initial page bundle. It loads only after the explicit “Увімкнути 3D” action, uses demand rendering, caps DPR at 1.5, and does not add post-processing or physics.
- The static poster bypasses Vercel Image Optimization transformations to avoid transformation charges.
- The local GLB is about 11.8 MB, cached as a static asset, and is only transferred after opt-in. Further mesh/texture compression is a future optimization, not a launch blocker for this concept branch.
- The six zone counts come from live catalog facets, and “Показати товари” updates the existing category filter, URL, result count, and products rather than opening a parallel catalog.

verification:

- TypeScript: passed.
- Focused ESLint: 0 errors; two existing non-blocking warnings in `stock/page.tsx` only.
- Browser: 3D activation, hotspot selection, category CTA, URL synchronization, desktop layout, mobile overflow, and Moto visibility all passed.
- Official Khronos CarConcept attribution is stored beside the model in `public/models/one-company-concept-car-LICENSE.md`.

final result: passed

---

# Homepage shop showcase — heading removal and dark CTA — 2026-07-16

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-4d35768a-24ed-4b7e-aa76-85154a65daff.png

source revision: user explicitly removed the `Все для авто та мото` heading and questioned whether a large red CTA suited the dark One Company theme.

implementation screenshot paths:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-no-heading-2026-07-16/mobile-light.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-no-heading-2026-07-16/mobile-dark.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-no-heading-2026-07-16/desktop-dark.png

viewport and state:

- Mobile: 390x844, Ukrainian `/ua`, light and dark themes, signed-out public state.
- Desktop: 1440x1000, Ukrainian `/ua`, dark theme, signed-out public state.

full-view comparison evidence:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-no-heading-2026-07-16/light-vs-dark.png
- Both theme states are normalized to 390x844 and compared side by side after the heading removal and CTA token change.

focused region comparison evidence:

- No separate crop is required because the shop block, CTA typography, product asset, secondary link, Auto card, and mobile navigation are all readable at native 390px scale.

findings:

- No actionable P0/P1/P2 issue remains.
- Fonts and typography: the removed heading is absent from both the visible render and accessibility tree. Remaining copy uses the established One Company typography and retains clear eyebrow, proof, action hierarchy.
- Spacing and layout rhythm: the showcase was reduced from 284px to 240px on mobile and from 340px to 300px on desktop, preventing an empty gap after the heading removal. Auto content moves higher in the first viewport without colliding with the bottom navigation.
- Colors and visual tokens: the light theme keeps the red conversion CTA. The dark theme uses a white surface, black label/arrow, no red shadow, and retains red only as a small brand accent in the eyebrow and secondary arrow.
- Image quality and asset fidelity: the official transparent Akrapovič product remains legible in both themes and does not introduce an opaque plate.
- Copy and content: `Все для авто та мото` has been removed exactly as requested. The useful proof statement, catalog action, and fitment action remain.
- Accessibility: the primary CTA preserves a minimum 48px mobile target, visible contrast in both themes, semantic link behavior, and focus rings.
- P3: the dark CTA intentionally has stronger white contrast than the surrounding outline controls; this is appropriate for the sole primary conversion action.

comparison history:

- P1 user concern: a large saturated red CTA felt too aggressive inside the monochrome dark theme. Fix: changed only the dark state to a white/black CTA and removed its red shadow; the light state stays red for conversion clarity.
- P2 user-requested content removal: removing the main heading without reflow would leave excessive empty height. Fix: reduced theme-neutral showcase heights and rebalanced vertical margins.
- Post-fix evidence: `light-vs-dark.png` and `desktop-dark.png` show the heading absent, compact geometry, no clipping, and a dark-theme CTA aligned with the site's monochrome design language.

primary interactions tested:

- `Відкрити каталог` remains a semantic link to `/ua/shop/catalog`.
- `Підібрати деталь` remains a semantic link to `/ua/contact#selection-form`.
- Theme switching was exercised through the real mobile control.
- Browser console after final captures: 0 errors; one existing development warning only.

verification:

- TypeScript: passed.
- Focused ESLint for `src/app/[locale]/page.tsx`: passed with 0 errors.
- `git diff --check`: passed; line-ending notices only.
- Visual comparison: passed at 390x844 and reviewed at 1440x1000.

final result: passed

---

# Homepage shop showcase — transparent theme revision — 2026-07-16

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-4d35768a-24ed-4b7e-aa76-85154a65daff.png

source revision: user requested the existing One Company typography and a transparent, theme-native showcase background instead of the selected concept's fixed black panel.

implementation screenshot paths:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-transparent-2026-07-16/mobile-light.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-transparent-2026-07-16/mobile-dark.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-transparent-2026-07-16/desktop-light.png

viewport and state:

- Mobile: 390x844, Ukrainian `/ua`, both light and dark themes, signed-out public state, menu closed.
- Desktop: 1440x1000, Ukrainian `/ua`, light theme, signed-out public state.

full-view comparison evidence:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-transparent-2026-07-16/reference-vs-light.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-transparent-2026-07-16/light-vs-dark.png
- The original selected concept, the user-directed transparent revision, and both theme states are normalized to 390x844 and visually compared side by side.

focused region comparison evidence:

- A separate crop is not needed because the 390px comparisons keep the complete showcase, heading weight, CTA label, transparent product asset, border, and first Auto card readable at native scale.

findings:

- No actionable P0/P1/P2 issue remains.
- Fonts and typography: the showcase now uses the site's existing Unbounded display stack with the established light headline weight, tight tracking, and locale-aware body/button size tokens. The heavy concept-only headline treatment was removed.
- Spacing and layout rhythm: the 284px mobile and 340px desktop proportions remain unchanged, preserving the first-viewport visibility of the Auto card and mobile navigation. The lighter typography introduces more breathing room without changing the content order.
- Colors and visual tokens: the showcase surface is `bg-transparent`; foreground, muted text, border, focus offsets, and secondary action now use semantic theme tokens. Only the One Company conversion red remains fixed.
- Image quality and asset fidelity: the square-backed do88 photograph was replaced by the existing official Akrapovič transparent exhaust PNG. It floats over the page background in both themes without a black or grey rectangular plate. Mobile opacity is intentionally lower to keep text legible.
- Copy and content: the unified-shop copy and destinations are unchanged.
- Accessibility: both actions remain semantic links with visible focus states and a 48px minimum mobile primary target. The product image remains decorative with an empty alt and `aria-hidden`.
- P3: the transparent product is intentionally subtle on mobile; increasing its opacity would improve product prominence but would reduce copy contrast.

comparison history:

- P1 user-reported mismatch: the showcase used a fixed `#070708` surface and therefore looked like a foreign black slab in the light theme. Fix: removed the fixed surface, black veil, and black directional shadow; moved all text and borders to semantic theme tokens.
- P2 user-reported typography drift: the heading and small UI labels used heavier concept-specific weights. Fix: restored the existing One Company Unbounded stack with `font-light` for the headline, `font-medium` for labels, and shared typography tokens for body/button copy.
- P2 post-fix image artifact: retaining the square-backed intake photograph left a visible grey rectangle on the transparent light surface. Fix: replaced it with an existing official transparent product asset and tuned theme-responsive opacity.
- Post-fix evidence: `reference-vs-light.png`, `light-vs-dark.png`, and `desktop-light.png` show no opaque showcase plate, no image background rectangle, no clipped text, and consistent typography across themes.

primary interactions tested:

- `Відкрити каталог` still resolves to `/ua/shop/catalog`.
- `Підібрати деталь` still resolves to `/ua/contact#selection-form`.
- Theme switching was exercised through the real mobile and desktop theme controls.
- Browser console after final light/dark captures: 0 errors; one existing development warning only.

verification:

- TypeScript: passed.
- Focused ESLint for `src/app/[locale]/page.tsx`: passed with 0 errors.
- `git diff --check`: passed; line-ending notices only.
- Visual comparison: passed at 390x844 and reviewed at 1440x1000.

final result: passed

---

# Homepage unified-shop showcase — 2026-07-16

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-4d35768a-24ed-4b7e-aa76-85154a65daff.png

implementation screenshot paths:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-2026-07-16/implementation-mobile.png
- D:/One Company/OneCompany/output/playwright/home-shop-showcase-2026-07-16/implementation-desktop.png

viewport and state:

- Mobile: 390x844, Ukrainian `/ua`, dark theme, signed-out public state, cookie banner dismissed.
- Desktop: 1440x1000, Ukrainian `/ua`, dark theme, signed-out public state.

full-view comparison evidence:

- D:/One Company/OneCompany/output/playwright/home-shop-showcase-2026-07-16/qa-side-by-side.png
- The selected concept and the final implementation are normalized to the same 390x844 viewport and compared side by side.
- No separate crop is needed: the full 390px render keeps the complete shop block, CTA typography, image treatment, and the beginning of the Auto card readable at native scale.

findings:

- No actionable P0/P1/P2 issue remains.
- The selected concept's hierarchy is preserved: compact brand badge, red shop eyebrow, one unified-shop headline, brand/collection proof, dominant red catalog CTA, and a secondary fitment action.
- Mobile uses a 284px showcase so the shop transition and the existing Auto card remain visible in the first viewport. Desktop expands the same component into a 340px editorial product showcase without changing its information architecture.
- The official existing do88 intake photograph replaces the concept-only product render, preserving the site's real-brand imagery rule while retaining the same dark carbon/red-filter visual role.
- The implementation keeps the established One Company display typography, black surfaces, thin neutral borders, red conversion accent, header, Auto/Moto content, and persistent mobile navigation.
- The copy consistently presents one shop: `Магазин One Company`, `Все для авто та мото`, `200+ брендів · 15 фірмових колекцій`.
- Responsive behavior is intentional rather than a scaled desktop block: CTA sizing, typography, content width, image crop, and vertical rhythm tighten below 640px.
- Accessibility: both actions are semantic links with visible focus states; the primary mobile target is 48px high; the photograph is decorative and hidden from assistive technology.
- P3: the exact photographed component and crop differ from the generated concept because the implementation uses an official product asset already approved for the live brand system.

comparison history:

- Initial P1: the theme `primary` token rendered the catalog CTA white in this dark section. Fix: pinned the conversion action to One Company red (`#d5001c`) with a darker hover state.
- Initial P2: the first mobile pass used a 330px showcase, a 28px title, and a 240px CTA, pushing too much of the existing homepage below the fold. Fix: reduced the showcase to 284px, title to 24px, CTA to 210px, and tightened the badge/section rhythm.
- Final comparison confirms the shop block, Auto card, and bottom navigation all coexist cleanly at 390x844 with no clipped text or horizontal overflow.

primary interactions tested:

- `Відкрити каталог` navigates to `/ua/shop/catalog` and loads the unified catalog page.
- `Підібрати деталь` navigates to `/ua/contact#selection-form` and loads the fitment/contact form state.
- Browser console after both navigations: 0 errors; one existing development warning only.

verification:

- TypeScript: passed.
- Focused ESLint for `src/app/[locale]/page.tsx`: passed with 0 errors.
- `git diff --check`: passed; line-ending notices only.
- Visual comparison: passed at 390x844 and reviewed separately at 1440x1000.

final result: passed

---

# Homepage shop entry and performance design QA

source visual truth path: C:/Users/sascy/AppData/Local/Temp/codex-clipboard-b0384b7b-6ca6-4f59-b64c-d8e2c64ec786.png

implementation screenshot paths:

- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/08-desktop-optimized-images.png
- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/09-mobile-optimized-images.png
- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/10-desktop-dark-theme.png
- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/04-mobile-after.png

viewport:

- Desktop: 1280x720.
- Mobile comparison: 390x844.
- Final optimized mobile render: 390x720, with additional geometry checks at 360x800 and 390x844.

state: Ukrainian `/ua`, signed-out public state, light and dark themes, quick shop actions visible, existing Auto/Moto content preserved.

full-view comparison evidence:

- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/05-source-vs-mobile-after.jpg
- The source and implementation are normalized to the same 390x844 viewport.
- The source concept is used for the two-action hierarchy and mobile navigation direction. The implementation intentionally retains the real homepage badge, Auto/Moto cards, copy, photos, header, and content order because the user explicitly rejected replacing existing content.

focused region comparison evidence:

- D:/One Company/OneCompany/artifacts/home-shop-entry-2026-07-13/06-actions-source-vs-after.jpg
- The focused crop compares the red shop action and light vehicle-finder action at readable size. Button proportions, red/neutral hierarchy, icon weight, two-line Ukrainian wrapping, and spacing are visibly aligned.

findings:

- No actionable P0/P1/P2 issue remains.
- Fonts and typography: the existing One Company display font remains unchanged. Both actions use compact uppercase labels with controlled tracking and two-line mobile wrapping; neither label overflows at 360px or 390px.
- Spacing and layout rhythm: the actions sit between the existing badge/H1 and Auto/Moto cards, avoiding nested links or image overlap. Desktop uses a centered 3xl-width action row; mobile keeps both actions in one compact row, matching the selected concept.
- Colors and visual tokens: the shop action uses fixed One Company red in both themes; the finder action uses the same warm white family as the header and mobile bottom navigation. Dark-theme parity is visible in `10-desktop-dark-theme.png`.
- Image quality and asset fidelity: the four real homepage source images remain the visual truth. They were encoded as four local WebP variants totaling 139,200 bytes instead of 6,752,616 bytes of PNG source data, with no visible crop or sharpness regression in the final desktop and mobile captures. No generated or placeholder image was introduced.
- Copy and content: no existing homepage headline, description, statistic, image, or destination was replaced. New copy is limited to `Перейти в магазин` and `Підбір за авто / мото`, with localized English equivalents.
- Icons: ArrowRight and SlidersHorizontal come from the installed Lucide family and match the site’s existing navigation stroke treatment.
- Responsiveness: measured document overflow is zero at 360, 768, 1024, and 1440px. At 360px the action widths are 171px and 149px, both 56px high; their `scrollWidth` equals `clientWidth`.
- Accessibility: the action pair is a labelled semantic `nav`; both destinations are real links with visible focus rings. Mobile targets are at least 56px high. The finder anchor resolves to `#selection-form`, which was measured 76px below the viewport top after navigation.
- P3: Framer Motion still emits an existing non-blocking development warning about scroll-container positioning in the lower `StickyScroll` section. It does not affect the hero actions or navigation.

comparison history:

- Initial P1 usability gap: the current homepage had no visible above-the-fold shop action. Evidence: `01-desktop-before.png` and `02-mobile-before.png`.
- Fix: added a server-rendered two-action row before the untouched Auto/Moto cards and disabled automatic route prefetch for both actions and the two heavy experience links.
- Post-fix evidence: `03-desktop-after.png`, `04-mobile-after.png`, `05-source-vs-mobile-after.jpg`, and `06-actions-source-vs-after.jpg`.
- Initial P2 theme drift: the first implementation used the semantic `primary` token, which becomes white in the dark theme and removed the intended red conversion hierarchy. Evidence: `10a-desktop-dark-primary-before-fix.png`.
- Fix: pinned the primary action to One Company red (`#d5001c`) with a darker red hover state while retaining semantic focus-ring behavior.
- Post-fix evidence: `10-desktop-dark-theme.png`; the shop action remains red and the finder action remains neutral.

primary interactions tested:

- `Перейти в магазин` navigates to `/ua/shop`.
- `Підбір за авто / мото` navigates to `/ua/contact#selection-form`; the target exists and receives the intended scroll offset.
- Existing Auto and Moto card routes remain `/ua/auto` and `/ua/moto`.
- Existing mobile bottom navigation remains visible in the mobile DOM and its shop/finder destinations are unchanged.
- Light/dark theme switching keeps both actions readable and visually distinct.
- `/ua/shop`, `/ua/shop/catalog`, and `/ua/shop/stock` render after moving the auth provider into the shop layout.
- Browser console errors checked after the final pass: none.

performance verification:

- The 2.5-second global loading overlay is no longer mounted, so the real page is visible immediately.
- Anonymous homepage reloads no longer request `/api/auth/session`; the session provider and currency preference sync now live inside the shop layout.
- The global Lenis/GSAP smooth-scroll bootstrap is no longer mounted on every localized page.
- Hero video no longer starts on pointer, touch, or keyboard interaction before link navigation; it starts only after page scroll.
- Four Next Image hero preloads/transformations were removed. The final homepage exposes only the two existing logo preloads and serves pre-encoded local WebP hero assets.
- Hidden structural navigation and above-the-fold heavy destinations use `prefetch={false}`.

verification:

- TypeScript: passed.
- Focused ESLint: passed with 0 errors.
- Navigation/catalog unit tests: 8/8 passed.
- Translation JSON parsing: passed.

final result: passed

---

# Catalog premium vehicle icons and theme-aware hero — 2026-07-13

source visual truth path: D:/One Company/OneCompany/artifacts/catalog-option-1-implementation-2026-07-13/desktop-1280x720-final-v2.png

generated source asset paths:

- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/hero-light-source.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/hero-dark-source.png

implementation screenshot paths:

- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/desktop-light-final.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/desktop-dark-final.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/mobile-light-390x844.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/mobile-dark-390x844.png

viewport and state:

- Desktop: 1265x712, Ukrainian `/ua/shop/catalog?scope=moto`, settled Moto catalog, grid view.
- Mobile: 390x844, the same Moto scope with the compact finder and bottom navigation visible.
- Both light and dark themes were tested through the real theme toggle.

full-view comparison evidence:

- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/comparison-reference-vs-light.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/comparison-light-vs-dark.png
- D:/One Company/OneCompany/artifacts/catalog-theme-hero-2026-07-13/comparison-mobile-light-vs-dark.png
- The selected reference and final implementation were opened together at matched desktop geometry. The catalog hierarchy, copy, real product data, finder, filters, and toolbar remain unchanged.

focused region comparison evidence:

- The desktop light/dark comparison verifies identical subject placement, title geometry, search-panel overlap, and Auto/Moto control geometry across themes.
- The mobile light/dark comparison verifies the 390px crop, title legibility, compact finder overlap, and bottom-navigation clearance.

findings:

- No actionable P0/P1/P2 issue remains.
- The old dark-only engine photograph was replaced with one compositionally identical light/dark pair: titanium headers, a compact turbocharger, forged wheel detail, and carbon fibre. The neutral performance-parts subject represents both Auto and Moto instead of visually privileging one scope.
- The new hero preserves the existing One Company layout and typography. Only the media, theme overlay, and foreground color tokens changed.
- The light theme uses a pearl/stone studio and dark semantic copy; the dark theme uses a graphite studio and white copy. Theme changes do not alter layout or require a client-mounted theme branch.
- Auto and Moto now use the matching Phosphor Core 2.1.1 `CarProfile` and `Motorcycle` duotone SVGs. The SVGs are rendered as `currentColor` masks, so active, inactive, light, and dark states remain consistent without another React dependency.
- The premium SVG treatment is used everywhere the mode icon appears: desktop switch, mobile filter sheet, vehicle fields, selected-vehicle summary, and Moto scope chip.
- Accessibility remains intact: SVG masks are decorative, mode buttons retain their readable labels and `aria-pressed` states, and no text was moved into an image.

comparison history:

- P2 visual mismatch: the original hero was dark in both themes and read as a heavy black slab in the light catalog. Fix: generated and integrated a compositionally matched light/dark pair selected by the root `.dark` class.
- P2 scope imbalance: the original engine-only crop leaned strongly toward Auto while the verified state was Moto. Fix: used neutral premium performance hardware shared by both catalogs.
- P2 icon language: the original front-car outline and generic bicycle-style Moto icon had mismatched silhouettes and low visual presence. Fix: replaced both with a coherent side-profile duotone pair and a subtle framed treatment in the primary switches.
- P2 LCP delay: the hero previously entered from `opacity: 0` after hydration. Fix: the hero is now static on first paint.

primary interactions tested:

- Light-to-dark theme switching changes the hero asset and text treatment while retaining the exact section geometry.
- The Moto mode remains selected after reload and still resolves 404 Moto products.
- The desktop and mobile finder controls, filters, sort, grid/list buttons, and bottom navigation remain visible in their existing positions.
- Final browser console check: no errors or warnings from the new hero or SVG implementation.

performance verification:

- Final WebP assets are 1942x809: 93,976 bytes for light and 86,152 bytes for dark.
- The generated PNG sources remain in QA artifacts; only the optimized WebP pair is used by the site.
- CSS theme selection avoids rendering two priority `next/image` instances and therefore avoids Vercel Image Optimization transformations for the hero.
- Versioned assets live under `/images`, which already receives the project's one-year immutable cache header.
- The two SVG masks are 683 and 926 bytes, also under `/images`, and add no icon-library runtime dependency.

image generation record:

- Mode: generated light product-mockup hero, then image edit for an exact dark-theme companion.
- Prompt intent: ultra-wide luxury editorial performance-hardware still life, subject on the right, clean left text-safe zone, realistic titanium/carbon materials, no brands, text, people, or vehicles. The dark edit preserved camera, crop, geometry, and subject placement while changing only the gallery backdrop and lighting.

verification:

- TypeScript: passed.
- Focused ESLint: 0 errors; two existing non-blocking warnings only.
- Catalog route and vehicle-scope tests: 6/6 passed.
- `git diff --check`: passed; line-ending notices only.

final result: passed

---

# Catalog Auto/Moto vehicle icon refinement — 2026-07-17

source visual truth path:

- C:/Users/sascy/AppData/Local/Temp/codex-clipboard-e01e6573-4054-452c-86d5-41575feee964.png

implementation screenshot path:

- D:/One Company/OneCompany/tmp/design-qa/vehicle-icons/mobile-filter-outline.png

viewport and state:

- 390x844, Ukrainian `/ua/shop/catalog`, light theme, mobile filter sheet open, Auto selected.

full-view comparison evidence:

- D:/One Company/OneCompany/tmp/design-qa/vehicle-icons/before-vs-outline.png
- The supplied screenshot and the final implementation crop are stacked at the same 376px width.

focused region comparison evidence:

- The full comparison is already a focused crop of the complete Auto/Moto control, keeping icon edges, frame, labels, selected state, and inactive state readable at native scale.

findings:

- No actionable P0/P1/P2 issue remains.
- Typography and copy are unchanged; the existing uppercase labels and spacing remain aligned.
- The icon frames grew from 28px to 32px and the useful icon area from 18px to 20px without changing the 48px switch height.
- The official Tabler outline pair uses one 24px grid, 2px stroke, rounded joins, and matching side-view silhouettes. Auto and Moto now have equal optical weight.
- Existing semantic colors remain intact: selected icons inherit the background color against the foreground surface, while inactive icons inherit muted foreground.
- The icons remain decorative masks, so button labels and `aria-pressed` continue to carry meaning for assistive technology.
- No raster image, generated approximation, emoji, or handcrafted code drawing was introduced.

comparison history:

- P2 initial state: the 256px duotone source icons collapsed poorly at 18px, producing inconsistent silhouettes and weak Moto recognition.
- First fix tested: official Tabler filled icons at 20px improved legibility but became visually heavy and toy-like inside the compact switch.
- Final fix: replaced the filled test with the official Tabler outline `car` and `motorbike` pair, retained the larger 20px size, and normalized both icon frames to 32px.
- Post-fix evidence: `before-vs-outline.png` shows cleaner edges, a more recognizable motorcycle, and consistent stroke weight in selected and inactive states.

primary interactions tested:

- The mobile filter sheet opens from the real catalog control.
- Auto remains selected with `aria-pressed`; Moto remains available as the adjacent mode.
- Browser console after the final render: 0 errors.

verification:

- Focused Prettier: passed.
- Focused ESLint: 0 errors; two unrelated existing warnings remain in the large catalog page.
- `git diff --check`: passed; line-ending notice only.

final result: passed

---

# Homepage forged-wheel shop showcase — 2026-07-17

source visual truth:

- Selected layout concept: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/call_Ydy2CbClNgbjodNHMSJSxs6K.png
- Real One Company wheel references:
  - C:/Users/sascy/AppData/Local/Temp/codex-clipboard-78eb4d0b-65a7-4ee9-9968-549b29ae638e.jpg
  - C:/Users/sascy/AppData/Local/Temp/codex-clipboard-6b5410b4-e916-484e-82f3-4189b37b8a8d.jpg

implementation screenshot paths:

- D:/One Company/OneCompany/tmp/design-qa/forged-wheel-polish/desktop-light.png
- D:/One Company/OneCompany/tmp/design-qa/forged-wheel-polish/desktop-dark.png
- D:/One Company/OneCompany/tmp/design-qa/forged-wheel-polish/mobile-light.png
- D:/One Company/OneCompany/tmp/design-qa/forged-wheel-polish/mobile-dark.png

viewport and state:

- Desktop: 1440x900, Ukrainian `/ua`, signed-out public state, light and dark themes.
- Mobile: 390x844, Ukrainian `/ua`, light and dark themes, bottom navigation visible.

full-view comparison evidence:

- D:/One Company/OneCompany/tmp/design-qa/forged-wheel-polish/source-vs-polished.png
- The selected concept and the live implementation are combined in one comparison image. The implementation keeps the concept's compact split-card hierarchy while replacing the generic exhaust visual with the user's real One Company forged-wheel design.

focused comparison evidence:

- A separate crop is not needed: the combined comparison keeps the complete shop panel, both actions, wheel treatment, header rhythm, and first content transition readable together.

findings:

- No actionable P0/P1/P2 issue remains.
- The desktop block is intentionally compact at 210px so it introduces the unified shop without displacing the existing Auto/Moto content.
- The light and dark assets share the same camera, wheel geometry, One Company center cap, and blue caliper; only the studio environment changes to match the active theme.
- Mobile uses the wheel as a restrained background treatment with a theme-aware gradient. Text, primary CTA, and secondary action remain readable at 390px with no horizontal clipping.
- Entrance motion is progressive: the panel lifts and fades in, the wheel settles from the right with a slight scale reduction, and content follows with a short stagger. Motion runs once and is removed when `prefers-reduced-motion` is enabled.
- The catalog and fitment actions remain semantic links to `/ua/shop/catalog` and `/ua/contact#selection-form`.
- The browser console contained 0 errors after light/dark and responsive checks.

comparison history:

- The previous exhaust asset looked cropped and generic. It was replaced with a generated, cleaned theme pair grounded in the user's real forged-wheel photographs.
- The previous oversized presentation was reduced to a compact split panel. Desktop and mobile now keep the next Auto/Moto content visible in the first viewport.
- Mobile media was changed from a hard right-side crop to a low-contrast full-panel background, preserving product identity without competing with the CTA.
- P2 polish pass: the desktop media still entered through a visible vertical seam and felt like a separate image tile. Fix: moved the media boundary left, removed the divider, and introduced a responsive alpha-mask transition so the studio background dissolves into the card.
- P3 motion pass: lengthened the wheel settle to 1.05s, increased its initial horizontal offset slightly, delayed the copy to create a clear image-then-content cadence, and softened hover movement to a slow 1.8% scale.
- Post-fix evidence: `source-vs-polished.png` shows the final continuous surface, intact CTA hierarchy, deliberate close wheel crop, and unchanged compact section height.

verification:

- Focused Prettier: passed.
- Focused ESLint: passed.
- TypeScript still reports only pre-existing unrelated One AI V2 environment/test-target errors.
- Visual comparison: passed at 1440x900 and 390x844 in both themes.

final result: passed

---

# Unified catalog option 1 design QA — 2026-07-13

source visual truth path: C:/Users/sascy/.codex/generated_images/019f5a61-4f2f-7fd0-8308-13b53c1b962e/exec-3ed5203e-58ef-4ff7-b58e-6c1511146ade.png

implementation screenshot paths:

- D:/One Company/OneCompany/artifacts/catalog-option-1-implementation-2026-07-13/desktop-1280x720-final-v2.png
- D:/One Company/OneCompany/artifacts/catalog-option-1-implementation-2026-07-13/mobile-390x720-final-v2.png
- D:/One Company/OneCompany/artifacts/catalog-option-1-implementation-2026-07-13/mobile-390x720-filters-final-v2.png
- D:/One Company/OneCompany/artifacts/catalog-option-1-implementation-2026-07-13/mobile-390x720-filters-moto-final.png

viewport and state:

- Desktop: 1280x720, Ukrainian `/ua/shop/catalog`, Auto scope, grid view, light theme.
- Mobile: 390x720, Auto scope with the compact finder collapsed and the bottom navigation visible.
- Mobile filter state: 390x720 bottom sheet in both Auto and Moto scopes.
- Moto verification state: `/ua/shop/catalog?scope=moto`, 404 scoped products, no Auto count or Auto products exposed during the switch.

full-view comparison evidence:

- The selected reference and `desktop-1280x720-final-v2.png` were opened together in the same visual comparison input after the final implementation pass.
- The implementation preserves the reference hierarchy: edge-to-edge turbo hero, overlapping search command surface, Auto/Moto switch, vehicle fitment row, compact filter rail, result toolbar, and three-column product grid.
- The real implementation intentionally reports 14,588 Auto products instead of the reference's combined 14,992 count because the selected Auto tab is now an authoritative catalog scope; Moto owns the remaining 404 products.

focused region comparison evidence:

- `mobile-390x720-filters-final-v2.png` verifies the bottom-sheet geometry, sticky result action, legible vehicle fields, category search, and safe-area behavior.
- `mobile-390x720-filters-moto-final.png` verifies dynamic Moto labels and 404-only counts in the same filter surface.
- `desktop-1280x720-final-v2.png` verifies that the One AI launcher is inline with sort/view controls and no longer covers a product card.

findings:

- No actionable P0/P1/P2 issue remains.
- Typography, color, border, radius, and spacing continue to use the existing One Company tokens and real content; the concept did not replace the brand language.
- Desktop hierarchy matches the chosen option while adapting to the real 1280x720 browser viewport and the site's existing floating header.
- Mobile keeps the approved bottom navigation, compact finder, full-width sort row, and a 92dvh filter sheet without clipped fields or product overlap.
- Auto and Moto are real data scopes across search, fitment, suggestions, URL state, One AI, manager handoff, and reset behavior.
- Compatibility language remains honest: product cards request verification when fitment is not confirmed and never label fallback results as confirmed fits.
- Accessibility: the filter sheet, make picker, and One AI dialog trap focus, close with Escape, restore focus, lock mobile body scroll, and expose dialog semantics. One AI is available from the toolbar at mobile, tablet, and desktop widths.
- Performance/cost: raw lazy product images avoid Vercel Image Optimization transformations; hidden legacy filter DOM was removed; suggestions call the API only while the search field is focused; mode changes abort stale requests and cached scoped searches are reused for 45 seconds.

comparison history:

- P1: the first catalog implementation could briefly show Auto cards, facets, and immediate suggestions after switching to Moto. Fix: scope-dependent state is invalidated immediately, stale requests are aborted, and the new scoped search bypasses the normal 600ms debounce.
- P1: One AI initially omitted the catalog scope and could return Auto products from Moto. Fix: scope is authoritative in planner context, search URLs, storefront links, copy, and manager handoff.
- P1: One AI's same-path catalog link could update the URL without updating client state. Fix: the CTA now performs an explicit same-origin navigation after persisting the AI filter marker.
- P1: the assistant launcher was hidden below 1024px. Fix: it now participates in the responsive result toolbar without floating over product cards.
- P2: the initial mobile sheet clipped lower controls and some Moto labels. Fix: the sheet uses 92dvh, sticky actions, stable render functions, and dynamic vehicle copy.
- P2: One AI lacked modal focus behavior and listened for Escape while closed. Fix: added `aria-modal`, scoped Escape handling, focus trap, autofocus, and focus restoration.
- P2: the suggestion effect repeated `/suggest` calls after unrelated result/facet changes. Fix: local immediate suggestions and remote focused suggestions are separated, so result reconciliation does not trigger another Function Invocation.
- P2: a complete legacy search/filter form remained mounted inside a hidden wrapper. Fix: removed the dead DOM block while preserving all active drawer, hero, and catalog controls.

primary interactions tested:

- Auto → Moto switches the URL to `?scope=moto`, removes the 14,588 Auto state immediately, and settles at 404 Moto products.
- Mobile filter sheet opens above the bottom navigation, traps focus, closes with Escape, and restores focus to its trigger.
- Moto make picker opens with Moto copy and scoped makes.
- Grid/list controls do not trigger another product search.
- One AI opens on mobile, receives `aria-modal=true`, focuses inside the dialog, closes with Escape, and restores focus to its launcher.
- Browser console check after the final pass contains no runtime errors or warnings; only development Fast Refresh, React DevTools, and disabled local Web Analytics messages appear.

verification:

- TypeScript: passed.
- Focused ESLint: 0 errors; existing non-blocking warnings only.
- Targeted catalog, navigation, scope, suggestion, routing, AI planner, and AI conversation tests: 65/65 passed.
- `git diff --check`: passed; line-ending notices only.

final result: passed
