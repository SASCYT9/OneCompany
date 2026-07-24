"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  FilePenLine,
  History,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Send,
  Tags,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { knowledgeCategoryLabel } from "./OpsKnowledge";
import { OpsKnowledgeEditor } from "./OpsKnowledgeEditor";
import { OpsSurface } from "./OpsSurface";
import { opsGet, opsMutation } from "./opsApi";
import type { OpsKnowledgeArticle } from "./types";

const categoryOptions = [
  ["prices-and-brands", "Цены и бренды"],
  ["delivery", "Доставка"],
  ["order-processing", "Оформление заказов"],
  ["suppliers", "Поставщики"],
  ["general-processes", "Общие процессы"],
  ["notes", "Заметки команды"],
] as const;

function InlineMarkdown({ value }: { value: string }) {
  return (
    <>
      {value
        .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g)
        .filter(Boolean)
        .map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={index} className="font-semibold text-slate-950">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code key={index} className="bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-900">
                {part.slice(1, -1)}
              </code>
            );
          }
          const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
          if (link) {
            return (
              <a
                key={index}
                href={link[2]}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2"
              >
                {link[1]}
              </a>
            );
          }
          return <Fragment key={index}>{part}</Fragment>;
        })}
    </>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = useMemo(() => content.split(/\n{2,}/), [content]);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700">
      {blocks.map((block, blockIndex) => {
        const value = block.trim();
        if (!value) return null;
        if (value.startsWith("```") && value.endsWith("```")) {
          const code = value.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={blockIndex}
              className="overflow-x-auto border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-100"
            >
              <code>{code}</code>
            </pre>
          );
        }
        const tableLines = value.split("\n").filter(Boolean);
        if (
          tableLines.length >= 2 &&
          tableLines[0].trim().startsWith("|") &&
          /^\s*\|?[\s:|-]+\|/.test(tableLines[1])
        ) {
          const cells = (line: string) =>
            line
              .trim()
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((cell) => cell.trim());
          const headers = cells(tableLines[0]);
          const rows = tableLines.slice(2).map(cells);
          return (
            <div key={blockIndex} className="overflow-x-auto border border-slate-200">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    {headers.map((header, index) => (
                      <th
                        key={index}
                        className="border-b border-slate-200 px-3 py-2.5 font-semibold"
                      >
                        <InlineMarkdown value={header} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                      {headers.map((_, cellIndex) => (
                        <td key={cellIndex} className="whitespace-normal px-3 py-2.5 align-top">
                          <InlineMarkdown value={row[cellIndex] ?? ""} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (value.startsWith("# ")) {
          return (
            <h1 key={blockIndex} className="pt-3 text-2xl font-bold text-slate-950">
              {value.slice(2)}
            </h1>
          );
        }
        if (value.startsWith("## ")) {
          return (
            <h2 key={blockIndex} className="pt-3 text-xl font-bold text-slate-950">
              {value.slice(3)}
            </h2>
          );
        }
        if (value.startsWith("### ")) {
          return (
            <h3 key={blockIndex} className="pt-2 text-lg font-bold text-slate-950">
              {value.slice(4)}
            </h3>
          );
        }
        if (value.startsWith("> ")) {
          return (
            <blockquote
              key={blockIndex}
              className="rounded-r-lg border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-blue-950"
            >
              {value.replace(/^>\s?/gm, "")}
            </blockquote>
          );
        }
        if (/^[-*]\s/m.test(value)) {
          return (
            <ul key={blockIndex} className="space-y-2 pl-1">
              {value.split("\n").map((line, index) => (
                <li key={index} className="flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
                  <span>
                    <InlineMarkdown value={line.replace(/^[-*]\s*/, "")} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        if (/^\d+\.\s/m.test(value)) {
          return (
            <ol key={blockIndex} className="space-y-2">
              {value.split("\n").map((line, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {index + 1}
                  </span>
                  <span>
                    <InlineMarkdown value={line.replace(/^\d+\.\s*/, "")} />
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            <InlineMarkdown value={value} />
          </p>
        );
      })}
    </div>
  );
}

function filterGlossaryContent(content: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return content;
  const lines = content.split(/\r?\n/u);
  const tableStart = lines.findIndex(
    (line, index) =>
      line.trim().startsWith("|") && /^\s*\|?[\s:|-]+\|/u.test(lines[index + 1] ?? "")
  );
  if (tableStart < 0)
    return content.toLocaleLowerCase("ru-RU").includes(normalized) ? content : null;
  let tableEnd = tableStart + 2;
  while (tableEnd < lines.length && lines[tableEnd].trim().startsWith("|")) tableEnd += 1;
  const matchingRows = lines
    .slice(tableStart + 2, tableEnd)
    .filter((line) => line.toLocaleLowerCase("ru-RU").includes(normalized));
  if (!matchingRows.length) return null;
  return [
    ...lines.slice(0, tableStart),
    lines[tableStart],
    lines[tableStart + 1],
    ...matchingRows,
    ...lines.slice(tableEnd),
  ].join("\n");
}

export function OpsKnowledgeDetail({
  articleId,
  initialArticle,
  demoMode = false,
  canWrite = false,
  canPublish = false,
  editingInitially = false,
  permissions,
}: {
  articleId: string;
  initialArticle?: OpsKnowledgeArticle;
  demoMode?: boolean;
  canWrite?: boolean;
  canPublish?: boolean;
  editingInitially?: boolean;
  permissions: readonly string[];
}) {
  const [article, setArticle] = useState(initialArticle);
  const [editing, setEditing] = useState(editingInitially || articleId === "new");
  const [title, setTitle] = useState(initialArticle?.title ?? "");
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt ?? "");
  const [content, setContent] = useState(initialArticle?.contentMarkdown ?? "");
  const [category, setCategory] = useState(initialArticle?.category ?? "general-processes");
  const [tags, setTags] = useState(initialArticle?.tags.join(", ") ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(!initialArticle && articleId !== "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localDraftKey = `ops-knowledge-draft:${articleId}`;

  useEffect(() => {
    if (initialArticle || demoMode || articleId === "new") return;
    const controller = new AbortController();
    void opsGet<{ article: OpsKnowledgeArticle }>(
      `/api/admin/operations/knowledge/${articleId}`,
      controller.signal
    )
      .then((response) => {
        setArticle(response.article);
        setTitle(response.article.title);
        setExcerpt(response.article.excerpt ?? "");
        setContent(response.article.contentMarkdown);
        setCategory(response.article.category);
        setTags(response.article.tags.join(", "));
        setChangeNote("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Не удалось открыть статью");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [articleId, demoMode, initialArticle]);

  useEffect(() => {
    if (!editing || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(localDraftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        title?: string;
        excerpt?: string;
        content?: string;
        category?: string;
        tags?: string;
        savedAt?: string;
      };
      if (!draft.content || draft.content === content) return;
      const accepted = window.confirm(
        `Найдена несохранённая версия${draft.savedAt ? ` от ${new Date(draft.savedAt).toLocaleString("ru-RU")}` : ""}. Восстановить её?`
      );
      if (accepted) {
        setTitle(draft.title ?? title);
        setExcerpt(draft.excerpt ?? excerpt);
        setContent(draft.content);
        setCategory(draft.category ?? category);
        setTags(draft.tags ?? tags);
      } else {
        window.localStorage.removeItem(localDraftKey);
      }
    } catch {
      window.localStorage.removeItem(localDraftKey);
    }
    // Draft recovery is intentionally checked only when the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, localDraftKey]);

  useEffect(() => {
    if (!editing || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        localDraftKey,
        JSON.stringify({
          title,
          excerpt,
          content,
          category,
          tags,
          savedAt: new Date().toISOString(),
        })
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [category, content, editing, excerpt, localDraftKey, tags, title]);

  async function save() {
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      contentMarkdown: content.trim(),
      locale: "ru",
      category,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      changeNote: changeNote.trim() || (article ? "Обновлено в админке" : "Первая версия"),
    };
    try {
      let saved: OpsKnowledgeArticle;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        saved = {
          id: article?.id ?? `demo-article-${Date.now()}`,
          slug: article?.slug ?? title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-"),
          ...body,
          excerpt: body.excerpt,
          status: "DRAFT",
          version: (article?.version ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        };
      } else if (article) {
        const response = await opsMutation<{ article: OpsKnowledgeArticle }>({
          path: `/api/admin/operations/knowledge/${article.id}`,
          method: "PATCH",
          body,
          version: article.version,
          scope: `knowledge-save:${article.id}`,
        });
        saved = response.article;
      } else {
        const response = await opsMutation<{ article: OpsKnowledgeArticle }>({
          path: "/api/admin/operations/knowledge",
          body,
          scope: "knowledge-create",
        });
        saved = response.article;
      }
      setArticle(saved);
      setChangeNote("");
      setEditing(false);
      window.localStorage.removeItem(localDraftKey);
      if (articleId === "new")
        window.history.replaceState(null, "", `/admin/operations/knowledge/${saved.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Статья не сохранена");
    } finally {
      setSaving(false);
    }
  }

  async function restoreRevision(revision: number) {
    if (!article || saving) return;
    const accepted = window.confirm(
      `Восстановить версию ${revision}? Текущая версия сохранится в истории.`
    );
    if (!accepted) return;
    setSaving(true);
    setError(null);
    try {
      const response = await opsMutation<{ article: OpsKnowledgeArticle }>({
        path: `/api/admin/operations/knowledge/${article.id}/revisions/${revision}/restore`,
        body: {},
        version: article.version,
        scope: `knowledge-restore:${article.id}:${revision}`,
      });
      const restored = response.article;
      setArticle(restored);
      setTitle(restored.title);
      setExcerpt(restored.excerpt ?? "");
      setContent(restored.contentMarkdown);
      setCategory(restored.category);
      setTags(restored.tags.join(", "));
      setEditing(false);
      setHistoryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось восстановить версию");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!article || saving) return;
    setSaving(true);
    setError(null);
    try {
      let published: OpsKnowledgeArticle;
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        published = {
          ...article,
          status: "PUBLISHED",
          version: article.version + 1,
          publishedRevision: article.version + 1,
        };
      } else {
        const response = await opsMutation<{ article: OpsKnowledgeArticle }>({
          path: `/api/admin/operations/knowledge/${article.id}/publish`,
          body: { changeNote: "Опубликовано из админки" },
          version: article.version,
          scope: `knowledge-publish:${article.id}`,
        });
        published = response.article;
      }
      setArticle(published);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Статья не опубликована");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <OpsSurface permissions={permissions}>
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка статьи…
        </div>
      </OpsSurface>
    );
  }

  if (!article && articleId !== "new" && !editing) {
    return (
      <OpsSurface permissions={permissions}>
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <CircleAlert className="h-9 w-9 text-red-500" />
          <h1 className="mt-3 text-xl font-bold">Статья не открылась</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "Материал не найден."}</p>
        </div>
      </OpsSurface>
    );
  }

  return (
    <OpsSurface permissions={permissions}>
      <div className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <Link
          href="/admin/operations/knowledge"
          className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Назад в БАЗУ</span>
        </Link>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              {article ? (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="hidden h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium sm:flex"
                >
                  <X className="h-4 w-4" />
                  Отмена
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!title.trim() || !content.trim() || saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить
              </button>
            </>
          ) : (
            <>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setHistoryOpen((current) => !current)}
                  className="hidden h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-medium sm:flex"
                >
                  <History className="h-4 w-4" />
                  История
                </button>
              ) : null}
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium"
                >
                  <Pencil className="h-4 w-4" />
                  Редактировать
                </button>
              ) : null}
              {canPublish && article?.status !== "PUBLISHED" ? (
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={saving}
                  className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Опубликовать
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {error ? (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}
        {editing ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-600">
              <FilePenLine className="h-4 w-4" />
              {article ? "Редактирование статьи" : "Новая статья"}
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Название</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Понятное название инструкции"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-2xl"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Краткое описание</span>
              <textarea
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                rows={2}
                placeholder="Что сотрудник узнает из этой статьи"
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Категория</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
                >
                  {categoryOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Теги через запятую</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="maxton, совместимость"
                  className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <div>
              <div className="mb-2">
                <span className="text-xs font-semibold text-slate-600">Содержание статьи</span>
                <p className="mt-1 text-xs text-slate-400">
                  Выделите текст и используйте кнопки форматирования. Результат можно проверить во
                  вкладке «Просмотр».
                </p>
              </div>
              <OpsKnowledgeEditor
                value={content}
                onChange={setContent}
                renderPreview={(preview) => <MarkdownContent content={preview} />}
              />
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">
                Что изменилось <span className="font-normal text-slate-400">· необязательно</span>
              </span>
              <input
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Например: обновлена формула доставки и контакт поставщика"
                maxLength={1_000}
                className="mt-2 h-11 w-full border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
        ) : article ? (
          <article>
            {historyOpen && article.revisions?.length ? (
              <section className="mb-7 border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-950">История изменений</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Восстановление создаёт новую черновую версию — история не удаляется.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    aria-label="Закрыть историю"
                    className="p-2 text-slate-500 hover:text-slate-950"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 divide-y divide-slate-200 overflow-y-auto">
                  {article.revisions.map((revision) => (
                    <div
                      key={revision.id}
                      className="flex items-start justify-between gap-4 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Версия {revision.revision}
                          {revision.revision === article.version ? (
                            <span className="ml-2 text-xs font-medium text-blue-600">текущая</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {revision.changedBy?.name || "Сотрудник"} ·{" "}
                          {new Date(revision.createdAt).toLocaleString("ru-RU")}
                        </p>
                        {revision.changeNote ? (
                          <p className="mt-1 text-xs text-slate-700">{revision.changeNote}</p>
                        ) : null}
                      </div>
                      {revision.revision !== article.version ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void restoreRevision(revision.revision)}
                          className="flex shrink-0 items-center gap-1.5 border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Вернуть
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-600">
              <BookOpen className="h-4 w-4" />
              {knowledgeCategoryLabel(article.category)}
              <span className="text-slate-300">·</span>
              <span
                className={cn(
                  article.status === "PUBLISHED" ? "text-emerald-600" : "text-amber-600"
                )}
              >
                {article.status === "PUBLISHED" ? "Опубликовано" : "Черновик"}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              {article.title}
            </h1>
            {article.excerpt ? (
              <p className="mt-4 text-lg leading-8 text-slate-500">{article.excerpt}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-200 py-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                Обновлено{" "}
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(article.updatedAt))}
              </span>
              {article.tags.length ? (
                <span className="flex items-center gap-1.5">
                  <Tags className="h-4 w-4" />
                  {article.tags.join(" · ")}
                </span>
              ) : null}
            </div>
            <div className="mt-8">
              {article.slug === "automotive-terms-for-managers" ? (
                <div className="mb-6 border border-slate-200 bg-white p-3 sm:p-4">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={glossaryQuery}
                      onChange={(event) => setGlossaryQuery(event.target.value)}
                      placeholder="Найти термин, синоним или объяснение…"
                      className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              ) : null}
              {article.slug === "automotive-terms-for-managers" ? (
                filterGlossaryContent(article.contentMarkdown, glossaryQuery) ? (
                  <MarkdownContent
                    content={filterGlossaryContent(article.contentMarkdown, glossaryQuery)!}
                  />
                ) : (
                  <div className="border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    По вашему запросу терминов не найдено.
                  </div>
                )
              ) : (
                <MarkdownContent content={article.contentMarkdown} />
              )}
            </div>
          </article>
        ) : null}
      </div>
    </OpsSurface>
  );
}
