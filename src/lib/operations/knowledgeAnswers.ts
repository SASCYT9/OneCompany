import { OpsKnowledgeStatus, type PrismaClient } from "@prisma/client";

import {
  answerOpsKnowledgeQuestionWithAi,
  createPrismaOpsAiBudget,
  isTransientOpsAiError,
  type OpsAiProvider,
  type OpsKnowledgeAnswerSource,
} from "@/lib/operations/ai";
import { opsAdminLink } from "@/lib/operations/adminLinks";
export { extractOpsKnowledgeQuestion } from "@/lib/operations/knowledgeQuestion";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";

const STOP_WORDS = new Set([
  "как",
  "какая",
  "какой",
  "какие",
  "какое",
  "сколько",
  "где",
  "когда",
  "что",
  "это",
  "для",
  "или",
  "есть",
  "нас",
  "наш",
  "мне",
  "яка",
  "який",
  "які",
  "скільки",
  "коли",
  "що",
  "для",
  "нам",
  "чи",
  "the",
  "and",
  "how",
  "what",
]);

const ARTICLE_CONTENT_LIMIT = 2_500;

export function opsKnowledgeQuestionTerms(question: string) {
  return Array.from(
    new Set(
      question
        .toLocaleLowerCase("ru-RU")
        .replace(/[^\p{Letter}\p{Number}\s-]+/gu, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
        // Russian/Ukrainian endings vary («доставка», «доставку»): match by stem.
        .map((term) => (term.length > 6 ? term.slice(0, term.length - 2) : term))
    )
  ).slice(0, 8);
}

export async function findOpsKnowledgeForQuestion(
  client: Pick<PrismaClient, "opsKnowledgeArticle">,
  question: string,
  limit = 4
) {
  const terms = opsKnowledgeQuestionTerms(question);
  if (!terms.length) return [];
  const base = { status: OpsKnowledgeStatus.PUBLISHED, archivedAt: null };
  const contains = (term: string) => ({ contains: term, mode: "insensitive" as const });
  // Ranking happens here, not in an arbitrary «first 40 matches» slice:
  // title hits weigh most, then articles that mention every term.
  const [byTitle, byAllTerms] = await Promise.all([
    client.opsKnowledgeArticle.findMany({
      where: { ...base, OR: terms.map((term) => ({ title: contains(term) })) },
      take: 60,
      select: { id: true, title: true },
    }),
    terms.length > 1
      ? client.opsKnowledgeArticle.findMany({
          where: { ...base, AND: terms.map((term) => ({ searchText: contains(term) })) },
          take: 30,
          select: { id: true, title: true },
        })
      : Promise.resolve([] as Array<{ id: string; title: string }>),
  ]);
  const byAnyTerm =
    byTitle.length + byAllTerms.length < limit
      ? await client.opsKnowledgeArticle.findMany({
          where: { ...base, OR: terms.map((term) => ({ searchText: contains(term) })) },
          orderBy: { updatedAt: "desc" },
          take: 40,
          select: { id: true, title: true },
        })
      : [];
  const scores = new Map<string, { title: string; score: number }>();
  const add = (rows: Array<{ id: string; title: string }>, bonus: number) => {
    for (const row of rows) {
      const title = row.title.toLocaleLowerCase("ru-RU");
      const titleHits = terms.filter((term) => title.includes(term)).length;
      const entry = scores.get(row.id) ?? { title: row.title, score: titleHits * 3 };
      entry.score += bonus;
      scores.set(row.id, entry);
    }
  };
  add(byTitle, 0);
  add(byAllTerms, 2);
  add(byAnyTerm, 1);
  const topIds = Array.from(scores.entries())
    .filter(([, entry]) => entry.score > 0)
    .sort((left, right) => right[1].score - left[1].score)
    .slice(0, limit)
    .map(([id]) => id);
  if (!topIds.length) return [];
  const articles = await client.opsKnowledgeArticle.findMany({
    where: { id: { in: topIds } },
    select: { id: true, title: true, contentMarkdown: true },
  });
  const byId = new Map(articles.map((article) => [article.id, article]));
  return topIds.flatMap((id) => {
    const article = byId.get(id);
    return article
      ? [
          {
            id: article.id,
            title: article.title,
            content: article.contentMarkdown.slice(0, ARTICLE_CONTENT_LIMIT),
          },
        ]
      : [];
  });
}

function articleButtons(articles: Array<{ id: string; title: string }>) {
  const rows: OpsTelegramInlineButton[][] = articles.slice(0, 3).map((article) => [
    {
      text: `📚 ${article.title.length > 40 ? `${article.title.slice(0, 39)}…` : article.title}`,
      url: opsAdminLink(`/admin/operations/knowledge/${encodeURIComponent(article.id)}`),
    },
  ]);
  return rows.length ? ({ inline_keyboard: rows } satisfies OpsTelegramReplyMarkup) : undefined;
}

/**
 * Answers «? вопрос» from published knowledge articles. Without AI (not
 * configured or budget exhausted) it still points to the best matches.
 */
export async function answerOpsKnowledgeQuestion(input: {
  client: PrismaClient;
  question: string;
  provider?: OpsAiProvider;
  /** Test hook, passed to the AI call. */
  overloadPauseMs?: number;
}): Promise<{
  text: string;
  replyMarkup?: OpsTelegramReplyMarkup;
  aiUsed: boolean;
  model?: string;
  aiError?: string;
  /** Every model answered «overloaded»: worth a second try a bit later. */
  aiOverloaded?: boolean;
}> {
  const articles: OpsKnowledgeAnswerSource[] = await findOpsKnowledgeForQuestion(
    input.client,
    input.question
  );
  if (!articles.length) {
    return {
      text: [
        "🤷 В базе знаний ничего не нашёл по этому вопросу.",
        "Если нужно разобраться — напишите это обычным сообщением без «?», я поставлю задачу.",
      ].join("\n"),
      aiUsed: false,
    };
  }
  try {
    const response = await answerOpsKnowledgeQuestionWithAi({
      question: input.question,
      articles,
      budget: createPrismaOpsAiBudget(input.client),
      provider: input.provider,
      overloadPauseMs: input.overloadPauseMs,
    });
    const used = articles.filter((article) => response.value.sourceIds.includes(article.id));
    const sources = used.length ? used : articles.slice(0, 2);
    if (!response.value.found) {
      return {
        text: [
          `🤷 ${response.value.answer || "Точного ответа в базе нет."}`,
          "",
          "Возможно, поможет:",
          ...articles.slice(0, 3).map((article) => `• ${article.title}`),
        ].join("\n"),
        replyMarkup: articleButtons(articles),
        aiUsed: true,
        model: response.model,
      };
    }
    return {
      text: [
        `💡 ${response.value.answer}`,
        "",
        `📚 Источник: ${sources.map((article) => `«${article.title}»`).join(", ")}`,
      ].join("\n"),
      replyMarkup: articleButtons(sources),
      aiUsed: true,
      model: response.model,
    };
  } catch (error) {
    const aiError = error instanceof Error ? error.message.slice(0, 300) : "AI_FAILED";
    console.error("[operations.knowledge.answer] AI answer failed", aiError);
    return {
      aiError,
      aiOverloaded: isTransientOpsAiError(error),
      text: [
        "📚 Вот что есть в базе по вашему вопросу:",
        ...articles.slice(0, 3).map((article) => `• ${article.title}`),
      ].join("\n"),
      replyMarkup: articleButtons(articles),
      aiUsed: false,
    };
  }
}
