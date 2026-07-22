"use client";

let csrfToken: string | null = null;

export class OpsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new OpsApiError(
      typeof body?.error?.message === "string"
        ? body.error.message
        : typeof body?.message === "string"
          ? body.message
          : "Operations request failed",
      response.status,
      typeof body?.error?.code === "string" ? body.error.code : undefined
    );
  }
  return body;
}

export async function opsGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return (await readJson(response)) as T;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/admin/operations/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = (await readJson(response)) as { token: string };
  csrfToken = body.token;
  return csrfToken;
}

function makeKey(scope: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `ops-ui:${scope}:${random}`;
}

export async function opsMutation<T>({
  path,
  method = "POST",
  body,
  version,
  etag,
  scope = "mutation",
}: {
  path: string;
  method?: "POST" | "PATCH" | "DELETE";
  body: unknown;
  version?: number;
  etag?: string;
  scope?: string;
}): Promise<T> {
  const token = await getCsrfToken();
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Ops-CSRF-Token": token,
      "Idempotency-Key": makeKey(scope),
      ...(etag
        ? { "If-Match": `"${etag.replaceAll('"', "")}"` }
        : typeof version === "number"
          ? { "If-Match": `"${version}"` }
          : {}),
    },
    body: JSON.stringify(body),
  });
  if (response.status === 403) csrfToken = null;
  return (await readJson(response)) as T;
}
