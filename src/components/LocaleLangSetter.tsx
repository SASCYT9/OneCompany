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
    } else {
      html.classList.remove("locale-ua");
    }
  }, [locale]);
  return null;
}
