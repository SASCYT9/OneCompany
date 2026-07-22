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

# Design QA — production dark catalog and Operations activation

- Source visual truth: `C:/Users/sascy/AppData/Local/Temp/codex-clipboard-127ea10f-3c97-4d25-96d2-29869da669a1.png`
- Catalog implementation screenshot: `C:/Users/sascy/.codex/visualizations/2026/07/19/019f7b8b-495b-7a02-9824-3b723fe063be/production-hotfix/catalog-dark-after.png`
- Combined comparison: `C:/Users/sascy/.codex/visualizations/2026/07/19/019f7b8b-495b-7a02-9824-3b723fe063be/production-hotfix/catalog-dark-comparison.png`
- Operations implementation screenshot: `C:/Users/sascy/.codex/visualizations/2026/07/19/019f7b8b-495b-7a02-9824-3b723fe063be/production-hotfix/ops-production-after.png`
- Source pixels: 1533 × 693; catalog implementation pixels/CSS viewport: 3440 × 1519 at device scale 1.
- Comparison normalization: both catalog captures scaled to 1533 px width on a shared canvas; no crop or density-only finding was filed.
- Routes: `https://onecompany.global/ua/shop` and `https://onecompany.global/admin/operations`
- State: production, authenticated admin, desktop, dark storefront; Operations light workspace inside the existing dark admin shell.

## Full-view comparison evidence

The catalog layout, typography, spacing, imagery, controls, copy, and dark palette remain unchanged outside the native select theme correction. The Operations production capture shows the permission-aware `Работа` navigation and a rendered `Обзор работы` page rather than the prior server error.

## Focused region comparison evidence

The supplied source shows a Windows/Chrome native category popup rendered white while inheriting near-white option text. The deployed select now computes to `color-scheme: dark`; every inspected option computes to `rgb(250, 250, 250)` text on `rgb(5, 5, 5)` background. The supported browser API cannot keep an operating-system native select popup open for capture, so focused verification combines the shared visual canvas, computed production styles, and the regression contract in `tests/shop/unit/shopCatalogQuickSearchTheme.test.ts`.

## Findings

- No actionable P0, P1, or P2 findings remain in the requested scope.
- Fonts and typography: unchanged from the existing storefront/admin systems.
- Spacing and layout rhythm: unchanged; no new overflow, crop, radius, or alignment regression is visible.
- Colors and visual tokens: native selects and options now use a dark color scheme with explicit foreground/background tokens; contrast is no longer dependent on the browser's light popup default.
- Image quality and asset fidelity: existing product and brand assets are unchanged and remain sharp at the tested viewport.
- Copy and content: unchanged, except the already-implemented Russian Operations labels now appear in production.
- Primary interactions tested: authenticated Operations route load, permission-aware navigation render, production catalog select token resolution.
- Console/runtime errors: no new browser error boundary; no Vercel HTTP 500 logs after the production verification request.

## Comparison history

- Earlier P1: white native select popup with nearly white option labels in dark mode.
- Fix: added light/dark `color-scheme` plus explicit option/optgroup background and foreground tokens.
- Post-fix evidence: production computed styles resolve the select and options to the dark palette; focused tests pass.
- Earlier P0: Operations menu was feature-flagged off and enabling it exposed Prisma direct-connection exhaustion.
- Fix: enabled only the Ops UI, moved runtime traffic to Prisma Postgres pooled TCP, retained `DIRECT_URL` for migrations, and reused one Prisma client per warm isolate.
- Post-fix evidence: authenticated `/admin/operations` renders successfully and the new deployment has no HTTP 500 log entries after verification.

## Follow-up polish

- Manually open one native select on each supported desktop OS during the next cross-browser regression pass; native popup chrome is operating-system controlled.

final result: passed

---

# Design QA — One Company Operations workspace

- Desktop source visual truth: `C:/Users/sascy/.codex/generated_images/019f7b8b-495b-7a02-9824-3b723fe063be/call_drp3vXPXAjYBMyTb9ave5c7M.png`
- Mobile list source visual truth: `C:/Users/sascy/.codex/generated_images/019f7b8b-495b-7a02-9824-3b723fe063be/call_9HfJLMvXZuGJw2lnVNh7Fyvx.png`
- Mobile detail source visual truth: `C:/Users/sascy/.codex/generated_images/019f7b8b-495b-7a02-9824-3b723fe063be/call_ATad6k9OdjdkTdx6smFmgi6C.png`
- Route: `http://127.0.0.1:3000/admin/operations/tasks`
- Intended states: desktop split task workspace; mobile task list; mobile task detail

## Implemented visual contract

- The Operations workspace is scoped to the existing admin shell; it does not create a second site or restyle legacy commerce screens.
- Desktop uses a dark admin navigation frame, light working surface, task list/detail split, and list/board/calendar views.
- Mobile defaults to `Мои / Сегодня / Все`, uses a permission-aware bottom navigation, opens task detail as a separate route, and keeps safe-area actions sticky.
- Kanban is a desktop enhancement with pointer and keyboard sensors; mobile is not forced into compressed horizontal columns.
- Audio uses `preload="none"` and the transcript starts collapsed.
- Colors are isolated in Operations/admin theme tokens rather than treated as fixed source-image values.

## Static and interaction verification completed

- Operations pages are server-guarded by the same feature flag and current-database permission checks as their APIs.
- Navigation, mobile destinations, Inbox review actions, task transitions, comments, editing, knowledge links, and private attachment access have focused source/integration tests.
- Responsive classes cover compact mobile layouts, `sm`, `md`, `lg`, and wide desktop states; sticky controls include `env(safe-area-inset-bottom)`.
- No placeholder task action or blocker text is fabricated during a mutation.
- Focused TypeScript, ESLint, UI/RBAC, and Operations tests pass.

## Visual comparison blocker

The in-app browser initially opened the admin and Operations routes, but the browser URL safety policy then blocked further reads/reloads. That policy explicitly prohibits retries or switching to another browser, so no compliant post-implementation screenshot or side-by-side comparison could be produced in this turn.

Required staging acceptance remains:

- Capture and compare the same states at 360, 390, 768, and 1440 px.
- Check typography, spacing, wrapping, horizontal overflow, sticky safe-area actions, board scrolling, drag keyboard announcements, and task-detail focus order.
- Verify the light Operations surface inside the dark existing admin shell with real Russian data, long titles, empty states, and error states.
- Re-run the source/prototype side-by-side comparison and resolve every visible P0/P1/P2 issue before production rollout.

final result: blocked — visual browser comparison must be completed in staging; implementation and source-level checks are complete

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
