import { OpsJobStage, OpsJobStatus, PrismaClient } from "@prisma/client";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function assertLocalLabDatabase(value: string) {
  const url = new URL(value);
  const databaseName = url.pathname.replace(/^\/+/, "");
  if (
    !LOCAL_DATABASE_HOSTS.has(url.hostname) ||
    url.port !== "56432" ||
    databaseName !== "onecompany_ops_lab"
  ) {
    throw new Error(
      "Local Lab resume refused: DATABASE_URL must target onecompany_ops_lab on 127.0.0.1:56432"
    );
  }
}

async function main() {
  assertLocalLabDatabase(String(process.env.DATABASE_URL ?? ""));
  const prisma = new PrismaClient();
  try {
    const resumed = await prisma.opsJob.updateMany({
      where: {
        status: OpsJobStatus.WAITING_HUMAN,
        stage: OpsJobStage.EXTRACT,
        inboxItem: {
          processingErrorType: {
            in: ["AI_NOT_CONFIGURED", "AI_BUDGET_EXHAUSTED"],
          },
          proposals: { none: {} },
        },
      },
      data: {
        status: OpsJobStatus.QUEUED,
        availableAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        finishedAt: null,
      },
    });

    console.log(
      JSON.stringify({
        resumed: resumed.count,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local Lab resume failed");
  process.exitCode = 1;
});
