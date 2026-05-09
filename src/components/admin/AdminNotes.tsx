"use client";

import { useEffect, useState } from "react";

import { Loader2, MessageSquarePlus, Pin, PinOff, Trash2, User } from "lucide-react";

import { useToast } from "@/components/admin/AdminToast";

/**
 * AdminNotes — collapsible notes thread for any entity.
 *
 * Features:
 *   - Inline composer with Enter to save (Shift+Enter for newline)
 *   - Pin/unpin notes (pinned notes float to top)
 *   - Delete (own notes only — author check on backend)
 *   - Author name + relative time per note
 *
 * Usage:
 *   <AdminNotes entityType="shop.order" entityId={order.id} />
 */

type Note = {
  id: string;
  authorEmail: string;
  authorName: string | null;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export function AdminNotes({ entityType, entityId }: { entityType: string; entityId: string }) {
  const toast = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composeText, setComposeText] = useState("");
  const [composing, setComposing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/notes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
          { cache: "no-store" }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to load");
        if (!cancelled) setNotes(data.notes || []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, reloadKey]);

  async function addNote() {
    if (!composeText.trim()) return;
    setComposing(true);
    try {
      const response = await fetch(
        `/api/admin/notes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: composeText }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error("Could not save note", data.error || "Try again");
        return;
      }
      setComposeText("");
      setReloadKey((k) => k + 1);
    } finally {
      setComposing(false);
    }
  }

  async function togglePin(note: Note) {
    const response = await fetch(`/api/admin/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !note.isPinned }),
    });
    if (!response.ok) {
      toast.error("Could not pin/unpin");
      return;
    }
    setReloadKey((k) => k + 1);
  }

  async function deleteNote(note: Note) {
    const response = await fetch(`/api/admin/notes/${note.id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error("Could not delete", data.error || "Try again");
      return;
    }
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="rounded-none border border-white/5 bg-[#171717] p-3">
        <textarea
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void addNote();
            }
          }}
          placeholder="Додати нотатку… (Enter — зберегти, Shift+Enter — новий рядок)"
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => void addNote()}
            disabled={composing || !composeText.trim()}
            className="inline-flex items-center gap-1.5 rounded-none bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {composing ? (
              <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
            ) : (
              <MessageSquarePlus className="h-3 w-3" />
            )}
            Додати нотатку
          </button>
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="text-xs text-zinc-500">Завантаження нотаток…</div>
      ) : error ? (
        <div className="rounded-none border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {error}
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-none border border-dashed border-white/8 bg-black/20 p-4 text-center text-xs text-zinc-500">
          Поки немає нотаток. Додайте першу вище.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`group rounded-none border p-3 transition ${
                n.isPinned ? "border-amber-500/25 bg-amber-500/4" : "border-white/5 bg-[#171717]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <User className="h-3 w-3 text-zinc-500" aria-hidden="true" />
                  <span className="font-medium text-zinc-300">{n.authorName || n.authorEmail}</span>
                  {n.isPinned ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/8 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                      Закріплено
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => void togglePin(n)}
                    aria-label={n.isPinned ? "Відкріпити" : "Закріпити"}
                    title={n.isPinned ? "Відкріпити" : "Закріпити"}
                    className="rounded-none p-1 text-zinc-500 hover:bg-white/6 hover:text-amber-300"
                  >
                    {n.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteNote(n)}
                    aria-label="Видалити"
                    title="Видалити (тільки автор)"
                    className="rounded-none p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                {n.content}
              </div>
              <div
                className="mt-1.5 text-[10px] text-zinc-500"
                title={new Date(n.createdAt).toLocaleString()}
              >
                {relativeTime(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "щойно";
  if (min < 60) return `${min} хв тому`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} год тому`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} д тому`;
  return new Date(iso).toLocaleDateString();
}
