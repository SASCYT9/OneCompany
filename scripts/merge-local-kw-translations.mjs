import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const snapshotDir = resolve("backups/shopify/kw-suspensions/2026-09-02");
const productsPath = resolve(snapshotDir, "products.jsonl");
const translationsPath = resolve(snapshotDir, "translations-en.jsonl");
const localPath = resolve(
  process.argv[2] ?? "backups/local-translations/kw-sample-2026-09-03T22-19-03-827Z.json"
);

const products = (await readFile(productsPath, "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(JSON.parse)
  .filter((product) => String(product.id ?? "").includes("/Product/"))
  .filter((product) =>
    new Set(["kw", "kw automotive ukraine"]).has(
      String(product.vendor ?? "")
        .trim()
        .toLowerCase()
    )
  );
const local = JSON.parse(await readFile(localPath, "utf8"));
const byHandle = new Map(local.map((product) => [product.slug, product]));

const missing = products
  .filter((product) => !byHandle.has(product.handle))
  .map((product) => product.handle);
const extra = local
  .filter((product) => !products.some((source) => source.handle === product.slug))
  .map((product) => product.slug);
const invalid = local.filter(
  (product) =>
    product.status !== "PASS" || !product.titleEn || (product.bodyHtmlUa && !product.bodyHtmlEn)
);
if (
  missing.length ||
  extra.length ||
  invalid.length ||
  products.length !== 1999 ||
  local.length !== 1999
) {
  throw new Error(
    JSON.stringify({
      products: products.length,
      local: local.length,
      missing,
      extra,
      invalid: invalid.map((product) => product.slug),
    })
  );
}

const rows = products.map((product) => {
  const translated = byHandle.get(product.handle);
  return {
    id: product.id,
    title: product.title,
    descriptionHtml: product.descriptionHtml ?? null,
    translations: [
      { key: "title", value: translated.titleEn, outdated: false },
      ...(translated.bodyHtmlEn
        ? [{ key: "body_html", value: translated.bodyHtmlEn, outdated: false }]
        : []),
    ],
  };
});

const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
const backupPath = resolve(snapshotDir, `translations-en.before-local-${stamp}.jsonl`);
const temporaryPath = `${translationsPath}.tmp-${process.pid}`;
await copyFile(translationsPath, backupPath);
await writeFile(temporaryPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
await rename(temporaryPath, translationsPath);

process.stdout.write(
  `${JSON.stringify({ products: products.length, translations: rows.length, titles: rows.length, bodies: rows.filter((row) => row.translations.some((entry) => entry.key === "body_html")).length, backupPath, translationsPath }, null, 2)}\n`
);
