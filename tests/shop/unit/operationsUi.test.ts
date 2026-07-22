import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isOpsLocalDemoMode } from "../../../src/app/admin/operations/demoMode";
import { getOpsLocalDemoAccess } from "../../../src/lib/operations/localDemoAccess";
import { OPS_PRIORITY_LABELS, OPS_STATUS_LABELS, opsRu } from "../../../src/lib/operations/i18n";
import { isOperationsUiEnabled } from "../../../src/lib/operations/featureFlags";

test("Ops local demo mode is explicit and cannot run in production", () => {
  assert.equal(isOpsLocalDemoMode({ NODE_ENV: "development", OPS_LOCAL_DEMO_MODE: "true" }), true);
  assert.equal(
    isOpsLocalDemoMode({ NODE_ENV: "development", OPS_LOCAL_DEMO_MODE: "false" }),
    false
  );
  assert.equal(isOpsLocalDemoMode({ NODE_ENV: "production", OPS_LOCAL_DEMO_MODE: "true" }), false);
});

test("local demo access is non-production, Ops-only, and does not grant wildcard access", () => {
  const access = getOpsLocalDemoAccess({
    NODE_ENV: "development",
    OPS_LOCAL_DEMO_MODE: "true",
  });

  assert.ok(access);
  assert.equal(access.isOwner, false);
  assert.equal(access.permissions.includes("*"), false);
  assert.equal(access.permissions.includes("ops.tasks.read"), true);
  assert.equal(
    access.permissions.some((permission) => permission.startsWith("shop.")),
    false
  );
  assert.equal(
    getOpsLocalDemoAccess({
      NODE_ENV: "production",
      OPS_LOCAL_DEMO_MODE: "true",
    }),
    null
  );
});

test("local Ops demo runner keeps every external worker and Telegram flag disabled", () => {
  const runner = readFileSync(
    new URL("../../../scripts/operations/start-local-demo.mjs", import.meta.url),
    "utf8"
  );
  assert.match(runner, /OPS_UI_ENABLED: "true"/);
  assert.match(runner, /OPS_LOCAL_DEMO_MODE: "true"/);
  for (const flag of [
    "OPS_TELEGRAM_MANAGER_ENABLED",
    "OPS_TELEGRAM_NOTIFICATIONS_ENABLED",
    "OPS_TELEGRAM_AUTO_CREATE_ENABLED",
    "OPS_JOBS_ENABLED",
    "OPS_AUTOMATIONS_ENABLED",
  ]) {
    assert.match(runner, new RegExp(`${flag}: "0"`));
  }
  assert.doesNotMatch(runner, /TELEGRAM_BOT_TOKEN|setWebhook|polling/);
});

test("Ops feature flag fails closed in production and honors an explicit local disable", () => {
  assert.equal(isOperationsUiEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isOperationsUiEnabled({ NODE_ENV: "production", OPS_UI_ENABLED: "true" }), true);
  assert.equal(isOperationsUiEnabled({ NODE_ENV: "development", OPS_UI_ENABLED: "false" }), false);
});

test("Russian Ops dictionary covers every task state and priority", () => {
  assert.deepEqual(Object.keys(OPS_STATUS_LABELS).sort(), [
    "AGENT_RUNNING",
    "BLOCKED",
    "CANCELLED",
    "DONE",
    "INBOX",
    "IN_PROGRESS",
    "NEEDS_APPROVAL",
    "PLANNED",
    "REVIEW",
    "WAITING_EXTERNAL",
    "WAITING_HUMAN",
  ]);
  assert.deepEqual(Object.keys(OPS_PRIORITY_LABELS).sort(), ["HIGH", "LOW", "NORMAL", "URGENT"]);
  assert.equal(opsRu.navigation.knowledge, "БАЗА");
  assert.equal(opsRu.tasks.views.board, "Доска");
});

test("Ops UI mutations use responsive forms and require operator input instead of fabricated workflow text", () => {
  const workspace = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskWorkspace.tsx", import.meta.url),
    "utf8"
  );
  const detail = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskDetail.tsx", import.meta.url),
    "utf8"
  );
  assert.equal(workspace.includes("Уточнить следующий шаг по задаче"), false);
  assert.equal(workspace.includes("Уточнить причину ожидания"), false);
  assert.equal(detail.includes("Уточнить следующий шаг по задаче"), false);
  assert.equal(detail.includes("Уточнить причину ожидания"), false);
  assert.doesNotMatch(workspace, /window\.prompt/);
  assert.doesNotMatch(detail, /window\.prompt/);
  assert.doesNotMatch(workspace, /transitionNextAction/);
  assert.doesNotMatch(workspace, /transitionBlocker/);
  assert.match(workspace, /Быстрая заметка/);
  assert.match(workspace, /kanban-comment:/);
  assert.match(workspace, /Например: ОПЛАТИЛ/);
  assert.match(detail, /transitionDialogStatus/);
  assert.match(detail, /Следующее действие/);
  assert.match(detail, /Причина ожидания или блокировки/);
  assert.match(detail, /необязательно/);
  assert.match(detail, /Причина повторного открытия/);
  assert.match(detail, /aria-label="Приоритет задачи"/);
  assert.match(detail, /aria-label="Исполнитель задачи"/);
  assert.match(detail, /aria-label="Срок задачи"/);
  assert.match(detail, /aria-label="Название задачи"/);
  assert.match(detail, /aria-label="Описание задачи"/);
  assert.match(detail, /aria-label="Проект задачи"/);
  assert.match(detail, /aria-label="Критерий готовности"/);
  assert.doesNotMatch(detail, /ops-task-edit-title/);
  assert.match(detail, /task-inline-\$\{scope\}/);
  assert.match(detail, /saveInlineTaskPatch\([\s\S]*?"priority"/);
  assert.match(detail, /saveInlineTaskPatch\([\s\S]*?"assignee"/);
  assert.match(detail, /saveInlineTaskPatch\([\s\S]*?"due"/);
});

test("Phase 5 UI exposes only typed helper inputs and review-only approvals", () => {
  const taskAutomation = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskAutomation.tsx", import.meta.url),
    "utf8"
  );
  const approvals = readFileSync(
    new URL("../../../src/components/admin/operations/OpsApprovals.tsx", import.meta.url),
    "utf8"
  );
  const approvalsPage = readFileSync(
    new URL("../../../src/app/admin/operations/approvals/page.tsx", import.meta.url),
    "utf8"
  );

  for (const type of ["research_draft", "document_summary", "catalog_check"]) {
    assert.match(taskAutomation, new RegExp(type));
  }
  assert.doesNotMatch(taskAutomation, /contentEditable|dangerouslySetInnerHTML/);
  assert.match(taskAutomation, /OPS_AUTOMATION|tasks\/\$\{task\.id\}\/automations/);
  assert.match(taskAutomation, /version: task\.version/);
  assert.match(approvals, /approval-decision:\$\{selected\.id\}/);
  assert.match(approvals, /version: selected\.task\.version/);
  assert.match(approvals, /disabled=\{saving \|\| !note\.trim\(\)\}/);
  assert.match(approvals, /effectExecuted: false/);
  assert.match(approvalsPage, /requireOpsPageAccess\(\s*ADMIN_PERMISSIONS\.OPS_APPROVALS_DECIDE/);
});

test("Inbox review keeps audio lazy and proposal edits audited, idempotent, and concurrent", () => {
  const inbox = readFileSync(
    new URL("../../../src/components/admin/operations/OpsInbox.tsx", import.meta.url),
    "utf8"
  );
  const proposalRoute = readFileSync(
    new URL(
      "../../../src/app/api/admin/operations/inbox/[id]/proposals/[proposalId]/route.ts",
      import.meta.url
    ),
    "utf8"
  );
  const manualProposalRoute = readFileSync(
    new URL("../../../src/app/api/admin/operations/inbox/[id]/proposals/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(inbox, /preload="none"/);
  assert.match(inbox, /selectedAudioAttachments\.map/);
  assert.match(inbox, /\/attachments\/\$\{attachment\.id\}\/access/);
  assert.match(proposalRoute, /runOpsIdempotentMutation/);
  assert.match(proposalRoute, /writeOpsAudit/);
  assert.match(proposalRoute, /IF_MATCH_REQUIRED/);
  assert.match(inbox, /Создать вручную/);
  assert.match(manualProposalRoute, /runOpsIdempotentMutation/);
  assert.match(manualProposalRoute, /assertCanAssignTask/);
  assert.match(manualProposalRoute, /inbox\.proposal\.create_manual/);
});

test("task details render protected media and the board keeps a persistent detail panel", () => {
  const detail = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskDetail.tsx", import.meta.url),
    "utf8"
  );
  const workspace = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskWorkspace.tsx", import.meta.url),
    "utf8"
  );

  assert.match(detail, /attachment\.mimeType\.startsWith\("image\/"\)/);
  assert.match(detail, /attachment\.mimeType\.startsWith\("video\/"\)/);
  assert.match(
    detail,
    /\/api\/admin\/operations\/tasks\/\$\{current\.id\}\/attachments\/\$\{attachment\.id\}\/access/
  );
  assert.match(detail, /loading="lazy"/);
  assert.match(detail, /preload="none"/);
  assert.match(detail, /attachment\.transcription/);
  assert.match(detail, /Транскрипция голосового/);
  assert.match(detail, /Транскрипция видеосообщения/);
  assert.match(detail, /Теги задачи/);
  assert.match(detail, /Задача #\{current\.number\}/);
  assert.match(detail, /Убрать задачу с доски/);
  assert.match(detail, /onBlur=\{\(\) => void saveDueDraft\(\)\}/);
  assert.match(detail, /Саша Цомпель/);
  assert.match(detail, /aria-label="Просмотр изображения"/);
  assert.match(workspace, /grid-cols-\[minmax\(720px,1fr\)_480px\]/);
  assert.match(workspace, /Выберите задачу на доске, чтобы открыть подробности/);
  assert.match(workspace, /label: "Готово"/);
  assert.match(workspace, /statuses: \["DONE"\]/);
  assert.doesNotMatch(workspace, /setBoardDetailOpen/);
});

test("projects can be created and edited while shared tasks are explicit on mobile and desktop", () => {
  const projects = readFileSync(
    new URL("../../../src/components/admin/operations/OpsProjects.tsx", import.meta.url),
    "utf8"
  );
  const projectForm = readFileSync(
    new URL("../../../src/components/admin/operations/OpsProjectForm.tsx", import.meta.url),
    "utf8"
  );
  const taskForm = readFileSync(
    new URL("../../../src/components/admin/operations/OpsProjectTaskForm.tsx", import.meta.url),
    "utf8"
  );
  assert.match(projects, /Создать проект/);
  assert.match(projects, /Настроить/);
  assert.match(projects, /Открыть задачи/);
  assert.match(projectForm, /\/api\/admin\/operations\/projects/);
  assert.match(projectForm, /pb-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(taskForm, /Общая задача для всей команды/);
  assert.match(taskForm, /isShared/);
  assert.match(taskForm, /projectId: project\.id/);
});

test("knowledge base has onboarding, full-content search, and readable source tables", () => {
  const knowledge = readFileSync(
    new URL("../../../src/components/admin/operations/OpsKnowledge.tsx", import.meta.url),
    "utf8"
  );
  const detail = readFileSync(
    new URL("../../../src/components/admin/operations/OpsKnowledgeDetail.tsx", import.meta.url),
    "utf8"
  );
  const importer = readFileSync(
    new URL("../../../scripts/import-ops-knowledge-foundation.ts", import.meta.url),
    "utf8"
  );

  assert.match(knowledge, /article\.contentMarkdown/);
  assert.match(knowledge, /article\.tags\.includes\("start-here"\)/);
  assert.match(knowledge, /Начните отсюда/);
  assert.match(detail, /<table className=/);
  assert.match(detail, /overflow-x-auto/);
  assert.match(detail, /InlineMarkdown/);
  assert.match(importer, /knowledge\.source_import/);
  assert.match(importer, /OpsKnowledgeStatus\.DRAFT/);
  assert.match(importer, /publishedRevision: article\.publish \? 1 : null/);
});

test("brand catalog is complete and every task creation path links matching guides", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../../../src/data/operations/brand-guides.json", import.meta.url), "utf8")
  ) as {
    summary: {
      total: number;
      topLevelPdfNames: number;
      withFormula: number;
      pdfOnlyAdded: number;
    };
    brands: Array<{ guideKey: string }>;
  };
  assert.deepEqual(catalog.summary, {
    total: 277,
    topLevelPdfNames: 70,
    withFormula: 47,
    needsReview: 228,
    pdfOnlyAdded: 5,
  });
  assert.equal(new Set(catalog.brands.map((brand) => brand.guideKey)).size, 277);

  for (const relativePath of [
    "../../../src/app/api/admin/operations/tasks/route.ts",
    "../../../src/app/api/admin/operations/tasks/[id]/route.ts",
    "../../../src/app/api/admin/operations/inbox/[id]/apply/route.ts",
    "../../../src/lib/operations/telegramJobs.ts",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /linkMatchingBrandGuides/);
    assert.match(source, /brandGuideKeys/);
    assert.match(source, /shippingReferenceLinked/);
  }
});

test("brand directory is separate, responsive, and linked from task details", () => {
  const directory = readFileSync(
    new URL("../../../src/components/admin/operations/OpsBrandDirectory.tsx", import.meta.url),
    "utf8"
  );
  const detail = readFileSync(
    new URL(
      "../../../src/components/admin/operations/OpsBrandDirectoryDetail.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const detailPage = readFileSync(
    new URL("../../../src/app/admin/operations/directory/[key]/page.tsx", import.meta.url),
    "utf8"
  );
  const taskDetail = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskDetail.tsx", import.meta.url),
    "utf8"
  );
  const navigation = readFileSync(
    new URL("../../../src/lib/admin/adminNavigation.ts", import.meta.url),
    "utf8"
  );
  assert.match(directory, /Бренд, алиас, формула, страна или ссылка/);
  assert.match(directory, /md:hidden/);
  assert.match(directory, /hidden border border-slate-200 bg-white md:block/);
  assert.match(detail, /Ориентиры доставки/);
  assert.match(detail, /Источники и ссылки/);
  assert.match(detail, /Редактировать бренд/);
  assert.match(detail, /Редактировать доставку/);
  assert.match(detailPage, /OPS_KNOWLEDGE_WRITE/);
  assert.match(detailPage, /hydrateBrandGuideFromArticle/);
  assert.match(detailPage, /parseShippingEstimatesFromMarkdown/);
  assert.match(taskDetail, /operations\/directory\/\$\{article\.brandKey\}/);
  assert.match(taskDetail, /OpsLinkedText/);
  assert.match(navigation, /\/admin\/operations\/directory/);
});

test("task workspace exposes a permission-safe participant filter with server-side assignment filtering", () => {
  const workspace = readFileSync(
    new URL("../../../src/components/admin/operations/OpsTaskWorkspace.tsx", import.meta.url),
    "utf8"
  );
  const membersRoute = readFileSync(
    new URL("../../../src/app/api/admin/operations/members/route.ts", import.meta.url),
    "utf8"
  );
  const tasksRoute = readFileSync(
    new URL("../../../src/app/api/admin/operations/tasks/route.ts", import.meta.url),
    "utf8"
  );
  const routeAccess = readFileSync(
    new URL("../../../src/lib/admin/adminRouteAccess.ts", import.meta.url),
    "utf8"
  );

  assert.match(workspace, /function TeamRail/);
  assert.match(workspace, /Фильтр по участнику/);
  assert.match(workspace, /Задачи без исполнителя/);
  assert.match(membersRoute, /OPS_TASKS_READ/);
  assert.match(membersRoute, /activeTaskCount/);
  assert.match(tasksRoute, /const assigneeId/);
  assert.match(tasksRoute, /OR: \[\{ assigneeId \}, \{ isShared: true \}\]/);
  assert.match(
    routeAccess,
    /id: "ops-members-read"[\s\S]*?permission: ADMIN_PERMISSIONS\.OPS_TASKS_READ/
  );
});
