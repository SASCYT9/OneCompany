import crypto from "node:crypto";
import { OpsApprovalStatus } from "@prisma/client";
import { hashApprovalPayload } from "@/lib/operations/automation";
import { OpsError } from "@/lib/operations/errors";

export type OpsApprovalDecision = {
  status: typeof OpsApprovalStatus.APPROVED | typeof OpsApprovalStatus.REJECTED;
  note: string | null;
};

export function normalizeOpsApprovalDecision(value: unknown): OpsApprovalDecision {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const decision = String(input.decision ?? "")
    .trim()
    .toLowerCase();
  if (decision !== "approve" && decision !== "reject") {
    throw new OpsError(
      "APPROVAL_DECISION_INVALID",
      400,
      'decision must be either "approve" or "reject"'
    );
  }
  const note = input.note === null || input.note === undefined ? null : String(input.note).trim();
  if (!note || note.length > 2_000) {
    throw new OpsError(
      "APPROVAL_NOTE_INVALID",
      400,
      "Approval decision requires a note between 1 and 2000 characters"
    );
  }
  return {
    status: decision === "approve" ? OpsApprovalStatus.APPROVED : OpsApprovalStatus.REJECTED,
    note,
  };
}

export function assertOpsApprovalPayloadIntegrity(input: {
  action: string;
  payload: unknown;
  payloadHash: string;
}) {
  const actual = hashApprovalPayload(input.action, input.payload);
  const expectedBuffer = Buffer.from(input.payloadHash);
  const actualBuffer = Buffer.from(actual);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new OpsError("APPROVAL_PAYLOAD_TAMPERED", 409, "Approval payload integrity check failed");
  }
}

export function assertOpsApprovalCanBeDecided(input: {
  status: OpsApprovalStatus;
  expiresAt: Date;
  now?: Date;
}) {
  if (input.status !== OpsApprovalStatus.PENDING) {
    throw new OpsError("APPROVAL_ALREADY_DECIDED", 409, "Approval is no longer pending");
  }
  if (input.expiresAt.getTime() <= (input.now ?? new Date()).getTime()) {
    throw new OpsError("APPROVAL_EXPIRED", 409, "Approval has expired");
  }
}

export function effectiveOpsApprovalStatus(input: {
  status: OpsApprovalStatus;
  expiresAt: Date;
  now?: Date;
}) {
  if (
    input.status === OpsApprovalStatus.PENDING &&
    input.expiresAt.getTime() <= (input.now ?? new Date()).getTime()
  ) {
    return OpsApprovalStatus.EXPIRED;
  }
  return input.status;
}

export function normalizeOpsApprovalStatusFilter(value: string | null) {
  const normalized = String(value ?? OpsApprovalStatus.PENDING)
    .trim()
    .toUpperCase();
  if (normalized === "ALL") return null;
  if (!Object.values(OpsApprovalStatus).includes(normalized as OpsApprovalStatus)) {
    throw new OpsError("APPROVAL_STATUS_INVALID", 400, "Unsupported approval status");
  }
  return normalized as OpsApprovalStatus;
}
