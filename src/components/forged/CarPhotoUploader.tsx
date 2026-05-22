"use client";

import { useCallback, useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/seo";
import { useForgedConfig } from "./store";

type Props = { locale: SupportedLocale };

const MAX_BYTES = 8 * 1024 * 1024;

export default function CarPhotoUploader({ locale }: Props) {
  const isUa = locale === "ua";
  const carPhotoUrl = useForgedConfig((s) => s.config.carPhotoUrl);
  const setConfig = useForgedConfig((s) => s.setConfig);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError(isUa ? "Можна завантажити тільки фото." : "Only image files allowed.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(isUa ? "Файл більше 8 МБ." : "File exceeds 8 MB.");
        return;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/shop/forged/upload-car-photo", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const j = (await res.json()) as { url: string };
        setConfig({ carPhotoUrl: j.url });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [isUa, setConfig]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-6 text-center transition hover:border-white/30"
      >
        {carPhotoUrl ? (
          <div
            className="aspect-video w-full overflow-hidden rounded-lg bg-cover bg-center"
            style={{ backgroundImage: `url(${carPhotoUrl})` }}
          />
        ) : (
          <p className="text-sm text-white/60">
            {isUa
              ? "Перетягніть фото свого авто сюди або натисніть нижче"
              : "Drag a photo of your car here or click below"}
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-4 rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.18em] text-white/80 transition hover:border-white/50 hover:text-white disabled:opacity-50"
        >
          {uploading
            ? isUa
              ? "Завантажую…"
              : "Uploading…"
            : carPhotoUrl
              ? isUa
                ? "Замінити фото"
                : "Replace photo"
              : isUa
                ? "Обрати файл"
                : "Choose file"}
        </button>
      </div>

      {error && <p className="text-xs text-rose-300/90">{error}</p>}

      <p className="text-xs leading-relaxed text-white/40">
        {isUa
          ? "Найкраще працює бічне фото авто на чистому фоні. Максимум 8 МБ. Фото зберігається лише для прив'язки до вашого замовлення."
          : "Side-on shots on a clean background work best. 8 MB max. The photo is stored only to attach to your quote."}
      </p>
    </div>
  );
}
