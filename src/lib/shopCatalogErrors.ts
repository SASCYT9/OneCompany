const TRANSIENT_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1012", "P1017", "P2024"]);

export function getShopCatalogFailureCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "UNKNOWN");
  }
  return error instanceof Error ? error.name : "UNKNOWN";
}

export function isTransientShopCatalogError(error: unknown) {
  const code = getShopCatalogFailureCode(error);
  if (TRANSIENT_PRISMA_CODES.has(code)) return true;
  if (/PrismaClientInitializationError/i.test(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /connection|connect|pool|timeout|timed out|database.*unavailable/i.test(message);
}
