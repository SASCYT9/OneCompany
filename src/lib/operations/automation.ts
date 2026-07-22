import crypto from "node:crypto";
import {
  OpsAttachmentState,
  OpsAutomationStatus,
  OpsJobStage,
  OpsJobStatus,
  OpsTaskStatus,
  type Prisma,
} from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";

export const OPS_AUTOMATION_TYPES = [
  "research_draft",
  "document_summary",
  "catalog_check",
] as const;

export type OpsAutomationType = (typeof OPS_AUTOMATION_TYPES)[number];

export type OpsAutomationRequest =
  | {
      type: "research_draft";
      input: { query: string };
    }
  | {
      type: "document_summary";
      input: { attachmentId: string };
    }
  | {
      type: "catalog_check";
      input: { productId?: string; sku?: string };
    };

export const OPS_AUTOMATION_REGISTRY: Record<
  OpsAutomationType,
  {
    title: string;
    readCapabilities: readonly string[];
    output: "internal_proposal";
    maxAttempts: 4;
    timeoutSeconds: 90;
    maxToolCalls: number;
  }
> = {
  research_draft: {
    title: "Research draft",
    readCapabilities: ["public_web_read"],
    output: "internal_proposal",
    maxAttempts: 4,
    timeoutSeconds: 90,
    maxToolCalls: 5,
  },
  document_summary: {
    title: "Document summary",
    readCapabilities: ["private_attachment_read"],
    output: "internal_proposal",
    maxAttempts: 4,
    timeoutSeconds: 90,
    maxToolCalls: 2,
  },
  catalog_check: {
    title: "Catalog check",
    readCapabilities: ["shop_catalog_read"],
    output: "internal_proposal",
    maxAttempts: 4,
    timeoutSeconds: 90,
    maxToolCalls: 3,
  },
};

// These capabilities are intentionally not represented in the registry.
export const OPS_AUTOMATION_FORBIDDEN_EFFECTS = [
  "purchase",
  "payment",
  "checkout",
  "payment_credentials",
  "browser_control",
  "shell",
  "sql",
  "external_message",
] as const;

function requiredString(value: unknown, field: string, max: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) {
    throw new OpsError(
      "AUTOMATION_INPUT_INVALID",
      400,
      `${field} must contain 1–${max} characters`
    );
  }
  return normalized;
}

export function parseOpsAutomationRequest(value: unknown): OpsAutomationRequest {
  const request = (value && typeof value === "object" ? value : {}) as {
    type?: unknown;
    input?: unknown;
  };
  const type = String(request.type ?? "")
    .trim()
    .toLowerCase();
  const input = (request.input && typeof request.input === "object" ? request.input : {}) as Record<
    string,
    unknown
  >;

  if (type === "research_draft") {
    return {
      type,
      input: { query: requiredString(input.query, "query", 2_000) },
    };
  }
  if (type === "document_summary") {
    return {
      type,
      input: { attachmentId: requiredString(input.attachmentId, "attachmentId", 100) },
    };
  }
  if (type === "catalog_check") {
    const productId = input.productId
      ? requiredString(input.productId, "productId", 100)
      : undefined;
    const sku = input.sku ? requiredString(input.sku, "sku", 200) : undefined;
    if (!productId && !sku) {
      throw new OpsError(
        "AUTOMATION_INPUT_INVALID",
        400,
        "catalog_check requires productId or sku"
      );
    }
    return { type, input: { productId, sku } };
  }

  throw new OpsError(
    "AUTOMATION_NOT_ALLOWED",
    403,
    "Only typed read-only helper automations are allowed"
  );
}

export function assertOpsAutomationTaskCanStart(task: {
  status: OpsTaskStatus;
  archivedAt: Date | null;
}) {
  if (task.archivedAt) {
    throw new OpsError("TASK_ARCHIVED", 409, "Archived tasks cannot start helpers");
  }
  if (task.status === OpsTaskStatus.DONE || task.status === OpsTaskStatus.CANCELLED) {
    throw new OpsError("TASK_CLOSED", 409, "Closed tasks cannot start helpers");
  }
  if (task.status === OpsTaskStatus.AGENT_RUNNING) {
    throw new OpsError("AUTOMATION_ALREADY_ACTIVE", 409, "The task already has an active helper");
  }
}

const DOCUMENT_SUMMARY_MIME_TYPES = new Set(["application/pdf", "text/plain"]);

/**
 * Resolves every request against records already linked to the task. This
 * prevents a guessed attachment ID or ambiguous SKU from crossing a task or
 * catalog boundary before a durable job is created.
 */
export async function resolveOpsAutomationRequestTarget(
  tx: Prisma.TransactionClient,
  taskId: string,
  request: OpsAutomationRequest
): Promise<OpsAutomationRequest> {
  if (request.type === "research_draft") {
    return request;
  }

  if (request.type === "document_summary") {
    const link = await tx.opsTaskAttachment.findUnique({
      where: {
        taskId_attachmentId: {
          taskId,
          attachmentId: request.input.attachmentId,
        },
      },
      select: {
        attachment: {
          select: {
            id: true,
            state: true,
            mimeType: true,
          },
        },
      },
    });
    if (!link || link.attachment.state !== OpsAttachmentState.READY) {
      throw new OpsError(
        "ATTACHMENT_NOT_AVAILABLE",
        404,
        "The attachment is not available on this task"
      );
    }
    if (!DOCUMENT_SUMMARY_MIME_TYPES.has(link.attachment.mimeType.toLowerCase())) {
      throw new OpsError(
        "ATTACHMENT_TYPE_NOT_SUPPORTED",
        409,
        "Document summary accepts only PDF or plain-text task attachments"
      );
    }
    return {
      type: request.type,
      input: { attachmentId: link.attachment.id },
    };
  }

  const products = await tx.shopProduct.findMany({
    where: request.input.productId
      ? {
          id: request.input.productId,
          ...(request.input.sku ? { sku: request.input.sku } : {}),
        }
      : { sku: request.input.sku },
    orderBy: { id: "asc" },
    take: 2,
    select: {
      id: true,
      sku: true,
    },
  });
  if (products.length === 0) {
    throw new OpsError("CATALOG_TARGET_NOT_FOUND", 404, "Catalog product not found");
  }
  if (products.length > 1) {
    throw new OpsError(
      "CATALOG_TARGET_AMBIGUOUS",
      409,
      "The SKU matches more than one product; choose an explicit product"
    );
  }
  const product = products[0];
  return {
    type: request.type,
    input: {
      productId: product.id,
      ...(product.sku ? { sku: product.sku } : {}),
    },
  };
}

export async function enqueueOpsAutomation(params: {
  tx: Prisma.TransactionClient;
  taskId: string;
  requestedById: string;
  idempotencyKey: string;
  request: OpsAutomationRequest;
}) {
  const definition = OPS_AUTOMATION_REGISTRY[params.request.type];
  const run = await params.tx.opsAutomationRun.create({
    data: {
      taskId: params.taskId,
      automationType: params.request.type,
      status: OpsAutomationStatus.QUEUED,
      requestedById: params.requestedById,
      inputSnapshot: JSON.parse(JSON.stringify(params.request)) as Prisma.InputJsonValue,
      maxAttempts: definition.maxAttempts,
      budget: {
        timeoutSeconds: definition.timeoutSeconds,
        maxToolCalls: definition.maxToolCalls,
        output: definition.output,
        readCapabilities: definition.readCapabilities,
      },
    },
  });
  const job = await params.tx.opsJob.create({
    data: {
      idempotencyKey: `automation:${params.idempotencyKey}`,
      taskId: params.taskId,
      type: `automation:${params.request.type}`,
      status: OpsJobStatus.QUEUED,
      stage: OpsJobStage.EXECUTE_AUTOMATIONS,
      maxAttempts: definition.maxAttempts,
      payload: {
        automationRunId: run.id,
        type: params.request.type,
      },
    },
  });
  return { run, job };
}

function canonicalApprovalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalApprovalJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalApprovalJson(item)])
    );
  }
  return value;
}

export function hashApprovalPayload(action: string, payload: unknown) {
  return crypto
    .createHash("sha256")
    .update(action)
    .update("\0")
    .update(JSON.stringify(canonicalApprovalJson(payload)) ?? "null")
    .digest("hex");
}

export function isOpsAiBudgetAvailable(input: { costMicros: bigint; hardStopMicros?: bigint }) {
  return input.costMicros < (input.hardStopMicros ?? BigInt(2_000_000));
}
