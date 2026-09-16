# Design QA — презентаційний каталог

## Baseline PDF implementation QA

- Original source visual truth: `C:/Users/Admin/Downloads/URBAN_G580_EQ_Brochure.pdf`.
- Original source page renders: `tmp/pdf-audit/urban-reference`.
- Browser evidence: `tmp/pdf-audit/ui-desktop.png`, `tmp/pdf-audit/ui-mobile-top.png`, and `tmp/pdf-audit/ui-mobile-preview.png`.
- Generated baseline PDF: `output/pdf/eventuri-editorial-catalog-preview.pdf`.
- Generated baseline page renders: `tmp/pdf-audit/editorial-a4-final`.
- Baseline comparisons: `tmp/pdf-audit/comparison-a4-full.png` and `tmp/pdf-audit/comparison-a4-product.png`.
- State: Ukrainian, EUR, prices visible, Eventuri logo, four Catalog V2 products, one product per page.
- PDF viewport: A4, 595.28 × 841.89 pt on every page; source and implementation pages rendered at the same 110 DPI (910 × 1287 px).
- Browser viewports: desktop 1440 × 1000 and mobile 390 × 844 CSS px at device scale factor 1.

### Baseline findings retained

- The implementation follows the reference hierarchy: compact brand mark, spaced uppercase metadata, heavy geometric title, restrained gray deck, and large tabular price. Long names use length-aware sizing.
- Cover and product pages preserve the reference's dark title panel, image rhythm, white statement area, specification/price block, and quiet footer.
- Catalog V2 imagery is normalized to a print canvas and embedded at up to 1500 px with JPEG quality 88; managers can choose gallery alternatives.
- Product names, descriptions, SKU, currencies, prices, totals, cover copy, Ukrainian/Russian/English labels, and logo mode remain dynamic.
- Native labeled inputs, visible disabled states, focus treatment, and responsive stacking were verified.

### Baseline comparison history retained

1. Rebuilt the initial generic card layout into the measured A4 editorial composition from the reference.
2. Replaced 480 px image normalization with the 1500 px print path and trimmed excess white canvas.
3. Replaced the oversized Eventuri frame with surface-aware compact logo treatment.
4. Fixed non-cover pages collapsing to content height; `pdfinfo -box` then reported A4 for all pages.
5. Replaced the outdated live outline with the actual dark-header, product-image, and white-statement cover structure.
6. Verified no horizontal overflow at 1440 px or 390 px and completed UI PDF generation without runtime errors.

### Baseline follow-up note

- A supplier's primary image may be softer than its gallery alternatives because of source-media quality; managers can select a better Catalog V2 image before export.

## Source of truth

- Reference: `C:/Users/Admin/AppData/Local/Temp/codex-clipboard-1a7de3bb-119e-4943-971e-1dfe7804c504.png`
- Reference dimensions: 1652 × 1228 px.
- Implementation: `/admin/shop/catalogs` and the final browser editor in `src/app/admin/shop/catalogs/page.tsx`.
- Implementation evidence: `tmp/design-qa-implementation.png` at 1103 × 941 px and `tmp/design-qa-comparison.png`.
- State mismatch: the reference includes the complete production admin shell and populated product selection; the synthetic implementation capture intentionally renders only the catalog workspace with demo data. Shell chrome is excluded from fidelity scoring.

## Visual comparison

- Preserved the dark premium surface, thin neutral borders, blue primary actions, condensed labels, A4 live outline, and clear step hierarchy from the existing admin.
- The final editor adds a page rail, live page preview, per-item controls, photo strip, and persistent completion actions without changing the established visual language.
- Text wraps within its containers, long product names remain readable, and controls keep a consistent minimum hit area.
- Eventuri and other brand logos use contained sizing; dark brand marks receive a white presentation frame on public pages.

## Responsive evidence

- Desktop/laptop browser check: 1103 × 941 px; editor renders as page rail + preview + controls with no horizontal clipping.
- Mobile browser check: 390 × 844 px; `documentElement.scrollWidth` is 375 px and the dialog width is 359.2 px, so there is no horizontal overflow. Editor regions stack vertically and footer actions remain available.
- Browser console errors during the final interaction pass: none.

## Interaction evidence

- Added two Catalog V2 products and opened the final editor.
- Switched an item from Editorial to Gallery and confirmed the live page label changed to `GALLERY`.
- Entered a custom page title and confirmed the live preview updated immediately.
- Removed one photo and confirmed the item changed from `5 з 5` to `4 з 5`, with `Відновити всі` available.
- Reordered a remaining photo and confirmed the gallery order updated.
- Changed zoom to `1.35×`, horizontal focus to `38%`, and vertical focus to `62%`; all values persisted in the editor state.

## PDF evidence

- Final artifact: `tmp/pdfs/catalog-editor-qa-v3.pdf`.
- Five A4 pages verified, including cover, gallery/product pages, and the personalized contact page.
- Focused render evidence: `tmp/pdfs/catalog-editor-qa-v2-1.png`, `tmp/pdfs/catalog-editor-qa-v2-2.png`, `tmp/pdfs/catalog-editor-qa-v2-3.png`, and `tmp/pdfs/catalog-editor-qa-v3-contact.png`.
- No title clipping, gallery gaps, contact-card overlap, or non-A4 pages remain.

## Iteration history

1. Initial pass found P2 horizontal editor overflow at laptop width, P2 long cover/gallery text collisions, and P1 contact-page overlap caused by a non-A4 layout.
2. Updated editor breakpoints and internal overflow rules; reduced and constrained cover/gallery typography; forced the contact page to A4 and repositioned its card.
3. Re-ran browser, PDF, type, lint, unit, Prisma, and production-build checks. No remaining P0–P3 visual findings.

## Final result

passed
