/**
 * Legacy direct-DB DO88 importer is intentionally write-disabled.
 *
 * Use the authenticated Admin Shop DO88 importer at
 * POST /api/admin/shop/do88-import. That path preserves existing relation IDs.
 */

const LEGACY_LIVE_IMPORT_DISABLED =
  "Legacy DO88 CLI import is write-disabled because it replaced variant IDs. " +
  "Use POST /api/admin/shop/do88-import through the authenticated admin workflow.";

async function main(): Promise<never> {
  throw new Error(LEGACY_LIVE_IMPORT_DISABLED);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
