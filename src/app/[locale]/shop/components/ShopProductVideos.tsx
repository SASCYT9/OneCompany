"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import type { ShopExternalVideo } from "@/lib/shopProductVideo";

type Props = {
  videos: ShopExternalVideo[];
  title: string;
  isUa: boolean;
};

export function ShopProductVideos({ videos, title, isUa }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (videos.length === 0) return null;

  return (
    <section className="space-y-3 rounded-3xl border border-foreground/12 bg-card p-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/75 dark:text-foreground/65">
          {isUa ? "Відео звучання" : "Sound video"}
        </h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/45">{videos.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {videos.map((video, index) => {
          const isActive = activeIndex === index;
          return (
            <div key={video.src} className="overflow-hidden rounded-2xl border border-foreground/12 bg-black">
              <div className="relative aspect-video">
                {isActive ? (
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`${video.src}?autoplay=1&rel=0`}
                    title={`${title} — ${isUa ? "відео" : "video"} ${index + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className="group absolute inset-0 flex items-center justify-center overflow-hidden bg-zinc-950"
                    aria-label={`${isUa ? "Відтворити відео" : "Play video"}: ${title}`}
                  >
                    {/* YouTube thumbnail is only an image; the player loads after an explicit click. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105 group-hover:opacity-90"
                      loading="lazy"
                    />
                    <span className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/65 text-white shadow-xl transition group-hover:scale-110 group-hover:border-white/80">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
