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
        {/* Base background — theme-aware so we don't paint black on cream */}
        <div className="absolute inset-0 bg-background" />

        {/* Poster image as fallback. On light theme we want it more visible
            so the underlying car imagery reads through the white-tint overlay. */}
        {poster && (
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
              videoReady ? "opacity-40 dark:opacity-20" : "opacity-55 dark:opacity-35"
            }`}
            style={{ backgroundImage: `url(${poster})` }}
          />
        )}

        {/* Video. Higher opacity in light because the white veil + light bg
            otherwise wash the video out. We also listen on multiple events
            because onCanPlay doesn't always fire reliably across browsers
            and the video can land at readyState=4 with opacity stuck at 0. */}
        {enabled && (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`h-full w-full object-cover transition-opacity duration-700 ${
              videoReady ? "opacity-65 dark:opacity-30" : "opacity-0"
            }`}
            poster={poster}
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            ref={(el) => {
              if (el && el.readyState >= 2 && !videoReady) {
                // Already loaded by the time React attaches — set ready immediately
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

        {/* Overlay. Soft cream veil on light (25%) keeps page readable but
            lets the video show through. Strong dark veil on dark (60%)
            preserves the original luxury ambient feel. */}
        <div className="absolute inset-0 bg-background/25 dark:bg-black/60 pointer-events-none" />
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
