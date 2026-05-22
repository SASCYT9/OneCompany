/**
 * QA: scan theme-aware files for hardcoded colors that could break theming.
 *
 * Excludes:
 *  - src/app/admin/** (always-dark by design)
 *  - src/app/[locale]/shop/<brand>/** (always-dark brand microsites)
 *  - src/styles/urban-*.css / uh7-theme.css (intentionally hardcoded brand themes)
 *  - node_modules, .next, public, scripts, tests, archive
 *
 * Output: artifacts/qa-2026-05-13/data/hardcoded-colors.csv
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "artifacts/qa-2026-05-13/data/hardcoded-colors.csv");

const ALWAYS_DARK_SHOP_DIRS = new Set([
  "adro",
  "akrapovic",
  "brabus",
  "burger",
  "csf",
  "do88",
  "forged",
  "girodisc",
  "ipe",
  "ohlins",
  "racechip",
  "urban",
]);

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const RGB_RE = /\brgba?\s*\(/;
const HSL_FN_RE = /\bhsla?\s*\(/;
const TW_HARDCODED =
  /\b(bg|text|border|fill|stroke|ring|divide|placeholder|caret|outline|decoration|accent)-(white|black)\b(?!\/)/;

interface Finding {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
  severity: "high" | "medium" | "low";
}

const findings: Finding[] = [];

async function walk(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (
        [
          "node_modules",
          ".next",
          ".git",
          "public",
          "archive",
          "backups",
          "tmp",
          "tests",
          "scripts",
          "wiki",
          "reference",
          "market_intelligence",
          "artifacts",
        ].includes(entry.name)
      )
        continue;
      if (rel === "src/app/admin" || rel.startsWith("src/app/admin/")) continue;
      // entire admin lib + admin components subtrees are always-dark
      if (rel === "src/lib/admin" || rel.startsWith("src/lib/admin/")) continue;
      if (rel === "src/components/admin" || rel.startsWith("src/components/admin/")) continue;
      // emails and PDF generators do their own theming (no browser DOM)
      if (rel === "src/emails" || rel.startsWith("src/emails/")) continue;
      if (rel === "src/components/emails" || rel.startsWith("src/components/emails/")) continue;
      if (rel.startsWith("src/app/api/admin/pdf/")) continue;
      if (rel.startsWith("src/app/api/shopify/")) continue;
      // forged microsite has its own static theme palette
      if (rel === "src/components/forged" || rel.startsWith("src/components/forged/")) continue;
      if (rel === "src/lib/forged" || rel.startsWith("src/lib/forged/")) continue;
      // always-dark brand-shop shared components
      if (
        rel === "src/app/[locale]/shop/components" ||
        rel.startsWith("src/app/[locale]/shop/components/")
      )
        continue;
      // skip always-dark brand-shop subtrees
      if (rel.match(/^src\/app\/\[locale\]\/shop\/[^/]+$/)) {
        const brand = entry.name;
        if (ALWAYS_DARK_SHOP_DIRS.has(brand)) continue;
      }

      await walk(full);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!/\.(tsx?|css|scss)$/.test(entry.name)) continue;

    // skip intentionally hardcoded brand stylesheets
    if (
      rel === "src/styles/uh7-theme.css" ||
      rel === "src/styles/urban-shop.css" ||
      rel === "src/styles/urban-collections.css"
    )
      continue;
    // globals.css IS where tokens are defined — its hex codes are by design
    if (rel === "src/app/globals.css") continue;

    const content = await fs.readFile(full, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      const stripped = line.trim();
      if (
        !stripped ||
        stripped.startsWith("//") ||
        stripped.startsWith("*") ||
        stripped.startsWith("/*")
      )
        return;

      let m;
      if ((m = line.match(HEX_RE))) {
        // ignore #fff, #000 only inside CSS @theme/:root blocks where defining tokens — heuristic: skip lines containing "var(--" already, and skip files in src/app/globals.css line ranges where tokens are DEFINED
        // we still record them — review later
        const sev =
          m[0].toLowerCase() === "#fff" ||
          m[0].toLowerCase() === "#ffffff" ||
          m[0].toLowerCase() === "#000" ||
          m[0].toLowerCase() === "#000000"
            ? "high"
            : "medium";
        findings.push({
          file: rel,
          line: lineNo,
          pattern: m[0],
          snippet: stripped.slice(0, 160),
          severity: sev,
        });
      }
      if (RGB_RE.test(line) && !/var\(--/.test(line)) {
        const match = line.match(/\brgba?\s*\([^)]+\)/);
        findings.push({
          file: rel,
          line: lineNo,
          pattern: match ? match[0] : "rgb(...)",
          snippet: stripped.slice(0, 160),
          severity: "medium",
        });
      }
      if (HSL_FN_RE.test(line) && !/var\(--/.test(line)) {
        const match = line.match(/\bhsla?\s*\([^)]+\)/);
        findings.push({
          file: rel,
          line: lineNo,
          pattern: match ? match[0] : "hsl(...)",
          snippet: stripped.slice(0, 160),
          severity: "medium",
        });
      }
      if ((m = line.match(TW_HARDCODED))) {
        findings.push({
          file: rel,
          line: lineNo,
          pattern: m[0],
          snippet: stripped.slice(0, 160),
          severity: "high",
        });
      }
    });
  }
}

(async () => {
  await walk(path.join(ROOT, "src"));

  // CSV escape
  const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';

  const header = "file,line,pattern,snippet,severity";
  const rows = findings.map((f) =>
    [f.file, f.line, esc(f.pattern), esc(f.snippet), f.severity].join(",")
  );

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, [header, ...rows].join("\n"), "utf8");

  // also write JSON for the PDF generator
  const jsonOut = OUT.replace(/\.csv$/, ".json");
  await fs.writeFile(jsonOut, JSON.stringify(findings, null, 2), "utf8");

  const high = findings.filter((f) => f.severity === "high").length;
  const med = findings.filter((f) => f.severity === "medium").length;
  console.log(`[audit-theme-tokens] scanned src/, found ${findings.length} findings`);
  console.log(`  high:   ${high}`);
  console.log(`  medium: ${med}`);
  console.log(`  output: ${OUT}`);
})();
