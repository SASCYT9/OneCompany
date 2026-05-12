"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DO88_COLLECTION_CARDS } from "../data/do88CollectionsList";

interface Do88CategoryFilterProps {
  locale: string;
  currentHandle: string;
  variant?: "horizontal" | "sidebar";
}

export default function Do88CategoryFilter({
  locale,
  currentHandle,
  variant = "horizontal",
}: Do88CategoryFilterProps) {
  const searchParams = useSearchParams();
  const brand = searchParams?.get("brand");
  const keyword = searchParams?.get("keyword");

  const isUa = locale === "ua";

  const buildCategoryUrl = (handle: string) => {
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (keyword) params.set("keyword", keyword);
    const q = params.toString();
    return `/${locale}/shop/do88/collections/${handle}${q ? `?${q}` : ""}`;
  };

  const categories = [
    { handle: "all", title: "All Parts", titleUa: "Всі деталі" },
    ...DO88_COLLECTION_CARDS.map((c) => ({
      handle: c.categoryHandle,
      title: c.title,
      titleUa: c.titleUk || c.title,
    })),
  ];

  if (variant === "sidebar") {
    return (
      <div
        className="flex flex-col gap-1 w-full do88-animate-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40 mb-3 ml-2">
          {isUa ? "Категорії" : "Categories"}
        </h3>
        {categories.map((cat) => {
          const isActive = currentHandle === cat.handle;
          return (
            <Link
              key={cat.handle}
              href={buildCategoryUrl(cat.handle)}
              className={`px-4 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
                isActive
                  ? "bg-foreground/12 text-foreground shadow-[inset_2px_0_0_#fff]"
                  : "text-foreground/75 dark:text-foreground/60 hover:text-foreground hover:bg-foreground/8"
              }`}
            >
              {isUa ? cat.titleUa : cat.title}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center overflow-x-auto gap-3 pb-2 pt-2 do88-animate-up"
      style={{ animationDelay: "0.2s" }}
    >
      {categories.map((cat) => {
        const isActive = currentHandle === cat.handle;
        return (
          <Link
            key={cat.handle}
            href={buildCategoryUrl(cat.handle)}
            className={`whitespace-nowrap px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
              isActive
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(213,0,28,0.35)] dark:shadow-[0_0_15px_rgba(194,157,89,0.4)]"
                : "bg-foreground/8 text-foreground/85 dark:text-foreground/70 hover:bg-foreground/12 hover:text-foreground border border-foreground/12"
            }`}
          >
            {isUa ? cat.titleUa : cat.title}
          </Link>
        );
      })}
    </div>
  );
}
