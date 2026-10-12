"use client";

import type { ReactNode } from "react";

import { CheckCircle2, ExternalLink } from "lucide-react";

import { customerMoney, discountPercent } from "@/lib/admin/productPriceEditor";
import { buildShopStorefrontProductPath } from "@/lib/shopStorefrontRouting";
import { cn } from "@/lib/utils";

import { customerAvailabilityOf } from "./ProductAvailabilityPanel";

type SummaryForm = {
  slug: string;
  brand: string;
  vendor: string;
  storefront: string;
  status: string;
  isPublished: boolean;
  stock: "inStock" | "preOrder" | "inTransit";
  showInStock: boolean;
  showInCarousel: boolean;
  leadTimeUa: string;
  leadTimeEn: string;
} & Record<string, unknown>;

function uah(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 0,
  }).format(value);
}

/** The storefront's answer to "what does the customer see right now?" for unsaved edits too. */
export function ProductCustomerSummary({
  form,
  rates,
}: {
  form: SummaryForm;
  rates: Record<string, number>;
}) {
  const price = customerMoney(form, "price", rates);
  const compare = customerMoney(form, "compareAt", rates);
  const discount = price && compare ? discountPercent(price.uah, compare.uah) : null;
  const availability = customerAvailabilityOf(form);
  const live = form.status === "ACTIVE" && form.isPublished;
  const storefrontHref = form.slug
    ? buildShopStorefrontProductPath("ua", {
        slug: form.slug,
        brand: form.brand,
        vendor: form.vendor,
        tags: form.storefront && form.storefront !== "main" ? [`store:${form.storefront}`] : [],
      })
    : null;

  return (
    <section
      aria-label="Що бачить покупець"
      className="mb-5 grid border border-white/[0.08] bg-[#0F0F0F] sm:grid-cols-[1.4fr_1fr_1fr_auto]"
    >
      <Cell label="Ціна для покупця">
        {price ? (
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[22px] font-semibold tabular-nums leading-none text-white">
              {uah(price.uah)}
            </span>
            {discount && compare ? (
              <>
                <span className="text-[13px] tabular-nums text-zinc-500 line-through">
                  {uah(compare.uah)}
                </span>
                <span className="bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-red-300">
                  −{discount}%
                </span>
              </>
            ) : null}
          </span>
        ) : (
          <span className="text-[15px] font-medium text-amber-300">Ціна за запитом</span>
        )}
      </Cell>
      <Cell label="Наявність">
        {availability === "inStock" ? (
          <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />В наявності
          </span>
        ) : (
          <span className="text-[15px] font-medium text-zinc-200">
            {availability === "inTransit" ? "В дорозі" : "Під замовлення"}
            {form.leadTimeUa ? (
              <span className="block text-[12px] font-normal text-zinc-500">{form.leadTimeUa}</span>
            ) : null}
          </span>
        )}
      </Cell>
      <Cell label="На сайті">
        <span
          className={cn(
            "inline-flex items-center gap-2 text-[15px] font-medium",
            live ? "text-zinc-100" : "text-amber-300"
          )}
        >
          <span
            className={cn("h-2 w-2 shrink-0", live ? "bg-emerald-400" : "bg-amber-400")}
            aria-hidden="true"
          />
          {live
            ? "Показується"
            : form.status === "ARCHIVED"
              ? "В архіві"
              : form.status === "DRAFT"
                ? "Чернетка — не видно"
                : "Приховано"}
        </span>
      </Cell>
      <div className="flex items-center border-t border-white/[0.06] px-4 py-3 sm:border-l sm:border-t-0">
        {storefrontHref && live ? (
          <a
            href={storefrontHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-blue-400 hover:text-blue-300"
          >
            Відкрити на сайті <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[12px] text-zinc-600">Сторінка недоступна</span>
        )}
      </div>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] px-4 py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}
