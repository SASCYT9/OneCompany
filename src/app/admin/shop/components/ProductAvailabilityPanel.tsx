"use client";

import { AlertTriangle, CheckCircle2, Clock3, PackageCheck, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

export type ProductAvailabilityState = {
  stock: "inStock" | "preOrder" | "inTransit";
  showInStock: boolean;
  showInCarousel: boolean;
  leadTimeUa: string;
  leadTimeEn: string;
};

type CustomerAvailability = "inStock" | "inTransit" | "preOrder";

/** Mirrors getShopConfirmedAvailability: only inStock + showInStock earns the badge. */
export function customerAvailabilityOf(state: ProductAvailabilityState): CustomerAvailability {
  if (state.stock === "inTransit") return "inTransit";
  return state.stock === "inStock" && state.showInStock ? "inStock" : "preOrder";
}

const OPTIONS: Array<{
  value: CustomerAvailability;
  title: string;
  description: string;
  icon: typeof PackageCheck;
  patch: Partial<ProductAvailabilityState>;
}> = [
  {
    value: "inStock",
    title: "В наявності",
    description: "Є на нашому складі — відправляємо одразу.",
    icon: PackageCheck,
    patch: { stock: "inStock", showInStock: true },
  },
  {
    value: "inTransit",
    title: "В дорозі",
    description: "Вже замовлено і їде до нас.",
    icon: Truck,
    patch: { stock: "inTransit", showInStock: false, showInCarousel: false },
  },
  {
    value: "preOrder",
    title: "Під замовлення",
    description: "Замовляємо у постачальника після оплати.",
    icon: Clock3,
    patch: { stock: "preOrder", showInStock: false, showInCarousel: false },
  },
];

const LEAD_TIMES: Array<[string, string]> = [
  ["1–2 тижні", "1–2 weeks"],
  ["2–3 тижні", "2–3 weeks"],
  ["3–4 тижні", "3–4 weeks"],
  ["4–6 тижнів", "4–6 weeks"],
  ["6–8 тижнів", "6–8 weeks"],
];

export function ProductAvailabilityPanel({
  state,
  onChange,
  variantQuantity,
  quantitySyncNote,
}: {
  state: ProductAvailabilityState;
  onChange: (patch: Partial<ProductAvailabilityState>) => void;
  /** Sum of variant quantities; informational only. */
  variantQuantity: number;
  quantitySyncNote?: string;
}) {
  const current = customerAvailabilityOf(state);
  const legacyHiddenStock = state.stock === "inStock" && !state.showInStock;

  return (
    <div className="@container space-y-5">
      <div className="grid gap-2 @xl:grid-cols-3" role="radiogroup" aria-label="Наявність товару">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.patch)}
              className={cn(
                "flex items-start gap-3 border px-4 py-3.5 text-left transition",
                active
                  ? "border-blue-500 bg-blue-500/[0.08]"
                  : "border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03]"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  active ? "text-blue-400" : "text-zinc-500"
                )}
                aria-hidden="true"
              />
              <span>
                <span
                  className={cn(
                    "block text-[14px] font-semibold",
                    active ? "text-white" : "text-zinc-200"
                  )}
                >
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-5 text-zinc-500">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {legacyHiddenStock ? (
        <p className="flex items-start gap-2 border-l-2 border-amber-400 bg-amber-400/[0.06] px-3 py-2 text-[12px] leading-5 text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Раніше тут стояло «У наявності» без показу на сайті, тому покупці бачили товар як «Під
          замовлення». Якщо товар справді є на складі — оберіть «В наявності».
        </p>
      ) : null}

      <div className="border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          Покупець бачить
        </div>
        {current === "inStock" ? (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-2 py-1 text-[13px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />В наявності
          </span>
        ) : (
          <span className="text-[13px] text-zinc-300">
            Без позначки «В наявності»
            {state.leadTimeUa ? (
              <>
                {" "}
                · термін постачання{" "}
                <strong className="font-semibold text-white">{state.leadTimeUa}</strong>
              </>
            ) : (
              " · термін постачання не вказано"
            )}
          </span>
        )}
      </div>

      {current === "inStock" ? (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.showInCarousel}
            onChange={(event) => onChange({ showInCarousel: event.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
          />
          <span>
            <span className="block text-[14px] font-medium text-zinc-100">
              Показувати в каруселі «В наявності» в каталозі
            </span>
            <span className="block text-[12px] leading-5 text-zinc-500">
              Для фізичних товарів зі складу. Ліцензії та цифрові товари зазвичай не додають.
            </span>
          </span>
        </label>
      ) : (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
            Термін постачання
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_TIMES.map(([ua, en]) => (
              <button
                key={ua}
                type="button"
                onClick={() => onChange({ leadTimeUa: ua, leadTimeEn: en })}
                className={cn(
                  "border px-3 py-1.5 text-[13px] transition",
                  state.leadTimeUa === ua
                    ? "border-blue-500 bg-blue-500/[0.1] text-white"
                    : "border-white/[0.1] text-zinc-300 hover:border-white/[0.25]"
                )}
              >
                {ua}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 @md:grid-cols-2">
            <LeadTimeInput
              label="Свій варіант · українською"
              value={state.leadTimeUa}
              placeholder="напр. 10–14 днів"
              onChange={(value) => onChange({ leadTimeUa: value })}
            />
            <LeadTimeInput
              label="English"
              value={state.leadTimeEn}
              placeholder="e.g. 10–14 days"
              onChange={(value) => onChange({ leadTimeEn: value })}
            />
          </div>
        </div>
      )}

      <p className="border-t border-white/[0.06] pt-4 text-[12px] leading-5 text-zinc-500">
        Кількість у варіантах:{" "}
        <strong className="font-semibold text-zinc-300">{variantQuantity} шт.</strong> Це довідкове
        число: позначку на сайті задає вибір вище.
        {quantitySyncNote ? ` ${quantitySyncNote}` : ""}
      </p>
    </div>
  );
}

function LeadTimeInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-zinc-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full border border-white/[0.12] bg-[#0E0E0E] px-3 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-hidden"
      />
    </label>
  );
}
