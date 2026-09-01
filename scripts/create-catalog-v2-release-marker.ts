import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createShopCatalogReleaseMarker,
  type ShopCatalogReleaseEvidence,
} from "../src/lib/shopCatalogReleaseActivationGuard";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const evidencePath = argument("--evidence");
  if (!evidencePath) throw new TypeError("Usage: --evidence <validated-evidence.json>");
  const secret = process.env.SHOP_CATALOG_V2_RELEASE_GATE_SECRET ?? "";
  const evidence = JSON.parse(
    await readFile(path.resolve(evidencePath), "utf8")
  ) as ShopCatalogReleaseEvidence;
  const marker = createShopCatalogReleaseMarker({ evidence, secret });
  process.stdout.write(`${marker}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
