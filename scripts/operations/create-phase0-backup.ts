import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";

type Options = {
  envPath: string;
  outputDirectory: string;
  dockerPath: string;
};

function parseOptions(argv: string[]): Options {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const options: Options = {
    envPath: ".env.local",
    outputDirectory: path.join("backups", "ops-preflight", now),
    dockerPath: "docker",
  };

  for (const argument of argv) {
    if (argument.startsWith("--env=")) {
      options.envPath = argument.slice("--env=".length);
    } else if (argument.startsWith("--output-dir=")) {
      options.outputDirectory = argument.slice("--output-dir=".length);
    } else if (argument.startsWith("--docker=")) {
      options.dockerPath = argument.slice("--docker=".length);
    }
  }

  return options;
}

function redact(value: string) {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

function assertSafeOutputDirectory(outputDirectory: string) {
  const repositoryRoot = path.resolve(".");
  const allowedRoot = path.resolve("backups", "ops-preflight");
  const resolved = path.resolve(outputDirectory);

  if (!resolved.startsWith(`${allowedRoot}${path.sep}`) || !resolved.startsWith(repositoryRoot)) {
    throw new Error(`Backup output must stay inside ${allowedRoot}`);
  }

  return resolved;
}

function toPostgresToolsUrl(connectionString: string) {
  const url = new URL(connectionString);
  const supportedParameters = new Set([
    "application_name",
    "channel_binding",
    "connect_timeout",
    "gssencmode",
    "keepalives",
    "keepalives_count",
    "keepalives_idle",
    "keepalives_interval",
    "options",
    "passfile",
    "service",
    "sslcert",
    "sslcrl",
    "sslkey",
    "sslmode",
    "sslpassword",
    "sslrootcert",
    "target_session_attrs",
    "tcp_user_timeout",
  ]);

  for (const key of Array.from(url.searchParams.keys())) {
    if (!supportedParameters.has(key)) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

function runDocker(dockerPath: string, args: string[], databaseUrl: string, captureOutput = false) {
  const result = spawnSync(dockerPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    maxBuffer: 16 * 1024 * 1024,
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"],
  });

  if (result.status !== 0) {
    const details = redact(String(result.stderr || result.error?.message || "unknown error"));
    throw new Error(`Docker PostgreSQL tool failed (${result.status ?? "no status"}): ${details}`);
  }

  return String(result.stdout || "");
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  loadEnv({ path: options.envPath, override: true, quiet: true });

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL or DIRECT_URL is required in ${options.envPath}`);
  }
  const postgresToolsUrl = toPostgresToolsUrl(databaseUrl);

  const outputDirectory = assertSafeOutputDirectory(options.outputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const archiveName = "onecompany-pre-operations.dump";
  const archivePath = path.join(outputDirectory, archiveName);
  const dockerMount = `${outputDirectory}:/backup`;

  runDocker(
    options.dockerPath,
    [
      "run",
      "--rm",
      "-e",
      "DATABASE_URL",
      "-v",
      dockerMount,
      "postgres:17",
      "sh",
      "-lc",
      `pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges --file=/backup/${archiveName}`,
    ],
    postgresToolsUrl
  );

  const listing = runDocker(
    options.dockerPath,
    [
      "run",
      "--rm",
      "-v",
      dockerMount,
      "postgres:17",
      "pg_restore",
      "--list",
      `/backup/${archiveName}`,
    ],
    postgresToolsUrl,
    true
  );

  const stat = await fs.stat(archivePath);
  const listingLines = listing
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith(";"));

  if (stat.size <= 0 || listingLines.length === 0) {
    throw new Error("Backup archive or pg_restore listing is empty");
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    archive: archiveName,
    bytes: stat.size,
    sha256: await sha256File(archivePath),
    pgRestoreListingEntries: listingLines.length,
    verification: "pg_restore --list passed",
    restoreCommandTemplate:
      "pg_restore --clean --if-exists --no-owner --no-privileges --dbname=<staging-restore-url> <archive>",
  };

  const manifestPath = path.join(outputDirectory, "backup-manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        archivePath,
        manifestPath,
        bytes: manifest.bytes,
        sha256: manifest.sha256,
        listingEntries: manifest.pgRestoreListingEntries,
        verification: manifest.verification,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? redact(error.message) : "Unknown backup error";
  console.error(`Phase 0 backup failed: ${message}`);
  process.exitCode = 1;
});
