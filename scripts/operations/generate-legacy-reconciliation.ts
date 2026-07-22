import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

type Options = {
  dockerPath: string;
  image: string;
  outputDirectory: string;
};

function parseOptions(argv: string[]): Options {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const read = (name: string) =>
    argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);

  return {
    dockerPath: read("docker") || "docker",
    image: read("image") || "pgvector/pgvector:0.8.2-pg17",
    outputDirectory:
      read("output-dir") || path.join("backups", "ops-preflight", now, "legacy-reconciliation"),
  };
}

function run(
  executable: string,
  args: string[],
  options: { capture?: boolean; env?: NodeJS.ProcessEnv } = {}
) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `${executable} failed (${result.status ?? "no status"}): ${String(
        result.stderr || result.error?.message || "unknown error"
      )}`
    );
  }

  return String(result.stdout || "").trim();
}

async function waitForPostgres(dockerPath: string, containerName: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      dockerPath,
      ["exec", containerName, "pg_isready", "--username=postgres", "--dbname=postgres"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    if (result.status === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Temporary PostgreSQL reconciliation target did not become ready");
}

function buildLegacyTargetSchema(headSchema: string) {
  let schema = headSchema;
  if (!schema.includes("appAtomicDiscountPercent")) {
    schema = schema.replace(
      /(model ShopSettings \{[\s\S]*?)(\n\})/,
      "$1\n  appAtomicDiscountPercent  Decimal? @default(7.00) @db.Decimal(5, 2)$2"
    );
  }

  if (!schema.includes("model ShopBrandB2bDiscount")) {
    schema += `

// Reflected from the live pricing schema and migration 20260520212700.
model ShopBrandB2bDiscount {
  id          String   @id @default(cuid())
  brand       String   @unique
  discountPct Decimal  @db.Decimal(5, 2)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
`;
  }

  return schema;
}

async function createMigrationSubset(outputDirectory: string) {
  const sourceRoot = path.resolve("prisma", "migrations");
  const targetRoot = path.join(outputDirectory, "migrations-before-ops");
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.copyFile(
    path.join(sourceRoot, "migration_lock.toml"),
    path.join(targetRoot, "migration_lock.toml")
  );

  const cutoff = "20260717170000_add_shop_knowledge_catalog_state";
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const selected = entries
    .filter((entry) => entry.isDirectory() && entry.name <= cutoff)
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of selected) {
    await fs.cp(path.join(sourceRoot, entry.name), path.join(targetRoot, entry.name), {
      recursive: true,
    });
  }

  return { targetRoot, migrationCount: selected.length };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const repositoryRoot = path.resolve(".");
  const allowedRoot = path.resolve("backups", "ops-preflight");
  const outputDirectory = path.resolve(options.outputDirectory);
  if (
    !outputDirectory.startsWith(`${allowedRoot}${path.sep}`) ||
    !outputDirectory.startsWith(repositoryRoot)
  ) {
    throw new Error(`Output must stay inside ${allowedRoot}`);
  }
  await fs.mkdir(outputDirectory, { recursive: true });

  const headSchema = execFileSync("git", ["show", "HEAD:prisma/schema.prisma"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 8 * 1024 * 1024,
  });
  const legacySchemaPath = path.join(outputDirectory, "legacy-target-schema.prisma");
  await fs.writeFile(legacySchemaPath, buildLegacyTargetSchema(headSchema), "utf8");
  const { targetRoot: migrationPath, migrationCount } =
    await createMigrationSubset(outputDirectory);

  const containerName = `onecompany-reconciliation-${process.pid}-${Date.now()}`;
  try {
    run(options.dockerPath, [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--publish",
      "127.0.0.1::5432",
      options.image,
    ]);
    await waitForPostgres(options.dockerPath, containerName);

    const portOutput = run(options.dockerPath, ["port", containerName, "5432/tcp"], {
      capture: true,
    });
    const port = portOutput.match(/:(\d+)\s*$/)?.[1];
    if (!port) throw new Error(`Could not resolve temporary PostgreSQL port: ${portOutput}`);

    const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
    const env = {
      ...process.env,
      OPS_REPLAY_DATABASE_URL: databaseUrl,
      OPS_REPLAY_SCHEMA_PATH: legacySchemaPath,
      OPS_REPLAY_MIGRATIONS_PATH: migrationPath,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    };
    const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");
    run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--config", "scripts/operations/prisma-replay.config.ts"],
      { env }
    );

    const diffPath = path.join(outputDirectory, "legacy-reconciliation.generated.sql");
    run(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "diff",
        "--config",
        "scripts/operations/prisma-replay.config.ts",
        "--from-url",
        databaseUrl,
        "--to-schema-datamodel",
        legacySchemaPath,
        "--script",
        "--output",
        diffPath,
      ],
      { env }
    );

    console.log(
      JSON.stringify(
        {
          migrationCount,
          legacySchemaPath,
          diffPath,
          bytes: (await fs.stat(diffPath)).size,
          verification: "generated from a fresh pre-Ops migration replay",
        },
        null,
        2
      )
    );
  } finally {
    spawnSync(options.dockerPath, ["rm", "--force", containerName], {
      encoding: "utf8",
      stdio: "ignore",
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown reconciliation error";
  console.error(`Legacy reconciliation generation failed: ${message}`);
  process.exitCode = 1;
});
