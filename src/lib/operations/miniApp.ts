import crypto from "node:crypto";

import type { OpsMyDay, OpsMyDayTask } from "@/lib/operations/myDay";
import { opsRepeatLabel } from "@/lib/operations/recurrence";

/** How long a «Мой день» session opened from Telegram stays valid. */
export const OPS_MINI_APP_MAX_AGE_SECONDS = 12 * 60 * 60;

export const OPS_MINI_APP_ACTIONS = [
  "done",
  "snooze_tomorrow",
  "snooze_week",
  "take",
  "cancel",
] as const;
export type OpsMiniAppAction = (typeof OPS_MINI_APP_ACTIONS)[number];

/**
 * Validates Telegram Mini App `initData` (HMAC-SHA256 with the bot token, see
 * core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 */
export function verifyOpsMiniAppInitData(
  initData: string,
  input: { botToken: string; now?: Date; maxAgeSeconds?: number }
): { telegramUserId: bigint; authDate: Date } | null {
  const botToken = input.botToken.trim();
  if (!botToken || !initData || initData.length > 4_096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date"));
  if (!/^[a-f0-9]{64}$/.test(hash) || !Number.isSafeInteger(authDate) || authDate <= 0) {
    return null;
  }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const maxAge = input.maxAgeSeconds ?? OPS_MINI_APP_MAX_AGE_SECONDS;
  if (nowSeconds - authDate > maxAge || authDate - nowSeconds > 300) return null;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest();
  const provided = Buffer.from(hash, "hex");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const user = JSON.parse(params.get("user") ?? "null") as { id?: unknown } | null;
    const id = Number(user?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return { telegramUserId: BigInt(id), authDate: new Date(authDate * 1000) };
  } catch {
    return null;
  }
}

export type OpsMiniAppTask = {
  id: string;
  number: number;
  title: string;
  dueAt: string | null;
  priority: string;
  nextAction: string | null;
  orderNumber: string | null;
  repeatLabel: string | null;
  assigneeNames: string[];
  adminUrl: string;
};

function serializeTask(task: OpsMyDayTask, adminLink: (path: string) => string): OpsMiniAppTask {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    dueAt: task.dueAt?.toISOString() ?? null,
    priority: task.priority,
    nextAction: task.nextAction,
    orderNumber: task.orderNumber,
    repeatLabel: task.repeat ? opsRepeatLabel(task.repeat) : null,
    assigneeNames: task.assigneeNames,
    adminUrl: adminLink(`/admin/operations/tasks/${task.id}`),
  };
}

export function serializeOpsMiniAppDay(day: OpsMyDay, adminLink: (path: string) => string) {
  const map = (tasks: OpsMyDayTask[]) => tasks.map((task) => serializeTask(task, adminLink));
  return {
    overdue: map(day.overdue),
    today: map(day.today),
    upcoming: map(day.upcoming.slice(0, 20)),
    noDue: map(day.noDue.slice(0, 20)),
    unassigned: map(day.unassigned),
    counts: day.counts,
  };
}

export type OpsMiniAppDay = ReturnType<typeof serializeOpsMiniAppDay>;
