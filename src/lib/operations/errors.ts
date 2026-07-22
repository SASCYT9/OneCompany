import { NextResponse } from "next/server";

export class OpsError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpsError";
  }
}

export function opsErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected operations error";

  if (error instanceof OpsError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status }
    );
  }

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required" } },
      { status: 401 }
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Permission is required" } },
      { status: 403 }
    );
  }

  console.error("[operations]", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Operations request failed" } },
    { status: 500 }
  );
}
