"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function CatalogError({ error, reset }: { error: Error; reset: () => void }) {
  const pathname = usePathname();
  const locale = pathname.startsWith("/en/") ? "en" : "ua";
  const copy =
    locale === "ua"
      ? {
          title: "Каталог тимчасово недоступний",
          body: "Не вдалося завантажити товари. Спробуйте ще раз — ваші фільтри збережені в URL.",
          retry: "Повторити",
          reset: "Відкрити каталог без фільтрів",
        }
      : {
          title: "Catalog is temporarily unavailable",
          body: "Products could not be loaded. Try again — your filters remain in the URL.",
          retry: "Try again",
          reset: "Open catalog without filters",
        };

  useEffect(() => {
    console.error("Catalog V2 render failed", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-white px-6 text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-light sm:text-5xl">{copy.title}</h1>
        <p className="mt-5 text-zinc-500">{copy.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-zinc-950 px-6 py-3 text-sm text-white dark:bg-white dark:text-zinc-950"
          >
            {copy.retry}
          </button>
          <Link
            href={`/${locale}/shop/catalog`}
            className="border border-zinc-200 px-6 py-3 text-sm dark:border-white/10"
          >
            {copy.reset}
          </Link>
        </div>
      </div>
    </main>
  );
}
