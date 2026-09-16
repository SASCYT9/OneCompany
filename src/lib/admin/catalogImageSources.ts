import { SHOP_REMOTE_IMAGE_HOSTS } from "@/lib/shopImageHosts";

export function catalogImageSources(values: unknown[]): string[] {
  return [
    ...new Set(
      values.flatMap((value) => {
        if (typeof value !== "string") return [];
        const src = value.trim();
        if (!src || src.includes("\\")) return [];
        if (src.startsWith("/") && !src.startsWith("//")) return [src];
        try {
          const url = new URL(src);
          if (url.username || url.password) return [];
          if (url.protocol === "https:") return [url.href];
          // A few legacy supplier records still contain HTTP URLs. Upgrade
          // only known image hosts so browser mixed-content blocking does not
          // make otherwise valid catalog photos disappear.
          if (url.protocol === "http:" && SHOP_REMOTE_IMAGE_HOSTS.includes(url.hostname)) {
            url.protocol = "https:";
            return [url.href];
          }
          return [];
        } catch {
          return [];
        }
      })
    ),
  ].slice(0, 8);
}
