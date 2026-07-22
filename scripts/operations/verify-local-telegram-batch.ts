import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  normalizeOpsTelegramUpdate,
  type OpsTelegramMember,
} from "../../src/lib/operations/telegram";
import {
  collectOpsTelegramBatchForward,
  createOpsTelegramBatchCallbackData,
  executeOpsTelegramBatchCallback,
  shouldAppendToOpenOpsTelegramBatch,
} from "../../src/lib/operations/telegramBatch";

const databaseUrl = new URL(String(process.env.DATABASE_URL ?? ""));
if (
  !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "56432" ||
  databaseUrl.pathname !== "/onecompany_ops_lab"
) {
  throw new Error("Telegram batch verification refused to use a non-Lab database");
}

const prisma = new PrismaClient();
let batchId: string | null = null;
let duplicateBatchId: string | null = null;
let inboxItemId: string | null = null;
let jobId: string | null = null;
const baseUpdateId = BigInt(Date.now()) * BigInt(1000);

async function main() {
  try {
    const profile = await prisma.opsMemberProfile.findFirst({
      where: {
        telegramEnabled: true,
        telegramUserId: { not: null },
        adminUser: { isActive: true },
      },
      select: {
        telegramUserId: true,
        adminUser: { select: { id: true, email: true, name: true } },
      },
    });
    assert.ok(profile?.telegramUserId, "Lab requires one linked Telegram member");
    const member: OpsTelegramMember = {
      adminUserId: profile.adminUser.id,
      email: profile.adminUser.email,
      name: profile.adminUser.name,
    };

    for (let index = 0; index < 12; index += 1) {
      const normalized = normalizeOpsTelegramUpdate({
        update_id: Number(baseUpdateId + BigInt(index)),
        message: {
          message_id: 900_000 + index,
          from: { id: Number(profile.telegramUserId) },
          chat: { id: Number(profile.telegramUserId), type: "private" },
          text: index === 0 ? "Проверить цены Maxton" : `Сообщение контекста ${index + 1}`,
          ...(index === 11
            ? {}
            : { forward_origin: { type: "hidden_user", sender_user_name: "Test source" } }),
        },
      });
      assert.ok(normalized);
      if (index === 11) {
        assert.equal(
          await shouldAppendToOpenOpsTelegramBatch({ client: prisma, update: normalized }),
          true
        );
      }
      const collected = await collectOpsTelegramBatchForward({
        client: prisma,
        update: normalized,
        member,
      });
      batchId ??= collected.id;
      assert.equal(collected.id, batchId);
      assert.equal(collected.itemCount, index + 1);
    }

    const callbackData = createOpsTelegramBatchCallbackData("one", batchId);
    assert.ok(callbackData);
    const callbackUpdate = normalizeOpsTelegramUpdate({
      update_id: Number(baseUpdateId + BigInt(100)),
      callback_query: {
        id: `batch-test-${Date.now()}`,
        from: { id: Number(profile.telegramUserId) },
        data: callbackData,
        message: {
          message_id: 900_010,
          from: { id: Number(process.env.OPS_TELEGRAM_BOT_ID), is_bot: true },
          chat: { id: Number(profile.telegramUserId), type: "private" },
        },
      },
    });
    assert.ok(callbackUpdate);
    const finalized = await executeOpsTelegramBatchCallback({
      client: prisma,
      update: callbackUpdate,
      member,
    });
    assert.ok(finalized?.jobId);
    jobId = finalized.jobId;

    const batch = await prisma.opsTelegramBatch.findUnique({
      where: { id: batchId },
      include: {
        items: true,
        inboxItem: { include: { jobs: true, proposals: true } },
      },
    });
    assert.equal(batch?.status, "PROCESSING");
    assert.equal(batch?.mode, "ONE_TASK");
    assert.equal(batch?.items.length, 12);
    assert.equal(batch?.inboxItem?.jobs.length, 1);
    assert.equal(batch?.inboxItem?.proposals.length, 0);
    inboxItemId = batch?.inboxItemId ?? null;

    for (let index = 0; index < 12; index += 1) {
      const normalized = normalizeOpsTelegramUpdate({
        update_id: Number(baseUpdateId + BigInt(200 + index)),
        message: {
          message_id: 901_000 + index,
          from: { id: Number(profile.telegramUserId) },
          chat: { id: Number(profile.telegramUserId), type: "private" },
          text: index === 0 ? "Проверить цены Maxton" : `Сообщение контекста ${index + 1}`,
          ...(index === 11
            ? {}
            : { forward_origin: { type: "hidden_user", sender_user_name: "Test source" } }),
        },
      });
      assert.ok(normalized);
      const collected = await collectOpsTelegramBatchForward({
        client: prisma,
        update: normalized,
        member,
      });
      duplicateBatchId ??= collected.id;
    }
    const duplicateCallbackData = createOpsTelegramBatchCallbackData("split", duplicateBatchId);
    assert.ok(duplicateCallbackData);
    const duplicateCallbackUpdate = normalizeOpsTelegramUpdate({
      update_id: Number(baseUpdateId + BigInt(300)),
      callback_query: {
        id: `batch-duplicate-test-${Date.now()}`,
        from: { id: Number(profile.telegramUserId) },
        data: duplicateCallbackData,
        message: {
          message_id: 901_100,
          from: { id: Number(process.env.OPS_TELEGRAM_BOT_ID), is_bot: true },
          chat: { id: Number(profile.telegramUserId), type: "private" },
        },
      },
    });
    assert.ok(duplicateCallbackUpdate);
    const duplicateResult = await executeOpsTelegramBatchCallback({
      client: prisma,
      update: duplicateCallbackUpdate,
      member,
    });
    assert.equal(duplicateResult?.jobId, null);
    assert.match(duplicateResult?.response ?? "", /уже была принята/i);
    const duplicateBatch = await prisma.opsTelegramBatch.findUnique({
      where: { id: duplicateBatchId },
      select: { status: true, inboxItemId: true },
    });
    assert.equal(duplicateBatch?.status, "CANCELLED");
    assert.equal(duplicateBatch?.inboxItemId, null);

    console.log(
      JSON.stringify({
        ok: true,
        collectedItems: batch?.items.length,
        inboxItemsCreated: batch?.inboxItem ? 1 : 0,
        jobsCreated: batch?.inboxItem?.jobs.length,
        tasksCreatedBeforeConfirmation: 0,
        duplicateBatchSuppressed: true,
      })
    );
  } finally {
    if (jobId) await prisma.opsJob.deleteMany({ where: { id: jobId } });
    if (batchId) {
      await prisma.opsTelegramBatch.updateMany({
        where: { id: batchId },
        data: { inboxItemId: null },
      });
    }
    if (inboxItemId) await prisma.opsInboxItem.deleteMany({ where: { id: inboxItemId } });
    if (batchId) {
      await prisma.opsTelegramBatchItem.deleteMany({ where: { batchId } });
      await prisma.adminAuditLog.deleteMany({
        where: { entityType: "ops.telegram_batch", entityId: batchId },
      });
      await prisma.opsTelegramBatch.deleteMany({ where: { id: batchId } });
    }
    if (duplicateBatchId) {
      await prisma.opsTelegramBatchItem.deleteMany({ where: { batchId: duplicateBatchId } });
      await prisma.adminAuditLog.deleteMany({
        where: { entityType: "ops.telegram_batch", entityId: duplicateBatchId },
      });
      await prisma.opsTelegramBatch.deleteMany({ where: { id: duplicateBatchId } });
    }
    await prisma.opsTelegramUpdate.deleteMany({
      where: {
        telegramUpdateId: {
          gte: baseUpdateId,
          lte: baseUpdateId + BigInt(300),
        },
      },
    });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
