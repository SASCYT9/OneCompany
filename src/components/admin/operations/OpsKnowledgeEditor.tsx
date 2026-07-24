"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  PencilLine,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  renderPreview: (value: string) => ReactNode;
};

type InsertMode = "wrap" | "line" | "block";

const tools = [
  { label: "Заголовок", icon: Heading2, before: "## ", after: "", mode: "line" as InsertMode },
  { label: "Жирный", icon: Bold, before: "**", after: "**", mode: "wrap" as InsertMode },
  { label: "Курсив", icon: Italic, before: "_", after: "_", mode: "wrap" as InsertMode },
  { label: "Список", icon: List, before: "- ", after: "", mode: "line" as InsertMode },
  { label: "Нумерация", icon: ListOrdered, before: "1. ", after: "", mode: "line" as InsertMode },
  { label: "Цитата", icon: Quote, before: "> ", after: "", mode: "line" as InsertMode },
  { label: "Ссылка", icon: Link2, before: "[", after: "](https://)", mode: "wrap" as InsertMode },
  {
    label: "Таблица",
    icon: Table2,
    before: "| Название | Значение |\n| --- | --- |\n|  |  |",
    after: "",
    mode: "block" as InsertMode,
  },
  { label: "Разделитель", icon: Minus, before: "---", after: "", mode: "block" as InsertMode },
] as const;

export function OpsKnowledgeEditor({ value, onChange, renderPreview }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [history, setHistory] = useState([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const lastRecorded = useRef(value);

  useEffect(() => {
    if (value === lastRecorded.current) return;
    const timer = window.setTimeout(() => {
      setHistory((current) => [...current.slice(0, historyIndex + 1), value].slice(-50));
      setHistoryIndex((current) => Math.min(current + 1, 49));
      lastRecorded.current = value;
    }, 700);
    return () => window.clearTimeout(timer);
  }, [historyIndex, value]);

  function commit(next: string, selectionStart?: number, selectionEnd?: number) {
    lastRecorded.current = next;
    onChange(next);
    setHistory((current) => [...current.slice(0, historyIndex + 1), next].slice(-50));
    setHistoryIndex((current) => Math.min(current + 1, 49));
    if (selectionStart !== undefined) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
      });
    }
  }

  function applyTool(tool: (typeof tools)[number]) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    let before: string = tool.before;
    let after: string = tool.after;
    if (tool.mode === "line") {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndCandidate = value.indexOf("\n", end);
      const lineEnd = lineEndCandidate < 0 ? value.length : lineEndCandidate;
      const lines = value
        .slice(lineStart, lineEnd)
        .split("\n")
        .map((line) => `${before}${line}`)
        .join("\n");
      commit(
        `${value.slice(0, lineStart)}${lines}${value.slice(lineEnd)}`,
        lineStart + before.length,
        lineStart + lines.length
      );
      return;
    }
    if (tool.mode === "block") {
      const prefix = start > 0 && !value.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
      const suffix = end < value.length && !value.slice(end).startsWith("\n\n") ? "\n\n" : "";
      before = `${prefix}${before}`;
      after = `${after}${suffix}`;
    }
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    commit(next, start + before.length, start + before.length + selected.length);
  }

  function moveHistory(direction: -1 | 1) {
    const nextIndex = historyIndex + direction;
    if (nextIndex < 0 || nextIndex >= history.length) return;
    setHistoryIndex(nextIndex);
    lastRecorded.current = history[nextIndex];
    onChange(history[nextIndex]);
  }

  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onClick={() => applyTool(tool)}
              className="flex h-9 w-9 items-center justify-center border border-transparent text-slate-600 hover:border-slate-300 hover:bg-white hover:text-blue-600"
            >
              <tool.icon className="h-4 w-4" />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <button
            type="button"
            aria-label="Отменить изменение текста"
            title="Отменить"
            disabled={historyIndex <= 0}
            onClick={() => moveHistory(-1)}
            className="flex h-9 w-9 items-center justify-center text-slate-600 disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Вернуть изменение текста"
            title="Вернуть"
            disabled={historyIndex >= history.length - 1}
            onClick={() => moveHistory(1)}
            className="flex h-9 w-9 items-center justify-center text-slate-600 disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex border border-slate-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              "flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold",
              mode === "write" ? "bg-blue-600 text-white" : "text-slate-600"
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
            Текст
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold",
              mode === "preview" ? "bg-blue-600 text-white" : "text-slate-600"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Просмотр
          </button>
        </div>
      </div>
      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={22}
          placeholder="Начните писать инструкцию. Кнопки сверху помогут оформить заголовки, списки, ссылки и таблицы."
          className="block min-h-[430px] w-full resize-y border-0 px-4 py-4 text-[15px] leading-7 text-slate-900 outline-none"
        />
      ) : (
        <div className="min-h-[430px] px-5 py-5">
          {value.trim() ? (
            renderPreview(value)
          ) : (
            <p className="text-sm text-slate-400">Здесь появится предварительный просмотр.</p>
          )}
        </div>
      )}
    </div>
  );
}
