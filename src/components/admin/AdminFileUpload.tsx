"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";

import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * AdminFileUpload — drag-drop file uploader with previews + progress.
 *
 * Features:
 *   - Drag-drop or click-to-browse
 *   - Image previews (data URL) before upload
 *   - Multiple files queued for upload
 *   - Per-file progress and remove buttons
 *   - Sends FormData to `uploadUrl` with field name `file`
 *   - Returns array of uploaded file URLs via onUploaded callback
 *
 * Usage:
 *   <AdminFileUpload
 *     uploadUrl="/api/admin/shop/media"
 *     accept="image/*"
 *     multiple
 *     maxBytes={10 * 1024 * 1024}
 *     onUploaded={(urls) => setImages(images.concat(urls))}
 *   />
 */

type QueuedFile = {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  uploadedUrl?: string;
};

export function AdminFileUpload({
  uploadUrl,
  accept = "image/*",
  multiple = true,
  maxBytes = 25 * 1024 * 1024,
  onUploaded,
  className,
  fieldName = "file",
  responseUrlKey = "url",
  hint,
}: {
  uploadUrl: string;
  accept?: string;
  multiple?: boolean;
  maxBytes?: number;
  onUploaded?: (urls: string[]) => void;
  className?: string;
  fieldName?: string;
  /** Path within the JSON response that contains the uploaded URL — supports dot notation, e.g. "data.url" */
  responseUrlKey?: string;
  hint?: string;
}) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickResponseUrl(json: unknown): string | null {
    if (!json || typeof json !== "object") return null;
    const parts = responseUrlKey.split(".");
    let cur: unknown = json;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return null;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : null;
  }

  const onFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const queued: QueuedFile[] = [];
      for (const file of arr) {
        if (file.size > maxBytes) {
          queued.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewUrl: "",
            status: "error",
            error: `Too large (${formatBytes(file.size)} > ${formatBytes(maxBytes)})`,
          });
          continue;
        }
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        queued.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl,
          status: "pending",
        });
      }
      setQueue((current) => [...current, ...queued]);

      // Auto-upload pending items
      queued
        .filter((q) => q.status === "pending")
        .forEach((q) => {
          void uploadOne(q.id, q.file);
        });
    },
    [maxBytes, uploadUrl, fieldName, responseUrlKey, onUploaded] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function uploadOne(id: string, file: File) {
    setQueue((current) => current.map((q) => (q.id === id ? { ...q, status: "uploading" } : q)));
    try {
      const fd = new FormData();
      fd.append(fieldName, file);
      const response = await fetch(uploadUrl, { method: "POST", body: fd });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const data = await response.json().catch(() => ({}));
      const url = pickResponseUrl(data);
      if (!url) throw new Error("Server did not return a URL");

      setQueue((current) =>
        current.map((q) => (q.id === id ? { ...q, status: "done", uploadedUrl: url } : q))
      );
      if (onUploaded) onUploaded([url]);
    } catch (e) {
      setQueue((current) =>
        current.map((q) =>
          q.id === id ? { ...q, status: "error", error: (e as Error).message } : q
        )
      );
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer?.files) onFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function removeFromQueue(id: string) {
    setQueue((current) => {
      const item = current.find((q) => q.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((q) => q.id !== id);
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "cursor-pointer rounded-none border-2 border-dashed p-6 text-center transition",
          dragOver
            ? "border-blue-500/60 bg-blue-500/6"
            : "border-white/10 bg-black/20 hover:border-blue-500/40 hover:bg-blue-500/4"
        )}
      >
        <Upload className="mx-auto h-6 w-6 text-zinc-500" aria-hidden="true" />
        <div className="mt-2 text-sm font-medium text-zinc-200">
          {dragOver ? "Drop files here" : "Drag files here or click to browse"}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {hint ?? `${accept} · up to ${formatBytes(maxBytes)} per file`}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {queue.length > 0 ? (
        <div className="space-y-1.5">
          {queue.map((q) => (
            <div
              key={q.id}
              className={cn(
                "flex items-center gap-3 rounded-none border bg-[#171717] p-2 transition",
                q.status === "error"
                  ? "border-red-500/25"
                  : q.status === "done"
                    ? "border-emerald-500/20"
                    : "border-white/5"
              )}
            >
              {q.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.previewUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-none border border-white/5 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-white/5 bg-black/30">
                  <ImageIcon className="h-5 w-5 text-zinc-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-zinc-100">{q.file.name}</span>
                  {q.status === "uploading" ? (
                    <Loader2
                      className="h-3 w-3 motion-safe:animate-spin text-blue-400"
                      aria-hidden="true"
                    />
                  ) : q.status === "done" ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/8 px-1.5 py-0 text-[10px] font-bold uppercase text-emerald-300">
                      Uploaded
                    </span>
                  ) : q.status === "error" ? (
                    <span className="rounded-full border border-red-500/25 bg-red-500/8 px-1.5 py-0 text-[10px] font-bold uppercase text-red-300">
                      Failed
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                  {formatBytes(q.file.size)}
                  {q.error ? ` · ${q.error}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFromQueue(q.id)}
                aria-label="Remove"
                className="rounded-none p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
