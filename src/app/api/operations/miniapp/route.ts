import { NextRequest, NextResponse } from "next/server";

import { opsAdminLink } from "@/lib/operations/adminLinks";
import {
  OPS_MINI_APP_ACTIONS,
  serializeOpsMiniAppDay,
  verifyOpsMiniAppInitData,
  type OpsMiniAppAction,
} from "@/lib/operations/miniApp";
import { loadOpsMyDay } from "@/lib/operations/myDay";
import {
  opsTaskActionErrorMessage,
  runOpsTaskQuickAction,
} from "@/lib/operations/telegramCallbacks";
import { resolveOpsBotMember } from "@/lib/operations/telegramBot";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INIT_DATA_HEADER = "x-telegram-init-data";
const RATE_LIMIT_PER_MINUTE = 60;

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function miniAppEnabled() {
  return /^(1|true)$/i.test(String(process.env.OPS_TELEGRAM_MANAGER_ENABLED ?? ""));
}

async function withinRateLimit(telegramUserId: bigint, now: Date) {
  const bucket = new Date(now);
  bucket.setUTCSeconds(0, 0);
  const key = `ops:miniapp:${telegramUserId}:${bucket.toISOString()}`;
  const row = await prisma.requestRateLimit.upsert({
    where: { key },
    create: { key, count: 1, bucketStart: bucket, expiresAt: new Date(bucket.getTime() + 60_000) },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count <= RATE_LIMIT_PER_MINUTE;
}

/** Telegram identity → linked team member, or an error response. */
async function authenticate(request: NextRequest) {
  if (!miniAppEnabled()) return { error: json({ error: "DISABLED" }, 404) };
  const now = new Date();
  const verified = verifyOpsMiniAppInitData(request.headers.get(INIT_DATA_HEADER) ?? "", {
    botToken: String(process.env.OPS_TELEGRAM_BOT_TOKEN ?? ""),
    now,
  });
  if (!verified) return { error: json({ error: "UNAUTHORIZED" }, 401) };
  if (!(await withinRateLimit(verified.telegramUserId, now))) {
    return { error: json({ error: "RATE_LIMITED" }, 429) };
  }
  const member = await resolveOpsBotMember(prisma, verified.telegramUserId);
  if (!member) return { error: json({ error: "NOT_A_MEMBER" }, 403) };
  return { member, now };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const day = await loadOpsMyDay({
      client: prisma,
      adminUserId: auth.member.adminUserId,
      canAssign: auth.member.canAssign,
      now: auth.now,
      timeZone: auth.member.timezone,
    });
    return json({
      member: {
        name: auth.member.name?.trim().split(/\s+/)[0] || auth.member.email.split("@")[0],
        canAssign: auth.member.canAssign,
        timeZone: auth.member.timezone,
      },
      day: serializeOpsMiniAppDay(day, (path) => opsAdminLink(path)),
      links: {
        tasks: opsAdminLink("/admin/operations/tasks?mine=1"),
        triage: opsAdminLink("/admin/operations/triage"),
      },
    });
  } catch (error) {
    console.error("[operations.miniapp] load failed", error);
    return json({ error: "UNAVAILABLE" }, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const body = (await request.json().catch(() => null)) as {
      taskId?: unknown;
      action?: unknown;
    } | null;
    const taskId = String(body?.taskId ?? "");
    const action = String(body?.action ?? "") as OpsMiniAppAction;
    if (!/^[a-zA-Z0-9_-]{8,40}$/.test(taskId) || !OPS_MINI_APP_ACTIONS.includes(action)) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }
    try {
      const result = await runOpsTaskQuickAction({
        client: prisma,
        actorAdminUserId: auth.member.adminUserId,
        taskId,
        action: { kind: action },
      });
      return json({ ok: true, message: result.message });
    } catch (error) {
      const message = opsTaskActionErrorMessage(error);
      if (!message) throw error;
      return json({ ok: false, message }, 409);
    }
  } catch (error) {
    console.error("[operations.miniapp] action failed", error);
    return json({ error: "UNAVAILABLE" }, 503);
  }
}
