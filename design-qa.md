# Presentation catalog — design QA

- Source visual truth: `C:\Users\Admin\Downloads\URBAN_G580_EQ_Brochure.pdf`
- Source page renders: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\urban-reference`
- Browser-rendered implementation: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\ui-desktop.png`
- Mobile implementation captures: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\ui-mobile-top.png`, `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\ui-mobile-preview.png`
- Generated PDF: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\output\pdf\eventuri-editorial-catalog-preview.pdf`
- Generated page renders: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\editorial-a4-final`
- Full-view comparison: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\comparison-a4-full.png`
- Focused product-page comparison: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany\tmp\pdf-audit\comparison-a4-product.png`
- State: Ukrainian, EUR, prices visible, Eventuri brand logo, four Catalog V2 products, one product per page
- PDF viewport: A4, 595.28 × 841.89 pt on every page
- PDF render density: 110 DPI; source and implementation product pages both 910 × 1287 px
- Browser viewport: desktop 1440 × 1000 CSS px and mobile 390 × 844 CSS px, device scale factor 1
- Density normalization: source and implementation PDF pages were rendered at the same 110 DPI. Contact sheets were normalized to equal column widths before the combined comparison was opened.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation reproduces the reference hierarchy with a compact brand mark, spaced uppercase metadata, a heavy geometric title, a restrained gray deck, and a large tabular price. Long product names use length-aware sizes and remain inside the page.
- Spacing and layout rhythm: the cover follows the reference's dark title panel, wide image band, and white statement panel. Product pages preserve the same header, intro, full-width image, caption, lower specification/price block, and quiet footer rhythm. The final configuration page follows the reference's image, item table, and black total bar.
- Colors and visual tokens: near-black, white, cool gray, and the restrained lime accent match the reference direction. The Eventuri red remains limited to supplied brand and product imagery.
- Image quality and asset fidelity: product imagery is loaded from Catalog V2, normalized to a print-oriented canvas, and embedded at up to 1500 px before JPEG compression. No placeholder art, CSS illustration, or recreated logo is used. Managers can cycle through each product's real gallery images before export.
- Copy and content: product names, descriptions, SKU, currency, prices, and totals remain dynamic. Cover title and subtitle stay editable. Ukrainian, Russian, and English labels are supported.
- Responsiveness and interaction: the desktop workbench remains two-column; at 820 px it becomes one column; at 390 px the form, selected products, and PDF preview stay within the viewport with no horizontal overflow. Adding products, changing the logo mode, and downloading the PDF were exercised.
- Accessibility: controls retain accessible labels, disabled states, native inputs/selects, and visible focus treatment.

## Comparison history

1. Initial implementation had a P1 art-direction mismatch: an oversized framed logo, generic card-like product sheets, a dark empty cover area, and no editorial image rhythm. Fixed by rebuilding the cover, single-product page, double-product spread, and configuration summary from the reference's measured A4 composition. Post-fix evidence: `comparison-a4-full.png` and `comparison-a4-product.png`.
2. Initial implementation had a P1 image-quality issue: source images were normalized to 480 px and appeared small or soft in print. Fixed by adding a catalog-specific 1500 px image path, trimming excess white canvas, placing products on a consistent neutral background, and exporting at JPEG quality 88. The six-page sample is 828 KB and all images render.
3. Initial implementation had a P1 logo mismatch: Eventuri was placed in a large generic frame. Fixed with surface-aware light/dark contrast and a compact 132 × 31 pt editorial brand mark. OneCompany, brand, and no-logo modes remain supported.
4. Follow-up PDF inspection found a P0 document-format issue: non-cover pages collapsed to content height when page wrapping was disabled. Fixed by using wrapped fixed-size A4 pages for product and summary pages while keeping the exact-height cover unwrapped. `pdfinfo -box` now reports A4 for all six pages.
5. Follow-up UI inspection found a P2 preview mismatch: the live outline still showed the old dark gradient/table design. Fixed by replacing it with the actual dark-header, product-image, and white-statement cover structure and by correcting the page-count formula for paginated summaries.
6. Responsive verification found no horizontal overflow at 1440 px or 390 px. The mobile preview stacks below the editing workflow and preserves readable controls and a complete A4 cover thumbnail.

## Primary interactions tested

- Catalog V2 search list loaded four products with images and prices
- Added and reordered multiple selected products
- Product gallery cycling control available for every multi-image product
- OneCompany, Eventuri brand, and no-logo choices rendered in the live preview
- Percentage and fixed discount controls remained enabled with valid selected prices
- PDF generation completed from the UI with the success message `PDF сформовано та завантажено.`
- One-product and two-product layouts generated valid A4 documents
- Browser console checked: no runtime errors; only the React development-tools information message
- Every page of the final six-page PDF was rendered and visually inspected

## Follow-up polish

- P3: a supplier's primary image may still be softer than its gallery alternatives. This is source-media quality, not layout failure; the manager can switch to another Catalog V2 image before export.

final result: passed
