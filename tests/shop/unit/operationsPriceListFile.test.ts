import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";

import type { PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const fileModule = import("../../../src/lib/operations/priceListFile");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const RATES = { EUR: 1, USD: 1.14, UAH: 50.56, _uahReserve: 1, _rawUsdToUah: 45.03 };
const owner = {
  id: "owner-000000001",
  email: "owner@onecompany.global",
  name: "Owner",
  permissions: ["*"],
  roleKeys: ["owner"],
};
const igor = { ...owner, id: "igor-0000000001", roleKeys: ["superadmin"] };
const buttons = async (_action: string, resourceId: string, label: string) => ({
  text: label,
  callback_data: `cb:${resourceId}`,
});

/** A minimal zip: stored and deflated parts, as Excel writes them. */
function zip(files: Array<{ name: string; data: string; deflate?: boolean }>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const raw = Buffer.from(file.data, "utf8");
    const body = file.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(file.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(file.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(file.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const size = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Strings go to sharedStrings (one as an inline string), numbers stay numbers. */
function xlsx(rows: Array<Array<string | number | null>>, hiddenRows: string[][] = [["junk"]]) {
  const shared: string[] = [];
  const column = (index: number) => String.fromCharCode(65 + index);
  const sheet = (data: Array<Array<string | number | null>>, inline: boolean) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${data
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}" spans="1:${row.length}">${row
            .map((value, index) => {
              const ref = `${column(index)}${rowIndex + 1}`;
              if (value === null) return `<c r="${ref}" s="1"/>`;
              if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
              if (inline && rowIndex === 0 && index === 0) {
                return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
              }
              shared.push(value);
              return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
            })
            .join("")}</row>`
      )
      .join("")}</sheetData></worksheet>`;
  const visible = sheet(rows, true);
  const hidden = sheet(hiddenRows, false);
  return zip([
    {
      name: "xl/workbook.xml",
      data: `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hidden" sheetId="2" state="hidden" r:id="rId2"/><sheet name="Price &amp; list" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      data: `<sst>${shared
        .map((value, index) =>
          index === 1
            ? `<si><r><t>${escapeXml(value.slice(0, 2))}</t></r><r><t xml:space="preserve">${escapeXml(value.slice(2))}</t></r><rPh><t>x</t></rPh></si>`
            : `<si><t>${escapeXml(value)}</t></si>`
        )
        .join("")}</sst>`,
    },
    { name: "xl/worksheets/sheet1.xml", data: visible, deflate: true },
    { name: "xl/worksheets/sheet2.xml", data: hidden },
  ]);
}

const HOLLEY_HEADER = [
  "Brand",
  "Category",
  "Item",
  "Item_Status",
  "MAP",
  "Retail",
  "Description",
  "UPC",
  "Length",
  "Width",
  "Height",
  "Weight",
];

function holleyRow(
  brand: string,
  sku: string,
  status: string,
  map: number,
  retail: number,
  weight: number,
  description = "PART",
  category = "Engine"
) {
  return [
    brand,
    category,
    sku,
    status,
    map,
    retail,
    description,
    "813725000000",
    20,
    10,
    5,
    weight,
  ];
}

function siteProduct(input: {
  sku: string;
  brand: string;
  usd: number;
  pricing?: Array<Record<string, unknown>>;
}) {
  const prices = {
    priceEur: null,
    priceUsd: input.usd,
    priceUah: null,
    priceSourceCurrency: "USD",
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
  };
  return {
    id: `p-${input.sku}`,
    sku: input.sku,
    slug: input.sku.toLowerCase(),
    brand: input.brand,
    titleEn: `${input.brand} ${input.sku}`,
    titleUa: "",
    ...prices,
    variants: [{ id: `v-${input.sku}`, sku: input.sku, ...prices }],
    metafields: input.pricing
      ? [
          { key: "pricing", value: JSON.stringify(input.pricing) },
          { key: "official_url", value: `https://www.dinancars.com/${input.sku.toLowerCase()}` },
        ]
      : [],
  };
}

function fakeClient(input: {
  products: ReturnType<typeof siteProduct>[];
  rivals?: Array<{ sku: string; price: number }>;
}) {
  const proposals: Array<Record<string, unknown>> = [];
  const factWrites: unknown[][] = [];
  const sourceUpdates: Array<Record<string, unknown>> = [];
  const client = {
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
    shopProduct: {
      findMany: async ({
        where,
      }: {
        where: { brand?: string; id?: { in: string[] }; OR?: Array<{ sku?: { in: string[] } }> };
      }) => {
        if (where.brand) return input.products.filter((product) => product.brand === where.brand);
        const ids = where.id?.in;
        if (ids) return input.products.filter((product) => ids.includes(product.id));
        const wanted = new Set<string>(
          (where.OR?.[0]?.sku?.in ?? []).map((sku) => sku.toLowerCase())
        );
        return input.products.filter(
          (product) =>
            wanted.has(product.sku.toLowerCase()) ||
            product.variants.some((variant) => wanted.has(variant.sku.toLowerCase()))
        );
      },
    },
    opsSupplierItem: {
      findMany: async ({ where }: { where: { sourceKey?: string | { in: string[] } } }) =>
        typeof where.sourceKey === "object" ? (input.rivals ?? []) : [],
      findFirst: async () => null,
    },
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      factWrites.push(values);
      return 1;
    },
    opsPriceChange: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `chg-${String(proposals.length + 1).padStart(10, "0")}`, ...data };
        proposals.push(row);
        return row;
      },
    },
    opsPriceWatchSource: {
      findUnique: async ({ where }: { where: { key: string } }) => ({
        id: `src-${where.key}-0000001`,
      }),
      updateMany: async (args: Record<string, unknown>) => {
        sourceUpdates.push(args);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const savedFacts = () =>
    factWrites.flatMap((values) =>
      values
        .filter((value): value is string => typeof value === "string" && value.startsWith("[{"))
        .flatMap((value) => JSON.parse(value) as Array<Record<string, unknown>>)
    );
  return { client, proposals, savedFacts, sourceUpdates };
}

test("numbers, currencies, markups and price-list hints", async () => {
  const { parsePriceListNumber, currencyOfPriceText, priceListMarkup, isPriceListHint } =
    await fileModule;
  assert.equal(parsePriceListNumber("9 005,92"), 9005.92);
  assert.equal(parsePriceListNumber("1,234.50"), 1234.5);
  assert.equal(parsePriceListNumber("1.234,50 €"), 1234.5);
  assert.equal(parsePriceListNumber("$1,234"), 1234);
  assert.equal(parsePriceListNumber("12,5"), 12.5);
  assert.equal(parsePriceListNumber("1.2345E+3"), 1234.5);
  assert.equal(parsePriceListNumber("1.234.567"), 1234567);
  assert.equal(parsePriceListNumber("−5"), null);
  assert.equal(parsePriceListNumber("по запросу"), null);
  assert.equal(parsePriceListNumber("0"), null);
  assert.equal(currencyOfPriceText("Retail (USD)"), "USD");
  assert.equal(currencyOfPriceText("UVP €"), "EUR");
  assert.equal(currencyOfPriceText("Цена, грн"), "UAH");
  assert.equal(currencyOfPriceText("RRP £"), "GBP");
  assert.equal(currencyOfPriceText("Price"), null);
  assert.equal(priceListMarkup("+10%"), 1.1);
  assert.equal(priceListMarkup("наценка 15 %"), 1.15);
  assert.equal(priceListMarkup("-5%"), 0.95);
  assert.equal(priceListMarkup("x1.2"), 1.2);
  assert.equal(priceListMarkup("+0%"), 1, "«+0%»: the file holds site prices as they are");
  assert.equal(priceListMarkup("прайс.xlsx"), null);
  assert.equal(priceListMarkup("+500%"), null);
  assert.equal(isPriceListHint("Прайс Eventuri.xlsx", null), true);
  assert.equal(isPriceListHint("order 115.csv", "новые цены"), true);
  assert.equal(isPriceListHint("order 115.csv", "+10%"), true);
  assert.equal(isPriceListHint("order 115.csv", "для Олега"), false);
});

test("an .xlsx is read without extra libraries: shared, rich and inline strings, hidden sheets skipped", async () => {
  const { readPriceListFile, detectPriceList, priceListSheetsText } = await fileModule;
  const body = xlsx([
    HOLLEY_HEADER,
    holleyRow("Dinan", "D440-0001", "Active", 900, 1100, 11, "INTAKE <CARBON> & FILTER"),
    [null, null, "D440-0002", "OBS", 400, 450.5, null],
  ]);
  const sheets = readPriceListFile(body, XLSX);
  assert.equal(sheets.length, 1, "the hidden sheet is not read");
  assert.equal(sheets[0].name, "Price & list");
  assert.deepEqual(sheets[0].rows[0], HOLLEY_HEADER);
  assert.equal(sheets[0].rows[1][6], "INTAKE <CARBON> & FILTER");
  assert.deepEqual(sheets[0].rows[2].slice(0, 6), ["", "", "D440-0002", "OBS", "400", "450.5"]);
  const detected = detectPriceList(sheets);
  assert.equal(detected?.kind, "holley");
  assert.equal(detected?.kind === "holley" ? detected.brand : null, "dinan");
  assert.match(priceListSheetsText(sheets), /^# Price & list\nBrand\tCategory\tItem/);
  assert.throws(
    () => readPriceListFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), XLSX),
    /повреждён/
  );
});

test("a CSV in Windows-1251 with semicolons and decimal commas", async () => {
  const { readPriceListFile, detectPriceList } = await fileModule;
  const cp1251 = (text: string) =>
    new Uint8Array(
      Array.from(text, (character) => {
        const code = character.charCodeAt(0);
        return code >= 0x410 && code <= 0x44f ? code - 0x410 + 0xc0 : code;
      })
    );
  const sheets = readPriceListFile(
    cp1251("Артикул;Цена, EUR;Опт\nV167-678-63;9 005,92;7000\n"),
    "text/csv"
  );
  assert.deepEqual(sheets[0].rows, [
    ["Артикул", "Цена, EUR", "Опт"],
    ["V167-678-63", "9 005,92", "7000"],
  ]);
  const detected = detectPriceList(sheets);
  assert.deepEqual(
    detected?.kind === "table" ? [detected.parts[0].columns, detected.currency] : null,
    [{ sku: 0, price: 1 }, "EUR"]
  );
});

test("a Dinan dealer list: Ігор's formula, competitor cap, new and gone items, facts with size", async () => {
  const { handlePriceListFile } = await fileModule;
  const { client, proposals, savedFacts, sourceUpdates } = fakeClient({
    products: [
      siteProduct({
        sku: "D440-0001",
        brand: "Dinan",
        usd: 1000,
        pricing: [{ sku: "D440-0001", msrpUsd: 1000, mapUsd: 820 }],
      }),
      siteProduct({
        sku: "D440-0002",
        brand: "Dinan",
        usd: 500,
        pricing: [{ sku: "D440-0002", msrpUsd: 450, mapUsd: 400, competitorUsd: 520 }],
      }),
      siteProduct({
        sku: "D440-0003",
        brand: "Dinan",
        usd: 300,
        pricing: [{ sku: "D440-0003", msrpUsd: 250 }],
      }),
      siteProduct({ sku: "D440-0004", brand: "Dinan", usd: 99, pricing: [] }),
    ],
    // Adrenalin Drive at 20 000 ₴ ≈ $434.50 at the price book's 46.03 ₴/$.
    rivals: [{ sku: "D440-0002", price: 20_000 }],
  });
  const outcome = await handlePriceListFile({
    client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: xlsx([
      HOLLEY_HEADER,
      holleyRow("Dinan", "D440-0001", "Active", 900, 1100, 11),
      holleyRow("Dinan", "D440-0002", "Active", 400, 450, 5),
      holleyRow("Dinan", "D440-0003", "OBS", 200, 250, 3),
      holleyRow("Dinan", "D999-0001", "Active", 80, 99, 1, "NEW BRACKET"),
      holleyRow(
        "Dinan",
        "D020-1001-S",
        "Active",
        17.95,
        23.93,
        2,
        "T-SHIRT: LOGO BLACK",
        "Apparel/Merchandise"
      ),
      holleyRow("APR", "CS100011", "Active", 100, 120, 1),
    ]),
    mimeType: XLSX,
    fileName: "Dinan Retail 1-15-27.xlsx",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
  });
  assert.equal(outcome?.kind, "reply");
  const text = outcome?.kind === "reply" ? outcome.reply.text : "";
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].origin, "price_list:dinan");
  const items = proposals[0].items as Array<{ sku: string; before: number; after: number }>;
  assert.deepEqual(
    items.map((item) => [item.sku, item.before, item.after]),
    [
      // MAP $900 × 1.15 + $12 × 11 lb → kg = $1 094.87 → $1 095.
      ["D440-0001", 1000, 1095],
      // Formula $488 is dearer than the competitor ($434.50) and $434 is above MAP + shipping ($428).
      ["D440-0002", 500, 434],
    ]
  );
  assert.match(text, /Dinan: новый прайс/);
  assert.match(text, /Dinan Retail 1-15-27\.xlsx: 4 позиции, на сайте из них 3/);
  assert.match(text, /MAP: выше у 1 \(в среднем \+9,8\s%\), ниже у 0/);
  assert.match(text, /Не дороже конкурента: 1 · не ниже MAP \+ доставка: 0/);
  assert.match(text, /В прайсе, но нет на сайте: 1\n/);
  assert.doesNotMatch(text, /D020-1001-S/, "merchandise is not a product to import");
  assert.match(text, /Сняты с производства или пропали из прайса: 2/);
  assert.match(text, /<code>D440-0003<\/code>, <code>D440-0004<\/code>/);
  assert.match(text, /напомню через 90 дн\./);
  assert.doesNotMatch(text, /CS100011/, "rows of another brand in the file are left alone");
  const facts = savedFacts();
  assert.equal(facts.length, 4);
  const first = facts.find((fact) => fact.supplierKey === "D440-0001")!;
  assert.deepEqual(
    [first.productId, first.price, first.weightKg, first.lengthCm, first.widthCm, first.heightCm],
    ["p-D440-0001", 900, 4.99, 50.8, 25.4, 12.7]
  );
  const obsolete = facts.find((fact) => fact.supplierKey === "D440-0003")!;
  assert.deepEqual([obsolete.available, obsolete.availability], [false, "снят с производства"]);
  assert.equal(facts.find((fact) => fact.supplierKey === "D999-0001")?.productId, null);
  assert.equal(sourceUpdates.length, 0, "the price list becomes current only after «Применить»");
});

test("a list that matches the site marks it current right away", async () => {
  const { handlePriceListFile } = await fileModule;
  const { client, proposals, sourceUpdates } = fakeClient({
    products: [
      siteProduct({
        sku: "D440-0001",
        brand: "Dinan",
        usd: 1095,
        pricing: [{ sku: "D440-0001", msrpUsd: 1100, mapUsd: 900 }],
      }),
    ],
  });
  const outcome = await handlePriceListFile({
    client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: xlsx([HOLLEY_HEADER, holleyRow("Dinan", "D440-0001", "Active", 900, 1100, 11)]),
    mimeType: XLSX,
    fileName: "Dinan Retail.xlsx",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
    now: new Date("2027-01-15T10:00:00Z"),
  });
  assert.equal(proposals.length, 0);
  assert.match(
    outcome?.kind === "reply" ? outcome.reply.text : "",
    /уже совпадают с прайсом[\s\S]*следующее напоминание — 15 апреля/
  );
  assert.deepEqual(sourceUpdates[0], {
    where: { key: "dinan" },
    data: {
      priceListDate: new Date("2027-01-15T10:00:00Z"),
      nextReminderAt: new Date("2027-04-15T10:00:00Z"),
    },
  });
});

test("any SKU + price sheet: the brand's rule or the caption markup; a purchase list is flagged", async () => {
  const { handlePriceListFile } = await fileModule;
  const products = [
    siteProduct({ sku: "EVE-1", brand: "Eventuri", usd: 105 }),
    siteProduct({ sku: "EVE-2", brand: "Eventuri", usd: 220 }),
  ];
  const marked = fakeClient({ products });
  const outcome = await handlePriceListFile({
    client: marked.client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: new TextEncoder().encode("SKU,Price USD\nEVE-1,100\nEVE-2,200\nNOPE-1,50\n"),
    mimeType: "text/csv",
    fileName: "Eventuri IND price.csv",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
  });
  const text = outcome?.kind === "reply" ? outcome.reply.text : "";
  assert.equal(marked.proposals[0].origin, "price_list:eventuri");
  assert.deepEqual(
    (marked.proposals[0].items as Array<{ sku: string; after: number }>).map((item) => [
      item.sku,
      item.after,
    ]),
    [["EVE-1", 110]],
    "Eventuri: IND + 10 % from the source rule"
  );
  assert.match(text, /Прайс «Eventuri IND price\.csv» \+10,0\s%/);
  assert.match(text, /с наценкой \+10,0\s% \(правило Eventuri: цена IND \+ 10 %\); валюта: \$/);
  assert.match(text, /Пропущено: 1 — нет на сайте/);
  // The list's own prices stay for the product card (owners see list × markup there).
  assert.deepEqual(
    marked
      .savedFacts()
      .map((fact) => [fact.supplierKey, fact.productId, fact.variantId, fact.price, fact.currency]),
    [
      ["EVE-1", "p-EVE-1", "v-EVE-1", 100, "USD"],
      ["EVE-2", "p-EVE-2", "v-EVE-2", 200, "USD"],
    ]
  );

  const captioned = fakeClient({ products });
  await handlePriceListFile({
    client: captioned.client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: new TextEncoder().encode("SKU,Price USD\nEVE-1,100\nEVE-2,200\n"),
    mimeType: "text/csv",
    fileName: "Eventuri IND price.csv",
    caption: "+15%",
    telegramChatId: null,
    button: buttons as never,
  });
  assert.deepEqual(
    (captioned.proposals[0].items as Array<{ sku: string; after: number }>).map((item) => [
      item.sku,
      item.after,
    ]),
    [
      ["EVE-1", 115],
      ["EVE-2", 230],
    ],
    "the caption wins over the rule"
  );
  assert.equal(
    captioned.savedFacts().length,
    0,
    "under another markup the card could not repeat the calculation, so the list is not kept"
  );

  // A brand without a price source: the file holds its site prices as they are.
  const many = Array.from({ length: 6 }, (_, index) =>
    siteProduct({ sku: `MAN-${index + 10}`, brand: "Manual", usd: 110 })
  );
  const purchase = fakeClient({ products: many });
  const flagged = await handlePriceListFile({
    client: purchase.client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: new TextEncoder().encode(
      `SKU,Price USD\n${many.map((product) => `${product.sku},100`).join("\n")}\n`
    ),
    mimeType: "text/csv",
    fileName: "price.csv",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
  });
  assert.equal(purchase.proposals[0].origin, "price_list");
  assert.match(
    flagged?.kind === "reply" ? flagged.reply.text : "",
    /⚠️ Почти все цены ниже, чем на сайте \(в среднем −9,1\s%\)/
  );
});

test("iPE's list (prices under a merged header) is not turned into site prices without a markup", async () => {
  const { handlePriceListFile } = await fileModule;
  const csv = new TextEncoder().encode(
    [
      "AUDI,,,,,,,",
      "MODEL,SECTION,SKU NO.,MAT.,DESCRIPTION,,MSRP(USD),",
      "Audi A5 B9,Downpipe,1AA50-11-A000-2N,SS,Catted Downpipe,Audi A5-B9,,1200",
      ",,1P971N-03-N0AT-7S,SS,Tips (Titanium Blue),Porsche 971,+,140",
      "Remark,,,,,,,",
    ].join("\n")
  );
  const products = [siteProduct({ sku: "1AA50-11-A000-2N", brand: "iPE exhaust", usd: 2700 })];
  const refused = fakeClient({ products });
  const outcome = await handlePriceListFile({
    client: refused.client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: csv,
    mimeType: "text/csv",
    fileName: "2026 Price List_USD_April 2026.csv",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
  });
  const reply = outcome?.kind === "reply" ? outcome.reply : null;
  assert.equal(refused.proposals.length, 0);
  assert.match(String(reply?.text), /2 позиции с ценой, бренд iPE/);
  assert.match(
    String(reply?.text),
    /цена прайса \+ доставка и растаможка — из этого файла я их не пересчитаю/
  );
  assert.deepEqual(reply?.replyMarkup?.inline_keyboard[0][0], {
    text: "✅ Прайс актуален",
    callback_data: "cb:src-ipe-0000001",
  });

  const asIs = fakeClient({ products });
  await handlePriceListFile({
    client: asIs.client,
    actorAdminUserId: owner.id,
    actor: owner,
    body: csv,
    mimeType: "text/csv",
    fileName: "2026 Price List_USD_April 2026.csv",
    caption: "+0%",
    telegramChatId: null,
    button: buttons as never,
  });
  assert.deepEqual(
    (asIs.proposals[0].items as Array<{ sku: string; after: number }>).map((item) => [
      item.sku,
      item.after,
    ]),
    [["1AA50-11-A000-2N", 1200]],
    "«+0%»: the owner says these are site prices"
  );
});

test("who may send it, what is not a price list, and unreadable files", async () => {
  const { handlePriceListFile } = await fileModule;
  const { client, proposals } = fakeClient({ products: [] });
  const base = {
    client,
    actorAdminUserId: owner.id,
    mimeType: "text/csv",
    caption: null,
    telegramChatId: null,
    button: buttons as never,
  };
  const csv = new TextEncoder().encode("SKU,Price\nEVE-1,100\n");
  assert.equal(
    (await handlePriceListFile({ ...base, actor: igor, body: csv, fileName: "price.csv" }))?.kind,
    "not_owner",
    "superadmin's list waits in the inbox for an owner"
  );
  assert.equal(
    await handlePriceListFile({ ...base, actor: owner, body: csv, fileName: "order 115.csv" }),
    null,
    "an order or invoice with prices is not a price list"
  );
  assert.equal(
    await handlePriceListFile({
      ...base,
      actor: owner,
      body: new TextEncoder().encode("Name,Phone\nOleg,123\n"),
      fileName: "price.csv",
    }),
    null
  );
  const broken = await handlePriceListFile({
    ...base,
    actor: owner,
    mimeType: XLSX,
    body: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 9, 9]),
    fileName: "Dinan.xlsx",
  });
  assert.match(
    broken?.kind === "reply" ? broken.reply.text : "",
    /Не смог прочитать «Dinan\.xlsx»: файл повреждён/
  );
  const other = await handlePriceListFile({
    ...base,
    actor: owner,
    mimeType: XLSX,
    body: xlsx([HOLLEY_HEADER, holleyRow("Flowmaster", "FM-1", "Active", 10, 12, 1)]),
    fileName: "Holley.xlsx",
  });
  assert.match(
    other?.kind === "reply" ? other.reply.text : "",
    /дилерский прайс Holley \(Flowmaster\)/
  );
  assert.equal(proposals.length, 0);
});

test("the bot accepts spreadsheets: loose MIME types by extension, macro workbooks rejected, bytes checked", async () => {
  const { validateOpsTelegramMedia, assertOpsMediaMagicBytes, OPS_XLSX_MIME_TYPE } = await import(
    "../../../src/lib/operations/media"
  );
  const document = (fileName: string, mimeType: string | null) => ({
    kind: "document" as const,
    fileId: "file-1",
    fileUniqueId: "unique-1",
    fileSize: 2_048,
    durationSeconds: null,
    mimeType,
    fileName,
  });
  assert.equal(validateOpsTelegramMedia(document("Dinan Retail.xlsx", XLSX)).mimeType, XLSX);
  assert.equal(
    validateOpsTelegramMedia(document("Dinan Retail.xlsx", "application/octet-stream")).mimeType,
    XLSX
  );
  assert.equal(
    validateOpsTelegramMedia(document("price.csv", "application/vnd.ms-excel")).mimeType,
    "text/csv"
  );
  assert.equal(
    validateOpsTelegramMedia(document("price.csv", "text/comma-separated-values")).mimeType,
    "text/csv"
  );
  assert.equal(
    validateOpsTelegramMedia(document("notes.txt", "text/plain")).mimeType,
    "text/plain"
  );
  assert.throws(() => validateOpsTelegramMedia(document("macro.xlsm", XLSX)), /macro-enabled/);
  assert.throws(
    () => validateOpsTelegramMedia(document("old.xls", "application/vnd.ms-excel")),
    /not accepted/
  );
  assert.doesNotThrow(() => assertOpsMediaMagicBytes(xlsx([["SKU", "Price"]]), OPS_XLSX_MIME_TYPE));
  assert.throws(
    () => assertOpsMediaMagicBytes(new TextEncoder().encode("SKU,Price"), OPS_XLSX_MIME_TYPE),
    /do not match/
  );
  assert.doesNotThrow(() =>
    assertOpsMediaMagicBytes(new TextEncoder().encode("SKU,Price\nA-1,10"), "text/csv")
  );
});
