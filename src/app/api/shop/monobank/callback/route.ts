import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateMonobankWebhook,
  MonobankError,
  parseMonobankStatus,
} from "@/lib/shopMonobank";
import { applyMonobankStatus } from "@/lib/shopMonobankPayments";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-sign");
  if (!signature) return NextResponse.json({ error: "Signature required" }, { status: 401 });
  if (Number(req.headers.get("content-length")) > 65_536) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody) > 65_536)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  try {
    if (!(await authenticateMonobankWebhook(rawBody, signature))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    await applyMonobankStatus(prisma, parseMonobankStatus(body));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof MonobankError ? error.code : "MONOBANK_CALLBACK_FAILED";
    console.error("[Monobank callback]", code);
    const status =
      code === "MONOBANK_PAYMENT_NOT_FOUND"
        ? 404
        : [
              "MONOBANK_INVALID_STATUS",
              "MONOBANK_PAYMENT_MISMATCH",
              "MONOBANK_FINAL_AMOUNT_REQUIRED",
            ].includes(code)
          ? 400
          : 503;
    return NextResponse.json({ error: code }, { status });
  }
}
