#!/usr/bin/env node
/**
 * Builds src/data/shopCountryRegions.json: the first-level subdivisions
 * (states, provinces, regions, oblasts) the checkout offers for every country.
 *
 * Source: Unicode CLDR (Unicode License v3) at a pinned release:
 *   common/supplemental/subdivisions.xml  - which subdivisions are first level
 *   common/subdivisions/en.xml            - English names
 * Ukraine is listed by hand with official Ukrainian names and the usual
 * English "<Name> Oblast" forms (CLDR spells them "Kyivshchyna" etc.).
 *
 * Usage: node scripts/generate-shop-country-regions.mjs [--from <dir with the two XML files>]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CLDR_TAG = "release-48-2";
const CLDR_BASE = `https://raw.githubusercontent.com/unicode-org/cldr/${CLDR_TAG}`;
const OUTPUT = path.resolve("src/data/shopCountryRegions.json");

const UKRAINE = [
  ["UA-05", "Вінницька область", "Vinnytsia Oblast"],
  ["UA-07", "Волинська область", "Volyn Oblast"],
  ["UA-09", "Луганська область", "Luhansk Oblast"],
  ["UA-12", "Дніпропетровська область", "Dnipropetrovsk Oblast"],
  ["UA-14", "Донецька область", "Donetsk Oblast"],
  ["UA-18", "Житомирська область", "Zhytomyr Oblast"],
  ["UA-21", "Закарпатська область", "Zakarpattia Oblast"],
  ["UA-23", "Запорізька область", "Zaporizhzhia Oblast"],
  ["UA-26", "Івано-Франківська область", "Ivano-Frankivsk Oblast"],
  ["UA-30", "Київ", "Kyiv"],
  ["UA-32", "Київська область", "Kyiv Oblast"],
  ["UA-35", "Кіровоградська область", "Kirovohrad Oblast"],
  ["UA-40", "Севастополь", "Sevastopol"],
  ["UA-43", "Автономна Республіка Крим", "Autonomous Republic of Crimea"],
  ["UA-46", "Львівська область", "Lviv Oblast"],
  ["UA-48", "Миколаївська область", "Mykolaiv Oblast"],
  ["UA-51", "Одеська область", "Odesa Oblast"],
  ["UA-53", "Полтавська область", "Poltava Oblast"],
  ["UA-56", "Рівненська область", "Rivne Oblast"],
  ["UA-59", "Сумська область", "Sumy Oblast"],
  ["UA-61", "Тернопільська область", "Ternopil Oblast"],
  ["UA-63", "Харківська область", "Kharkiv Oblast"],
  ["UA-65", "Херсонська область", "Kherson Oblast"],
  ["UA-68", "Хмельницька область", "Khmelnytskyi Oblast"],
  ["UA-71", "Черкаська область", "Cherkasy Oblast"],
  ["UA-74", "Чернігівська область", "Chernihiv Oblast"],
  ["UA-77", "Чернівецька область", "Chernivtsi Oblast"],
];

async function readSource(fromDir, relativePath) {
  if (fromDir) return readFile(path.join(fromDir, relativePath.replaceAll("/", "_")), "utf8");
  const response = await fetch(`${CLDR_BASE}/${relativePath}`);
  if (!response.ok) throw new Error(`${relativePath}: HTTP ${response.status}`);
  return response.text();
}

function decodeXml(value) {
  return (
    value
      .replaceAll("&amp;", "&")
      .replaceAll("&apos;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      // CLDR footnote marks ("Île-de-France²", "Aerodrom †") never belong on a parcel.
      .replace(/[\s²³¹⁰-⁹†‡*]+$/u, "")
      .trim()
  );
}

function isoCode(cldrType) {
  return `${cldrType.slice(0, 2).toUpperCase()}-${cldrType.slice(2).toUpperCase()}`;
}

const fromIndex = process.argv.indexOf("--from");
const fromDir = fromIndex > 0 ? process.argv[fromIndex + 1] : null;
const [containmentXml, namesXml] = await Promise.all([
  readSource(fromDir, "common/supplemental/subdivisions.xml"),
  readSource(fromDir, "common/subdivisions/en.xml"),
]);

const names = new Map();
for (const match of namesXml.matchAll(/<subdivision type="([a-z0-9]+)"[^>]*>([^<]+)<\/subdivision>/g)) {
  names.set(match[1], decodeXml(match[2]));
}

const regions = {};
for (const match of containmentXml.matchAll(/<subgroup type="([A-Z]{2})" contains="([^"]+)"\/>/g)) {
  const country = match[1];
  if (country === "UA") continue;
  const entries = match[2]
    .split(/\s+/)
    .filter((type) => names.has(type))
    .map((type) => ({ code: isoCode(type), en: names.get(type) }))
    .sort((a, b) => a.en.localeCompare(b.en, "en"));
  if (entries.length) regions[country] = entries;
}
regions.UA = UKRAINE.map(([code, uk, en]) => ({ code, en, uk })).sort((a, b) =>
  a.uk.localeCompare(b.uk, "uk")
);

const sorted = Object.fromEntries(Object.entries(regions).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(
  OUTPUT,
  `${JSON.stringify({ source: `Unicode CLDR ${CLDR_TAG}; Ukraine curated`, regions: sorted })}\n`
);
const total = Object.values(sorted).reduce((sum, list) => sum + list.length, 0);
console.log(`${Object.keys(sorted).length} countries, ${total} regions -> ${OUTPUT}`);
