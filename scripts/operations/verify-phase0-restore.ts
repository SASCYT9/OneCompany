import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

type Options = {
  archivePath: string;
  dockerPath: string;
  expectedTables?: number;
  expectedMigrations?: number;
};

function parseOptions(argv: string[]): Options {
  const options: Options = {
    archivePath: "",
    dockerPath: "docker",
  };

  for (const argument of argv) {
    if (argument.startsWith("--archive=")) {
      options.archivePath = argument.slice("--archive=".length);
    } else if (argument.startsWith("--docker=")) {
      options.dockerPath = argument.slice("--docker=".length);
    } else if (argument.startsWith("--expected-tables=")) {
      options.expectedTables = Number(argument.slice("--expected-tables=".length));
    } else if (argument.startsWith("--expected-migrations=")) {
      options.expectedMigrations = Number(argument.slice("--expected-migrations=".length));
    }
  }

  if (!options.archivePath) {
    throw new Error("--archive is required");
  }

  return options;
}

function runDocker(dockerPath: string, args: string[], captureOutput = false) {
  const result = spawnSync(dockerPath, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `Docker restore verification failed (${result.status ?? "no status"}): ${String(
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

  throw new Error("Temporary PostgreSQL restore target did not become ready");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const archivePath = path.resolve(options.archivePath);
  const allowedRoot = path.resolve("backups", "ops-preflight");

  if (!archivePath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`Archive must stay inside ${allowedRoot}`);
  }

  await fs.access(archivePath);
  const archiveDirectory = path.dirname(archivePath);
  const archiveName = path.basename(archivePath);
  const containerName = `onecompany-ops-restore-${process.pid}-${Date.now()}`;

  try {
    runDocker(options.dockerPath, [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "--volume",
      `${archiveDirectory}:/backup:ro`,
      "postgres:17",
    ]);

    await waitForPostgres(options.dockerPath, containerName);

    runDocker(options.dockerPath, [
      "exec",
      containerName,
      "pg_restore",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--exclude-schema=ppg",
      "--username=postgres",
      "--dbname=postgres",
      `/backup/${archiveName}`,
    ]);

    const output = runDocker(
      options.dockerPath,
      [
        "exec",
        containerName,
        "psql",
        "--tuples-only",
        "--no-align",
        "--username=postgres",
        "--dbname=postgres",
        "--command",
        `
          SELECT json_build_object(
            'tables', (
              SELECT count(*)::int
              FROM information_schema.tables
              WHERE table_schema = 'public'
            ),
            'migrations', (
              SELECT count(*)::int
              FROM "_prisma_migrations"
            )
          );
        `,
      ],
      true
    );

    const restored = JSON.parse(output) as { tables: number; migrations: number };
    if (options.expectedTables !== undefined && restored.tables !== options.expectedTables) {
      throw new Error(
        `Restored table count mismatch: expected ${options.expectedTables}, received ${restored.tables}`
      );
    }
    if (
      options.expectedMigrations !== undefined &&
      restored.migrations !== options.expectedMigrations
    ) {
      throw new Error(
        `Restored migration count mismatch: expected ${options.expectedMigrations}, received ${restored.migrations}`
      );
    }

    const manifest = {
      verifiedAt: new Date().toISOString(),
      archive: archiveName,
      temporaryTarget: "postgres:17",
      restored,
      expected: {
        tables: options.expectedTables ?? null,
        migrations: options.expectedMigrations ?? null,
      },
      verification: "temporary restore and count reconciliation passed",
    };

    const manifestPath = path.join(archiveDirectory, "restore-verification.json");
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
  } finally {
    spawnSync(options.dockerPath, ["rm", "--force", containerName], {
      encoding: "utf8",
      stdio: "ignore",
    });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown restore verification error";
  console.error(`Phase 0 restore verification failed: ${message}`);
  process.exitCode = 1;
});
