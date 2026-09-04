"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];

export function ProductMediaUpload({
  busy,
  onBusyChange,
  onUploaded,
}: {
  busy: boolean;
  onBusyChange: (value: boolean) => void;
  onUploaded: (url: string, mediaType: "IMAGE" | "VIDEO") => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function upload(files: File[]) {
    if (inFlight.current || busy || !files.length) return;
    inFlight.current = true;
    onBusyChange(true);
    setError("");
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Завантажуємо ${index + 1} із ${files.length}…`);
        if (!allowedTypes.includes(file.type) || file.size > 50 * 1024 * 1024) {
          failures.push(`${file.name}: непідтримуваний формат або розмір понад 50 МБ.`);
          continue;
        }
        try {
          const body = new FormData();
          body.append("file", file);
          const response = await fetch("/api/admin/shop/media", { method: "POST", body });
          const data = await response.json();
          if (!response.ok || !data.item?.url)
            throw new Error(data.error || "Не вдалося завантажити файл");
          onUploaded(data.item.url, file.type.startsWith("video/") ? "VIDEO" : "IMAGE");
        } catch (cause) {
          failures.push(`${file.name}: ${(cause as Error).message}`);
        }
      }
      setError(failures.join(" "));
    } finally {
      onBusyChange(false);
      inFlight.current = false;
      setProgress("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mb-4">
      <div
        className="rounded-lg border border-dashed border-white/25 bg-white/2 p-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept={allowedTypes.join(",")}
          hidden
          disabled={busy}
          onChange={(event) => void upload(Array.from(event.target.files || []))}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 border border-white/20 bg-white/5 px-4 py-2 text-sm disabled:opacity-50"
        >
          <Upload size={16} />
          {busy ? progress || "Завантажуємо…" : "Завантажити фото або відео"}
        </button>
        <p className="mt-2 text-xs text-zinc-400">
          Або перетягніть файли сюди · JPG, PNG, WebP, GIF, MP4, WebM · до 50 МБ
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Файли одразу потрапляють у медіатеку. Щоб додати їх до товару, збережіть зміни.
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
