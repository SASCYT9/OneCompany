/**
 * Legacy direct-DB Burger reimport is intentionally write-disabled.
 *
 * The supported importer is the authenticated POST /api/import-burger route,
 * which merges media and variants by stable identity without replacing IDs.
 */

const LEGACY_LIVE_IMPORT_DISABLED =
  "Legacy Burger CLI import is write-disabled because it replaced media and variant IDs. " +
  "Use the authenticated Admin Shop Imports action backed by POST /api/import-burger.";

async function main(): Promise<never> {
  throw new Error(LEGACY_LIVE_IMPORT_DISABLED);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
