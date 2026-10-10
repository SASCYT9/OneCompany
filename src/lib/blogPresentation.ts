import type { BlogMedia, BlogPost } from "@/types/site-content";

export const blogAuthorName = "One Company";

export function getBlogCover(post: BlogPost) {
  return (
    post.cover?.src ??
    post.media.find((item) => item.type === "image")?.src ??
    post.media.find((item) => item.type === "video" && item.poster)?.poster
  );
}

// A cover belongs to the media it was selected/extracted from. Keep it when
// unrelated media are added; discard it when its source is removed or replaced.
export function updateBlogMedia(post: BlogPost, media: BlogMedia[]): BlogPost {
  if (!post.cover) return { ...post, media };
  const coverSrc = post.cover.src;
  const sources = post.media.filter((item) => item.src === coverSrc || item.poster === coverSrc);
  const sourceUnchanged = (source: BlogMedia) =>
    media.some(
      (item) =>
        item.id === source.id &&
        item.type === source.type &&
        item.src === source.src &&
        item.poster === source.poster
    );
  // Older video posts store the extracted cover separately from their poster.
  // Appending media is safe if all original media are still unchanged.
  const unchangedSource = sources.length
    ? sources.some(sourceUnchanged)
    : post.media.every(sourceUnchanged);
  if (unchangedSource) return { ...post, media };
  return {
    ...post,
    cover: undefined,
    media: media.map((item) => {
      const source = post.media.find((source) => source.id === item.id);
      return source &&
        source.src !== item.src &&
        (item.poster === coverSrc || item.poster === source.poster)
        ? { ...item, poster: undefined }
        : item;
    }),
  };
}

export function formatBlogDate(date: string, locale: "ua" | "en") {
  return new Intl.DateTimeFormat(locale === "ua" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(date));
}

export function getBlogDateInput(date: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Kyiv",
  }).formatToParts(new Date(date));
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
