import { spawnSync } from "node:child_process";
import path from "node:path";

const image =
  process.argv.find((argument) => argument.startsWith("--image="))?.slice("--image=".length) ??
  "pgvector/pgvector:0.8.2-pg17";
const docker =
  process.argv.find((argument) => argument.startsWith("--docker="))?.slice("--docker=".length) ??
  "docker";
const sizes =
  process.argv.find((argument) => argument.startsWith("--sizes=")) ?? "--sizes=100000,500000";
const benchmarkArguments = [sizes, ...(process.argv.includes("--debug-plan") ? ["--debug-plan"] : [])];
const containerName = `onecompany-catalog-scale-${process.pid}-${Date.now()}`;

function run(executable: string, args: string[], capture = false) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    throw new Error(
      `${executable} failed (${result.status ?? "no status"}): ${String(result.stderr || result.error?.message || "unknown error")}`
    );
  }
  return String(result.stdout ?? "").trim();
}

async function waitForPostgres() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      docker,
      ["exec", containerName, "pg_isready", "--username=postgres", "--dbname=postgres"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Disposable catalog scale PostgreSQL did not become ready");
}

async function main() {
  try {
    run(docker, [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--publish",
      "127.0.0.1::5432",
      image,
    ]);
    await waitForPostgres();
    const portOutput = run(docker, ["port", containerName, "5432/tcp"], true);
    const port = portOutput.match(/:(\d+)\s*$/)?.[1];
    if (!port) throw new Error(`Could not resolve disposable PostgreSQL port: ${portOutput}`);
    const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable&application_name=catalog-scale-gate`;
    const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
    const benchmark = path.resolve("scripts", "benchmark-catalog-v2-scale.ts");
    const result = spawnSync(process.execPath, [tsxCli, benchmark, ...benchmarkArguments], {
      encoding: "utf8",
      env: { ...process.env, CATALOG_SCALE_DATABASE_URL: databaseUrl },
      maxBuffer: 32 * 1024 * 1024,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`catalog scale benchmark failed (${result.status ?? "no status"})`);
    }
  } finally {
    spawnSync(docker, ["rm", "--force", containerName], { stdio: "ignore" });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
