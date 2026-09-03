const YOUTUBE_EMBED_HOSTS = new Set(["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"]);

export type ShopExternalVideo = {
  src: string;
  provider: "youtube";
  videoId: string;
};

function normalizeUrl(value: string) {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

/**
 * Converts approved YouTube URLs into a canonical, privacy-enhanced embed URL.
 * Do not render supplier HTML directly: descriptions are untrusted input.
 */
export function parseSupportedExternalVideo(value: string | null | undefined): ShopExternalVideo | null {
  const parsed = normalizeUrl(String(value ?? ""));
  if (!parsed || !YOUTUBE_EMBED_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const match = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,})\/?$/);
  if (!match) return null;

  const videoId = match[1];
  return {
    provider: "youtube",
    videoId,
    src: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

/** Extracts all supported video embeds while keeping their supplier order. */
export function extractSupportedExternalVideos(html: string | null | undefined) {
  const sources = Array.from(
    String(html ?? "").matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
    (match) => match[1]
  );
  const seen = new Set<string>();
  return sources.flatMap((source) => {
    const video = parseSupportedExternalVideo(source);
    if (!video || seen.has(video.src)) return [];
    seen.add(video.src);
    return [video];
  });
}
