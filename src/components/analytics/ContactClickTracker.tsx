"use client";

import { useEffect } from "react";
import { trackEvent, trackSocialClick, trackTelegramClick } from "@/lib/analytics";

type Channel = "phone" | "email" | "telegram" | "whatsapp" | "viber" | "instagram" | "facebook";

export function contactChannel(href: string): Channel | null {
  const lower = href.trim().toLowerCase();
  if (lower.startsWith("tel:")) return "phone";
  if (lower.startsWith("mailto:")) return "email";
  if (lower.startsWith("tg:") || /^https?:\/\/(www\.)?(t\.me|telegram\.me)\//.test(lower))
    return "telegram";
  if (/^https?:\/\/(www\.)?(wa\.me|api\.whatsapp\.com|whatsapp\.com)\//.test(lower))
    return "whatsapp";
  if (lower.startsWith("viber:")) return "viber";
  if (/^https?:\/\/(www\.)?instagram\.com\//.test(lower)) return "instagram";
  if (/^https?:\/\/(www\.|m\.)?facebook\.com\//.test(lower)) return "facebook";
  return null;
}

/**
 * One listener for the whole site: every click on a phone / email / messenger / social
 * link is sent to analytics, wherever the link lives (header, footer, product page…).
 * `data-track-label` on the link (or a parent) names the button in the event.
 */
export default function ContactClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      const channel = contactChannel(href);
      if (!channel) return;
      const label = link.closest("[data-track-label]")?.getAttribute("data-track-label");
      if (label) trackEvent("cta_click", { cta_label: label, cta_destination: href });
      // No number / address in the event: Meta flags anything that looks like personal data.
      else if (channel === "phone" || channel === "email") trackEvent(`click_${channel}`);
      else if (channel === "telegram") trackTelegramClick(href);
      else trackSocialClick(channel, href);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
