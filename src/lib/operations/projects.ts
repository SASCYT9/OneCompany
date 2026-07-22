import { OpsPriority, OpsProjectStatus } from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";

function text(value: unknown, label: string, required = false, max = 5_000) {
  const normalized =
    value === null || value === undefined
      ? null
      : String(value)
          .trim()
          .slice(0, max + 1);
  if (normalized && normalized.length > max) {
    throw new OpsError("VALIDATION_ERROR", 400, `${label} exceeds ${max} characters`);
  }
  if (required && !normalized) {
    throw new OpsError("VALIDATION_ERROR", 400, `${label} is required`);
  }
  return normalized || null;
}

function enumInput<T extends Record<string, string>>(
  values: T,
  value: unknown,
  fallback: T[keyof T]
) {
  const normalized = String(value ?? fallback).toUpperCase();
  if (!Object.values(values).includes(normalized as T[keyof T])) {
    throw new OpsError("VALIDATION_ERROR", 400, `Invalid enum value: ${normalized}`);
  }
  return normalized as T[keyof T];
}

function dateInput(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new OpsError("VALIDATION_ERROR", 400, "Invalid date");
  }
  return date;
}

export function normalizeProjectCreateInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    title: text(input.title, "Project title", true, 500)!,
    description: text(input.description, "Description", false, 20_000),
    status: enumInput(OpsProjectStatus, input.status, OpsProjectStatus.ACTIVE),
    priority: enumInput(OpsPriority, input.priority, OpsPriority.NORMAL),
    ownerId: text(input.ownerId, "Owner", false, 100),
    startDate: dateInput(input.startDate),
    dueDate: dateInput(input.dueDate),
    nextAction: text(input.nextAction, "Next action", false, 2_000),
  };
}

export function normalizeProjectPatchInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if ("title" in input) result.title = text(input.title, "Project title", true, 500)!;
  if ("description" in input) {
    result.description = text(input.description, "Description", false, 20_000);
  }
  if ("status" in input) {
    result.status = enumInput(OpsProjectStatus, input.status, OpsProjectStatus.ACTIVE);
  }
  if ("priority" in input) {
    result.priority = enumInput(OpsPriority, input.priority, OpsPriority.NORMAL);
  }
  if ("ownerId" in input) result.ownerId = text(input.ownerId, "Owner", false, 100);
  if ("startDate" in input) result.startDate = dateInput(input.startDate);
  if ("dueDate" in input) result.dueDate = dateInput(input.dueDate);
  if ("nextAction" in input) {
    result.nextAction = text(input.nextAction, "Next action", false, 2_000);
  }
  if (!Object.keys(result).length) {
    throw new OpsError("VALIDATION_ERROR", 400, "No supported project fields were supplied");
  }
  return result;
}
