import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

type CliOptions = {
  envPath: string;
  outputPath: string;
  label: string;
};

function parseOptions(argv: string[]): CliOptions {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const options: CliOptions = {
    envPath: ".env.local",
    outputPath: path.join("backups", "ops-preflight", now, "phase0-audit.json"),
    label: "configured-database",
  };

  for (const argument of argv) {
    if (argument.startsWith("--env=")) {
      options.envPath = argument.slice("--env=".length);
    } else if (argument.startsWith("--output=")) {
      options.outputPath = argument.slice("--output=".length);
    } else if (argument.startsWith("--label=")) {
      options.label = argument.slice("--label=".length);
    }
  }

  return options;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string) {
  return sha256(await fs.readFile(filePath));
}

async function listMigrationFiles(root: string) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const migrations: Array<{ name: string; path: string; sha256: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const migrationPath = path.join(root, entry.name, "migration.sql");
    try {
      migrations.push({
        name: entry.name,
        path: migrationPath.replaceAll("\\", "/"),
        sha256: await sha256File(migrationPath),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return migrations.sort((left, right) => left.name.localeCompare(right.name));
}

function readGitSha() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

async function readEnvKeys(envPath: string) {
  const source = await fs.readFile(envPath, "utf8");
  return Array.from(
    new Set(
      source
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
        .filter((key): key is string => Boolean(key))
    )
  ).sort();
}

async function inspectDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });

  const safeConnection = {
    protocol: url.protocol.replace(":", ""),
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    sslMode: url.searchParams.get("sslmode"),
  };

  await client.connect();
  try {
    const identity = await client.query<{
      database: string;
      schema: string;
      version: string;
      transaction_read_only: string;
    }>(`
          SELECT
            current_database() AS database,
            current_schema() AS schema,
            current_setting('server_version') AS version,
            current_setting('transaction_read_only') AS transaction_read_only
        `);
    const tables = await client.query<{
      table_name: string;
      table_type: string;
    }>(`
          SELECT table_name, table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
    const columns = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      character_maximum_length: number | null;
      datetime_precision: number | null;
    }>(`
          SELECT
            table_name,
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default,
            numeric_precision,
            numeric_scale,
            character_maximum_length,
            datetime_precision
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `);
    const constraints = await client.query<{
      table_name: string;
      constraint_name: string;
      constraint_type: string;
    }>(`
          SELECT table_name, constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
          ORDER BY table_name, constraint_name
        `);
    const indexes = await client.query<{
      table_name: string;
      index_name: string;
      index_definition: string;
    }>(`
          SELECT
            tablename AS table_name,
            indexname AS index_name,
            indexdef AS index_definition
          FROM pg_indexes
          WHERE schemaname = 'public'
          ORDER BY tablename, indexname
        `);
    const extensions = await client.query<{ extension_name: string; version: string }>(`
          SELECT extname AS extension_name, extversion AS version
          FROM pg_extension
          ORDER BY extname
        `);
    const migrations = await client.query<{
      migration_name: string;
      checksum: string;
      started_at: Date;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
    }>(`
          SELECT
            migration_name,
            checksum,
            started_at,
            finished_at,
            rolled_back_at,
            applied_steps_count
          FROM "_prisma_migrations"
          ORDER BY started_at, migration_name
        `);

    const schemaSnapshot = {
      tables: tables.rows,
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      extensions: extensions.rows,
    };

    return {
      status: "reachable",
      connection: safeConnection,
      identity: identity.rows[0],
      counts: {
        tables: tables.rowCount,
        columns: columns.rowCount,
        constraints: constraints.rowCount,
        indexes: indexes.rowCount,
        migrations: migrations.rowCount,
      },
      schemaHash: sha256(JSON.stringify(schemaSnapshot)),
      schema: schemaSnapshot,
      migrations: migrations.rows,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  loadEnv({ path: options.envPath, override: true, quiet: true });

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(`DATABASE_URL or DIRECT_URL is required in ${options.envPath}`);
  }

  const migrationRoot = path.join("prisma", "migrations");
  const headSchema = execFileSync("git", ["show", "HEAD:prisma/schema.prisma"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 8 * 1024 * 1024,
  });
  const manifest = {
    generatedAt: new Date().toISOString(),
    label: options.label,
    git: {
      branch: execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
      sha: readGitSha(),
    },
    config: {
      envFile: path.basename(options.envPath),
      envKeys: await readEnvKeys(options.envPath),
      vercelSha256: await sha256File("vercel.json"),
      prismaSchemaSha256: await sha256File(path.join("prisma", "schema.prisma")),
      gitHeadPrismaSchemaSha256: sha256(headSchema),
      migrationLockSha256: await sha256File(path.join(migrationRoot, "migration_lock.toml")),
      migrationFiles: await listMigrationFiles(migrationRoot),
    },
    database: await inspectDatabase(connectionString),
  };

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(
    path.join(path.dirname(options.outputPath), "git-head-schema.prisma"),
    headSchema,
    "utf8"
  );
  await fs.writeFile(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath: path.resolve(options.outputPath),
        label: manifest.label,
        gitSha: manifest.git.sha,
        databaseStatus: manifest.database.status,
        connection: manifest.database.connection,
        counts: manifest.database.counts,
        schemaHash: manifest.database.schemaHash,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const safeError =
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
      : "Unknown error";
  console.error(`Phase 0 audit failed: ${safeError}`);
  process.exitCode = 1;
});
