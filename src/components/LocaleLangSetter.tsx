"use client";

import { useEffect } from "react";

type Props = { locale: string };

export default function LocaleLangSetter({ locale }: Props) {
  useEffect(() => {
    const html = document.documentElement;
    const newLang = locale === "ua" ? "uk" : "en";
    html.lang = newLang;
    if (newLang === "uk") {
      html.classList.add("locale-ua");
      // Set root-level font variables to literal Manrope font family string
      html.style.setProperty(
        "--font-sans",
        "'Manrope','Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      );
      html.style.setProperty(
        "--font-display",
        "'Manrope','Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      );
      html.style.setProperty(
        "--font-body",
        "'Manrope','Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
      );
    } else {
      html.classList.remove("locale-ua");
      // Remove UA-specific overrides so we fallback to root defaults
      html.style.removeProperty("--font-sans");
      html.style.removeProperty("--font-display");
      html.style.removeProperty("--font-body");
    }
  }, [locale]);
  return null;
}
