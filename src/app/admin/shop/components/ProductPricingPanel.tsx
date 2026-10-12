"use client";

import { useState, type ReactNode } from "react";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Info, RefreshCw, Truck } from "lucide-react";

import {
  b2bDiscountForBrand,
  customerMoney,
  discountPercent,
  isAtomicManagedBrand,
  isRevozportManagedBrand,
  priceBandPatch,
  priceFormulaText,
  PRODUCT_PRICE_CURRENCIES,
  readPriceBand,
  switchPriceBandCurrency,
  type CustomerMoney,
  type PriceFormLike,
} from "@/lib/admin/productPriceEditor";
import type { ShopCurrencyCode } from "@/lib/shopCurrencyDefaults";
import { cn } from "@/lib/utils";

export type ProductB2bContext = {
  defaultB2bDiscountPercent: number | null;
  brandB2bDiscounts: Record<string, number>;
};

const SYMBOL: Record<ShopCurrencyCode, string> = { EUR: "€", USD: "$", UAH: "грн" };

function formatMoney(value: number, currency: ShopCurrencyCode) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "UAH" ? 0 : 2,
    maximumFractionDigits: currency === "UAH" ? 0 : 2,
  }).format(value);
}

function formatAmount(value: number) {
  return value > 0 ? String(Math.round(value * 100) / 100) : "";
}

function scaled(money: CustomerMoney, factor: number): CustomerMoney {
  return { eur: money.eur * factor, usd: money.usd * factor, uah: money.uah * factor };
}

/**
 * One amount + one currency per price; everything else is derived and shown as
 * "what the customer pays". Used for the product and for each variant.
 */
export function ProductPricingPanel({
  form,
  rates,
  brand,
  b2bContext,
  onPatch,
  compact = false,
  notice,
}: {
  form: PriceFormLike;
  rates: Record<string, number>;
  brand: string;
  b2bContext: ProductB2bContext | null;
  onPatch: (patch: Record<string, string>) => void;
  /** Variant mode: no brand banners, no Europe price block. */
  compact?: boolean;
  notice?: ReactNode;
}) {
  const retail = readPriceBand(form, "price");
  // Currency picked before an amount is typed lives here until the amount exists.
  const [pendingCurrency, setPendingCurrency] = useState<ShopCurrencyCode>("EUR");
  const currency: ShopCurrencyCode = retail.currency ?? pendingCurrency;
  const retailMoney = customerMoney(form, "price", rates);
  const compare = readPriceBand(form, "compareAt");
  const compareMoney = customerMoney(form, "compareAt", rates);
  // Feeds often store compare-at == price ("no sale"); only a real markdown opens the block.
  const [showCompare, setShowCompare] = useState(
    Boolean(retailMoney && compareMoney && compareMoney.uah > retailMoney.uah)
  );
  const b2bExplicit = readPriceBand(form, "b2bPrice");
  const [b2bPendingCurrency, setB2bPendingCurrency] = useState<ShopCurrencyCode | null>(null);
  const b2bCurrency = b2bExplicit.currency ?? b2bPendingCurrency ?? currency;
  const [b2bMode, setB2bMode] = useState<"rules" | "custom">(
    b2bExplicit.isSet ? "custom" : "rules"
  );
  const atomic = !compact && isAtomicManagedBrand(brand);
  const revozport = !compact && isRevozportManagedBrand(brand);
  const discount =
    retailMoney && compareMoney ? discountPercent(retailMoney.uah, compareMoney.uah) : null;
  const rule = b2bContext ? b2bDiscountForBrand(brand, b2bContext) : null;

  function changeCurrency(next: ShopCurrencyCode) {
    if (next === currency) return;
    setPendingCurrency(next);
    if (!retail.isSet) return;
    onPatch({
      ...switchPriceBandCurrency(form, "price", next, rates),
      ...(compare.isSet ? switchPriceBandCurrency(form, "compareAt", next, rates) : {}),
    });
  }

  return (
    <div className="@container space-y-5">
      {atomic ? (
        <Banner icon={<RefreshCw className="h-4 w-4" />} tone="blue">
          <strong className="font-semibold text-zinc-100">Ціну оновлює прайс Atomic.</strong> Кожні
          3 години: ціна Atomic у гривнях ÷ 52 = ціна в євро (мото — ще −3%). Якщо артикул є в
          прайсі, ручну зміну буде перезаписано під час наступного оновлення.
        </Banner>
      ) : null}
      {revozport ? (
        <Banner icon={<Truck className="h-4 w-4" />} tone="neutral">
          Для покупців з України до ціни автоматично додається доставка Revozport (за вагою, у
          доларах). Тому вводьте ціну в <strong className="text-zinc-100">USD</strong>.
        </Banner>
      ) : null}
      {notice}

      <div>
        <FieldLabel>Роздрібна ціна</FieldLabel>
        <MoneyInput
          amount={retail.amount}
          currency={currency}
          onAmount={(amount) => onPatch(priceBandPatch("price", amount, currency, rates))}
          onCurrency={changeCurrency}
          placeholder="Ціна не задана"
        />
        <CustomerView
          money={retailMoney}
          compareMoney={showCompare ? compareMoney : null}
          discount={showCompare ? discount : null}
          empty={
            compact
              ? "Своєї ціни немає — варіант продається за ціною товару."
              : "Без ціни покупець бачить «Ціна за запитом»."
          }
        />
        {retail.currency ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-5 text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {priceFormulaText(currency, rates)}
          </p>
        ) : null}
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <Toggle
          checked={showCompare}
          onChange={(checked) => {
            setShowCompare(checked);
            if (!checked && compare.isSet)
              onPatch(priceBandPatch("compareAt", null, currency, rates));
          }}
          label="Показувати стару (закреслену) ціну"
          hint="Для розпродажу: покупець бачить стару ціну перекресленою і відсоток знижки."
        />
        {showCompare ? (
          <div className="mt-3 max-w-sm">
            <MoneyInput
              amount={
                compareMoney ? compareMoney[currency.toLowerCase() as keyof CustomerMoney] : 0
              }
              currency={currency}
              onAmount={(amount) => onPatch(priceBandPatch("compareAt", amount, currency, rates))}
              placeholder="Стара ціна"
            />
            {compareMoney && retailMoney && !discount ? (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Стара ціна має бути більшою за поточну — інакше знижка на сайті не показується.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <FieldLabel>Оптова ціна · B2B</FieldLabel>
        <div className="grid gap-2 @md:grid-cols-2">
          <Choice
            active={b2bMode === "rules"}
            onClick={() => {
              setB2bMode("rules");
              if (b2bExplicit.isSet)
                onPatch({
                  ...priceBandPatch("b2bPrice", null, currency, rates),
                  ...priceBandPatch("b2bCompareAt", null, currency, rates),
                });
            }}
            title="За правилами знижок"
            description={
              !b2bContext
                ? "Знижки з розділу «Ціни»"
                : rule
                  ? `−${rule.percent}% ${rule.source === "brand" ? `для бренду ${brand.toUpperCase()}` : "знижка за замовчуванням"}`
                  : "Знижок не налаштовано"
            }
          />
          <Choice
            active={b2bMode === "custom"}
            onClick={() => setB2bMode("custom")}
            title="Своя оптова ціна"
            description="Фіксована ціна тільки для цього товару"
          />
        </div>
        {b2bMode === "rules" ? (
          <p className="mt-3 text-[13px] leading-5 text-zinc-400">
            {!b2bContext ? (
              "Схвалені B2B-клієнти отримують знижку за правилами бренду або персональну знижку з профілю."
            ) : rule && retailMoney ? (
              <>
                Схвалені B2B-клієнти бачать{" "}
                <strong className="font-semibold text-zinc-100">
                  {formatMoney(scaled(retailMoney, 1 - rule.percent / 100).uah, "UAH")}
                </strong>{" "}
                (роздрібна −{rule.percent}%). Персональна знижка клієнта має пріоритет.
              </>
            ) : (
              "Схвалені B2B-клієнти бачать роздрібну ціну, якщо в їхньому профілі немає персональної знижки."
            )}{" "}
            <Link
              href="/admin/shop/pricing"
              className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300"
            >
              Знижки брендів <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </p>
        ) : (
          <div className="mt-3 max-w-sm">
            <MoneyInput
              amount={b2bExplicit.amount}
              currency={b2bCurrency}
              onAmount={(amount) => onPatch(priceBandPatch("b2bPrice", amount, b2bCurrency, rates))}
              onCurrency={(next) => {
                setB2bPendingCurrency(next);
                if (b2bExplicit.isSet)
                  onPatch(switchPriceBandCurrency(form, "b2bPrice", next, rates));
              }}
              placeholder="Оптова ціна"
            />
            <CustomerView money={customerMoney(form, "b2bPrice", rates)} compact />
          </div>
        )}
      </div>

      {!compact ? (
        <div className="border-t border-white/[0.06] pt-4">
          <FieldLabel>Ціна для Європи · € без ПДВ</FieldLabel>
          <div className="max-w-sm">
            <MoneyInput
              amount={Number(form.priceEurEurope) || 0}
              currency="EUR"
              onAmount={(amount) =>
                onPatch({ priceEurEurope: amount && amount > 0 ? String(amount) : "" })
              }
              placeholder="Як роздрібна"
            />
          </div>
          <p className="mt-2 text-[12px] leading-5 text-zinc-500">
            Для покупців з ЄС. Якщо порожньо — вони бачать звичайну ціну в євро.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
      {children}
    </div>
  );
}

function Banner({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: "blue" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-l-2 px-4 py-3 text-[13px] leading-5 text-zinc-400",
        tone === "blue" ? "border-blue-500 bg-blue-500/[0.07]" : "border-zinc-500 bg-white/[0.03]"
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone === "blue" ? "text-blue-400" : "text-zinc-400")}>
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function MoneyInput({
  amount,
  currency,
  onAmount,
  onCurrency,
  placeholder,
}: {
  amount: number;
  currency: ShopCurrencyCode;
  onAmount: (amount: number | null) => void;
  onCurrency?: (currency: ShopCurrencyCode) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? formatAmount(amount);

  return (
    <div className="flex h-12 w-full max-w-md items-stretch border border-white/[0.12] bg-[#0E0E0E] focus-within:border-blue-500">
      <span className="flex min-w-10 shrink-0 items-center justify-center border-r border-white/[0.08] px-2 text-[14px] text-zinc-500">
        {SYMBOL[currency]}
      </span>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          setDraft(raw);
          if (raw === "") onAmount(null);
          else if (/^\d+(\.\d{0,2})?$/.test(raw) && Number(raw) > 0) onAmount(Number(raw));
        }}
        onBlur={() => setDraft(null)}
        className="min-w-0 flex-1 bg-transparent px-3 text-[18px] font-semibold tabular-nums text-zinc-50 placeholder:text-[14px] placeholder:font-normal placeholder:text-zinc-600 focus:outline-hidden"
      />
      {onCurrency ? (
        <div
          className="flex shrink-0 border-l border-white/[0.08]"
          role="radiogroup"
          aria-label="Валюта ціни"
        >
          {PRODUCT_PRICE_CURRENCIES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === currency}
              onClick={() => onCurrency(option)}
              className={cn(
                "w-14 text-[12px] font-semibold tracking-wide transition",
                option === currency
                  ? "bg-blue-600 text-white"
                  : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <span className="flex w-14 shrink-0 items-center justify-center border-l border-white/[0.08] text-[12px] font-semibold text-zinc-500">
          {currency}
        </span>
      )}
    </div>
  );
}

function CustomerView({
  money,
  compareMoney,
  discount,
  empty,
  compact,
}: {
  money: CustomerMoney | null;
  compareMoney?: CustomerMoney | null;
  discount?: number | null;
  empty?: string;
  compact?: boolean;
}) {
  if (!money) {
    return empty ? <p className="mt-3 text-[13px] text-zinc-500">{empty}</p> : null;
  }
  return (
    <div
      className={cn(
        "mt-3 border border-white/[0.08] bg-white/[0.02]",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}
    >
      {!compact ? (
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          Покупець бачить
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span
          className={cn(
            "font-semibold tabular-nums text-white",
            compact ? "text-[15px]" : "text-[22px]"
          )}
        >
          {formatMoney(money.uah, "UAH")}
        </span>
        {compareMoney && discount ? (
          <>
            <span className="text-[14px] tabular-nums text-zinc-500 line-through">
              {formatMoney(compareMoney.uah, "UAH")}
            </span>
            <span className="bg-red-500/15 px-1.5 py-0.5 text-[12px] font-semibold text-red-300">
              −{discount}%
            </span>
          </>
        ) : null}
        <span className="text-[13px] tabular-nums text-zinc-400">
          {formatMoney(money.eur, "EUR")}
        </span>
        <span className="text-[13px] tabular-nums text-zinc-400">
          {formatMoney(money.usd, "USD")}
        </span>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
      />
      <span>
        <span className="block text-[14px] font-medium text-zinc-100">{label}</span>
        {hint ? <span className="block text-[12px] leading-5 text-zinc-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Choice({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start border px-4 py-3 text-left transition",
        active
          ? "border-blue-500 bg-blue-500/[0.08]"
          : "border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03]"
      )}
    >
      <span className={cn("text-[14px] font-semibold", active ? "text-white" : "text-zinc-200")}>
        {title}
      </span>
      <span className="mt-0.5 text-[12px] text-zinc-500">{description}</span>
    </button>
  );
}
