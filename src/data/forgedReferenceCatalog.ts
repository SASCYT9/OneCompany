/**
 * Internal reference-led catalog for One Company Forged.
 *
 * Source brand/model names are used only for production research and QA.
 * Public UI must expose OC names only, with no third-party logos or marks
 * on generated assets.
 */

export type ForgedReferenceStatus = "approved-seed" | "needs-model-page-review";

export type ForgedReferenceWheel = {
  ocSlug: string;
  ocName: string;
  /** Private admin label for the original wheel reference. Never shown in storefront UI. */
  originalReferenceLabel: string;
  sourceBrand: "HRE" | "Brixton Forged" | "Mansory" | "AL13" | "MV Forged";
  sourceModel: string;
  sourceUrl: string;
  status: ForgedReferenceStatus;
  priority: 1 | 2 | 3;
  construction: string;
  verifiedAsOf: string;
  geometryBrief: string;
  qaNotes: string[];
};

export const FORGED_REFERENCE_CATALOG: ForgedReferenceWheel[] = [
  {
    ocSlug: "oc-p101sc",
    ocName: "OC Aero Split 101",
    originalReferenceLabel: "HRE P101SC",
    sourceBrand: "HRE",
    sourceModel: "P101SC",
    sourceUrl: "https://www.hrewheels.com/wheels/series-p1sc/p101sc",
    status: "approved-seed",
    priority: 1,
    construction: "forged monoblok, 6061-T6 aluminum reference",
    verifiedAsOf: "2026-05-16",
    geometryBrief:
      "mesh-style ten paired split-spoke monoblok, conical face, I-beam spoke sides, aggressive lug pocketing, lightweight motorsport/super-sedan stance",
    qaNotes: [
      "2026-05-12 source check: official HRE P101SC model page confirms a model-level Series P1SC page, Forged Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, modern conical profile, and 6061-T6 forged aluminum construction.",
      "2026-05-12 re-check: official model-page specifications also confirm side cuts and backpad pocketing, custom CNC machining per application, OE TPMS/lug hardware compatibility, and center-lock options.",
      "2026-05-12 live source verification: official HRE P101SC page still resolves as a model-level Series P1SC entry with P101SC title, Forged / Monoblok positioning, 19-24 inch availability, modern conical profile, side cuts, backpad pocketing, OE TPMS/lug hardware compatibility, center-lock options, and HRE center-cap / finish evidence that must not appear in OC renders.",
      "2026-05-15 source verification: direct fetch of the official HRE P101SC URL returned a transient 502, but official HRE search-index content for that model-level Series P1SC page confirms P101SC title, Forged / Monoblok positioning, 19, 20, 21, 22, 23, and 24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, modern conical profile, side cuts, backpad pocketing, custom CNC machining per application, OE TPMS/lug hardware compatibility, center-lock options, and HRE center-cap / finish evidence that must not appear in OC renders.",
      "2026-05-15 automation spot-check: direct model URL still fails for fetchers, but official HRE indexed model-level content remains current for P101SC / Series P1SC and repeats the same forged Monoblok, 19-24 inch, 6061-T6, modern conical profile, side-cut, backpad-pocketing, TPMS/lug compatibility, center-lock, HRE cap, and finish evidence. Treat all HRE marks, caps, optional equipment, and finish labels as internal reference only.",
      "2026-05-15 reference-led rerun: official HRE indexed content for https://www.hrewheels.com/wheels/series-p1sc/p101sc is still model-level P101SC / Series P1SC evidence, not a collection-only source; it confirms Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, 6061-T6 forged aluminum, modern conical profile, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, and HRE cap/optional-equipment evidence. Keep all HRE marks, finish names, caps, and equipment internal-only.",
      "2026-05-15 focused source verification: direct fetch of the official HRE P101SC URL still returns a transient 502 for automation tooling, but official HRE search-index content remains current model-level P101SC / Series P1SC evidence with Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, side cuts, backpad pocketing, 6061-T6 forged aluminum, OE TPMS/lug hardware compatibility, center-lock options, and HRE cap / finish / optional-equipment content that must stay internal-only. Official HRE Series P1SC launch material continues to identify P101SC as the mesh wheel in the P1SC line, supporting the OC mesh-family mapping.",
      "2026-05-15 render-staging QA: do not promote public/forged/generated-staging/renders/oc-p101sc/audi-rs6-c8 because aluminium and magnesium pass a visual placement/no-third-party-logo check, but the carbon image reads as a dark wheel/metal scene rather than a clearly dedicated carbon-composite render.",
      "2026-05-15 launch-material source check: official HRE Series P1SC launch material characterizes P101SC as the mesh wheel in the P1SC line, alongside P104SC as V-spoke, P107SC as split five-spoke, and P111SC as Y-spoke phone dial; keep that geometry mapping internal and do not expose HRE naming, caps, finishes, or equipment in OC public assets.",
      "2026-05-15 automation source re-check: direct open of the official HRE P101SC model URL still returns a fetcher-side 502, but current official HRE indexed model-level content for P101SC / Series P1SC confirms Forged / Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, 6061-T6 forged aluminum, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, optional equipment, and HRE cap evidence that must remain internal-only. Official HRE P1SC launch material still maps P101SC to the mesh style.",
      "2026-05-15 current indexed source audit: direct fetch of the official HRE P101SC model URL still fails for automation tooling, but the official HRE indexed model-level result for https://www.hrewheels.com/wheels/series-p1sc/p101sc remains current and confirms P101SC / Series P1SC, Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, 6061-T6 forged aluminum, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, optional equipment, and HRE cap evidence. The official HRE Series P1SC launch article still identifies P101SC as the mesh wheel in the line; keep all HRE marks, caps, finish names, optional equipment, and launch-copy language internal-only.",
      "2026-05-15 catalog family correction: aligned the visible OC catalog entry to family 'mesh' because official HRE Series P1SC launch material identifies P101SC as the mesh style and the approved internal geometry brief already describes a mesh-style ten paired split-spoke monoblok.",
      "2026-05-15 public render QA: do not approve public/forged/renders/bmw-m3-g80/oc-p101sc yet. Aluminium, magnesium, and carbon show realistic wheel placement, acceptable tire shape, no duplicate/ghost wheels, and no visible third-party marks, but aluminium has a blank/dark center cap instead of a visible small OC cap, and carbon reads too close to dark metal/darkened aluminium rather than a dedicated carbon-composite treatment.",
      "2026-05-15 public render QA: do not approve public/forged/renders/audi-rs6-c8/oc-p101sc yet. Aluminium and magnesium show realistic wheel placement, acceptable tire shape, no duplicate/ghost wheels, and small OC-only center caps with no visible third-party marks, but carbon darkens the whole car scene and reads as black/dark metal rather than a dedicated carbon-composite wheel treatment.",
      "2026-05-16 focused source verification: direct fetch of the official HRE P101SC model URL still returns a fetcher-side 502, but current official HRE indexed model-level content remains available for https://www.hrewheels.com/wheels/series-p1sc/p101sc and confirms P101SC / Series P1SC, Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, 6061-T6 forged aluminum, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, optional equipment, and HRE cap evidence. Official HRE Series P1SC launch material continues to map P101SC to the mesh wheel in the P1SC family; keep all HRE marks, caps, finish names, optional equipment, and launch-copy language internal-only.",
      "Official source imagery/finish labels are internal reference only; do not create public OC finish or color variants from Frozen Dark Clear or HRE cap/equipment options.",
      "Use HRE only as internal geometry reference.",
      "Remove all third-party cap, barrel, lip, and spoke branding.",
      "Generated asset must carry One Company center cap only.",
    ],
  },
  {
    ocSlug: "oc-p104sc",
    ocName: "OC Aero Split 104",
    originalReferenceLabel: "HRE P104SC",
    sourceBrand: "HRE",
    sourceModel: "P104SC",
    sourceUrl: "https://www.hrewheels.com/wheels/series-p1sc/p104sc",
    status: "approved-seed",
    priority: 1,
    construction: "forged monoblok, 6061-T6 aluminum reference",
    verifiedAsOf: "2026-05-16",
    geometryBrief:
      "four paired V-spoke monoblok, angular spoke intersections, broad negative pockets, sculpted outer lip relief, high-load SUV/sedan compatible proportions",
    qaNotes: [
      "2026-05-12 source check: official HRE P104SC model page confirms a model-level Series P1SC page, Forged Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, and 6061-T6 forged aluminum construction.",
      "2026-05-12 re-check: official model-page specifications also confirm the modern conical profile, standard side cuts and backpad pocketing, custom CNC machining per application, OE TPMS/lug hardware compatibility, and center-lock options.",
      "2026-05-12 re-check: official HRE Series P1SC launch material identifies P104SC as the V-spoke style in the P1SC line, reinforcing the four-paired V-spoke geometry brief.",
      "2026-05-12 live source verification: official HRE P104SC page still resolves as a model-level Series P1SC entry with P104SC title, Forged / Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, modern conical profile, side cuts, backpad pocketing, OE TPMS/lug hardware compatibility, center-lock options, and HRE center-cap / optional-equipment evidence that must not appear in OC renders.",
      "2026-05-15 official source check: official HRE P104SC model URL is still indexed as a model-level Series P1SC entry with P104SC title, Forged / Monoblok positioning, 19, 20, 21, 22, 23, and 24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, modern conical profile, side cuts, backpad pocketing, custom CNC machining per application, OE TPMS/lug hardware compatibility, center-lock options, and HRE center-cap / optional-equipment evidence that must not appear in OC renders.",
      "2026-05-15 automation spot-check: direct model URL still fails for fetchers, but official HRE indexed model-level content remains current for P104SC / Series P1SC and repeats the same forged Monoblok, 19-24 inch, 6061-T6, modern conical profile, side-cut, backpad-pocketing, TPMS/lug compatibility, center-lock, HRE cap, optional-equipment, and finish evidence. Treat all HRE marks, caps, optional equipment, and finish labels as internal reference only.",
      "2026-05-15 reference-led source verification: direct open of the official HRE P104SC URL returned automation fetch errors, but current official HRE search-index content still resolves to the model-level P104SC / Series P1SC page with Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, side cuts, backpad pocketing, 6061-T6 forged aluminum, OE TPMS/lug hardware compatibility, center-lock options, and HRE cap / lug / finish evidence that must stay internal-only. Official HRE Series P1SC launch material still maps P104SC to the V-spoke P1SC geometry family.",
      "2026-05-15 render-staging QA: do not promote public renders from public/forged/generated-staging/renders/oc-p104sc/audi-rs6-c8 because the car/body framing shifts across aluminium, magnesium, and carbon files, and the carbon image reads as a darkened aluminium scene rather than a dedicated carbon-composite wheel render.",
      "2026-05-15 public render QA: public/forged/renders/bmw-m3-g80/oc-p104sc passes official-source indexed re-check plus visible no-third-party-logo, realistic wheel-placement, tire-shape, duplicate/ghost-wheel, and oversized-cap checks across aluminium, magnesium, and carbon files; carbon reads as a dedicated dark carbon-composite treatment rather than a darkened aluminium duplicate.",
      "2026-05-15 current source audit: direct fetch of the official HRE P104SC model URL still returns a fetcher-side 502, but official HRE indexed model-level content for P104SC / Series P1SC remains current and confirms Forged Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, 6061-T6 forged aluminum, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, optional equipment, and HRE cap evidence. Official HRE Series P1SC launch material still maps P104SC to the V-spoke geometry family; keep all HRE marks, caps, finish names, optional equipment, and launch-copy language internal-only.",
      "2026-05-16 source verification: official HRE indexed model-level content for https://www.hrewheels.com/wheels/series-p1sc/p104sc remains current for P104SC / Series P1SC and confirms Forged Monoblok positioning, 19-24 inch sizing, Monoblok 1-Piece construction, SUV load rating in 20-24 inch diameters, modern conical profile, 6061-T6 forged aluminum, side cuts, backpad pocketing, custom CNC machining, OE TPMS/lug hardware compatibility, center-lock options, finish labels, optional equipment, and HRE cap evidence. Official HRE Series P1SC launch material still identifies P104SC as the V-spoke style; keep all HRE marks, caps, finish names, optional equipment, and launch-copy language internal-only.",
      "2026-05-16 public render QA: do not approve public/forged/renders/audi-rsq8/oc-p104sc yet. Official HRE indexed model-level source remains current for P104SC / Series P1SC, and all three files show no visible third-party marks, small OC-only center caps, plausible wheel placement, acceptable tire shape, and no duplicate/ghost wheels, but aluminium, magnesium, and carbon shift the car/body framing and tonal treatment across materials; regenerate as one consistent OC-branded material set with a dedicated carbon-composite wheel.",
      "Use HRE only as internal geometry reference.",
      "Confirm no visible HRE text remains in prompts or pixels.",
      "Keep center cap physically small; avoid oversized OC badge.",
    ],
  },
  {
    ocSlug: "oc-p103sc",
    ocName: "OC Aero Multi 103",
    originalReferenceLabel: "HRE P103SC",
    sourceBrand: "HRE",
    sourceModel: "P103SC",
    sourceUrl: "https://www.hrewheels.com/wheels/series-p1sc/p103sc",
    status: "approved-seed",
    priority: 1,
    construction: "forged monoblok, 6061-T6 aluminum reference",
    verifiedAsOf: "2026-05-12",
    geometryBrief:
      "multi-spoke monoblok, track-focused I-beam spoke sides, efficient lug bolt pockets, emphasized spoke intersections, sculpted outer lip surface, modern conical P1SC proportions",
    qaNotes: [
      "2026-05-12 source check: official HRE P103SC model page confirms a model-level Series P1SC page, Forged Monoblok positioning, 19-24 inch availability, Monoblok 1-Piece specification, SUV load rating in 20-24 inch diameters, modern conical profile, and 6061-T6 forged aluminum construction.",
      "Official page describes P103SC as a multi-spoke wheel with purposeful I-Beam structures, efficient lug bolt pockets, additional aggressive design features, and added attention to spoke intersection points and outer lip surface.",
      "Use HRE only as internal geometry reference.",
      "Remove all third-party cap, barrel, lip, and spoke branding.",
      "Generated asset must carry One Company center cap only, kept small and physically plausible.",
    ],
  },
  {
    ocSlug: "oc-fd15",
    ocName: "OC Imperial FD",
    originalReferenceLabel: "Mansory FD.15",
    sourceBrand: "Mansory",
    sourceModel: "FD.15",
    sourceUrl: "https://www.mansory.com/rims/fd-15",
    status: "approved-seed",
    priority: 1,
    construction: "fully forged reference",
    verifiedAsOf: "2026-05-16",
    geometryBrief:
      "luxury multi-spoke directional forged wheel, dense faceted spoke surfaces, large SUV/sedan fitment language, premium tuner aesthetic",
    qaNotes: [
      "2026-05-12 source check: official Mansory FD.15 model page confirms a model-level rim page, Fully forged type, and broad compatible vehicle list including RSQ8, RS6, G-Class/GRONOS, BMW 7 Series, and Bentley/Rolls-Royce applications.",
      "2026-05-12 re-check: official Mansory FD.15 specification rows list 21, 22, 23, 24, and 26 inch applications, multiple width/offset/PCD combinations, and repeated Fully forged type entries, so this entry is backed by model-level fitment evidence rather than a collection index.",
      "2026-05-12 live source verification: direct Mansory FD.15 page still resolves as a model-level rim page with an FD.15 header, Fully forged label, compatible vehicle labels, and repeated Fully forged specification rows across 21-26 inch fitments.",
      "2026-05-15 live source verification: direct official Mansory FD.15 page still resolves as a model-level rim page with FD.15 header, Fully forged label, compatible vehicle labels including GRONOS EVO S, Audi RSQ8, Audi RS6, and BMW 7 Series, repeated Fully forged specification rows across 21, 22, 23, 24, and 26 inch groups, and source finish imagery that must remain internal reference only.",
      "2026-05-15 automation source re-check: direct official Mansory FD.15 URL still resolves as a model-level rim page with FD.15 title, Fully forged positioning, compatible vehicle labels including GRONOS EVO S, Audi RSQ8, Audi RS6, and BMW 7 Series, specification tables spanning 21, 22, 23, 24, and 26 inch groups, and repeated Fully forged type rows; source finish names and imagery remain internal reference only.",
      "2026-05-15 browser source verification: official Mansory FD.15 page resolves directly at the model URL with FD.15 heading, Fully forged label, compatible labels including GRONOS EVO S, Audi RSQ8, Audi RS6, BMW 7 Series, G-Class W465, and 21-26 inch specification groups with repeated Fully forged rows; all Mansory marks, finish labels, and source vehicle/dealer context remain internal-only reference material.",
      "2026-05-15 focused source audit: official Mansory FD.15 model URL still resolves directly with FD.15 heading, Fully forged label, compatible vehicle labels including Audi RSQ8, Audi RS6, BMW 7 Series, G-Class W465, Rolls-Royce Spectre, Bentley Bentayga, and Defender 110, plus specification sections for 21, 22, 23, 24, and 26 inch fitments with repeated Fully forged type rows; Chrome, Black Glossy, Black Diamond, Raw, Mansory marks, and source imagery stay internal-only and must not become public OC variants.",
      "2026-05-15 current source snapshot: official Mansory FD.15 model page still resolves directly with FD.15 heading, Fully forged positioning, compatible labels including Rolls-Royce Spectre, GRONOS EVO S, Audi RSQ8, Audi RS6, BMW 7 Series, G-Class W465, Bentley Bentayga, Defender 110, and Cybertruck, plus 21, 22, 23, 24, and 26 inch specification groups with repeated Fully forged type rows; Chrome, Black Glossy, Black Diamond, Raw, Mansory marks, compatible-car labels, and source imagery remain internal-only and must not be exposed as OC public variants.",
      "2026-05-16 source verification: direct official Mansory FD.15 model URL still resolves as model-level rim evidence with FD.15 heading, Fully forged positioning, compatible vehicle labels including Rolls-Royce Spectre, GRONOS EVO S, Audi RSQ8, Audi RS6, BMW 7 Series, G-Class W465, Bentley Bentayga, Defender 110, Rolls-Royce Cullinan II, and Cybertruck, plus 21, 22, 23, 24, and 26 inch specification groups with repeated Fully forged type rows; Chrome, Black Glossy, Black Diamond, Raw, Mansory marks, compatible-car labels, and source imagery stay internal-only and must not become OC public variants.",
      "2026-05-15 public render QA: public/forged/renders/mercedes-g63-w465/oc-fd15 passes source URL re-check plus visible no-third-party-logo, wheel-placement, tire-shape, duplicate/ghost-wheel, and oversized-cap checks across aluminium, magnesium, and carbon files; carbon reads as a dedicated carbon-composite treatment rather than a darkened aluminium duplicate.",
      "Official FD.15 page exposes Chrome, Black Glossy, Black Diamond, and Raw source finish imagery; treat those as internal reference evidence only and do not create public OC finish or color variants from them.",
      "Useful first for G63 W465, RSQ8, S580 W223, M760 G70.",
      "Do not render Mansory logos or model marks.",
    ],
  },
  {
    ocSlug: "oc-pf13-rs",
    ocName: "OC Motorsport PF13",
    originalReferenceLabel: "Brixton Forged PF13 RS",
    sourceBrand: "Brixton Forged",
    sourceModel: "PF13 RS",
    sourceUrl: "https://brixtonforged.com/forged-wheels/brixton-forged-pf13-rs/",
    status: "approved-seed",
    priority: 1,
    construction: "1-piece lightweight monoblock, 6061-T6 forged aluminum reference",
    verifiedAsOf: "2026-05-16",
    geometryBrief:
      "topology-optimized motorsport monoblock, split-spoke webbing, mid/deep concave profiles, sharp surface transitions, 5-lug and center-lock language",
    qaNotes: [
      "2026-05-12 source check: official Brixton PF13 R / RS model page confirms a model-level page, PF13 RS standard 5-lug and center-lock variants, 1-piece lightweight monoblock construction, 18-24 inch availability, mid/deep concave profiles, 6061-T6 forged aluminum, and TUV / SAE / JWL / VIA testing.",
      "2026-05-12 re-check: the official product specifications also confirm built-to-order per-application custom CNC machining, standard backpad pocketing, water channeling, OEM TPMS compatibility, and center-lock options.",
      "2026-05-12 live source re-check: official page still exposes separate PF13 R, PF13 RS 5-lug, and PF13 RS center-lock product blocks with model imagery, so render geometry can use the RS topology/webbing language but must not inherit Brixton caps, finish labels, logo color-fill placements, or accessory branding.",
      "2026-05-15 live source verification: official Brixton PF13RS page still resolves as a model-level PF13 R / RS page with separate PF13 R, PF13 RS 5-lug, and PF13 RS center-lock product blocks, 1-piece lightweight monoblock construction, 18-24 inch availability, mid/deep concave profile support, 6061-T6 forged aluminum material, TUV / SAE / JWL / VIA testing, built-to-order CNC machining, backpad pocketing, water channeling, OEM TPMS compatibility, and center-lock options. Source page also exposes Brixton cap, finish, and logo-fill options that must be suppressed in OC-branded renders.",
      "2026-05-15 automation source re-check: official Brixton PF13RS URL still resolves as a model-level PF13 R / RS page with distinct PF13 R 5-lug, PF13 RS 5-lug, and PF13 RS center-lock product blocks, 1-piece lightweight monoblock construction, 18-24 inch sizing, mid/deep concave specification, 6061-T6 forged aluminum, TUV / SAE / JWL / VIA testing, built-to-order CNC machining, backpad pocketing, water channeling, OEM TPMS compatibility, center-lock options, and explicit center-cap / finish / logo-fill accessory evidence that remains internal reference only.",
      "2026-05-15 browser source verification: direct official Brixton PF13RS model page resolves with Brixton Forged PF13 R / RS title, PF13 R 5-lug, PF13 RS 5-lug, and PF13 RS center-lock product blocks, 1-piece lightweight monoblock construction, 18-24 inch diameters, mid/deep concave product specifications, 6061-T6 aerospace forged aluminum, backpad pocketing, water channeling, OE TPMS compatibility, center-lock options, TUV / SAE / JWL / VIA testing, plus center-cap, finish, and color-fill accessory content that must stay internal and never appear on OC public assets.",
      "2026-05-15 public render QA: public/forged/renders/bmw-m3-g80/oc-pf13-rs passes visible OC-only center-cap, wheel-placement, tire-shape, and duplicate/ghost-wheel checks across aluminium, magnesium, and carbon files, but the carbon file reads as a dark wheel rather than a dedicated carbon-composite render. Do not treat this render set as fully approved until carbon is replaced.",
      "2026-05-15 focused source verification: official Brixton PF13RS model page remains indexed as current model-level PF13 R / RS evidence with PF13 RS 5-lug and center-lock blocks, 1-piece lightweight monoblock construction, 18-24 inch sizing, mid/deep concave profiles, 6061-T6 aerospace forged aluminum, TUV / SAE / JWL / VIA testing, OE TPMS compatibility, center-lock options, and center-cap / finish / logo-fill accessory content that must stay internal-only. Existing public/forged/renders/bmw-m3-g80/oc-pf13-rs aluminium and magnesium renders remain usable, but carbon remains blocked because it reads as dark painted metal rather than a dedicated carbon-composite render.",
      "2026-05-15 direct source verification: official Brixton PF13RS model URL resolves directly with PF13 R / RS title, separate PF13 R 5-lug, PF13 RS 5-lug, and PF13 RS center-lock blocks, 1-piece lightweight monoblock construction, 18-24 inch diameters, mid/deep concave profile, 6061-T6 aerospace forged aluminum, TUV / SAE / JWL / VIA testing, OE TPMS compatibility, center-lock options, and center-cap / finish / logo-fill evidence that must remain internal-only.",
      "2026-05-15 automation web verification: official Brixton PF13RS model URL still opens directly as a model-level page with PF13 R / RS title, distinct PF13 R 5-lug, PF13 RS 5-lug, and PF13 RS center-lock blocks, 1-piece lightweight monoblock construction, 18-24 inch sizing, mid/deep concave profile support, 6061-T6 aerospace forged aluminum, TUV / SAE / JWL / VIA testing, OE TPMS compatibility, center-lock options, and center-cap / finish / brand logo-fill evidence that must remain internal-only.",
      "2026-05-15 post-memory-init source verification: official Brixton PF13RS model URL resolved directly as model-level PF13 R / RS evidence with PF13 RS 5-lug and center-lock blocks, 1-piece lightweight monoblock construction, 18-24 inch sizing, mid/deep concave support, 6061-T6 aerospace forged aluminum, TUV / SAE / JWL / VIA testing, OE TPMS compatibility, and center-cap / finish / logo-fill accessory evidence that must stay internal-only.",
      "2026-05-16 source verification: direct official Brixton PF13RS model URL still resolves as model-level PF13 R / RS evidence with separate PF13 R 5-lug, PF13 RS 5-lug, and PF13 RS center-lock blocks; 1-piece lightweight monoblock construction; 18-24 inch diameters; mid/deep concave profile support; 6061-T6 aerospace forged aluminum; TUV / SAE / JWL / VIA testing; OE TPMS compatibility; built-to-order CNC machining; backpad pocketing / water channeling; center-lock options; and center-cap / finish / logo-fill accessory evidence that must remain internal-only for OC renders.",
      "Keep OC naming neutral because the source page explicitly includes PF13 R and PF13 RS variants.",
      "Official page exposes Brixton center-cap options and brand logo color-fill placements; OC renders must suppress both and use only a small One Company center cap.",
    ],
  },
  {
    ocSlug: "oc-al13-rs80",
    ocName: "OC Precision RS80",
    originalReferenceLabel: "AL13 RS80",
    sourceBrand: "AL13",
    sourceModel: "RS80",
    sourceUrl: "https://al13wheels.com/forged-wheels/",
    status: "needs-model-page-review",
    priority: 2,
    construction: "RS Series reference, 3-piece availability listed by official collection page",
    verifiedAsOf: "2026-05-12",
    geometryBrief:
      "AL13 RS-series candidate; exact spoke geometry must be verified from model imagery before generation",
    qaNotes: [
      "2026-05-12 source check: official AL13 Wheel Collection page lists RS80 under RS Series, with 19-24 inch sizes and 3-Piece availability / starting at $3225 ea for the series.",
      "2026-05-12 follow-up: official RS80 tile resolves directly to https://al13wheels.com/wp-content/uploads/2025/04/RS80-800x800.jpg, not to a model detail page.",
      "No standalone official RS80 model page was found in official search results during this run.",
      "2026-05-12 re-check: official AL13 domain search still surfaces the collection page, manufacturing/finish pages, and vehicle gallery posts only; no RS80 model-level detail page was found.",
      "Do not generate from this entry until model-level imagery is selected.",
      "Use collection page only as index, not final geometry proof.",
    ],
  },
  {
    ocSlug: "oc-mv-cr05",
    ocName: "OC Corsa CR05",
    originalReferenceLabel: "MV Forged CR05",
    sourceBrand: "MV Forged",
    sourceModel: "CR05",
    sourceUrl: "https://mvforged.com/vehicle_gallery/lamborghini-revuelto-mv-forged-cr05-2/",
    status: "approved-seed",
    priority: 2,
    construction:
      "Corsa Series 1/2/3-piece forged reference; official CR05 applications show 1-piece and 3-piece forged builds",
    verifiedAsOf: "2026-05-16",
    geometryBrief:
      "Corsa forged split-spoke/twin-spoke language, standardized central hub undercut, harsh drafted angles, exaggerated primary cuts, thin spoke silhouette, supercar-focused fitment stance",
    qaNotes: [
      "2026-05-12 source re-check: official MV Forged CR05 vehicle-gallery page confirms a Revuelto CR05 application, model-specific imagery, Corsa Series, 3-piece forged construction, 21x9.5 / 22x12.5 sizing, and MV-branded cap evidence that must be removed from OC renders.",
      "Official 1-piece Revuelto project page confirms wheel style MV Forged CR05, Corsa Series, F21x9.5 / R22x12.5 sizing, 1-piece forged construction, and pocketing / undercuts: https://mvforged.com/lamborghini-revuelto/.",
      "Official secondary Revuelto CR05 project page confirms the same sizing with Corsa Series 3-piece forged construction, pocketing / undercuts, and model-specific image filenames: https://mvforged.com/lamborghini-revuelto-3/.",
      "2026-05-12 verification: official Corsa Series page (https://mvforged.com/corsa-series/) lists CR05 and confirms the shared profile-undercut design language, light-weight 1/2/3-piece configuration, 6061 T6 forged aluminum / titanium / carbon materials, 18-24 inch diameters, and CR05 Revuelto imagery links.",
      "2026-05-12 live verification: primary official MV Forged vehicle-gallery source still resolves as a CR05 Revuelto application with 3-Piece Forged configuration, 21x9.5 / 22x12.5 specs, and MV 4-piece cap evidence; companion official project pages still confirm CR05 wheel style, Corsa Series, 1-piece/3-piece forged construction, pocketing/undercuts, and model-specific CR05 image filenames.",
      "2026-05-15 live source verification: official MV Forged CR05 Revuelto vehicle-gallery page still resolves with MV Forged CR05 title, model-specific lamborghini-revuelto-cr05-3pc image filenames, Corsa Series classification, 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, and MV 4-piece center-cap evidence. Companion official Revuelto project pages still confirm MV Forged CR05 wheel style, Corsa Series, 1-Piece Forged and 3-Piece Forged constructions, F21x9.5 / R22x12.5 sizing, pocketing / undercuts, and model-specific CR05 imagery. The Corsa Series page remains series/spec support only and lists CR05 plus shared profile-undercut language, 1/2/3-piece configuration, 6061 T6 forged aluminum / titanium / carbon materials, and 18-24 inch diameters.",
      "2026-05-15 automation source re-check: official MV Forged CR05 vehicle-gallery URL still resolves as a model-specific Revuelto CR05 application with 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, model-specific cr05-3pc imagery, and MV 4-piece cap evidence. Official Revuelto project companions still confirm CR05 wheel style, Corsa Series, 1-Piece Forged and 3-Piece Forged constructions, pocketing / undercuts, and matching F21x9.5 / R22x12.5 sizing; use the Corsa Series page only as supporting evidence for shared hub-undercut language, material range, and 18-24 inch diameter support.",
      "2026-05-15 focused source verification: official MV Forged CR05 vehicle-gallery page remains a model-specific Revuelto CR05 source with 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, CR05 image filenames, and MV 4-piece cap evidence. Companion official Revuelto pages confirm CR05 wheel style, Corsa Series, 1-Piece Forged and 3-Piece Forged constructions, pocketing / undercuts, and matching F21x9.5 / R22x12.5 sizing; official Corsa Series page lists CR05 and supports the shared profile-undercut design language, 6061 T6 forged aluminum / titanium / carbon material range, 18-24 inch diameters, and cap / finish / logo-fill evidence that must stay internal-only.",
      "2026-05-15 reference-led source verification: direct official sourceUrl https://mvforged.com/vehicle_gallery/lamborghini-revuelto-mv-forged-cr05-2/ still resolves as a model-specific Lamborghini Revuelto MV Forged CR05 page with MV Forged CR05 heading, 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, CR05 3pc image filenames, Brushed Satin / Polished Gloss Olympic Bronze finish evidence, and MV Forged 4-piece center-cap evidence. Companion official Revuelto project pages still confirm CR05 wheel style in Corsa Series, 1-Piece Forged and 3-Piece Forged builds, pocketing / undercuts, F21x9.5 / R22x12.5 sizing, and the Corsa Series page remains support only for shared profile-undercut geometry, 6061 T6 forged aluminum / titanium / carbon material range, 18-24 inch diameters, and internal-only cap / finish / logo-fill references.",
      "2026-05-15 source URL audit: official MV Forged sourceUrl still opens as a model-specific Lamborghini Revuelto CR05 gallery with CR05 heading, 3-Piece Forged configuration, 21x9.5 / 22x12.5 specs, CR05 image filenames, Olympic Bronze finish evidence, and MV 4-piece cap evidence. Official companion project pages still confirm CR05 as Corsa Series in both 1-Piece Forged and 3-Piece Forged builds with pocketing / undercuts, while the Corsa Series page remains supporting evidence only for shared profile-undercut geometry, 6061 T6 forged aluminum / titanium / carbon materials, 18-24 inch sizing, CR05 listing, finish/logo-fill options, and cap options that must stay internal-only.",
      "2026-05-15 public render QA: public/forged/renders/bmw-m3-g80/oc-mv-cr05 passes official-source URL re-check plus visible OC-only center-cap, third-party-logo, wheel-placement, tire-shape, duplicate/ghost-wheel, and oversized-cap checks across aluminium, magnesium, and carbon files; carbon reads as a dedicated dark carbon-composite treatment rather than a darkened aluminium duplicate.",
      "2026-05-15 automation follow-up source verification: direct MV Forged sourceUrl and official Lamborghini Revuelto project page both remain model-specific CR05 evidence. The gallery confirms MV Forged CR05 heading, 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, CR05 image filenames, Olympic Bronze finish, and MV 4-piece center-cap evidence; the companion project confirms CR05 wheel style, Corsa Series, 1-Piece Forged construction, pocketing / undercuts, F21x9.5 / R22x12.5 sizing, and MV cap/dealer context. The Corsa Series page remains support-only for shared hub-undercut language, 1/2/3-piece configuration, 6061 T6 forged aluminum / titanium / carbon material range, 18-24 inch sizing, and CR05 listing; all marks, caps, finishes, and dealer/social context stay internal-only.",
      "2026-05-16 source URL audit: direct official MV Forged sourceUrl still resolves as a model-specific Lamborghini Revuelto MV Forged CR05 gallery with MV Forged CR05 heading, 3-Piece Forged configuration, 21x9.5 / 22x12.5 sizing, CR05 3pc image filenames, Brushed Satin / Polished Gloss Olympic Bronze finish evidence, and MV Forged 4-piece center-cap evidence. Treat all MV marks, finishes, fitted-by/dealer context, and cap details as internal-only reference; public OC renders must remain no-logo except for a small One Company center cap.",
      "Treat the Corsa Series page as series/spec support only; geometry approval for OC renders comes from the official CR05 Revuelto application pages with model-specific image filenames.",
      "Do not render MV Forged caps, text fills, spoke marks, or third-party vehicle/dealer identifiers.",
      "Use a small One Company center cap and preserve the central hub undercut without oversizing the badge.",
    ],
  },
];

export const FORGED_REFERENCE_TARGET_CARS = [
  "audi-rs6-c8",
  "bmw-m5-f90",
  "bmw-m5-g90",
  "audi-rsq8",
  "mercedes-g63-w465",
  "bmw-m3-g80",
  "bmw-m760-g70",
  "mercedes-s580-w223",
] as const;
