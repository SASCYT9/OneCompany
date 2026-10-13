import { OpsKnowledgeStatus, type PrismaClient } from "@prisma/client";

import {
  answerOpsKnowledgeQuestionWithAi,
  createPrismaOpsAiBudget,
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
  const candidates = await client.opsKnowledgeArticle.findMany({
    where: {
      status: OpsKnowledgeStatus.PUBLISHED,
      archivedAt: null,
      OR: terms.flatMap((term) => [
        { title: { contains: term, mode: "insensitive" as const } },
        { searchText: { contains: term, mode: "insensitive" as const } },
      ]),
    },
    take: 40,
    select: { id: true, title: true, searchText: true, contentMarkdown: true, brandKey: true },
  });
  const scored = candidates
    .map((article) => {
      const title = article.title.toLocaleLowerCase("ru-RU");
      const body = article.searchText.toLocaleLowerCase("ru-RU");
      const score = terms.reduce(
        (sum, term) => sum + (title.includes(term) ? 3 : 0) + (body.includes(term) ? 1 : 0),
        0
      );
      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored.slice(0, limit).map(({ article }) => ({
    id: article.id,
    title: article.title,
    content: article.contentMarkdown.slice(0, ARTICLE_CONTENT_LIMIT),
  }));
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
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup; aiUsed: boolean }> {
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
    };
  } catch {
    return {
      text: [
        "📚 Вот что есть в базе по вашему вопросу:",
        ...articles.slice(0, 3).map((article) => `• ${article.title}`),
      ].join("\n"),
      replyMarkup: articleButtons(articles),
      aiUsed: false,
    };
  }
}
