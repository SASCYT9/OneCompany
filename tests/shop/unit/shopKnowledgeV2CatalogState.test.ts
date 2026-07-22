import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

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

const catalogStateModule = import("../../../src/lib/shopKnowledgeV2/catalogState");

const FINGERPRINT = "a".repeat(64);

test("catalog state reads one canonical fingerprint and fails closed when absent", async () => {
  const { readShopKnowledgeCatalogState } = await catalogStateModule;
  const availableClient = {
    async $queryRaw() {
      return [{ revision: BigInt(7), fingerprint: FINGERPRINT.toUpperCase() }];
    },
  } as unknown as PrismaClient;
  assert.deepEqual(await readShopKnowledgeCatalogState(availableClient), {
    available: true,
    revision: BigInt(7),
    fingerprint: FINGERPRINT,
  });

  const missingClient = {
    async $queryRaw() {
      throw Object.assign(new Error('relation "ShopKnowledgeCatalogState" does not exist'), {
        code: "P2021",
      });
    },
  } as unknown as PrismaClient;
  assert.deepEqual(await readShopKnowledgeCatalogState(missingClient), {
    available: false,
    revision: null,
    fingerprint: null,
  });
});

test("catalog state bump produces a new 64-character epoch in one write", async () => {
  const { bumpShopKnowledgeCatalogState } = await catalogStateModule;
  let writes = 0;
  const client = {
    async $executeRaw() {
      writes += 1;
      return 1;
    },
  } as unknown as PrismaClient;

  const first = await bumpShopKnowledgeCatalogState(client, new Date("2026-07-17T16:00:00.000Z"));
  const second = await bumpShopKnowledgeCatalogState(client, new Date("2026-07-17T16:00:00.000Z"));

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.match(second, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
  assert.equal(writes, 2);
});

test("production runtime accepts only the exact current database fingerprint", async () => {
  const {
    isShopKnowledgeCatalogFingerprintCurrent,
    normalizeShopKnowledgeCatalogFingerprint,
    requiresShopKnowledgeCatalogRuntimeGuard,
  } = await catalogStateModule;
  assert.equal(normalizeShopKnowledgeCatalogFingerprint(FINGERPRINT.toUpperCase()), FINGERPRINT);
  assert.equal(normalizeShopKnowledgeCatalogFingerprint("not-a-fingerprint"), null);
  assert.equal(
    isShopKnowledgeCatalogFingerprintCurrent({
      actual: FINGERPRINT,
      expected: FINGERPRINT,
    }),
    true
  );
  assert.equal(
    isShopKnowledgeCatalogFingerprintCurrent({
      actual: FINGERPRINT,
      expected: "b".repeat(64),
    }),
    false
  );
  assert.equal(
    requiresShopKnowledgeCatalogRuntimeGuard({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    }),
    false
  );
  assert.equal(
    requiresShopKnowledgeCatalogRuntimeGuard({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    }),
    true
  );
  assert.equal(
    requiresShopKnowledgeCatalogRuntimeGuard({
      NODE_ENV: "production",
    }),
    true
  );
});

test("catalog epoch changes at every active Knowledge V2 mutation boundary", () => {
  assert.match(
    readFileSync("src/lib/shopKnowledgeV2/embeddingRepository.ts", "utf8"),
    /if \(finalized > 0\)[\s\S]*bumpShopKnowledgeCatalogState\(tx, input\.finalizedAt\)/
  );
  assert.match(
    readFileSync("src/lib/admin/oneAiQualityProductRepository.ts", "utf8"),
    /options\.bumpCatalogState !== false[\s\S]*bumpShopKnowledgeCatalogState\(tx, now\)/
  );
  const bulkSource = readFileSync("src/lib/admin/oneAiQualityBulkRepository.ts", "utf8");
  assert.match(bulkSource, /\{ bumpCatalogState: false \}/);
  assert.equal((bulkSource.match(/await bumpShopKnowledgeCatalogState\(tx\)/g) ?? []).length, 1);

  assert.match(
    readFileSync("src/lib/shopAiStrictRepository.ts", "utf8"),
    /requiresShopKnowledgeCatalogRuntimeGuard\(process\.env\)[\s\S]*isShopKnowledgeCatalogFingerprintCurrent/
  );
  assert.match(
    readFileSync("src/app/api/shop/stock/assistant/route.ts", "utf8"),
    /readShopKnowledgeCatalogState\(prisma\)[\s\S]*catalogFingerprint: evalCatalogFingerprint/
  );
});
