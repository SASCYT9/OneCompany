# Design QA — Operations task board, variant 3

## Evidence

- Source visual truth: `C:\Users\sascy\.codex\generated_images\019f7b8b-495b-7a02-9824-3b723fe063be\exec-f0b83314-a2eb-4584-886c-c969043565e8.png`
- Rendered implementation: `D:\One Company\OneCompany\artifacts\design-qa\task-board-no-team-rail.png`
- Side-by-side comparison: `D:\One Company\OneCompany\artifacts\design-qa\task-board-no-team-rail-comparison.png`
- Local route: `http://127.0.0.1:3000/admin/operations/tasks`
- Source pixels: 1486 × 1058.
- Implementation capture: 1465 × 1272, CSS viewport 1465 × 1272, device density 1.
- Responsive check: 390 × 844 CSS px.
- Latest desktop detail evidence: `D:\One Company\OneCompany\artifacts\design-qa\task-board-detail-fixed.png`.
- Latest mobile detail evidence: `D:\One Company\OneCompany\artifacts\design-qa\task-detail-mobile-390-fixed.png`.
- State: authenticated owner, Tasks → Board, real local task data, selected task detail visible.
- Density normalization: both images reviewed at their native 1× density. The in-app browser window is smaller than the generated source, so comparison focuses on layout proportions and responsive behavior rather than literal pixel alignment.

## Full-view comparison evidence

The implementation preserves the selected design's defining structure: existing dark global navigation, four focused Kanban lanes, persistent task detail panel, blue active accents, and compact light workspace. Following the latest user direction, the participant rail is removed from Board view and its filtering remains available in the toolbar. The freed width is split between the Kanban lanes and a wider task-detail panel.

## Focused region comparison evidence

- Board cards: compared title density, priority marker, assignee color, deadline, next-action excerpt, borders, and drag affordance.
- Task detail: compared persistent right-panel placement, title hierarchy, edit action, task metadata, and scroll behavior.
- Participant filtering: verified the toolbar select retains all participant filters without occupying a permanent board column.
- Mobile: verified the board is replaced by the existing task list/detail flow; no global horizontal overflow and no promo image at 390 px.

## Findings

No actionable P0, P1, or P2 mismatch remains.

- [P3] Real task titles are longer than the mock data and wrap more often in narrow lanes. This is expected dynamic-content behavior; the lane itself scrolls horizontally and the selected task remains readable in the persistent detail panel.
- [P3] The source mock shows more populated lanes than the local database. This is data-state variance, not a missing UI state; empty lanes are rendered deliberately and drag targets remain available.

## Required fidelity surfaces

- Fonts and typography: existing One Company display/body typography retained; compact detail title reduced for narrow desktop panels; no clipped controls.
- Spacing and layout rhythm: squared cards and dividers match the selected direction; board and detail remain separate regions without body overflow. The task detail is 500 px wide at the captured desktop viewport.
- Colors and visual tokens: existing blue, slate, amber, violet, and member identity accents retained with adequate contrast.
- Image quality and asset fidelity: the requested car promo asset and the obsolete handcrafted car SVG were removed; no replacement image or fake decorative asset was introduced.
- Copy and content: Russian operations labels are concise and preserve existing task terminology.

## Interaction and runtime verification

- Board view switch: passed.
- Selecting a Kanban task and updating the persistent detail panel: passed.
- Participant filter renders from current server data while the Board participant rail stays absent: passed.
- Drag-and-drop implementation and keyboard sensor remain wired to server-validated transitions.
- Mobile 390 px body overflow: none.
- Browser console errors during verification: none.
- TypeScript: passed.
- Ops tests: 137/137 passed.

## Comparison history

1. Initial implementation finding: global `--radius` mapped `rounded-md` cards to a 997 px pill radius (P2). Fix: board cards and their compact actions now use `rounded-none`. Post-fix computed radius: 0 px.
2. Initial implementation finding: a fixed 720 px board track pushed the persistent detail pane beyond a 1280 px viewport (P2). Fix: outer board track changed to `minmax(0,1fr)` and horizontal overflow is isolated to the Kanban region. Post-fix evidence: body width equals viewport width (1280 px) and the detail pane remains visible.
3. Requested sidebar cleanup: removed the rendered car promo block and unused custom car SVG. Post-fix desktop and 390 px checks both report no promo image.
4. Follow-up finding: the compact right panel inherited a viewport-based four-column metadata layout, leaving roughly 90 px per field on wide screens and truncating assignee/deadline values (P1). Fix: compact details now always use a stable two-column grid; the full mobile task page uses one metadata column. Post-fix evidence shows complete assignee text, readable controls, 390 px body width equal to viewport width, and no horizontal overflow.
5. The fourth focus lane was renamed from `На проверке` to `Готово` and now maps to the terminal `DONE` status instead of `REVIEW`.
6. Latest density finding: the permanent participant rail left insufficient horizontal space for both Kanban copy and the assignee control (P1). Fix: removed the rail from Board view, retained the participant select in the toolbar, widened the detail panel to 500 px at the captured viewport, hid the redundant compact avatar, and preserved the full assignee name in the select and tooltip. Post-fix evidence: no `Участники` rail heading in Board view, selected assignee `Olexandr Tsompel` is fully visible, and document horizontal overflow is false.

## Follow-up polish

- At a later data-rich canary, re-check card density with 20+ simultaneous tasks and several urgent/blocked states.

## Final result

final result: passed
---

# Design QA — Official AI provider marks (latest)

## Assets

- ChatGPT official app mark: `D:\One Company\OneCompany\public\logos\chatgpt-official.png`.
- Perplexity official symbol: `D:\One Company\OneCompany\public\logos\perplexity-symbol-light.svg`.
- Source guidelines: `https://openai.com/brand/` and `https://live.standards.site/perplexity/logo`.

## Verification

- Both provider assets are served locally with HTTP 200 and the expected `image/png` / `image/svg+xml` content types.
- The compact product CTA now renders these official marks instead of the previous generic Lucide provider icons.

## Final result

final result: passed

---

# Design QA — Product AI opinion compact CTA (latest)

## Evidence

- Compact desktop implementation screenshot: `D:\One Company\OneCompany\output\playwright\ai-opinion-compact-ua.png`.
- Local route: `http://localhost:3000/ua/shop/racechip/products/racechip-gts5-bmw-x6-g06-from-2019-30-d-mild-hybrid-2993ccm-298hp-219kw-650nm`.

## Visual decision

- Replaced the oversized AI card with one compact CTA directly below the purchase button.
- Added distinct ChatGPT and Perplexity accent treatments with reusable Lucide SVG icons, compact labels, arrow affordances, hover states, and keyboard focus rings.
- Removed duplicate outer panels from the specialized RaceChip, iPE, Brabus, and Burger purchase flows.

## Verification

- Browser DOM check: one AI panel, one ChatGPT link, and one Perplexity link on the target product page.
- Both links open the external provider with the product-specific prompt encoded in the `q` parameter.
- `npm run typecheck`: passed.
- Targeted ESLint: passed with no errors; existing repository warnings remain in unrelated code.

## Final result

final result: passed

---

# Design QA — Product AI opinion / ready prompt (latest)

## Evidence

- Source visual truth: `C:\Users\sascy\AppData\Local\Temp\codex-clipboard-4ca9966b-be68-435a-9d15-580895425a9e.png`.
- Rendered implementation — PDP CTA: `D:\One Company\OneCompany\output\playwright\ai-opinion-pdp-panel-ua-full.png`.
- Rendered implementation — ready prompt page: `D:\One Company\OneCompany\output\playwright\ai-opinion-prompt-ua.png`.
- Local routes: `http://localhost:3000/ua/shop/racechip/products/{slug}` and `http://localhost:3000/ua/shop/ai-opinion/{slug}?provider=chatgpt`.
- Source pixels: 912 × 570, native screenshot density.
- Prompt implementation capture: 1440 × 2235, CSS viewport 1440 × 1200, device density 1.
- PDP CTA focused capture: 1216 × 231 CSS pixels at a 1440 × 1000 viewport, device density 1.
- State: UA locale, dark OneCompany storefront theme, ChatGPT selected; provider switch also verified for Perplexity.

## Full-view comparison evidence

The source establishes the component composition: a short AI-assistance message followed by two equal provider actions. The implementation preserves that hierarchy and adapts the light blue/white source treatment to the existing OneCompany obsidian/bronze storefront tokens.

## Focused region comparison evidence

- PDP panel: verified eyebrow, title, supporting copy, two equal-width provider buttons, icon affordances, borders, radius and focus/hover-ready link semantics.
- Prompt page: verified product context card, provider switcher, ready prompt textarea, copy action, provider handoff action, and final compatibility disclaimer.
- Mobile behavior: provider actions use a single-column layout below the `sm` breakpoint; the prompt textarea remains readable and horizontally contained.

## Findings

No actionable P0, P1, or P2 mismatch remains.

- [P3] The source uses official ChatGPT and Perplexity glyphs; the implementation uses the repository's Lucide icon library because no provider logo assets are present. Labels and provider-specific states remain explicit. Official assets can replace these icons in a later polish pass if desired.

## Required fidelity surfaces

- Fonts and typography: existing OneCompany display/body typography retained; provider labels use the same compact uppercase treatment as nearby commerce controls.
- Spacing and layout rhythm: the panel keeps the source's two-action grouping while using the PDP's existing card rhythm; prompt page uses a stable two-column desktop layout and stacks naturally on mobile.
- Colors and visual tokens: source hierarchy translated to existing obsidian surfaces and bronze primary accent; contrast remains clear in dark mode.
- Image quality and asset fidelity: real product image is reused from the catalog; no placeholder or handcrafted provider artwork was introduced.
- Copy and content: UA and EN translation keys were added together; prompt content is generated from the current product title, brand, SKU, description, highlights and specifications.

## Interaction and runtime verification

- Product CTA to ready prompt page: passed; expected `/ua/shop/ai-opinion/{slug}?provider=chatgpt` arrived and rendered the prompt.
- ChatGPT → Perplexity switch: passed; heading changed to `Підготуйте запит для Perplexity`.
- Copy prompt: passed; button changed to `Скопійовано`.
- Provider handoff URLs: passed; ChatGPT uses `https://chatgpt.com/`, Perplexity uses `https://www.perplexity.ai/`.
- Browser console errors during the focused interaction run: none.
- TypeScript: passed.
- Targeted ESLint for new files/routes: passed with zero warnings.
- Prettier check for new files, routes and locale files: passed.

## Comparison history

1. Initial implementation used the reference's two-button structure and was adapted to the existing OneCompany dark/bronze design system. The final focused capture shows both provider actions aligned in one row at desktop width.
2. Added separate integration points for the shared PDP, Brabus/Burger layouts, iPE and RaceChip so the feature is present across the storefront's product-detail variants.

## Follow-up polish

- Replace the Lucide provider marks with official provider assets if OneCompany wants exact logo fidelity in the next visual pass.

## Final result

final result: passed

---

# Design QA — Eventuri final polish pass (latest)

## Evidence

- Desktop landing, 1440 px: `D:\One Company\OneCompany\output\playwright\final-polish-after-desktop-1440.png`.
- Mobile landing, 375 px: `D:\One Company\OneCompany\output\playwright\final-polish-after-mobile-375-v2.png`.
- Featured product cards, 375 px: `D:\One Company\OneCompany\output\playwright\final-polish-after-products-dark-375-v2.png`.
- Light-theme landing, 1440 px: `D:\One Company\OneCompany\output\playwright\final-polish-after-light-1440.png`.
- Eventuri filter result, desktop: `D:\One Company\OneCompany\output\playwright\final-polish-filter-result-v5.png`.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri`.

## Polish changes

- Hero image caption now keeps the vehicle label, component label and arrow inside their own flex bounds at compact widths; no clipped arrow or text escapes at 375 px.
- Eventuri source-image boards blend into light image wells while dark theme restores normal blending so carbon components stay legible in both themes.
- The airflow field has a slightly stronger edge presence without competing with the real M5 engine-bay photograph; reduced-motion behavior remains intact.
- The catalog still preserves equal card structure and vehicle chips after the Eventuri-only finder navigation.

## Verification

- BMW → M5 → G90 finder: passed; the finder reports 2 candidates and opens `/ua/shop/catalog?brand=Eventuri&make=BMW&model=M5&chassis=G90`.
- Catalog result: passed; exactly 2 Eventuri products are shown with SKU, price, pre-order state and `BMW M5 G90` fitment chips.
- Dark and light theme captures: passed; product media remains readable and no horizontal overflow is visible.
- `npm run typecheck`: passed.
- ESLint for the touched Eventuri and stock-page files: passed with zero warnings.
- Browser runtime: 0 errors. Development-only advisories remain for Next Image LCP prioritization and the R3F/Three.js clock implementation; neither blocks rendering or interaction.

## Final result

final result: passed

---

# Design QA — Eventuri ambient background art pass (latest)

## Evidence

- Generated dark airflow background: `D:\One Company\OneCompany\public\images\eventuri\eventuri-airflow-dark.png`.
- Generated light airflow background: `D:\One Company\OneCompany\public\images\eventuri\eventuri-airflow-light.png`.
- Generated technical section background: `D:\One Company\OneCompany\public\images\eventuri\eventuri-technical-dark.png`.
- Background source/implementation side-by-side: `D:\One Company\OneCompany\output\eventuri-audit\51-background-source-vs-implementation.png`.
- Dark desktop implementation: `D:\One Company\OneCompany\output\eventuri-audit\50-background-dark-1440-final.png`.
- Light desktop implementation: `D:\One Company\OneCompany\output\eventuri-audit\47-background-light-1440-loaded.png`.
- Dark engineering section: `D:\One Company\OneCompany\output\eventuri-audit\49-background-dark-approach-1440.png`.
- Existing real-photo source/implementation comparison: `D:\One Company\OneCompany\output\eventuri-audit\30-source-vs-final-dark.png`.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri`.

## Visual decision

- The generated bitmap assets are ambient layers only. They do not replace the real BMW M5 G90/G99/Eventuri gallery photography, add product parts, or contain logos, text, people, or watermarks.
- The light theme uses the ivory/graphite airflow study; the dark theme uses the carbon/graphite airflow study. The technical study is reserved for the selection-approach section.
- Image layers are low-opacity and sit behind opaque copy/product cards. The real product hero remains the visual focal point and the generated textures provide depth around the page edges and section negative space.
- The same layout, typography, filter controls, animations, and reduced-motion behavior remain intact in both themes.

## Responsive and runtime verification

- 1440 px light and dark: passed; ambient texture is visible without reducing copy contrast or obscuring the M5 image.
- Dark selection-approach section: passed; technical background stays restrained behind the three-card explanation.
- Existing 390 px dark hero/finder evidence remains valid (`20-final-dark-390.png`, `22-final-dark-390-finder.png`); no generated layer creates horizontal overflow.
- Layout metrics at the final desktop check: content width equals viewport width (`1781` / `1781`), so no horizontal overflow is introduced.
- `npm run typecheck`: passed.
- `npm run test:seo:contracts`: passed, 17/17.
- Browser runtime after the final Fast Refresh: no current error entries; the only remaining console entries are non-blocking Next Image LCP/sizing advisories.

## Findings

No actionable P0, P1, or P2 issue remains. The generated assets are deliberately subtle so the real Eventuri component photography and the catalogue controls remain primary.

## Final result

final result: passed

---

# Design QA — Eventuri landing redesign: “Art of Airflow, measured”

## Audit correction

This section supersedes the legacy **Eventuri hero: BMW M5 G90 / G99** approval elsewhere in this file. That approval covered a prior, overlay-heavy hero only. It must not be used as evidence for the current landing page.

## Evidence

- Pre-redesign desktop audit: `D:\One Company\OneCompany\output\eventuri-audit\01-current-desktop-hero.png`
- Pre-redesign category audit: `D:\One Company\OneCompany\output\eventuri-audit\02-current-categories.png`
- Final UA desktop: `D:\One Company\OneCompany\output\eventuri-audit\14-redesign-1440-final.png` — 1440 × 980 CSS px.
- Final UA mobile: `D:\One Company\OneCompany\output\eventuri-audit\10-redesign-390-final.png` — 390 × 844 CSS px.
- Final compact vehicle finder: `D:\One Company\OneCompany\output\eventuri-audit\11-redesign-390-finder.png`.
- Final catalogue cards: `D:\One Company\OneCompany\output\eventuri-audit\07-redesign-1440-catalog.png` and `D:\One Company\OneCompany\output\eventuri-audit\09-redesign-880-catalog.png`.
- Final selected-product cards: `D:\One Company\OneCompany\output\eventuri-audit\08-redesign-1440-products.png`.
- Final EN desktop: `D:\One Company\OneCompany\output\eventuri-audit\12-redesign-1440-en.png`.
- Source/implementation side-by-side: `D:\One Company\OneCompany\output\eventuri-audit\13-redesign-hero-comparison.png` — original M5 G90/G99 catalogue photograph on the left; current implementation on the right.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri`.

## Design decision and fidelity

- The real BMW M5 G90/G99 Eventuri gallery photography stays visually unobscured. Text now lives on a solid, independent editorial panel instead of being placed over the engine bay.
- The visual system is limited to graphite/black, warm product-white, off-white type, and Eventuri red for active rules and conversion actions. Cards use one sharp, consistent border and image-well treatment; no blur, faux carbon, neon glow, synthetic automotive art, or IND-branded images are used.
- The page begins with a visible vehicle-selection CTA on desktop and 390 px mobile. The compact finder follows the hero and uses direct, honest language: vehicle data narrows results; final compatibility is checked before order.
- The global mobile bottom bar is intentionally hidden only on `/[locale]/shop/eventuri`, because it covered the finder and card controls at compact widths. The existing header keeps menu and cart access available.

## Content and catalogue verification

- The visible taxonomy is the persisted Eventuri product type, not title-search heuristics: Intake Systems (74), Turbo Inlets & Pipes (11), Engine Covers (20), Strut Braces (1), Filters & Accessories (2).
- Landing-card routes now send an exact `productType` filter into the normal catalogue pipeline. Local API checks returned exactly 74 / 11 / 20 / 1 / 2 products for those five types.
- Selected product cards show the actual localized product title, type, current currency price, and the persisted `Made to order` / `Під замовлення` state. They do not claim stock availability or verified vehicle fitment.
- The M5 caption says only `BMW M5 G90/G99 · Intake system`; it does not make an unverified “actual installed system” provenance claim.

## Responsive and interaction verification

- 1440 px UA and EN: full hero composition, logo, CTA, finder, category cards, product cards, type hierarchy, and currency-sensitive prices are legible without clipping.
- 880 px compact desktop/tablet: catalogue switches to a two-column grid; imagery stays in fixed image wells and all card text remains within its card.
- 390 px mobile: uses a separate real close-up M5 gallery image, keeps the red vehicle CTA fully visible in the initial hero, and keeps all finder fields single-column and tappable.
- Finder data flow: Eventuri → BMW → M5 → G90 is available locally; the current catalogue returns 2 candidate products for that selection. The UI clearly says VIN confirmation is required before order.
- TypeScript: `npm run typecheck` passed.
- SEO contract tests: `npm run test:seo:contracts` passed 17/17.

## Findings

No actionable P0, P1, or P2 issue remains in the fresh desktop, compact, mobile, UA, or EN review.

- [P3] Some product titles are naturally long, so cards clamp titles to four lines and retain the price/action row at a stable position. This prevents variable source data from escaping the card without hiding the primary purchase information.
- [P3] Eventuri fitment remains partly inferred in the catalogue data. The landing page deliberately avoids presenting it as confirmed fitment and directs final compatibility checks to VIN review.

## Final result

final result: passed

---

## Current Eventuri QA status

The legacy **Eventuri hero: BMW M5 G90 / G99** report immediately below is archived historical evidence. The authoritative report for the current page is **Eventuri landing redesign: “Art of Airflow, measured”** above.

final result: passed

---

# Design QA — Eventuri hero: BMW M5 G90 / G99

## Evidence

- Source visual truth path: `D:\One Company\OneCompany\output\eventuri-g90-hero-candidates\g90-m5-3.jpg`
  - Original installed-system photo from the migrated Eventuri product gallery for `eventuri-bmw-g90-g99-m5-intake-system`; it shows the BMW M5 G90/G99 with the hood open and the actual Eventuri intake installed.
- Implementation screenshot path: `D:\One Company\OneCompany\output\eventuri-m5-g90-hero-preview.png`
- Full-view comparison evidence: `D:\One Company\OneCompany\output\eventuri-m5-g90-hero-comparison.png` (source left, implementation right).
- Focused region comparison evidence: `D:\One Company\OneCompany\output\eventuri-m5-g90-hero-focus-comparison.png` (engine bay / installed intake, source left, implementation right).
- Responsive implementation screenshot: `D:\One Company\OneCompany\output\eventuri-m5-g90-mobile-preview.png`.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri`.
- State: initial Eventuri landing page with the real M5 G90/G99 image; no selected vehicle filters.

## Viewport and density normalization

- Source image: 2048 × 1365 px, sRGB JPEG.
- Desktop implementation: browser CSS viewport 1280 × 720 at DPR 1.25; captured image 1265 × 712 px.
- Full-view comparison: both visual regions normalized to 1266 × 710 px for equal-scale review. This is crop/scale normalization only; it does not change the implementation asset.
- Mobile responsive check: 390 × 844 CSS px override; captured image 375 × 811 px after browser chrome/scrollbar exclusion.

## Full-view comparison evidence

The implementation preserves the actual photographed BMW M5 G90/G99 engine bay rather than illustrating or compositing a fictional kit. The installed twin carbon Eventuri intake remains the visual focal point, while the dark OneCompany presentation, Eventuri wordmark, large display copy and fitment CTA retain the selected premium performance direction. The source image is intentionally darker in implementation for copy contrast; intake texture, hood-open state and M5 engine bay remain plainly visible.

## Focused region comparison evidence

The engine-bay crop verifies the carbon intake housings, OEM engine cover, open hood and surrounding vehicle hardware are all from the original gallery photograph. The implementation does not insert a generated intake, trunk scene, logo watermark or IND-branded overlay. The real-product link immediately below the copy leads to the matching G90/G99 Eventuri intake PDP.

## Findings

No actionable P0, P1 or P2 mismatch remains.

- [P3] The source gallery photo has no designed text-safe area, so the implementation uses a dark opacity layer to make the real product image usable as a landing-page hero. This is intentional and leaves both the engine and carbon intake readable.

## Required fidelity surfaces

- Fonts and typography: existing OneCompany display and body type system is retained; the hierarchy stays readable at desktop and 390 px mobile without clipped title or CTA copy.
- Spacing and layout rhythm: hero copy retains a deliberate left column; the real engine-bay photo fills the hero without stretching, and the mobile fitment card follows within the first scroll.
- Colors and visual tokens: existing black/charcoal OneCompany surface, white type and restrained Eventuri-red accent are used consistently. The photo overlay improves contrast without introducing a separate illustrative palette.
- Image quality and asset fidelity: source is a 2048 px real Eventuri gallery photo stored in Vercel Blob and rendered with `next/image`; no generated car, fake component, inline SVG illustration or IND logo is used in the hero.
- Copy and content: UA and EN are independently written; the hero explicitly identifies `BMW M5 G90 / G99 · Реальний комплект на фото` / `Actual installed system` and links to the corresponding product.

## Interaction and runtime verification

- UA and EN landing pages: passed; locale-specific copy and real-image alt text render correctly.
- Eventuri vehicle finder: passed. BMW → M5 → G90 is available from the Eventuri-only dataset.
- Exact G90 route: passed. The finder navigates to `/ua/shop/catalog?brand=Eventuri&make=BMW&model=M5&chassis=G90&strict=1` and returns 2 Eventuri products, both marked pre-order.
- Desktop and 390 px mobile hero: passed; no visible horizontal overflow or clipped persistent controls.
- Browser console errors/warnings: none.
- TypeScript: passed (`npm run typecheck`).

## Comparison history

1. Initial selected concept used a generic performance-car hero. User review correctly identified that a trunk-mounted Eventuri scene would not be technically credible for this product.
2. Fix: replaced the generated car asset with the original M5 G90/G99 Eventuri intake-gallery image (`g90-m5-3.jpg`), added truthful image alt text and a direct product link, and kept the product component separate from any generated imagery.
3. Post-fix visual evidence: full-view and focused side-by-side comparisons above; the initial product image, desktop hero and mobile hero all show the same real installed system.

## Follow-up polish

- If Eventuri supplies a wider official G90/G99 installation image later, it can replace the source with no layout change; the current source is already high-resolution and sufficiently wide for the hero crop.

## Final result

final result: passed

---

## Current Eventuri QA status (authoritative)

The legacy hero-only report above is archived. The authoritative current QA is **Eventuri landing redesign: “Art of Airflow, measured”** and its recorded result remains:

final result: passed

---

# Design QA — Eventuri product-card alignment pass (latest)

## Evidence

- User source screenshot: `C:\Users\sascy\AppData\Local\Temp\codex-clipboard-cded2f66-3ea5-4810-a966-5f3eddae9681.png`.
- Source/implementation side-by-side: `D:\One Company\OneCompany\output\eventuri-audit\57-source-vs-aligned-products.png`.
- Dark implementation: `D:\One Company\OneCompany\output\eventuri-audit\53-aligned-products-dark.png`.
- Light implementation: `D:\One Company\OneCompany\output\eventuri-audit\55-aligned-products-light-loaded.png`.
- Mobile implementation: `D:\One Company\OneCompany\output\eventuri-audit\56-aligned-products-390.png`.
- Category-grid implementation: `D:\One Company\OneCompany\output\eventuri-audit\60-aligned-categories-light.png`.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri#eventuri-products`.

## Alignment changes

- Every featured-product grid item now stretches to the tallest card in its row.
- Product links use full height, so every card shares one bottom edge.
- Image wells remain identical in aspect ratio and size.
- Type/status rows reserve the same vertical space; status pills do not wrap.
- Titles reserve four lines, and the price/action row is pushed to the bottom with `mt-auto`.
- Category cards use the same stretch/full-height treatment, with their catalogue CTA anchored to one shared bottom line.

## Verification

- 1440 px dark and light: all four cards have aligned image bottoms, title blocks, dividers, prices, and arrow controls.
- The five Eventuri category cards now share one bottom edge and one CTA baseline despite different description lengths.
- DOM box-model check: all five category cards measured `426.19px` high; all four featured product cards measured `438.15px` high.
- 390 px: single-column card flow remains intact; CSS content width equals the viewport width (`469` / `469` in the browser device scale), with no body overflow introduced.
- `npm run typecheck`: passed.
- `npx eslint --no-warn-ignored --max-warnings=0 -- src/app/[locale]/shop/eventuri/EventuriMachineAtelier.tsx`: passed.
- `npm run test:seo:contracts`: passed, 17/17.

## Final result

final result: passed

---

# Design QA — Eventuri Three.js ambient airflow pass (latest)

## Evidence

- Light-theme hero with 3D airflow field: `D:\One Company\OneCompany\output\eventuri-audit\61-threejs-airflow-light-hero.png`.
- Dark-theme hero with 3D airflow field: `D:\One Company\OneCompany\output\eventuri-audit\62-threejs-airflow-dark-hero.png`.
- Final verified dark-theme deliverable capture: `D:\One Company\OneCompany\output\eventuri-audit\64-threejs-airflow-dark-hero-final.png`.
- 390 px mobile fallback/overflow check: `D:\One Company\OneCompany\output\eventuri-audit\63-threejs-airflow-mobile.png`.
- Local route: `http://127.0.0.1:3000/ua/shop/eventuri`.

## Visual decision

- Implemented the recommended **Carbon Airflow Field**: restrained Three.js tube ribbons plus one distant carbon halo, positioned behind the hero and never over real product photography or copy.
- Palette follows the theme: satin graphite and a single Eventuri-red airflow accent in dark mode; graphite/silver and red in light mode.
- The scene is ambient only and does not depict or invent an Eventuri product.
- Theme changes are observed live; reduced-motion disables animation while retaining the static composition; the mobile layout keeps the canvas pointer-free and overflow-free.

## Verification

- Light/dark desktop: passed; airflow is visible at the outer negative space while hero copy and the real M5 image remain primary.
- 390 px mobile: passed; CSS content width equals viewport width (`375` / `375.2`) with no horizontal overflow.
- Browser runtime: no current errors; only the non-blocking Three.js clock deprecation advisory from the rendering runtime.
- `npm run typecheck`: passed.
- ESLint for both Eventuri components: passed.

## Final result

final result: passed

---

# Design QA — Product AI opinion deeplink (latest)

## Evidence

- Source visual truth: `C:\Users\sascy\AppData\Local\Temp\codex-clipboard-4ca9966b-be68-435a-9d15-580895425a9e.png`.
- Updated implementation screenshot: `D:\One Company\OneCompany\output\playwright\ai-opinion-pdp-panel-ua-direct.png`.
- Local route: `http://localhost:3000/ua/shop/racechip/products/racechip-gts5-bmw-x6-g06-from-2019-30-d-mild-hybrid-2993ccm-298hp-219kw-650nm`.

## Verification

- The separate internal prompt page was removed. ChatGPT and Perplexity are now direct external anchors with a product-specific `q` parameter and `target="_blank"`.
- The decoded ChatGPT query is one expert-analysis instruction: explain what the part is, what real benefit it gives, and what it is made of, with an explicit instruction not to invent missing material data.
- The UA panel keeps the existing OneCompany dark/bronze treatment, two-provider layout, focus states, and a concise note that the prompt opens in a new tab.
- `npm run typecheck`: passed.
- Targeted ESLint for the new panel, prompt builder, and RaceChip/iPE routes: passed.
- The product page may take longer to render locally because the existing cross-shop fitment catalog query can hit its 10-second database limit; this is independent of the AI panel.

## Final result

final result: passed

---

# Catalog restoration design QA

- Source visual truth: `C:\Users\Admin\AppData\Local\Temp\codex-clipboard-6f9a5b2c-194e-48d0-8883-4e369844ead1.png`
- Implementation screenshot: `C:\Users\Admin\.codex\visualizations\2026\08\30\01a05461-4006-78a2-b87b-6081db436935\catalog-restored.png`
- Combined comparison: `C:\Users\Admin\.codex\visualizations\2026\08\30\01a05461-4006-78a2-b87b-6081db436935\catalog-design-comparison.png`
- Browser viewport / implementation pixels: 1265 × 712 CSS px at device scale 1
- Source pixels: 1362 × 1197; the shared above-the-fold region was normalized to 712 px high for the combined comparison
- State: dark theme, Ukrainian locale, RaceChip brand, BMW make

## Full-view comparison evidence

The implementation restores the same established component and assets shown in the source: ONE COMPANY navigation, performance hero, search and Auto/Moto selector, BMW vehicle picker, selected-vehicle strip, filter sidebar, result controls, and product grid. The source error panel is replaced by 24 real product cards. There is no technical V2 form or route-level loading graphic.

## Focused-region comparison evidence

The hero/search/filter/results region is fully readable in the combined comparison, so a separate crop was unnecessary. Browser interaction verified that selecting BMW M2 preserved all 24 current cards during the request and then replaced them with 6 filtered cards; no skeleton grid appeared.

## Required fidelity surfaces

- Fonts and typography: unchanged premium catalog typography, weights, hierarchy, and labels.
- Spacing and layout rhythm: unchanged hero proportions, overlapping finder panel, sidebar/content grid, radii, borders, and card spacing.
- Colors and visual tokens: unchanged dark theme, gold primary action, neutral borders, and white controls.
- Image quality and assets: existing ONE COMPANY logo, performance hero, vehicle icons, brand marks, and product media are used directly.
- Copy and content: Ukrainian catalog copy is preserved; stale `0 товарів` and the Prisma P6009 message are replaced with live counts and products.

## Interaction and runtime checks

- Initial product cards: 24.
- Cards still visible immediately after changing model: 24.
- BMW M2 cards after completion: 6.
- Visible Prisma/P6009 errors: 0.
- Browser console errors: 0.
- TypeScript: passed.
- Relevant catalog tests: 22/22 passed.

## Comparison history

- P0 fixed: the public route rendered the technical V2 template instead of the premium catalog.
- P0 fixed: the premium catalog's legacy full-product query could exceed Prisma's 5 MB response limit.
- P1 fixed: a 12-card pulse skeleton replaced products during every filter refresh.
- Post-fix evidence: premium UI is restored, bounded projection reads are wired through the catalog API, existing cards remain visible during refresh, and filtered products render without errors.

## Findings

No actionable P0, P1, or P2 visual differences remain. Live data counts and product cards intentionally differ from the broken reference state.

final result: passed

