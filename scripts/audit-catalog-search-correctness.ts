import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  auditLegacySnapshotCatalog,
  type CatalogSearchDiagnosticProduct,
} from "../src/lib/shopCatalogSearchCorrectnessDiagnostics";

type Manifest = { stores: Record<string, { file: string }> };

function argument(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main() {
  const root = path.resolve(argument("snapshot-root", "public/catalog-fallback"));
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as Manifest;
  const stores = Object.fromEntries(
    await Promise.all(
      Object.entries(manifest.stores).map(async ([name, store]) => [
        name,
        JSON.parse(
          await readFile(path.join(root, store.file), "utf8")
        ) as CatalogSearchDiagnosticProduct[],
      ])
    )
  ) as Record<string, CatalogSearchDiagnosticProduct[]>;
  const report = auditLegacySnapshotCatalog({
    stores,
    query: {
      make: argument("make", "BMW"),
      model: argument("model", "M5"),
      chassis: argument("chassis", "G90"),
      year: (() => {
        const value = Number(argument("year", "0"));
        return Number.isSafeInteger(value) && value > 0 ? value : null;
      })(),
    },
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
