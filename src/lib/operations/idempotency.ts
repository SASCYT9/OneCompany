import { Prisma, type PrismaClient } from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";
import { hashOpsRequest, toStoredJson } from "@/lib/operations/request";

type IdempotentOutcome<T> = {
  body: T;
  statusCode: number;
  resourceType?: string;
  resourceId?: string;
};

type IdempotentResult<T> = IdempotentOutcome<T> & {
  replayed: boolean;
};

type TransactionClient = Prisma.TransactionClient;

export async function runOpsIdempotentMutation<T>(params: {
  prisma: PrismaClient;
  scope: string;
  key: string;
  payload: unknown;
  execute: (tx: TransactionClient) => Promise<IdempotentOutcome<T>>;
}): Promise<IdempotentResult<T>> {
  const requestHash = hashOpsRequest(params.payload);

  const run = async () =>
    params.prisma.$transaction(
      async (tx) => {
        let existing = await tx.opsIdempotencyRecord.findUnique({
          where: { scope_key: { scope: params.scope, key: params.key } },
        });
        if (existing && existing.expiresAt.getTime() <= Date.now()) {
          await tx.opsIdempotencyRecord.delete({ where: { id: existing.id } });
          existing = null;
        }
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new OpsError(
              "IDEMPOTENCY_CONFLICT",
              409,
              "The idempotency key was already used with a different request"
            );
          }
          return {
            body: existing.responseBody as T,
            statusCode: existing.statusCode,
            resourceType: existing.resourceType ?? undefined,
            resourceId: existing.resourceId ?? undefined,
            replayed: true,
          };
        }

        const outcome = await params.execute(tx);
        await tx.opsIdempotencyRecord.create({
          data: {
            scope: params.scope,
            key: params.key,
            requestHash,
            responseBody: toStoredJson(outcome.body) as Prisma.InputJsonValue,
            statusCode: outcome.statusCode,
            resourceType: outcome.resourceType,
            resourceId: outcome.resourceId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        return { ...outcome, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  try {
    return await run();
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") {
      throw error;
    }
    let existing = await params.prisma.opsIdempotencyRecord.findUnique({
      where: { scope_key: { scope: params.scope, key: params.key } },
    });
    if (existing && existing.expiresAt.getTime() <= Date.now()) {
      const removed = await params.prisma.opsIdempotencyRecord.deleteMany({
        where: { id: existing.id, expiresAt: { lte: new Date() } },
      });
      if (removed.count === 1) {
        return run();
      }
      existing = await params.prisma.opsIdempotencyRecord.findUnique({
        where: { scope_key: { scope: params.scope, key: params.key } },
      });
    }
    if (!existing || existing.requestHash !== requestHash) {
      throw new OpsError(
        "IDEMPOTENCY_CONFLICT",
        409,
        "The idempotency key was already used with a different request"
      );
    }
    return {
      body: existing.responseBody as T,
      statusCode: existing.statusCode,
      resourceType: existing.resourceType ?? undefined,
      resourceId: existing.resourceId ?? undefined,
      replayed: true,
    };
  }
}
