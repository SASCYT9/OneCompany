import crypto from "node:crypto";

import { checksumOpsMedia, createVercelPrivateOpsMediaStore } from "../../src/lib/operations/media";

async function main() {
  const allowGeneric = process.argv.includes("--allow-generic-token");
  const storeId = String(process.env.OPS_BLOB_STORE_ID ?? "").trim();
  const hasOidc = Boolean(String(process.env.VERCEL_OIDC_TOKEN ?? "").trim());
  // A project may also have a legacy public Blob token. Never let that token
  // override the explicitly configured private Ops store when OIDC is present.
  const token = String(
    process.env.OPS_BLOB_READ_WRITE_TOKEN ??
      ((!storeId || !hasOidc) && allowGeneric ? process.env.BLOB_READ_WRITE_TOKEN : "")
  ).trim();
  if (!token && !storeId) {
    throw new Error(
      allowGeneric ? "No Blob token is configured" : "OPS_BLOB_READ_WRITE_TOKEN is not configured"
    );
  }

  const store = createVercelPrivateOpsMediaStore(token, storeId);
  const expected = new TextEncoder().encode(`one-company-ops-blob-smoke:${crypto.randomUUID()}`);
  const expectedChecksum = checksumOpsMedia(expected);
  const requestedKey = `operations/smoke-tests/${Date.now()}-${crypto.randomUUID()}.txt`;
  let storedKey: string | null = null;

  try {
    const stored = await store.put({
      storageKey: requestedKey,
      body: expected,
      contentType: "text/plain; charset=utf-8",
    });
    storedKey = stored.storageKey;
    const restored = await store.get(stored.storageKey);
    const actualChecksum = checksumOpsMedia(restored);
    if (actualChecksum !== expectedChecksum) {
      throw new Error("Private Blob read-back checksum does not match");
    }
    console.log(
      JSON.stringify({
        ok: true,
        provider: "vercel_blob",
        access: "private",
        bytes: restored.byteLength,
        checksumVerified: true,
        cleanup: "pending",
      })
    );
  } finally {
    if (storedKey) {
      await store.remove(storedKey);
      console.log(
        JSON.stringify({
          ok: true,
          cleanup: "deleted",
        })
      );
    }
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Blob verification error",
    })
  );
  process.exitCode = 1;
});
