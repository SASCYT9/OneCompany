"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { inferVideoMimeType } from "@/lib/runtimeAssetPaths";

const STORAGE_KEY = "heroVideoDisabled";

export function HeroVideoWrapper({
  src,
  mobileSrc,
  poster,
  serverEnabled = true,
}: {
  src: string;
  mobileSrc?: string;
  poster?: string;
  serverEnabled?: boolean;
}) {
  const [disabled, setDisabled] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const t = useTranslations("admin");

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      setDisabled(value === "true");
    } catch {
      // ignore
    }

    function onToggle() {
      try {
        const value = localStorage.getItem(STORAGE_KEY);
        setDisabled(value === "true");
      } catch {
        // ignore
      }
    }

    window.addEventListener("heroVideoToggle", onToggle);
    window.addEventListener("storage", onToggle);
    return () => {
      window.removeEventListener("heroVideoToggle", onToggle);
      window.removeEventListener("storage", onToggle);
    };
  }, []);

  useEffect(() => {
    setVideoReady(false);
  }, [src, mobileSrc, serverEnabled, disabled]);

  const enabled = serverEnabled && !disabled;

  return (
    <>
      <div className="fixed inset-0 z-0 w-full h-full pointer-events-none">
        {/* Base layer — cream in light, near-black in dark. Light treatment
            uses only blur on the video (no darkening overlay) so the cream
            tone shows through and creates a soft editorial motion backdrop. */}
        <div className="absolute inset-0 bg-background" />

        {/* Poster image as fallback */}
        {poster && (
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
              videoReady ? "opacity-15 dark:opacity-20" : "opacity-30 dark:opacity-35"
            }`}
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}

        {/* Video.
            - Light theme: heavy blur, no opacity dimming, no overlay — pure
              motion painting on cream.
            - Dark theme: no blur, dimmed opacity, dark overlay — luxury
              cinematic depth. */}
        {enabled && (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className={`h-full w-full object-cover transition-opacity duration-700 blur-sm dark:blur-0 ${
              videoReady ? "opacity-70 dark:opacity-30" : "opacity-0"
            }`}
            poster={poster}
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            ref={(el) => {
              if (el && el.readyState >= 2 && !videoReady) {
                setVideoReady(true);
              }
              if (el && el.paused) {
                el.play().catch(() => {
                  /* autoplay blocked; poster will remain visible */
                });
              }
            }}
          >
            {mobileSrc && (
              <source
                src={mobileSrc}
                media="(max-width: 768px)"
                type={inferVideoMimeType(mobileSrc)}
              />
            )}
            <source src={src} type={inferVideoMimeType(src)} />
            <track kind="captions" />
          </video>
        )}

        {/* Overlay — only in dark theme. Light theme stays pure (just blur). */}
        <div className="absolute inset-0 bg-transparent dark:bg-black/60 pointer-events-none" />
      </div>
      {!serverEnabled && (
        <div className="fixed top-4 right-4 z-40 rounded-md bg-zinc-900/80 text-white px-3 py-1 text-xs">
          {t?.("heroVideoDisabledByAdmin") || "Hero video disabled"}
        </div>
      )}
    </>
  );
}

export default HeroVideoWrapper;
