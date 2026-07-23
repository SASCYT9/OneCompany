import assert from "node:assert/strict";
import test from "node:test";
import { OpsApprovalStatus, OpsBlockerType, OpsTaskStatus, type Prisma } from "@prisma/client";
import {
  assertOpsApprovalCanBeDecided,
  assertOpsApprovalPayloadIntegrity,
  effectiveOpsApprovalStatus,
  normalizeOpsApprovalDecision,
  normalizeOpsApprovalStatusFilter,
} from "../../../src/lib/operations/approvals";
import {
  assertOpsAutomationTaskCanStart,
  hashApprovalPayload,
  isOpsAiBudgetAvailable,
  OPS_AUTOMATION_FORBIDDEN_EFFECTS,
  OPS_AUTOMATION_REGISTRY,
  parseOpsAutomationRequest,
  resolveOpsAutomationRequestTarget,
} from "../../../src/lib/operations/automation";
import {
  assertOpsAutomationsEnabled,
  isOperationsUiEnabled,
  isOpsAutomationsEnabled,
} from "../../../src/lib/operations/featureFlags";
import {
  assertCanWriteTask,
  assertCanWriteProject,
  assertOperationsPermission,
} from "../../../src/lib/operations/access";
import { ADMIN_PERMISSIONS } from "../../../src/lib/admin/adminPermissions";
import {
  hasKnowledgeDraftChanges,
  normalizeKnowledgeCreateInput,
  OPS_KNOWLEDGE_CATEGORIES,
  redactKnowledgeTaskMetadata,
} from "../../../src/lib/operations/knowledge";
import {
  appendOpsSourceUrls,
  extractOpsSourceUrls,
  findMatchingBrandGuideKeys,
  findShippingEstimates,
  getBrandGuideByKey,
  hydrateBrandGuideFromArticle,
  isProductRelatedTask,
  operatorFacingReferenceText,
  parseShippingEstimatesFromMarkdown,
} from "../../../src/lib/operations/brandGuides";
import {
  hashOpsRequest,
  requireIfMatch,
  resolveOpsAllowedMutationOrigins,
} from "../../../src/lib/operations/request";
import {
  assertTaskStateInvariant,
  assertTaskTransition,
  normalizeTaskCreateInput,
  resolveOpsTaskDueAt,
} from "../../../src/lib/operations/tasks";

test("operations feature flag fails closed in production", () => {
  assert.equal(
    isOperationsUiEnabled({
      NODE_ENV: "production",
      OPS_UI_ENABLED: undefined,
    } as NodeJS.ProcessEnv),
    false
  );
  assert.equal(
    isOperationsUiEnabled({ NODE_ENV: "production", OPS_UI_ENABLED: "true" } as NodeJS.ProcessEnv),
    true
  );
});

test("optimistic locking accepts the application version header and legacy If-Match callers", () => {
  assert.equal(
    requireIfMatch(
      new Request("https://onecompany.global/api/admin/operations/tasks/task-1", {
        headers: { "X-Ops-Entity-Version": "12" },
      }) as never
    ),
    12
  );
  assert.equal(
    requireIfMatch(
      new Request("https://onecompany.global/api/admin/operations/tasks/task-1", {
        headers: { "If-Match": '"13"' },
      }) as never
    ),
    13
  );
});

test("automation canary flag is explicit and fails closed", () => {
  assert.equal(
    isOpsAutomationsEnabled({
      NODE_ENV: "test",
      OPS_AUTOMATIONS_ENABLED: undefined,
    } as NodeJS.ProcessEnv),
    false
  );
  assert.equal(
    isOpsAutomationsEnabled({
      NODE_ENV: "test",
      OPS_AUTOMATIONS_ENABLED: "true",
    } as NodeJS.ProcessEnv),
    true
  );
  const previous = process.env.OPS_AUTOMATIONS_ENABLED;
  try {
    process.env.OPS_AUTOMATIONS_ENABLED = "0";
    assert.throws(() => assertOpsAutomationsEnabled(), /canary gate/i);
    process.env.OPS_AUTOMATIONS_ENABLED = "1";
    assert.doesNotThrow(() => assertOpsAutomationsEnabled());
  } finally {
    if (previous === undefined) delete process.env.OPS_AUTOMATIONS_ENABLED;
    else process.env.OPS_AUTOMATIONS_ENABLED = previous;
  }
});

test("request hashing is stable across object key order", () => {
  assert.equal(hashOpsRequest({ b: 2, a: 1 }), hashOpsRequest({ a: 1, b: 2 }));
  assert.notEqual(hashOpsRequest({ a: 1 }), hashOpsRequest({ a: 2 }));
});

test("operations mutations accept the browser-facing host without trusting arbitrary origins", () => {
  const localOrigins = resolveOpsAllowedMutationOrigins({
    requestOrigin: "http://localhost:3000",
    host: "127.0.0.1:3000",
    forwardedHost: null,
    forwardedProto: "http",
  });
  assert.equal(localOrigins.has("http://127.0.0.1:3000"), true);
  assert.equal(localOrigins.has("https://attacker.example"), false);

  const productionOrigins = resolveOpsAllowedMutationOrigins({
    requestOrigin: "http://localhost:3000",
    host: "localhost:3000",
    forwardedHost: "admin.onecompany.example",
    forwardedProto: "https",
  });
  assert.equal(productionOrigins.has("https://admin.onecompany.example"), true);
  assert.equal(productionOrigins.has("https://attacker.example"), false);

  const malformedOrigins = resolveOpsAllowedMutationOrigins({
    requestOrigin: "http://localhost:3000",
    host: "onecompany.example/path",
    forwardedHost: "onecompany.example@attacker.example",
    forwardedProto: "https",
  });
  assert.equal(malformedOrigins.size, 1);
  assert.equal(malformedOrigins.has("http://localhost:3000"), true);
});

test("knowledge articles only accept the five operator-facing categories", () => {
  for (const category of OPS_KNOWLEDGE_CATEGORIES) {
    assert.equal(
      normalizeKnowledgeCreateInput({
        title: "Guide",
        contentMarkdown: "# Guide",
        category,
      }).category,
      category
    );
  }
  assert.throws(
    () =>
      normalizeKnowledgeCreateInput({
        title: "Guide",
        contentMarkdown: "# Guide",
        category: "arbitrary-section",
      }),
    /Category must be one of/
  );
});

test("knowledge revisions reject no-op saves and hide task metadata from knowledge-only users", () => {
  const current = {
    title: "Maxton pricing",
    excerpt: null,
    contentMarkdown: "# Guide",
    locale: "ru",
    category: "prices-and-brands",
    brandKey: "maxton",
    projectId: null,
    tags: ["pricing"],
  };
  assert.equal(hasKnowledgeDraftChanges(current, { ...current }), false);
  assert.equal(
    hasKnowledgeDraftChanges(current, { ...current, contentMarkdown: "# Updated" }),
    true
  );
  assert.deepEqual(
    redactKnowledgeTaskMetadata(
      {
        id: "article-1",
        project: { id: "project-1" },
        taskLinks: [{ taskId: "task-1" }],
        title: "Guide",
      },
      false
    ),
    { id: "article-1", title: "Guide" }
  );
});

test("task members can edit owned projects but cannot assign or manage foreign projects", () => {
  const access = {
    id: "member-1",
    email: "member@example.com",
    name: "Member",
    permissions: [ADMIN_PERMISSIONS.OPS_TASKS_READ, ADMIN_PERMISSIONS.OPS_TASKS_WRITE],
    roleKeys: ["task_member"],
    isOwner: false,
  };
  assert.doesNotThrow(() => assertCanWriteProject(access, { ownerId: access.id }));
  assert.throws(
    () => assertCanWriteProject(access, { ownerId: "member-2" }),
    /only edit projects they own/i
  );
  assert.throws(
    () => assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW),
    /Permission is required/
  );
});

test("shared tasks are editable by every task member without becoming unassigned work", () => {
  const access = {
    id: "member-1",
    email: "member@example.com",
    name: "Member",
    permissions: [ADMIN_PERMISSIONS.OPS_TASKS_READ, ADMIN_PERMISSIONS.OPS_TASKS_WRITE],
    roleKeys: ["task_member"],
    isOwner: false,
  };
  assert.doesNotThrow(() =>
    assertCanWriteTask(access, {
      assigneeId: null,
      createdById: "member-2",
      isShared: true,
    })
  );
  assert.throws(() =>
    assertCanWriteTask(access, {
      assigneeId: null,
      createdById: "member-2",
      isShared: false,
    })
  );
  assert.deepEqual(
    normalizeTaskCreateInput({
      title: "Общая задача",
      isShared: true,
      assigneeId: "member-2",
    }).assigneeId,
    null
  );
});

test("human board tasks may move without hidden metadata while agent work stays explicit", () => {
  assert.doesNotThrow(() =>
    assertTaskStateInvariant({
      status: OpsTaskStatus.IN_PROGRESS,
      nextAction: null,
      blockerType: null,
      blockerDescription: null,
    })
  );
  assert.doesNotThrow(() =>
    assertTaskStateInvariant({
      status: OpsTaskStatus.BLOCKED,
      nextAction: null,
      blockerType: null,
      blockerDescription: null,
    })
  );
  assert.throws(
    () =>
      assertTaskStateInvariant({
        status: OpsTaskStatus.AGENT_RUNNING,
        nextAction: null,
        blockerType: null,
        blockerDescription: null,
      }),
    /next action/i
  );
  assert.doesNotThrow(() =>
    assertTaskTransition(OpsTaskStatus.INBOX, OpsTaskStatus.IN_PROGRESS, {
      reopen: false,
      comment: null,
    })
  );
  assert.doesNotThrow(() =>
    assertTaskTransition(OpsTaskStatus.INBOX, OpsTaskStatus.DONE, {
      reopen: false,
      comment: null,
    })
  );
});

test("tasks without an explicit deadline receive exactly 24 hours on persistence", () => {
  const now = new Date("2026-07-22T09:30:00.000Z");
  assert.equal(resolveOpsTaskDueAt(null, now).toISOString(), "2026-07-23T09:30:00.000Z");
  const explicit = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(resolveOpsTaskDueAt(explicit, now), explicit);
});

test("agent_running is worker-only and closed tasks require explicit commented reopen", () => {
  assert.throws(
    () => normalizeTaskCreateInput({ title: "Unsafe", status: "agent_running" }),
    /automation worker/i
  );
  assert.throws(
    () =>
      assertTaskTransition(OpsTaskStatus.DONE, OpsTaskStatus.IN_PROGRESS, {
        reopen: false,
        comment: null,
      }),
    /explicit reopen/i
  );
  assert.doesNotThrow(() =>
    assertTaskTransition(OpsTaskStatus.DONE, OpsTaskStatus.IN_PROGRESS, {
      reopen: true,
      comment: "Customer supplied new details",
    })
  );
});

test("automation registry is closed and has no unsafe mutation capability", () => {
  assert.deepEqual(Object.keys(OPS_AUTOMATION_REGISTRY).sort(), [
    "catalog_check",
    "document_summary",
    "research_draft",
  ]);
  for (const definition of Object.values(OPS_AUTOMATION_REGISTRY)) {
    assert.equal(definition.output, "internal_proposal");
    assert.equal(definition.maxAttempts, 4);
    assert.ok(definition.timeoutSeconds <= 90);
  }
  assert.deepEqual(OPS_AUTOMATION_FORBIDDEN_EFFECTS, [
    "purchase",
    "payment",
    "checkout",
    "payment_credentials",
    "browser_control",
    "shell",
    "sql",
    "external_message",
  ]);
  assert.throws(
    () => parseOpsAutomationRequest({ type: "checkout", input: {} }),
    /typed read-only/i
  );
  assert.deepEqual(parseOpsAutomationRequest({ type: "catalog_check", input: { sku: "M-123" } }), {
    type: "catalog_check",
    input: { productId: undefined, sku: "M-123" },
  });
});

test("automation launch rejects archived, closed and already-running tasks", () => {
  assert.doesNotThrow(() =>
    assertOpsAutomationTaskCanStart({
      status: OpsTaskStatus.IN_PROGRESS,
      archivedAt: null,
    })
  );
  assert.throws(
    () =>
      assertOpsAutomationTaskCanStart({
        status: OpsTaskStatus.DONE,
        archivedAt: null,
      }),
    /closed tasks/i
  );
  assert.throws(
    () =>
      assertOpsAutomationTaskCanStart({
        status: OpsTaskStatus.AGENT_RUNNING,
        archivedAt: null,
      }),
    /active helper/i
  );
  assert.throws(
    () =>
      assertOpsAutomationTaskCanStart({
        status: OpsTaskStatus.PLANNED,
        archivedAt: new Date(),
      }),
    /archived tasks/i
  );
});

test("automation target resolution is task-bound and never guesses an ambiguous SKU", async () => {
  const linkedDocumentTx = {
    opsTaskAttachment: {
      async findUnique() {
        return {
          attachment: {
            id: "attachment-1",
            state: "READY",
            mimeType: "application/pdf",
          },
        };
      },
    },
  } as unknown as Prisma.TransactionClient;
  assert.deepEqual(
    await resolveOpsAutomationRequestTarget(linkedDocumentTx, "task-1", {
      type: "document_summary",
      input: { attachmentId: "attachment-1" },
    }),
    {
      type: "document_summary",
      input: { attachmentId: "attachment-1" },
    }
  );

  const foreignDocumentTx = {
    opsTaskAttachment: {
      async findUnique() {
        return null;
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    () =>
      resolveOpsAutomationRequestTarget(foreignDocumentTx, "task-1", {
        type: "document_summary",
        input: { attachmentId: "attachment-on-another-task" },
      }),
    /not available on this task/i
  );

  const ambiguousCatalogTx = {
    shopProduct: {
      async findMany() {
        return [
          { id: "product-1", sku: "DUPLICATE" },
          { id: "product-2", sku: "DUPLICATE" },
        ];
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    () =>
      resolveOpsAutomationRequestTarget(ambiguousCatalogTx, "task-1", {
        type: "catalog_check",
        input: { sku: "DUPLICATE" },
      }),
    /more than one product/i
  );
});

test("approval decisions verify immutable payloads, expiry and closed status values", () => {
  const payload = { action: "internal_proposal", taskId: "task-1" };
  const payloadHash = hashApprovalPayload("review_internal_proposal", payload);
  assert.equal(
    payloadHash,
    hashApprovalPayload("review_internal_proposal", {
      taskId: "task-1",
      action: "internal_proposal",
    })
  );
  assert.doesNotThrow(() =>
    assertOpsApprovalPayloadIntegrity({
      action: "review_internal_proposal",
      payload,
      payloadHash,
    })
  );
  assert.throws(
    () =>
      assertOpsApprovalPayloadIntegrity({
        action: "review_internal_proposal",
        payload: { ...payload, taskId: "task-2" },
        payloadHash,
      }),
    /integrity check failed/i
  );
  assert.deepEqual(normalizeOpsApprovalDecision({ decision: "approve", note: "Reviewed" }), {
    status: OpsApprovalStatus.APPROVED,
    note: "Reviewed",
  });
  assert.deepEqual(normalizeOpsApprovalDecision({ decision: "reject", note: "Not safe" }), {
    status: OpsApprovalStatus.REJECTED,
    note: "Not safe",
  });
  assert.throws(() => normalizeOpsApprovalDecision({ decision: "approve" }), /requires a note/i);
  assert.throws(() => normalizeOpsApprovalDecision({ decision: "execute" }), /approve.*reject/i);

  const now = new Date("2026-07-20T10:00:00.000Z");
  assert.doesNotThrow(() =>
    assertOpsApprovalCanBeDecided({
      status: OpsApprovalStatus.PENDING,
      expiresAt: new Date("2026-07-20T10:01:00.000Z"),
      now,
    })
  );
  assert.throws(
    () =>
      assertOpsApprovalCanBeDecided({
        status: OpsApprovalStatus.PENDING,
        expiresAt: now,
        now,
      }),
    /expired/i
  );
  assert.equal(
    effectiveOpsApprovalStatus({
      status: OpsApprovalStatus.PENDING,
      expiresAt: now,
      now,
    }),
    OpsApprovalStatus.EXPIRED
  );
  assert.equal(normalizeOpsApprovalStatusFilter("all"), null);
  assert.equal(normalizeOpsApprovalStatusFilter("approved"), OpsApprovalStatus.APPROVED);
});

test("AI hard stop is deterministic", () => {
  assert.equal(isOpsAiBudgetAvailable({ costMicros: BigInt(1_999_999) }), true);
  assert.equal(isOpsAiBudgetAvailable({ costMicros: BigInt(2_000_000) }), false);
});

test("brand guide matching is deterministic and does not guess unrelated tasks", () => {
  assert.deepEqual(findMatchingBrandGuideKeys(["Порахувати комплект Do88 для Volvo ICM-710"]), [
    "do88",
  ]);
  assert.deepEqual(findMatchingBrandGuideKeys(["Проверить цену Eventuri для BMW G80"]), [
    "eventuri",
  ]);
  assert.deepEqual(findMatchingBrandGuideKeys(["Нужен фильтр AFE для нового заказа"]), [
    "bmc-filters",
  ]);
  assert.deepEqual(findMatchingBrandGuideKeys(["Проверить товар aFe Power"]), ["afe-power"]);
  assert.deepEqual(findMatchingBrandGuideKeys(["Проверить остаток Volvo ICM-710"]), []);
});

test("product context preserves source links and finds shipping references", () => {
  const source = "Проверить диффузор Eventuri https://example.com/products/eventuri-diffuser.";
  assert.deepEqual(extractOpsSourceUrls([source]), [
    "https://example.com/products/eventuri-diffuser",
  ]);
  assert.match(
    appendOpsSourceUrls("Проверить товар", [source]) ?? "",
    /Ссылки из исходного сообщения:[\s\S]*https:\/\/example\.com\/products\/eventuri-diffuser/
  );
  assert.equal(isProductRelatedTask([source]), true);
  assert.deepEqual(
    findShippingEstimates([source]).map((estimate) => [estimate.key, estimate.amountUsd]),
    [["diffuser", 130]]
  );
  assert.equal(isProductRelatedTask(["Позвонить Игорю"]), false);
  assert.equal(
    operatorFacingReferenceText("Прайс PDF из Top-Level.pdf"),
    "Прайс поставщика из внутреннего источника"
  );
});

test("brand and delivery directory values can be hydrated from editable knowledge", () => {
  const fallback = getBrandGuideByKey("eventuri");
  assert.ok(fallback);
  const hydrated = hydrateBrandGuideFromArticle(fallback, {
    title: "Eventuri Updated",
    contentMarkdown: `# Eventuri Updated

| Поле | Значение |
| --- | --- |
| Розница | Сайт + 12% |
| Опт / партнёр | -8% |
| Логистика | Проверить склад и вес |

## Важные заметки

Новое правило владельца.`,
  });
  assert.equal(hydrated.brand, "Eventuri Updated");
  assert.equal(hydrated.retailFormula, "Сайт + 12%");
  assert.equal(hydrated.wholesaleFormula, "-8%");
  assert.equal(hydrated.logisticsRule, "Проверить склад и вес");
  assert.equal(hydrated.notes, "Новое правило владельца.");

  assert.deepEqual(
    parseShippingEstimatesFromMarkdown(`## США → Украина: кузовные детали

| Категория | Исторический ориентир |
| --- | ---: |
| Диффузор | ≈ $145 |

## Другие найденные ориентиры

| Маршрут | Ориентир |
| --- | --- |
| Китай → Киев | $18/кг |`).map(({ key, amountUsd }) => ({ key, amountUsd })),
    [{ key: "diffuser", amountUsd: 145 }]
  );
});
