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
      // Disable special font feature settings on UA to avoid glyph fallback
      // Save prior value so we can restore later
      const priorFFS = document.body.style.fontFeatureSettings;
      (document.body as HTMLElement).dataset.priorFontFeatureSettings = priorFFS || "";
      document.body.style.fontFeatureSettings = "normal";
      // Save prior font-family and set inline body.fontFamily to Manrope for immediate effect
      const priorFontFamily = document.body.style.fontFamily;
      (document.body as HTMLElement).dataset.priorFontFamily = priorFontFamily || "";
      document.body.style.fontFamily = "'Manrope','Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    } else {
      html.classList.remove("locale-ua");
      // Remove UA-specific overrides so we fallback to root defaults
      html.style.removeProperty("--font-sans");
      html.style.removeProperty("--font-display");
      html.style.removeProperty("--font-body");
      // Restore prior font-feature-settings value if any
      const priorFFSRestore = (document.body as HTMLElement).dataset.priorFontFeatureSettings || "";
      document.body.style.fontFeatureSettings = priorFFSRestore;
      // Restore prior inline body font-family if any
      const priorFontFamilyRestore = (document.body as HTMLElement).dataset.priorFontFamily || "";
      document.body.style.fontFamily = priorFontFamilyRestore;
    }
  }, [locale]);
  return null;
}
