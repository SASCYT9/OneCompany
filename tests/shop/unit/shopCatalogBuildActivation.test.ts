import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("the real build wrapper stops before snapshot and Next work when its activation check fails", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "catalog-build-guard-"));
  try {
    const cliDirectory = path.join(directory, "node_modules", "tsx", "dist");
    mkdirSync(cliDirectory, { recursive: true });
    // Replace only subprocess work: execute the repository's actual build wrapper.
    writeFileSync(
      path.join(cliDirectory, "cli.mjs"),
      `
      import { appendFileSync } from 'node:fs';
      appendFileSync('executed.jsonl', JSON.stringify(process.argv.slice(2)) + '\\n');
      process.exit(process.argv[2].endsWith('check-catalog-v2-release-activation.ts') ? 23 : 0);
    `
    );
    const result = spawnSync(process.execPath, [path.join(root, "scripts/build-site.mjs")], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "", DIRECT_URL: "" },
    });
    assert.equal(result.status, 23, result.stderr);
    const calls = readFileSync(path.join(directory, "executed.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(calls, [
      ["scripts/check-catalog-v2-release-activation.ts", "--production-build"],
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("build activation cannot inherit a development NODE_ENV to bypass unsigned production SSR", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      path.join(root, "scripts/check-catalog-v2-release-activation.ts"),
      "--production-build",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "development",
        DATABASE_URL: "",
        DIRECT_URL: "",
        SHOP_CATALOG_V2_READER_MODE: "ssr",
        SHOP_CATALOG_V2_VEHICLE_READER_MODE: "projection",
        SHOP_CATALOG_V2_RELEASE_GATE_MARKER: "",
        SHOP_CATALOG_V2_RELEASE_GATE_SECRET: "",
        VERCEL_GIT_COMMIT_SHA: "",
        GITHUB_SHA: "",
      },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /signed release evidence marker is required/);
});
