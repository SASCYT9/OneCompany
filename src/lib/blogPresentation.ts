import type { BlogPost } from "@/types/site-content";

export const blogAuthorName = "One Company";

export function getBlogCover(post: BlogPost) {
  return (
    post.cover?.src ??
    post.media.find((item) => item.type === "image")?.src ??
    post.media.find((item) => item.type === "video" && item.poster)?.poster
  );
}

export function formatBlogDate(date: string, locale: "ua" | "en") {
  return new Intl.DateTimeFormat(locale === "ua" ? "uk-UA" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(date));
}
