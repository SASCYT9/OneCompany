import assert from "node:assert/strict";
import test from "node:test";
import {
  OpsJobStage,
  OpsJobStatus,
  OpsPriority,
  OpsTaskEventType,
  OpsTaskSourceType,
  OpsTaskStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { runOpsIdempotentMutation } from "../../../src/lib/operations/idempotency";
import { leaseNextOpsJob, reclaimExpiredOpsJobLeases } from "../../../src/lib/operations/jobs";
import {
  OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES,
  releaseOpsMediaStorageReservation,
  reserveOpsMediaStorageBudget,
} from "../../../src/lib/operations/media";

const databaseUrl = process.env.OPS_TEST_DATABASE_URL;

test(
  "operations persistence is atomic, append-only, idempotent and restart-safe",
  { skip: databaseUrl ? false : "OPS_TEST_DATABASE_URL is required" },
  async () => {
    const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const actor = await prisma.adminUser.create({
        data: {
          email: "ops-integration@onecompany.test",
          name: "Ops integration",
          isActive: true,
        },
      });

      const reservationNow = new Date("2026-07-19T10:00:00.000Z");
      const reservation = await reserveOpsMediaStorageBudget({
        client: prisma,
        reservationKey: "integration-media-reservation",
        incomingBytes: 1_024,
        now: reservationNow,
      });
      await reserveOpsMediaStorageBudget({
        client: prisma,
        reservationKey: "integration-media-reservation",
        incomingBytes: 1_024,
        now: reservationNow,
      });
      const mediaBuckets = await prisma.opsUsageBucket.findMany({
        where: { feature: { in: ["media_upload", "media_retained"] } },
        select: { feature: true, storageBytes: true },
      });
      assert.deepEqual(
        Object.fromEntries(mediaBuckets.map((bucket) => [bucket.feature, bucket.storageBytes])),
        {
          media_upload: BigInt(1_024),
          media_retained: BigInt(1_024),
        }
      );
      await assert.rejects(
        reserveOpsMediaStorageBudget({
          client: prisma,
          reservationKey: "integration-media-reservation",
          incomingBytes: 2_048,
          now: reservationNow,
        }),
        (error: unknown) => (error as { code?: string }).code === "MEDIA_RESERVATION_CONFLICT"
      );
      await releaseOpsMediaStorageReservation({ client: prisma, reservation });
      assert.equal(
        await prisma.opsUsageBucket.count({
          where: { storageBytes: { not: BigInt(0) } },
        }),
        0
      );
      await prisma.opsUsageBucket.update({
        where: {
          month_feature: {
            month: new Date("2026-07-01T00:00:00.000Z"),
            feature: "media_upload",
          },
        },
        data: { storageBytes: OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES - BigInt(512) },
      });
      await assert.rejects(
        reserveOpsMediaStorageBudget({
          client: prisma,
          reservationKey: "integration-media-over-cap",
          incomingBytes: 1_024,
          now: reservationNow,
        }),
        (error: unknown) => (error as { code?: string }).code === "MEDIA_MONTHLY_UPLOAD_CAP"
      );

      const createProject = () =>
        runOpsIdempotentMutation({
          prisma,
          scope: "integration.project.create",
          key: "integration-project-key",
          payload: { title: "Integration project" },
          execute: async (tx) => {
            const project = await tx.opsProject.create({
              data: {
                externalId: "PRJ-INTEGRATION",
                title: "Integration project",
                ownerId: actor.id,
              },
            });
            await tx.adminAuditLog.create({
              data: {
                actorId: actor.id,
                actorEmail: actor.email,
                actorName: actor.name,
                scope: "operations",
                action: "project.create",
                entityType: "ops.project",
                entityId: project.id,
              },
            });
            return {
              body: { projectId: project.id },
              statusCode: 201,
              resourceType: "ops.project",
              resourceId: project.id,
            };
          },
        });

      const first = await createProject();
      const replay = await createProject();
      assert.equal(first.replayed, false);
      assert.equal(replay.replayed, true);
      assert.equal(replay.body.projectId, first.body.projectId);
      assert.equal(await prisma.opsProject.count({ where: { externalId: "PRJ-INTEGRATION" } }), 1);
      assert.equal(
        await prisma.adminAuditLog.count({
          where: { action: "project.create", entityId: first.body.projectId },
        }),
        1
      );
      await assert.rejects(
        runOpsIdempotentMutation({
          prisma,
          scope: "integration.project.create",
          key: "integration-project-key",
          payload: { title: "Different request" },
          execute: async () => ({
            body: { projectId: "never" },
            statusCode: 201,
          }),
        }),
        (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT"
      );

      await assert.rejects(
        prisma.$transaction(async (tx) => {
          const task = await tx.opsTask.create({
            data: {
              externalId: "TSK-ROLLBACK",
              projectId: first.body.projectId,
              title: "Must roll back",
              status: OpsTaskStatus.PLANNED,
              priority: OpsPriority.NORMAL,
              nextAction: "Verify rollback",
              createdById: actor.id,
            },
          });
          await tx.opsTaskEvent.create({
            data: {
              taskId: task.id,
              type: OpsTaskEventType.CREATED,
              actorId: actor.id,
            },
          });
          await tx.adminAuditLog.create({
            data: {
              actorId: actor.id,
              actorEmail: actor.email,
              scope: "operations",
              action: "task.create",
              entityType: "ops.task",
              entityId: task.id,
            },
          });
          throw new Error("ROLLBACK_SENTINEL");
        }),
        /ROLLBACK_SENTINEL/
      );
      assert.equal(await prisma.opsTask.count({ where: { externalId: "TSK-ROLLBACK" } }), 0);

      const task = await prisma.opsTask.create({
        data: {
          externalId: "TSK-INTEGRATION",
          projectId: first.body.projectId,
          title: "Durable task",
          status: OpsTaskStatus.PLANNED,
          priority: OpsPriority.HIGH,
          nextAction: "Run integration checks",
          createdById: actor.id,
        },
      });
      const event = await prisma.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.CREATED,
          actorId: actor.id,
          sourceType: OpsTaskSourceType.ADMIN,
        },
      });
      const comment = await prisma.opsComment.create({
        data: {
          taskId: task.id,
          authorId: actor.id,
          text: "Immutable comment",
        },
      });
      await assert.rejects(
        prisma.$executeRaw(
          Prisma.sql`UPDATE "OpsTaskEvent" SET "payload" = '{}'::jsonb WHERE "id" = ${event.id}`
        )
      );
      await assert.rejects(
        prisma.$executeRaw(
          Prisma.sql`UPDATE "OpsComment" SET "text" = 'changed' WHERE "id" = ${comment.id}`
        )
      );
      await prisma.opsTask.create({
        data: {
          externalId: "TSK-HUMAN-ACTIVE",
          title: "Human task without hidden workflow metadata",
          status: OpsTaskStatus.IN_PROGRESS,
          createdById: actor.id,
        },
      });
      await assert.rejects(
        prisma.opsTask.create({
          data: {
            externalId: "TSK-INVALID-AGENT",
            title: "Agent work requires an explicit next action",
            status: OpsTaskStatus.AGENT_RUNNING,
            createdById: actor.id,
          },
        })
      );

      await prisma.opsTelegramContext.create({
        data: { chatId: BigInt(42), messageThreadId: null, telegramUserId: null },
      });
      await assert.rejects(
        prisma.opsTelegramContext.create({
          data: { chatId: BigInt(42), messageThreadId: null, telegramUserId: null },
        })
      );

      const now = new Date("2026-07-19T12:00:00.000Z");
      const job = await prisma.opsJob.create({
        data: {
          idempotencyKey: "integration-job",
          type: "integration",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.INGEST,
          availableAt: now,
        },
      });
      const leased = await leaseNextOpsJob({
        client: prisma,
        workerId: "integration-worker-1",
        now,
      });
      assert.equal(leased?.id, job.id);
      assert.equal(leased?.status, OpsJobStatus.RUNNING);

      const reclaimed = await reclaimExpiredOpsJobLeases({
        client: prisma,
        now: new Date(now.getTime() + 121_000),
      });
      assert.equal(reclaimed.reclaimed, 1);
      assert.equal(reclaimed.deadLettered, 0);
      const recovered = await leaseNextOpsJob({
        client: prisma,
        workerId: "integration-worker-2",
        now: new Date(now.getTime() + 136_000),
      });
      assert.equal(recovered?.id, job.id);
      assert.equal(recovered?.leaseOwner, "integration-worker-2");
    } finally {
      await prisma.$disconnect();
    }
  }
);
