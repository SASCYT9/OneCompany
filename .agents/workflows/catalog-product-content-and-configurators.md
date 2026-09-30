# Catalog product content, options, and pricing standard

Use this workflow when refreshing a manufacturer catalog, importing new SKUs,
or adding supplier options to existing product pages.

## Product content and options

- Write complete, readable UA and EN descriptions from official manufacturer
  information. Preserve source specifications, fitment, included parts,
  installation notes, and limitations. Do not invent claims or compatibility.
- Apply product-specific enrichment only when its facts are tied to the exact
  SKU. Otherwise show the supplier's own copy; do not infer construction,
  performance, fitment, or kit contents from the category alone.
- Do not state that a part was made in Sweden based only on do88 being a Swedish
  brand; include product country of origin only when its source says so.
- Use the shared product variant selector for every product page. When the
  manufacturer offers selectable options, store the source option names and
  values, each exact SKU, and the price for each combination as product options
  and variants. The selected variant must determine the SKU and price; if the
  source supplies a distinct image for that SKU, the product gallery must show it.
- Preserve all three supplier option axes when present. Before publication,
  reject duplicate option combinations for distinct SKUs and verify that the
  part number at the top of the page follows the selected variant. Translate
  option labels for UA while keeping the original values used for matching.
- Keep a normal purchase flow for products with no manufacturer options. Do
  not create artificial variants or product-specific configurator components
  when the shared selector can represent the source choices.

## Vehicle fitment filters

- Add model, chassis, year, and engine fitment only when the manufacturer's
  SKU page or vehicle category supports that exact application. Use exact
  category segments, not substring guesses from marketing titles.
- A cross-category or shared-platform result needs an explicit manufacturer
  application list and a narrow product/title gate. A shared engine name by
  itself does not prove vehicle compatibility.
- Link an accessory to another SKU only through a source-defined identifier
  with one unambiguous parent (for example, do88 hose-clamp kit numbers).
  If the parent is absent or multiple parents match, leave the accessory out
  of model/chassis results until reviewed.
- If the source supplies a make but no model, allow make-level discovery and
  leave model/chassis unset. Never invent a model to fill the selector.
- Keep the product page compatibility block and the collection filter on the
  same reviewed fitment mapping so they cannot drift apart.

## do88 manufacturer scope

- Show the complete published do88 manufacturer assortment. Do not hide valid
  do88 products by price, vehicle make, platform age, or an editorial shortlist.
  Vehicle filters still require the reviewed, source-supported application rules.
- Include products manufactured by do88 only. The do88performance.eu shop also
  sells third-party brands; retailer ownership and a structured-data `brand`
  field are not proof that do88 made the product.
- Do not automatically import or price explicit third-party product lines such
  as BMC, GFB, Garrett, Setrab, or Mikalor. Keep uncertain manufacturer matches
  out of automatic changes until confirmed.

## do88 price rule

- Source: `https://www.do88performance.eu/`, English Europe storefront, EUR,
  **Customer / Incl. VAT** (`MOMS=inkl.`).
- Storefront EUR price = the currently displayed customer price × **1.10**,
  including an active customer promotion, rounded to two decimal places.
  Example: EUR 100.00 → EUR 110.00.
- Do not add VAT again, round to €5, or apply the margin to the current
  OneCompany price. Recalculate from the current supplier customer price on
  every refresh so the margin never compounds.
- For selectable options, use each exact variant's customer price when
  available. Do not copy the parent price onto variants with their own source
  price.
- Update the EUR base field through the established pricing flow; preserve B2B
  and other currency fields unless another approved rule covers them.
- Keep source URL, source SKU, source customer price, calculated price, and
  retrieval date in the review output.

## Shipping weight and package dimensions

- Record shipping weight in kilograms and package length, width, and height in
  centimeters. These fields describe the packed item for delivery, not the
  bare product.
- Prefer an exact-SKU manufacturer shipping specification. If the manufacturer
  does not publish it, use an exact-SKU retailer value only when the unit and
  product identity are explicit; retain the evidence URL and source value.
- Keep weights from conflicting listings in review. Do not resolve conflicts
  by averaging, and do not treat a repeated default-looking value (such as
  1 kg) as verified without corroboration.
- Product core size, diameter, hose length, and overall component dimensions
  are technical specifications. Never copy them into package dimensions.
- If a shipping estimate is explicitly approved, mark
  `isDimensionsEstimated=true` and keep the estimate separate from verified
  source measurements. Never present an estimate as manufacturer-confirmed.
- Do not publish a product with guessed dimensions or weight as verified.
  Preserve missing and conflicting-field review status until supplier data or
  an approved estimate is available.

## Review and publication

- A supplier listing is a discovery source, not proof of manufacturer.
- Review manufacturer scope, fitment, option-to-SKU mapping, price coverage,
  and UA/EN copy before import.
- Preview and reconcile the complete batch before a catalog write. A local
  review plan is not a published catalog update.
