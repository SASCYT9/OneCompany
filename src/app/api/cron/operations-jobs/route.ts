import { NextRequest, NextResponse } from "next/server";
import { drainOpsJobs } from "@/lib/operations/jobs";
import { runOpsJobsWatchdog } from "@/lib/operations/jobsWatchdog";
import { applyOpsKnowledgeDataPatches } from "@/lib/operations/knowledgeDataPatches";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  return {
    configured: Boolean(secret),
    valid: Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`,
  };
}

function jobsEnabled() {
  return /^(1|true)$/i.test(String(process.env.OPS_JOBS_ENABLED ?? ""));
}

export async function GET(request: NextRequest) {
  const auth = authorized(request);
  if (!auth.configured) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!auth.valid) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!jobsEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  try {
    const knowledgePatches = await applyOpsKnowledgeDataPatches(prisma);
    const watchdog = await runOpsJobsWatchdog({ client: prisma });
    const drain = await drainOpsJobs({
      client: prisma,
      execute: createOpsJobStageExecutor({ client: prisma }),
      maxJobs: 12,
      timeBudgetMs: 50_000,
    });
    return NextResponse.json({ ok: true, knowledgePatches, watchdog, drain });
  } catch (error) {
    console.error("[operations.jobs.cron] failed", error);
    return NextResponse.json({ ok: false, error: "OPERATIONS_JOBS_FAILED" }, { status: 500 });
  }
}
