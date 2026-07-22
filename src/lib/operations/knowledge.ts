import { OpsError } from "@/lib/operations/errors";
import { createOpsSlug } from "@/lib/operations/ids";

export const OPS_KNOWLEDGE_CATEGORIES = [
  "prices-and-brands",
  "delivery",
  "order-processing",
  "suppliers",
  "general-processes",
] as const;

export type OpsKnowledgeCategory = (typeof OPS_KNOWLEDGE_CATEGORIES)[number];

type KnowledgeComparable = {
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  locale: string;
  category: string;
  brandKey: string | null;
  projectId: string | null;
  tags: string[];
};

function category(value: unknown): OpsKnowledgeCategory {
  const normalized = String(value ?? "").trim();
  if (!OPS_KNOWLEDGE_CATEGORIES.includes(normalized as OpsKnowledgeCategory)) {
    throw new OpsError(
      "VALIDATION_ERROR",
      400,
      `Category must be one of: ${OPS_KNOWLEDGE_CATEGORIES.join(", ")}`
    );
  }
  return normalized as OpsKnowledgeCategory;
}

function text(value: unknown, label: string, required = false, max = 100_000) {
  const normalized = value === null || value === undefined ? null : String(value).trim();
  if (required && !normalized) {
    throw new OpsError("VALIDATION_ERROR", 400, `${label} is required`);
  }
  if (normalized && normalized.length > max) {
    throw new OpsError("VALIDATION_ERROR", 400, `${label} exceeds ${max} characters`);
  }
  return normalized || null;
}

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean))
  ).slice(0, 30);
}

export function buildKnowledgeSearchText(input: {
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  category: string;
  brandKey: string | null;
  tags: string[];
}) {
  return [
    input.title,
    input.excerpt,
    input.contentMarkdown,
    input.category,
    input.brandKey,
    ...input.tags,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 250_000);
}

export function normalizeKnowledgeCreateInput(body: unknown) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = text(input.title, "Title", true, 500)!;
  const result = {
    title,
    slug: text(input.slug, "Slug", false, 100) || createOpsSlug(title),
    excerpt: text(input.excerpt, "Excerpt", false, 1_000),
    contentMarkdown: text(input.contentMarkdown, "Content", true, 100_000)!,
    locale: text(input.locale, "Locale", false, 10) || "ru",
    category: category(input.category),
    brandKey: text(input.brandKey, "Brand", false, 100),
    projectId: text(input.projectId, "Project", false, 100),
    tags: tags(input.tags),
    changeNote: text(input.changeNote, "Change note", false, 1_000),
  };
  return { ...result, searchText: buildKnowledgeSearchText(result) };
}

export function normalizeKnowledgePatchInput(body: unknown, current: KnowledgeComparable) {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const merged = {
    title: "title" in input ? text(input.title, "Title", true, 500)! : current.title,
    excerpt: "excerpt" in input ? text(input.excerpt, "Excerpt", false, 1_000) : current.excerpt,
    contentMarkdown:
      "contentMarkdown" in input
        ? text(input.contentMarkdown, "Content", true, 100_000)!
        : current.contentMarkdown,
    locale: "locale" in input ? text(input.locale, "Locale", true, 10)! : current.locale,
    category: "category" in input ? category(input.category) : category(current.category),
    brandKey: "brandKey" in input ? text(input.brandKey, "Brand", false, 100) : current.brandKey,
    projectId:
      "projectId" in input ? text(input.projectId, "Project", false, 100) : current.projectId,
    tags: "tags" in input ? tags(input.tags) : current.tags,
  };
  return {
    ...merged,
    changeNote: text(input.changeNote, "Change note", false, 1_000),
    searchText: buildKnowledgeSearchText(merged),
  };
}

export function hasKnowledgeDraftChanges(current: KnowledgeComparable, next: KnowledgeComparable) {
  return (
    current.title !== next.title ||
    current.excerpt !== next.excerpt ||
    current.contentMarkdown !== next.contentMarkdown ||
    current.locale !== next.locale ||
    current.category !== next.category ||
    current.brandKey !== next.brandKey ||
    current.projectId !== next.projectId ||
    current.tags.length !== next.tags.length ||
    current.tags.some((tag, index) => tag !== next.tags[index])
  );
}

export function redactKnowledgeTaskMetadata<T>(article: T, canReadTasks: boolean): T {
  if (canReadTasks || !article || typeof article !== "object") return article;
  const safe = { ...(article as Record<string, unknown>) };
  delete safe.project;
  delete safe.taskLinks;
  return safe as T;
}
