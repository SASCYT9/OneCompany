import fs from "node:fs";
import path from "node:path";

export const MIN_SAFE_CATALOG_PRODUCT_COUNT = 10_000;

export function replaceFileAtomically(targetFile: string, content: string) {
  const target = path.resolve(targetFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.staged-${process.pid}-${Date.now()}`
  );
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const hadTarget = fs.existsSync(target);
  try {
    fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
    if (hadTarget) fs.renameSync(target, backup);
    fs.renameSync(temporary, target);
    if (hadTarget) fs.rmSync(backup, { force: true });
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    if (!fs.existsSync(target) && hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }
}

export function assertSafeCatalogReplacement(input: {
  productCount: number;
  activeDatabaseCount: number;
}) {
  if (!Number.isSafeInteger(input.productCount) || input.productCount < MIN_SAFE_CATALOG_PRODUCT_COUNT) {
    throw new Error(`Refusing fallback with ${input.productCount} products; expected at least ${MIN_SAFE_CATALOG_PRODUCT_COUNT}`);
  }
  if (!Number.isSafeInteger(input.activeDatabaseCount) || input.activeDatabaseCount < 0 || input.productCount < input.activeDatabaseCount) {
    throw new Error(`Fallback is truncated: ${input.productCount} products for ${input.activeDatabaseCount} active DB rows`);
  }
}

export function replaceCatalogDirectoryAtomically(stagedDirectory: string, targetDirectory: string) {
  const staged = path.resolve(stagedDirectory);
  const target = path.resolve(targetDirectory);
  if (path.dirname(staged) !== path.dirname(target) || staged === target) {
    throw new Error("Staged and target catalog directories must be distinct siblings");
  }
  if (!fs.statSync(staged).isDirectory()) throw new Error("Staged catalog path is not a directory");
  const manifest = JSON.parse(fs.readFileSync(path.join(staged, "manifest.json"), "utf8")) as { count?: number; activeDatabaseCount?: number };
  assertSafeCatalogReplacement({ productCount: manifest.count ?? -1, activeDatabaseCount: manifest.activeDatabaseCount ?? -1 });
  const backup = `${target}.backup-${process.pid}-${Date.now()}`;
  const hadTarget = fs.existsSync(target);
  try {
    if (hadTarget) fs.renameSync(target, backup);
    fs.renameSync(staged, target);
    if (hadTarget) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(target) && hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }
}
