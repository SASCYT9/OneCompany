import { spawnSync } from "node:child_process";
import path from "node:path";

const docker = "docker";
const containerName = `onecompany-catalog-publication-${process.pid}-${Date.now()}`;

function run(executable: string, args: string[], capture = false) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (result.status !== 0) throw new Error(`${executable} failed (${result.status ?? "unknown"})`);
  return String(result.stdout ?? "").trim();
}

async function main() {
  try {
    run(docker, ["run", "--detach", "--rm", "--name", containerName, "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--publish", "127.0.0.1::5432", "pgvector/pgvector:0.8.2-pg17"]);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (spawnSync(docker, ["exec", containerName, "pg_isready", "-U", "postgres"]).status === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const port = run(docker, ["port", containerName, "5432/tcp"], true).match(/:(\d+)\s*$/)?.[1];
    if (!port) throw new Error("Could not resolve disposable PostgreSQL port");
    const url = `postgresql://postgres@127.0.0.1:${port}/postgres?schema=public&application_name=catalog-publication-gate`;
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
    run(process.execPath, [prismaCli, "migrate", "deploy"], false);
    const serverRunner = path.resolve("scripts", "run-react-server-tsx.mjs");
    const benchmark = path.resolve("scripts", "benchmark-catalog-v2-publication.ts");
    const result = spawnSync(process.execPath, [serverRunner, benchmark], {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, CATALOG_PUBLICATION_GATE_DATABASE_URL: url },
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error("Publication benchmark failed");
  } finally {
    spawnSync(docker, ["rm", "--force", containerName], { stdio: "ignore" });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
