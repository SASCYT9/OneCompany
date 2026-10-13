import { OpsTaskStatus, type PrismaClient } from "@prisma/client";

import { OPS_OPEN_TASK_WHERE } from "@/lib/operations/reminders";

/**
 * Cheap, deterministic similarity for task titles (no AI): used to spot a
 * task that was sent twice and to suggest who usually handles this kind of
 * work. Common verbs and filler words are ignored; the rest is compared by
 * a short stem so «пневме» and «пневма» match.
 */
const STOP_WORDS = new Set([
  "уточнить",
  "узнать",
  "связаться",
  "проверить",
  "отправить",
  "найти",
  "заказать",
  "сделать",
  "написать",
  "позвонить",
  "запросить",
  "получить",
  "обработать",
  "согласовать",
  "рассчитать",
  "уточнити",
  "дізнатися",
  "звернутися",
  "зв'язатися",
  "перевірити",
  "надіслати",
  "замовити",
  "по",
  "для",
  "про",
  "при",
  "под",
  "над",
  "без",
  "или",
  "або",
  "чи",
  "the",
  "and",
  "for",
  "with",
  "поводу",
  "приводу",
  "сроки",
  "срок",
  "терміни",
  "статус",
  "статусу",
  "наличие",
  "наявність",
  "цену",
  "ціну",
  "задача",
  "задачу",
]);

const STEM_LENGTH = 5;
export const OPS_DUPLICATE_MIN_SIMILARITY = 0.6;
const DUPLICATE_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;
const SUGGESTION_LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export function opsTaskTokens(input: { title: string; tags?: readonly string[] }) {
  const words = [
    input.title,
    ...(input.tags ?? [])
      .filter((tag) => /^(?:brand|product):/i.test(tag))
      .map((tag) => tag.replace(/^(?:(?:brand|product):)+/i, "")),
  ]
    .join(" ")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{Letter}\p{Number}'\s-]+/gu, " ")
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return new Set(words.map((word) => word.slice(0, STEM_LENGTH)));
}

export function opsTaskSimilarity(
  left: { title: string; tags?: readonly string[] },
  right: { title: string; tags?: readonly string[] }
) {
  const a = opsTaskTokens(left);
  const b = opsTaskTokens(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  // Two shared meaningful words at least: «Volvo» alone is not a duplicate.
  if (shared < Math.min(2, a.size, b.size)) return 0;
  return shared / (a.size + b.size - shared);
}

/** An older open task that looks like the same request, or null. */
export async function findOpsDuplicateTask(input: {
  client: Pick<PrismaClient, "opsTask">;
  task: { id: string; title: string; tags: string[] };
  now: Date;
}) {
  const candidates = await input.client.opsTask.findMany({
    where: {
      ...OPS_OPEN_TASK_WHERE,
      id: { not: input.task.id },
      createdAt: { gte: new Date(input.now.getTime() - DUPLICATE_LOOKBACK_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, number: true, title: true, tags: true },
  });
  let best: { id: string; number: number; title: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = opsTaskSimilarity(input.task, candidate);
    if (score >= OPS_DUPLICATE_MIN_SIMILARITY && (!best || score > best.score)) {
      best = { id: candidate.id, number: candidate.number, title: candidate.title, score };
    }
  }
  return best;
}

/**
 * Who handled similar tasks before (by title words and brand tags), or null
 * when nothing similar was ever assigned.
 */
export async function suggestOpsAssignee(input: {
  client: Pick<PrismaClient, "opsTask">;
  task: { id: string; title: string; tags: string[] };
  now: Date;
}) {
  const history = await input.client.opsTask.findMany({
    where: {
      id: { not: input.task.id },
      status: { not: OpsTaskStatus.CANCELLED },
      createdAt: { gte: new Date(input.now.getTime() - SUGGESTION_LOOKBACK_MS) },
      OR: [{ assigneeId: { not: null } }, { assignees: { some: {} } }],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      title: true,
      tags: true,
      assigneeId: true,
      assignees: { select: { adminUserId: true } },
    },
  });
  const scores = new Map<string, number>();
  for (const past of history) {
    const similarity = opsTaskSimilarity(input.task, past);
    if (similarity < 0.25) continue;
    const people = new Set(past.assignees.map((assignment) => assignment.adminUserId));
    if (past.assigneeId) people.add(past.assigneeId);
    for (const adminUserId of people) {
      scores.set(adminUserId, (scores.get(adminUserId) ?? 0) + similarity);
    }
  }
  const ranked = Array.from(scores.entries()).sort((left, right) => right[1] - left[1]);
  if (!ranked.length || ranked[0][1] < 0.5) return null;
  // A tie means there is no clear owner of this kind of work.
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return null;
  return { adminUserId: ranked[0][0], score: ranked[0][1] };
}
