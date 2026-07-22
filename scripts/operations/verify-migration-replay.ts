import { spawnSync } from "node:child_process";
import path from "node:path";

type Options = {
  dockerPath: string;
  image: string;
  runIntegration: boolean;
};

function parseOptions(argv: string[]): Options {
  const dockerArgument = argv.find((argument) => argument.startsWith("--docker="));
  const imageArgument = argv.find((argument) => argument.startsWith("--image="));
  return {
    dockerPath: dockerArgument?.slice("--docker=".length) || "docker",
    image: imageArgument?.slice("--image=".length) || "pgvector/pgvector:0.8.2-pg17",
    runIntegration: argv.includes("--integration"),
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
  throw new Error("Temporary PostgreSQL migration replay target did not become ready");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const containerName = `onecompany-migration-replay-${process.pid}-${Date.now()}`;

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
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    };
    const prismaCli = path.resolve("node_modules", "prisma", "build", "index.js");

    run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--config", "scripts/operations/prisma-replay.config.ts"],
      { env }
    );

    const diff = spawnSync(
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
        "prisma/schema.prisma",
        "--exit-code",
      ],
      {
        encoding: "utf8",
        env,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    if (diff.status !== 0) {
      throw new Error(
        `Fresh migration replay differs from schema.prisma (exit ${diff.status}):\n${String(
          diff.stdout || diff.stderr
        )}`
      );
    }

    if (options.runIntegration) {
      run(
        process.execPath,
        [
          path.resolve("node_modules", "tsx", "dist", "cli.mjs"),
          "--test",
          "tests/shop/integration/operationsPersistence.test.ts",
        ],
        {
          env: {
            ...env,
            OPS_TEST_DATABASE_URL: databaseUrl,
          },
        }
      );
    }

    const counts = run(
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
      { capture: true }
    );

    console.log(
      JSON.stringify(
        {
          verification: "fresh migration replay matches prisma/schema.prisma",
          integration: options.runIntegration
            ? "operations persistence tests passed"
            : "not requested",
          target: `temporary ${options.image}`,
          counts: JSON.parse(counts),
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
  const message = error instanceof Error ? error.message : "Unknown migration replay error";
  console.error(`Migration replay verification failed: ${message}`);
  process.exitCode = 1;
});
