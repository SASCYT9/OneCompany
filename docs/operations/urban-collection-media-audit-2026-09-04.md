# Urban collection and media audit — 2026-09-04

## Status

Partial implementation, not a claim that every image is now correct. Prepared for the user-authorized local commit; no database writes, push or deployment.

User decision (2026-09-04): defer the 34 unresolved photo cases below because exact images are currently unavailable. Preserve these products and this SKU-level backlog; commit the verified corrections. Resume photo replacements when matching source assets become available.

Scope: all 26 Urban collection routes and all 259 Urban products in the local canonical fallback snapshot (17,385 products shop-wide). Other brands were not audited in this pass.

## Implemented

- Preserved product identities and catalog membership; read-only integrity audit compares source slugs, checks collection coverage, local files, and optionally remote image responses.
- Corrected shared original Urus fitment; separated L460/L461 and RSQ8 pre-facelift/facelift parts while retaining explicitly shared products.
- Restored manufacturer-confirmed W463A/W465 mirror covers and indicator surrounds to both W465 programmes.
- Collection routes without a cinematic configuration now render matching products instead of hiding them.
- Existing collection grid still progressively displays every matched product; no first-16 server truncation was added.
- 49 exact SKU-level media corrections in src/lib/urbanVerifiedProductMedia.json. Each records source evidence; the same selection is applied to catalog, collection and PDP.
- Preserved full Shopify filenames, including required UUIDs: two Range Rover spoiler gallery URLs previously returned 404 after filename rewriting.
- Reviewed primary-image contact sheets for all 259 products. Remote URL availability does NOT prove visual correctness or finish compatibility.

## Collection checks

All 259 source products remain represented. No product has been deleted or hidden to improve audit counts.
Defender has 43 matches, including URB-SPO-25353093-V1.
Original Urus: 11. RSQ8 pre-facelift: 8; facelift: 7.
L460: 29; L461: 28. W465 Widetrack: 15; Aerokit: 10; W463A Softkit: 12.
Counts overlap intentionally for shared parts.

Aventador S and Ghost Series II each have zero matching products in the current source catalog. They remain visible with truthful request-based copy; no invented products or cross-model assignments.

## Verification

- 35 focused matcher/media/visual-intent tests pass.
- TypeScript noEmit passes.
- Scoped git diff whitespace check passes.
- Local HTTP 200 and correct media confirmed for Golf R splitter and L461 spoiler PDPs.
- Local Defender collection HTTP 200 contains the missing-spoiler SKU.
- Standard ESLint is blocked before linting by existing duplicate react-hooks plugin registration in eslint.config.mjs. Configuration was not changed as part of this task.
- Integrity audit: run with SHOP_LOCAL_CATALOG_SNAPSHOT=1 and DATABASE_URL/DIRECT_URL empty, using node --import tsx scripts/audit-urban-catalog-integrity.ts --check-urls.
- Evidence/contact sheets and source responses are under tmp/urban-source-media (not production assets).

## Still open: supplier photos and variant confirmation

Two confirmed original supplier placeholders: URB-ACC-25358162-V1 (Transporter roof rails, manufacturer 490-0022) and URB-ACC-25358163-V1 (towbar, manufacturer 490-0023). GP currently supplies silhouettes; no corresponding usable official photo was found in the reviewed House of Urban catalog. Keep products; obtain exact photos from supplier/customer assets.

The following 32 primary images need further evidence or correction. Some are real model-context photos rather than a product detail; do not replace these using an arbitrary similar part. Gloss/satin and pre-facelift/facelift distinctions must be preserved.

| SKU | Product | Open issue |
| --- | --- | --- |
| URB-DIF-25358238-V1 | Urban Visual Carbon Fibre Satin Rear Diffuser Set for Audi RSQ8 Facelift | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-EXH-25353140-V1 | Urban Axle Back Exhaust System for Land Rover Discovery 5 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-EXH-25353143-V1 | Urban Axle Back Exhaust System for Land Rover Discovery 5.5 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-FRO-25353082-V1 | Urban Visual Carbon Fibre Front Bumper for Range Rover Sport L494 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-FRO-25358177-V1 | Urban 2-Piece Visual Carbon Fibre Lower Front Bumper Apron for Lamborghini Urus S with OEM Splitter | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-HOO-25353023-V1 | Urban Semi-Visual Carbon Fibre Bonnet Assembly with Visual Top Vents for Range Rover L460 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-HOO-25353103-V1 | Urban SVR Style Vented Carbon Fibre Bonnet for Defender L663 90/110/130 | Primary photo shows a wheel, not the bonnet. |
| URB-HOO-25358148-V1 | Urban Complete Bonnet Assembly for Rolls-Royce Cullinan Series II | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-HOO-25358180-V1 | Urban Carbon Fibre Bonnet Assembly with Twin Carbon Vents and Centre Intake for Lamborghini Urus S / Performante | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-HOO-25358239-V1 | Urban Visual Carbon Fibre Bonnet Vents Pair for Audi RSQ8 Facelift | SKU-named image is a supplier coming-soon silhouette; facelift-specific evidence is needed. |
| URB-INT-25353048-V1 | Urban UA Interior Branding Pack for Range Rover L405/L494 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-MIR-26054211-V1 | Urban Visual Carbon Fibre ADAS Wing Mirror Caps for Lamborghini Urus SE | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-REA-26054208-V1 | Urus SE - Rear Spoiler Assembly - Visual Carbon Fibre | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-SID-25353055-V1 | Urban Fixed Side Steps for Range Rover L405/L494 and Discovery 5 | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-SID-25353146-V1 | Discovery 5 Black Shadow Fixed Side Steps | Primary photo shows a plate bracket, not Discovery side steps. |
| URB-SID-26054205-V1 | Urus SE - Lower Side Sills - Visual Carbon Fibre | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-SPO-25358203-V1 | Urban upper rear spoiler with Urban emblem for Mercedes-Benz G-Wagon W465 Aerokit / Widetrack - Visual Carbon Fibre | Primary photo is a Cullinan spoiler; W465-specific image is needed. |
| URB-SPO-25358233-V1 | Urban lower rear lip spoiler for Audi RSQ8 Facelift / Pre-Facelift - Satin | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-TAI-25353065-V1 | Urban tailpipe finishers for Sport L494 SVR - Satin Black | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-TAI-25358154-V1 | Urban tailpipe finishers for Continental GT | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-TAI-26009358-V1 | Urban tailpipe finishers for G-Wagon Widetrack - Satin Black | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-TRI-25358205-V1 | Urban carbon fibre trim for G-Wagon Aerokit - Visual Carbon Fibre | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-TRI-25358206-V1 | Urban carbon fibre trim for G-Wagon Aerokit - Visual Carbon Fibre | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-WHE-26009230-V1 | 19" UCR - 5x112 - ET45 - Satin Grey (Golf R) | Satin Grey product currently shows black. |
| URB-WHE-26009231-V1 | 20" UC4 - 5x120 - ET32 - Gloss Black - Rear (T6.1) | UC4 rear wheel image has a different spoke design; confirm generation/finish. |
| URB-WHE-26009232-V1 | 20" UC4 - 5x120 - ET32 - Satin Black - Rear (T6.1) | UC4 rear wheel image has a different spoke design; confirm generation/finish. |
| URB-WHE-26009279-V1 | 23" UC4 - 5x120 - ET39 - Satin Black (L494/L663) | UC4 currently shows another wheel design; confirm satin finish. |
| URB-WHE-26009281-V1 | 23" UC4 - 5x130 - ET25 - Satin Black (G Wagon) | UC4 currently shows another wheel design; confirm satin finish. |
| URB-WHE-26009313-V1 | 24" UC6 - 5x120 - ET32 - Gloss Black - (L460/L461) | UC6 currently shows UC9; local UC6 asset exists but gloss finish is not verified. |
| URB-WHE-26009314-V1 | 24" UC6 - 5x120 - ET32 - Satin Black (L460/L461) | UC6 currently shows UC9; local UC6 asset exists but satin finish is not verified. |
| URB-WHE-26009319-V1 | 24" UC9 - 5x120 - ET32 - Satin Black - ET32 (L460/L461) | Generic vehicle view does not adequately show the listed component; exact product/finish photo is not yet verified. |
| URB-WHE-26009370-V1 | Defender OEM Black Wheel Nut Set - 18xNuts, 5xLocking Set | Wheel nut set currently shows a wheel cover. |

The remaining gallery images have availability checks, not exhaustive visual certification. Do not describe this audit as “all products have correct photos”.

## Completion requirement

Obtain and visually match missing/ambiguous SKU-specific photos (including wheel finishes); expand the verified media registry; rerun integrity checks and browser review. Production changes require a separate explicitly authorized commit/push/deploy or database operation.
