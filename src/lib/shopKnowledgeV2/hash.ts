import { createHash } from "node:crypto";

type CanonicalValue =
  | boolean
  | number
  | string
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

function toCanonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, toCanonicalValue(item)])
    );
  }
  return String(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export function hashKnowledgeValue(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
