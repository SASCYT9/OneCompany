import crypto from "node:crypto";
import { OpsJobStage, OpsJobStatus, type OpsJob, type PrismaClient } from "@prisma/client";

export const OPS_JOB_LEASE_MS = 120_000;
export const OPS_JOB_HEARTBEAT_MS = 20_000;
export const OPS_JOB_STAGE_TIMEOUT_MS = 90_000;
export const OPS_JOB_MAX_ATTEMPTS = 4;
export const OPS_JOB_BACKOFF_MS = [15_000, 60_000, 300_000, 900_000] as const;

export type OpsJobFailureState = {
  attempts: number;
  status: OpsJobStatus;
  availableAt: Date;
  finishedAt: Date | null;
};

export type OpsJobStageExecutor = (input: {
  job: OpsJob;
  workerId: string;
  signal: AbortSignal;
}) => Promise<
  | {
      outcome: "advance";
      stage: OpsJobStage;
      payload?: unknown;
      result?: unknown;
    }
  | {
      outcome: "succeeded";
      result?: unknown;
    }
  | {
      outcome: "waiting_human";
      result?: unknown;
    }
>;

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function opsJobBackoffMs(attemptsAfterFailure: number) {
  const index = Math.max(0, Math.min(OPS_JOB_BACKOFF_MS.length - 1, attemptsAfterFailure - 1));
  return OPS_JOB_BACKOFF_MS[index];
}

export function nextOpsJobFailureState(input: {
  attempts: number;
  maxAttempts: number;
  now: Date;
}): OpsJobFailureState {
  const attempts = input.attempts + 1;
  const deadLetter = attempts >= Math.max(1, input.maxAttempts);
  return {
    attempts,
    status: deadLetter ? OpsJobStatus.DEAD_LETTER : OpsJobStatus.QUEUED,
    availableAt: deadLetter ? input.now : new Date(input.now.getTime() + opsJobBackoffMs(attempts)),
    finishedAt: deadLetter ? input.now : null,
  };
}

export async function leaseNextOpsJob(input: {
  client: PrismaClient;
  workerId: string;
  now?: Date;
  types?: string[];
}) {
  const now = input.now ?? new Date();
  for (let pass = 0; pass < 4; pass += 1) {
    const candidate = await input.client.opsJob.findFirst({
      where: {
        status: OpsJobStatus.QUEUED,
        availableAt: { lte: now },
        cancelRequestedAt: null,
        ...(input.types?.length ? { type: { in: input.types } } : {}),
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!candidate) return null;
    const claimed = await input.client.opsJob.updateMany({
      where: {
        id: candidate.id,
        status: OpsJobStatus.QUEUED,
        availableAt: { lte: now },
        cancelRequestedAt: null,
      },
      data: {
        status: OpsJobStatus.RUNNING,
        leaseOwner: input.workerId,
        leaseExpiresAt: new Date(now.getTime() + OPS_JOB_LEASE_MS),
        heartbeatAt: now,
        startedAt: now,
        errorType: null,
        errorMessage: null,
      },
    });
    if (claimed.count === 1) {
      return input.client.opsJob.findUnique({ where: { id: candidate.id } });
    }
  }
  return null;
}

export async function heartbeatOpsJob(input: {
  client: PrismaClient;
  jobId: string;
  workerId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const updated = await input.client.opsJob.updateMany({
    where: {
      id: input.jobId,
      status: OpsJobStatus.RUNNING,
      leaseOwner: input.workerId,
    },
    data: {
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + OPS_JOB_LEASE_MS),
    },
  });
  return updated.count === 1;
}

export async function advanceOpsJob(input: {
  client: PrismaClient;
  jobId: string;
  workerId: string;
  stage: OpsJobStage;
  payload?: unknown;
  result?: unknown;
}) {
  const updated = await input.client.opsJob.updateMany({
    where: {
      id: input.jobId,
      status: OpsJobStatus.RUNNING,
      leaseOwner: input.workerId,
      cancelRequestedAt: null,
    },
    data: {
      status: OpsJobStatus.QUEUED,
      stage: input.stage,
      availableAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      ...(input.payload === undefined ? {} : { payload: jsonValue(input.payload) }),
      ...(input.result === undefined ? {} : { result: jsonValue(input.result) }),
    },
  });
  if (updated.count !== 1) {
    throw new Error("OPS_JOB_LEASE_LOST");
  }
}

export async function completeOpsJob(input: {
  client: PrismaClient;
  jobId: string;
  workerId: string;
  result?: unknown;
  waitingHuman?: boolean;
}) {
  const now = new Date();
  const status = input.waitingHuman ? OpsJobStatus.WAITING_HUMAN : OpsJobStatus.SUCCEEDED;
  const updated = await input.client.opsJob.updateMany({
    where: {
      id: input.jobId,
      status: OpsJobStatus.RUNNING,
      leaseOwner: input.workerId,
    },
    data: {
      status,
      result: input.result === undefined ? undefined : jsonValue(input.result),
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      finishedAt: now,
    },
  });
  if (updated.count !== 1) {
    throw new Error("OPS_JOB_LEASE_LOST");
  }
}

function errorDetails(error: unknown) {
  const typed = error as { code?: unknown; name?: unknown; message?: unknown };
  const rawMessage = String(
    typed?.message ?? (error instanceof Error ? error.message : "Job stage failed")
  );
  return {
    errorType: String(typed?.code ?? typed?.name ?? "JOB_STAGE_FAILED").slice(0, 120),
    errorMessage: redactOpsJobErrorMessage(rawMessage).slice(0, 2_000),
  };
}

export function redactOpsJobErrorMessage(message: string) {
  let redacted = message
    .replace(/bot\d{6,}:[a-zA-Z0-9_-]{20,}/g, "bot[REDACTED]")
    .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+/gi, "Bearer [REDACTED]");
  for (const secret of [
    process.env.OPS_TELEGRAM_BOT_TOKEN,
    process.env.OPS_TELEGRAM_WEBHOOK_SECRET,
    process.env.OPS_TELEGRAM_CALLBACK_SECRET,
    process.env.OPS_GEMINI_API_KEY,
    process.env.OPS_BLOB_READ_WRITE_TOKEN,
    process.env.VERCEL_OIDC_TOKEN,
    process.env.CRON_SECRET,
  ]) {
    const value = String(secret ?? "").trim();
    if (value.length >= 8) redacted = redacted.replaceAll(value, "[REDACTED]");
  }
  return redacted;
}

export async function failOpsJob(input: {
  client: PrismaClient;
  job: OpsJob;
  workerId: string;
  error: unknown;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const failure = nextOpsJobFailureState({
    attempts: input.job.attempts,
    maxAttempts: input.job.maxAttempts,
    now,
  });
  const details = errorDetails(input.error);
  const updated = await input.client.opsJob.updateMany({
    where: {
      id: input.job.id,
      status: OpsJobStatus.RUNNING,
      leaseOwner: input.workerId,
    },
    data: {
      ...failure,
      ...details,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
    },
  });
  if (updated.count === 1 && failure.status === OpsJobStatus.DEAD_LETTER && input.job.inboxItemId) {
    await input.client.opsInboxItem.update({
      where: { id: input.job.inboxItemId },
      data: {
        extractionStatus: "FAILED",
        processingErrorType: details.errorType,
        processingError: details.errorMessage,
      },
    });
  }
  return { updated: updated.count === 1, deadLetter: failure.status === OpsJobStatus.DEAD_LETTER };
}

export async function cancelRequestedOpsJobs(input: {
  client: PrismaClient;
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const rows = await input.client.opsJob.findMany({
    where: {
      cancelRequestedAt: { not: null },
      status: { in: [OpsJobStatus.QUEUED, OpsJobStatus.RUNNING] },
    },
    orderBy: { cancelRequestedAt: "asc" },
    take: Math.max(1, Math.min(100, input.limit ?? 50)),
    select: { id: true },
  });
  if (!rows.length) return 0;
  const result = await input.client.opsJob.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: {
      status: OpsJobStatus.CANCELLED,
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      finishedAt: now,
    },
  });
  return result.count;
}

export async function reclaimExpiredOpsJobLeases(input: {
  client: PrismaClient;
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const rows = await input.client.opsJob.findMany({
    where: {
      status: OpsJobStatus.RUNNING,
      leaseExpiresAt: { lt: now },
    },
    orderBy: { leaseExpiresAt: "asc" },
    take: Math.max(1, Math.min(100, input.limit ?? 50)),
    select: { id: true },
  });
  let reclaimed = 0;
  let deadLettered = 0;
  for (const row of rows) {
    const job = await input.client.opsJob.findUnique({ where: { id: row.id } });
    if (!job || job.status !== OpsJobStatus.RUNNING || !job.leaseExpiresAt) continue;
    const failure = nextOpsJobFailureState({
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      now,
    });
    const result = await input.client.opsJob.updateMany({
      where: {
        id: job.id,
        status: OpsJobStatus.RUNNING,
        leaseExpiresAt: { lt: now },
      },
      data: {
        ...failure,
        errorType: "LEASE_EXPIRED",
        errorMessage: "Worker lease expired and was reclaimed by the watchdog",
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
      },
    });
    if (result.count === 1) {
      reclaimed += 1;
      if (failure.status === OpsJobStatus.DEAD_LETTER) deadLettered += 1;
    }
  }
  return { reclaimed, deadLettered };
}

async function withStageTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = OPS_JOB_STAGE_TIMEOUT_MS
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          const error = new Error("Operations job stage exceeded its time budget");
          error.name = "OPS_JOB_STAGE_TIMEOUT";
          controller.abort(error);
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runLeasedOpsJob(input: {
  client: PrismaClient;
  job: OpsJob;
  workerId: string;
  execute: OpsJobStageExecutor;
}) {
  const heartbeat = setInterval(() => {
    void heartbeatOpsJob({
      client: input.client,
      jobId: input.job.id,
      workerId: input.workerId,
    }).catch(() => undefined);
  }, OPS_JOB_HEARTBEAT_MS);
  heartbeat.unref?.();
  try {
    const current = await input.client.opsJob.findUnique({ where: { id: input.job.id } });
    if (
      !current ||
      current.status !== OpsJobStatus.RUNNING ||
      current.leaseOwner !== input.workerId
    ) {
      throw new Error("OPS_JOB_LEASE_LOST");
    }
    if (current.cancelRequestedAt) {
      await completeOpsJob({
        client: input.client,
        jobId: current.id,
        workerId: input.workerId,
        result: { cancelled: true },
      });
      await input.client.opsJob.update({
        where: { id: current.id },
        data: { status: OpsJobStatus.CANCELLED },
      });
      return { outcome: "cancelled" as const };
    }
    const result = await withStageTimeout((signal) =>
      input.execute({ job: current, workerId: input.workerId, signal })
    );
    if (result.outcome === "advance") {
      await advanceOpsJob({
        client: input.client,
        jobId: current.id,
        workerId: input.workerId,
        stage: result.stage,
        payload: result.payload,
        result: result.result,
      });
    } else {
      await completeOpsJob({
        client: input.client,
        jobId: current.id,
        workerId: input.workerId,
        result: result.result,
        waitingHuman: result.outcome === "waiting_human",
      });
    }
    return { outcome: result.outcome };
  } catch (error) {
    const failed = await failOpsJob({
      client: input.client,
      job: input.job,
      workerId: input.workerId,
      error,
    });
    return { outcome: failed.deadLetter ? ("dead_letter" as const) : ("retry" as const) };
  } finally {
    clearInterval(heartbeat);
  }
}

export async function drainOpsJobs(input: {
  client: PrismaClient;
  execute: OpsJobStageExecutor;
  maxJobs?: number;
  timeBudgetMs?: number;
  workerId?: string;
  types?: string[];
}) {
  const startedAt = Date.now();
  const workerId = input.workerId ?? `ops-${crypto.randomUUID()}`;
  const maxJobs = Math.max(1, Math.min(25, input.maxJobs ?? 8));
  const timeBudgetMs = Math.max(1_000, Math.min(55_000, input.timeBudgetMs ?? 45_000));
  const outcomes: string[] = [];
  for (let index = 0; index < maxJobs; index += 1) {
    if (Date.now() - startedAt >= timeBudgetMs) break;
    const job = await leaseNextOpsJob({
      client: input.client,
      workerId,
      types: input.types,
    });
    if (!job) break;
    const result = await runLeasedOpsJob({
      client: input.client,
      job,
      workerId,
      execute: input.execute,
    });
    outcomes.push(result.outcome);
  }
  return {
    workerId,
    processed: outcomes.length,
    outcomes,
    durationMs: Date.now() - startedAt,
  };
}
