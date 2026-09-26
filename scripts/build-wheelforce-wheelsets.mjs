#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultRawDir = path.join(repoRoot, ".tmp", "wheelforce-wheelsets", "raw");
const defaultComponentRawDir = path.join(repoRoot, ".tmp", "wheelforce-wheelset-components");
const defaultSourceCatalog = path.resolve(repoRoot, "..", "One Company", "OneCompany", "data", "wheelforce", "source-catalog.json");
const defaultOutput = path.join(repoRoot, "src", "data", "wheelforce", "wheel-only-sets.json");
const args = process.argv.slice(2);
const writeOutput = args.includes("--write");
const argValue = (name, fallback) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
const rawDir = path.resolve(argValue("--raw-dir", defaultRawDir));
const componentRawDir = path.resolve(argValue("--component-raw-dir", defaultComponentRawDir));
const sourceCatalogPath = path.resolve(argValue("--source-catalog", defaultSourceCatalog));
const outputPath = path.resolve(argValue("--output", defaultOutput));

function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberToken(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWheelIdentity(title) {
  const parts = clean(title).split("|").map(clean);
  if (parts.length < 3) return null;
  const model = normalizeText(parts[0].replace(/^wf\s*/i, ""));
  const spec = parts[1].replace(/(\d),(\d)/g, "$1.$2");
  const dimension = spec.match(/\b(\d{1,2}(?:\.\d+)?)\s*[x×]\s*(\d{1,2}(?:\.\d+)?)/i);
  const offset = spec.match(/\bET\s*(-?\d{1,2}(?:\.\d+)?)/i);
  const pcd = spec.match(/\b([4-6])\s*(?:\/|x|×)\s*(\d{2,3}(?:\.\d+)?)/i) ??
    spec.match(/\b(\d{2,3}(?:\.\d+)?)\s*\/\s*([4-6])\b/i);
  if (!model || !dimension || !offset || !pcd) return null;
  const boltCount = pcd[2] && pcd[2].length <= 1 ? pcd[2] : pcd[1];
  const pcdValue = pcd[2] && pcd[2].length > 1 ? pcd[2] : pcd[1];
  const finish = normalizeText(parts.slice(2).join(" | "));
  const diameter = numberToken(dimension[1]);
  const width = numberToken(dimension[2]);
  const et = numberToken(offset[1]);
  const pcdNumber = numberToken(pcdValue);
  if (diameter == null || width == null || et == null || pcdNumber == null || !finish) return null;
  const key = [model, diameter, width, et, boltCount, pcdNumber, finish].join("|");
  return { key, model, diameter, width, et, boltCount: Number(boltCount), pcd: pcdNumber, finish, spec: clean(parts[1]) };
}

function euroGross(value) {
  const normalized = clean(value).replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function productWeightFacts(product) {
  const $ = cheerio.load(product.descriptionHtml ?? "");
  const attributes = new Map();
  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    const label = clean(cells.eq(0).text()).replace(/:$/, "").toLowerCase();
    const value = clean(cells.eq(1).text());
    if (label && value) attributes.set(label, value);
  });
  const readKg = (label) => {
    const match = attributes.get(label)?.match(/(\d+(?:[,.]\d+)?)\s*kg/i)?.[1];
    const value = numberToken(match);
    return value != null && value > 0 ? value : null;
  };
  return { shippingWeightKg: readKg("versandgewicht"), articleWeightKg: readKg("artikelgewicht") };
}

function vehicleLabelFromSetTitle(title) {
  return clean(String(title ?? "").split("|").at(-1));
}

function fitmentRows($) {
  return $("#mas-suitable-vehicles tbody tr")
    .map((_, row) => $(row).find("td").map((__, cell) => clean($(cell).text())).get())
    .get()
    .reduce((result, _, index, cells) => {
      if (index % 5 !== 0) return result;
      const [make, model, engine, power, yearText] = cells.slice(index, index + 5);
      if (!make || !model) return result;
      const years = [...String(yearText ?? "").matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
      result.push({
        make,
        model,
        engine: engine || null,
        power: power || null,
        yearText: yearText || null,
        yearFrom: years[0] ?? null,
        yearTo: years[1] ?? null,
      });
      return result;
    }, []);
}

function parsePartComponents($, wheelByIdentity) {
  const rows = [];
  $("#slider-partslist .slick-type-product").children(".product-wrapper").each((position, element) => {
    const row = $(element);
    const imageTitle = clean(row.find("img[alt]").first().attr("alt"));
    const label = clean(row.text());
    const quantityMatch = label.match(/(?:^|\s)(\d+)\s*x\s+(.+)$/i);
    if (!quantityMatch) return;
    const quantity = Number(quantityMatch[1]);
    const componentTitle = imageTitle || clean(quantityMatch[2]);
    const identity = parseWheelIdentity(componentTitle);
    if (identity) {
      rows.push({
        kind: "wheel",
        position,
        quantity,
        sourceTitle: componentTitle,
        identity,
        product: matchWheelSource(identity, wheelByIdentity),
      });
      return;
    }
    const sensorMatch = componentTitle.match(/\b(?:RDKS|TPMS)\b/i);
    if (sensorMatch) rows.push({ kind: "tpms", position, quantity, sourceTitle: componentTitle });
    else if (/\b(?:MICHELIN|CONTINENTAL|HANKOOK|PIRELLI|GOODYEAR|BRIDGESTONE|DUNLOP|VREDESTEIN|NOKIAN|FALKEN|YOKOHAMA|TOYO|KUMHO)\b/i.test(componentTitle)) {
      rows.push({ kind: "tire", position, quantity, sourceTitle: componentTitle });
    } else if (/montageservice|montagezubehör|mounting service|mounting accessories/i.test(componentTitle)) {
      rows.push({ kind: "service", position, quantity, sourceTitle: componentTitle });
    } else {
      rows.push({ kind: "other", position, quantity, sourceTitle: componentTitle });
    }
  });
  return rows;
}

function accessoryOptions($) {
  return $(".zubehoer-box")
    .map((_, box) => {
      const input = $(box).find("input.zubehoer-quantity").first();
      const label = $(box).find("label.labelname").first();
      const sku = input.attr("data-artnr")?.trim();
      const price = numberToken(input.attr("data-preis"));
      const title = label.find(".zub-content").clone()
        .find(".css-bundle-strong, .zubehoer-item-information, i")
        .remove().end().text().replace(/\s+/g, " ").trim();
      const rawImage = label.find(".zub-image img").attr("src") || "";
      let imageUrl = null;
      try {
        const image = new URL(rawImage);
        if (image.hostname === "wheelforce.de" && !/keinbild\.gif/i.test(image.pathname)) {
          image.pathname = image.pathname.replace(/\/(?:xs|sm|md|lg)\//, "/lg/");
          imageUrl = image.toString();
        }
      } catch {}
      if (!sku || !title || price == null) return null;
      return { sku, title, sourcePriceEurGross: price, imageUrl };
    })
    .get().filter(Boolean);
}

function parseOfficialWheelProduct(html, sourceUrl) {
  const $ = cheerio.load(html);
  const title = clean($("h1").first().text());
  const skuText = clean($(".product-sku").text());
  const sku = skuText.match(/(?:Artikelnummer|SKU)\s*:\s*([^\s]+)/i)?.[1] ?? null;
  const sourcePriceEurGross = euroGross($(".price_wrapper .price.h2").first().text() || $(".price.h2").first().text());
  if (!title || !sku || !/^WF\b/i.test(title) || sourcePriceEurGross == null) return null;
  const imageUrls = $("#gallery img.product-image").map((_, element) => {
    const srcset = $(element).attr("srcset") || "";
    const largeImage = [...srcset.matchAll(/(https:\/\/[^\s,]+\/lg\/[^\s,]+)\s+\d+w/g)].at(-1)?.[1];
    return largeImage || $(element).attr("data-src") || $(element).attr("src");
  }).get().filter((value) => value && /^https:\/\/wheelforce\.de\//i.test(value) && !/keinbild\.gif/i.test(value));
  return {
    sku,
    title,
    sourcePriceEurGross,
    imageUrls: [...new Set(imageUrls)],
    descriptionHtml: $("#wf-detaildesc").first().html()?.trim() || null,
    accessoryOptions: accessoryOptions($),
    sourceUrl: $("link[rel='canonical']").attr("href") || sourceUrl,
  };
}

async function extraWheelProducts() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(componentRawDir, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
  const products = [];
  for (const item of manifest) {
    const file = path.join(componentRawDir, `component-${String(item.index).padStart(4, "0")}.html`);
    try {
      const parsed = parseOfficialWheelProduct(await readFile(file, "utf8"), item.searchUrl);
      if (parsed) products.push({ ...parsed, searchedTitle: item.title });
    } catch {}
  }
  return products;
}

function allRowsSummary(filePath, $) {
  const visibleRows = fitmentRows($);
  const infoText = clean($("#mas-suitable-vehicles_info").text() || $(".dataTables_info").text());
  const total = Number(infoText.match(/insgesamt\s+(\d+)/i)?.[1] ?? infoText.match(/of\s+(\d+)/i)?.[1] ?? 0);
  return { visibleRows, reportedTotal: total || visibleRows.length, infoText, filePath };
}

function sourceWheelIndex(source) {
  const exact = new Map();
  const byGeometry = new Map();
  const products = (source.products ?? []).flatMap((product) => {
    const identity = parseWheelIdentity(product.title);
    return identity && Number(product.sourcePriceEurGross) > 0
      ? [{ ...product, identity, geometryKey: [identity.model, identity.diameter, identity.width, identity.et, identity.boltCount, identity.pcd].join("|") }]
      : [];
  });
  for (const product of products) {
    const current = exact.get(product.identity.key);
    if (current && current.sku !== product.sku) {
      throw new Error(`Duplicate manufacturer wheel identity maps to multiple SKUs: ${product.identity.key} (${current.sku}, ${product.sku})`);
    }
    if (!current || (current.imageUrls?.length ?? 0) < (product.imageUrls?.length ?? 0)) exact.set(product.identity.key, product);
    const geometryMatches = byGeometry.get(product.geometryKey) ?? [];
    geometryMatches.push(product);
    byGeometry.set(product.geometryKey, geometryMatches);
  }
  return { exact, byGeometry };
}

function matchWheelSource(identity, sourceIndex) {
  const exact = sourceIndex.exact.get(identity.key);
  if (exact) return exact;
  const geometryKey = [identity.model, identity.diameter, identity.width, identity.et, identity.boltCount, identity.pcd].join("|");
  const candidates = (sourceIndex.byGeometry.get(geometryKey) ?? []).filter((product) =>
    product.identity.finish.startsWith(identity.finish) || identity.finish.startsWith(product.identity.finish)
  );
  const unique = [...new Map(candidates.map((product) => [product.sku, product])).values()];
  return unique.length === 1 ? unique[0] : null;
}

function selectAxles(wheels) {
  const bySku = new Map();
  for (const wheel of wheels) {
    const record = bySku.get(wheel.product.sku) ?? { product: wheel.product, quantity: 0, identity: wheel.identity, positions: [] };
    record.quantity += wheel.quantity;
    record.positions.push(wheel.position);
    bySku.set(wheel.product.sku, record);
  }
  const parts = [...bySku.values()];
  const total = parts.reduce((sum, part) => sum + part.quantity, 0);
  if (total !== 4 || parts.length > 2 || parts.some((part) => part.quantity !== 2 && part.quantity !== 4)) {
    return { error: `Expected four wheels from one or two 2-piece specs, got ${total} across ${parts.length} specs` };
  }
  if (parts.length === 1 && parts[0].quantity === 4) {
    return { front: { ...parts[0], quantity: 2 }, rear: { ...parts[0], quantity: 2 }, sameSpec: true };
  }
  if (parts.length !== 2 || parts[0].quantity !== 2 || parts[1].quantity !== 2) {
    return { error: "Four-wheel set does not split into two axle pairs" };
  }
  const [first, second] = parts;
  if (first.identity.width === second.identity.width) {
    return { error: "Front/rear assignment is ambiguous because both pairs have the same width" };
  }
  const front = first.identity.width < second.identity.width ? first : second;
  const rear = front === first ? second : first;
  return { front, rear, sameSpec: false };
}

function itemSkuFromAccessory(sku, sourceProducts) {
  for (const product of sourceProducts) {
    const option = product.accessoryOptions?.find((candidate) => candidate.sku === sku);
    if (option) return { ...option, title: option.title };
  }
  return null;
}

function optionQuantity(sku) {
  return sku === "WF14066" ? 4 : 1;
}

function optionIsRelevant(title) {
  return /cap|valve|bolts|radbolzen|tpms|rdks|care.*kit|cleaner kit/i.test(title) && !/grille|racegitter|keychain|bottle|powerbank|montage/i.test(title);
}

function buildOptions(packageOptions, wheelProducts, tpmsParts) {
  const bySku = new Map();
  for (const option of packageOptions) {
    if (optionIsRelevant(option.title)) bySku.set(option.sku, option);
  }
  for (const wheel of wheelProducts) {
    for (const option of wheel.accessoryOptions ?? []) {
      if (optionIsRelevant(option.title)) {
        const existing = bySku.get(option.sku);
        if (!existing || option.title.toLowerCase().includes("tpms")) bySku.set(option.sku, option);
      }
    }
  }
  if (tpmsParts.some((part) => part.quantity === 4)) {
    const sensor = itemSkuFromAccessory("WF14066", wheelProducts);
    if (sensor) bySku.set(sensor.sku, sensor);
  }
  return [...bySku.values()].map((option) => ({
    sku: option.sku,
    title: option.title,
    sourcePriceEurGross: Number(option.sourcePriceEurGross),
    quantity: optionQuantity(option.sku),
    imageUrl: option.imageUrl ?? null,
  })).filter((option) => option.sourcePriceEurGross > 0);
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(rawDir, "manifest.json"), "utf8"));
  const source = JSON.parse(await readFile(sourceCatalogPath, "utf8"));
  const extraProducts = await extraWheelProducts();
  const sourceProducts = [...(source.products ?? []), ...extraProducts];
  const wheelIndex = sourceWheelIndex({ products: sourceProducts });
  const entries = [];
  const rejected = [];
  let soldOut = 0;
  for (const packageInfo of manifest.products ?? []) {
    const filePath = path.join(rawDir, `set-${String(packageInfo.index).padStart(4, "0")}.html`);
    let html;
    try {
      html = await readFile(filePath, "utf8");
    } catch {
      rejected.push({ sourceTitle: packageInfo.title, sourceUrl: packageInfo.url, reason: "detail page missing" });
      continue;
    }
    const $ = cheerio.load(html);
    const title = clean($("h1").first().text());
    const skuText = clean($(".product-sku").text());
    const sku = skuText.match(/(?:Artikelnummer|SKU)\s*:\s*([^\s]+)/i)?.[1] ?? null;
    const parts = parsePartComponents($, wheelIndex);
    const wheels = parts.filter((part) => part.kind === "wheel" && part.product);
    const unmappedWheels = parts.filter((part) => part.kind === "wheel" && !part.product);
    const wheelLooking = parts.filter((part) => parseWheelIdentity(part.sourceTitle ?? ""));
    if (unmappedWheels.length) {
      rejected.push({ sourceTitle: title || packageInfo.title, sourceSku: sku, sourceUrl: packageInfo.url, reason: "wheel component SKU not in source catalog", components: unmappedWheels.map((part) => part.sourceTitle) });
      continue;
    }
    if (!sku || !title || wheelLooking.length !== wheels.length) {
      rejected.push({ sourceTitle: title || packageInfo.title, sourceSku: sku, sourceUrl: packageInfo.url, reason: "missing kit identity or wheel component data" });
      continue;
    }
    const axle = selectAxles(wheels);
    if (axle.error) {
      rejected.push({ sourceTitle: title, sourceSku: sku, sourceUrl: packageInfo.url, reason: axle.error, debug: axle.debug ?? null });
      continue;
    }
    const fitment = allRowsSummary(filePath, $);
    if (!fitment.visibleRows.length || fitment.reportedTotal > fitment.visibleRows.length) {
      rejected.push({ sourceTitle: title, sourceSku: sku, sourceUrl: packageInfo.url, reason: !fitment.visibleRows.length ? "no manufacturer fitment rows" : "fitment table is paginated or incomplete", fitmentsFound: fitment.visibleRows.length, fitmentsReported: fitment.reportedTotal, fitmentInfo: fitment.infoText });
      continue;
    }
    const componentGross = (2 * Number(axle.front.product.sourcePriceEurGross)) + (2 * Number(axle.rear.product.sourcePriceEurGross));
    if (!Number.isFinite(componentGross) || componentGross <= 0) {
      rejected.push({ sourceTitle: title, sourceSku: sku, sourceUrl: packageInfo.url, reason: "invalid wheel-only set price" });
      continue;
    }
    const packageGross = euroGross($(".price_wrapper .price.h2").first().text() || $(".price.h2").first().text());
    const pageOptions = accessoryOptions($);
    const tpmsParts = parts.filter((part) => part.kind === "tpms");
    const wheelProducts = [...new Map(wheels.map((part) => [part.product.sku, part.product])).values()];
    const pageText = clean($("body").text());
    const availability = /momentan nicht verf[uü]gbar|ausverkauft|not available|sold out/i.test(pageText)
      ? "unavailable"
      : /bestellbar|orderable/i.test(pageText)
        ? "orderable"
        : "unknown";
    if (availability === "unavailable") soldOut += 1;
    entries.push({
      manufacturerSetSku: sku,
      manufacturerSetTitle: title,
      manufacturerSetUrl: $("link[rel='canonical']").attr("href") || packageInfo.url,
      manufacturerSetGrossEurWithNonWheelItems: packageGross,
      availability,
      priceMethod: "2 x front wheel manufacturer gross + 2 x rear wheel manufacturer gross; VAT-inclusive source values",
      sourcePriceEurGross: Math.round((componentGross + Number.EPSILON) * 100) / 100,
      front: {
        sku: axle.front.product.sku,
        title: axle.front.product.title,
        sizeSpec: axle.front.identity.spec,
        quantity: 2,
        unitSourcePriceEurGross: Number(axle.front.product.sourcePriceEurGross),
        ...productWeightFacts(axle.front.product),
        imageUrls: axle.front.product.imageUrls ?? [],
      },
      rear: {
        sku: axle.rear.product.sku,
        title: axle.rear.product.title,
        sizeSpec: axle.rear.identity.spec,
        quantity: 2,
        unitSourcePriceEurGross: Number(axle.rear.product.sourcePriceEurGross),
        ...productWeightFacts(axle.rear.product),
        imageUrls: axle.rear.product.imageUrls ?? [],
      },
      vehicleLabel: vehicleLabelFromSetTitle(title),
      fitments: fitment.visibleRows,
      fitmentsSource: "WheelForce package page #mas-suitable-vehicles",
      accessoryOptions: buildOptions(pageOptions, wheelProducts, tpmsParts),
      sourceParts: parts.map((part) => ({ kind: part.kind, quantity: part.quantity, title: part.sourceTitle, sku: part.product?.sku ?? null })),
    });
  }

  const grouped = new Map();
  for (const entry of entries) {
    const key = `${entry.front.sku}|${entry.rear.sku}`;
    const prior = grouped.get(key);
    if (!prior) {
      grouped.set(key, { ...entry, sourcePackages: [{ sku: entry.manufacturerSetSku, url: entry.manufacturerSetUrl, title: entry.manufacturerSetTitle, vehicleLabel: entry.vehicleLabel, availability: entry.availability }] });
      continue;
    }
    const fitmentMap = new Map([...prior.fitments, ...entry.fitments].map((item) => [JSON.stringify(item).toLowerCase(), item]));
    prior.fitments = [...fitmentMap.values()];
    prior.sourcePackages.push({ sku: entry.manufacturerSetSku, url: entry.manufacturerSetUrl, title: entry.manufacturerSetTitle, vehicleLabel: entry.vehicleLabel, availability: entry.availability });
    prior.availability = [prior.availability, entry.availability].includes("orderable")
      ? "orderable"
      : [prior.availability, entry.availability].includes("unknown")
        ? "unknown"
        : "unavailable";
    const options = new Map([...prior.accessoryOptions, ...entry.accessoryOptions].map((option) => [option.sku, option]));
    prior.accessoryOptions = [...options.values()];
  }

  const groupedSets = [...grouped.values()];
  const wheelOnlySets = groupedSets.filter((entry) => entry.availability === "orderable").map((entry) => ({
    ...entry,
    vehicleLabels: [...new Set(entry.sourcePackages.map((sourcePackage) => sourcePackage.vehicleLabel).filter(Boolean))],
    sku: `${entry.front.sku} + ${entry.rear.sku}`,
    slug: `wheelforce-set-${entry.front.sku}-${entry.rear.sku}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
  })).sort((a, b) => a.sku.localeCompare(b.sku));
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: source.generatedAt,
    source: "https://wheelforce.de/komplettraeder",
    sourceKind: "WheelForce vehicle-specific complete-wheel set pages; tyre and installation components excluded from sales product and price",
    manufacturerSetPagesFound: manifest.products?.length ?? 0,
    parsedManufacturerSetPages: entries.length,
    extraComponentPagesFound: extraProducts.length,
    extraWheelProductsParsed: extraProducts.length,
    uniqueWheelOnlySets: wheelOnlySets.length,
    soldOutSourcePackageCount: soldOut,
    uniqueSetsUnavailableOrUnconfirmed: groupedSets.length - wheelOnlySets.length,
    excludedPageCount: rejected.length,
    excludedPages: rejected,
    sets: wheelOnlySets,
  };
  const summary = {
    mode: writeOutput ? "write" : "dry-run",
    manufacturerSetPagesFound: output.manufacturerSetPagesFound,
    parsedManufacturerSetPages: output.parsedManufacturerSetPages,
    uniqueWheelOnlySets: output.uniqueWheelOnlySets,
    soldOutSourcePackageCount: output.soldOutSourcePackageCount,
    uniqueSetsUnavailableOrUnconfirmed: output.uniqueSetsUnavailableOrUnconfirmed,
    excludedPageCount: output.excludedPageCount,
    exclusionReasons: rejected.reduce((counts, item) => ({ ...counts, [item.reason]: (counts[item.reason] ?? 0) + 1 }), {}),
    duplicateWheelPairsMerged: entries.length - wheelOnlySets.length,
    fitmentRows: wheelOnlySets.reduce((sum, item) => sum + item.fitments.length, 0),
    unmappedWheelComponents: [...new Set(rejected.flatMap((item) => item.components ?? []))],
    sample: wheelOnlySets.slice(0, 3).map((item) => ({ sku: item.sku, manufacturerSetSkus: item.sourcePackages.map((sourcePackage) => sourcePackage.sku), front: `${item.front.sku} × ${item.front.quantity}`, rear: `${item.rear.sku} × ${item.rear.quantity}`, sourceGrossEur: item.sourcePriceEurGross, fitments: item.fitments.length, accessories: item.accessoryOptions.length })),
    excludedExamples: rejected.slice(0, 10),
    output: outputPath,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (writeOutput) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
