"use client";

import { Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ORDER_FLOW,
  ORDER_STATUS_INFO,
  orderNextStep,
  orderStatusLabel,
  type OrderStatusCode,
} from "@/lib/admin/orderWorkflow";
import { daysSince } from "./orderFormat";

type WorkflowOrder = {
  status: string;
  paymentStatus: string;
  amountPaid: number;
  isDraft?: boolean;
};

/**
 * The top of the order card: where the order is in its path and the one or two
 * buttons that move it on. Mistakes are fixed with «Повернути на …», not by hunting
 * through a select.
 */
export function OrderWorkflowPanel({
  order,
  statusSince,
  disabled,
  onMove,
  onChoose,
}: {
  order: WorkflowOrder;
  statusSince?: string | null;
  disabled?: boolean;
  onMove: (target: OrderStatusCode) => void;
  onChoose: () => void;
}) {
  const step = orderNextStep(order);
  const status = order.status as OrderStatusCode;
  const closed = status === "CANCELLED" || status === "REFUNDED";
  const currentIndex = ORDER_FLOW.indexOf(status);
  const waitingDays = statusSince ? daysSince(statusSince) : null;

  return (
    <section
      aria-label="Статус замовлення"
      className={cn(
        "@container border bg-[#151515]",
        closed ? "border-red-500/30" : "border-white/10"
      )}
    >
      {closed ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-red-500/20 bg-red-500/[0.07] px-5 py-3">
          <span className="bg-red-500/20 px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-red-200">
            {orderStatusLabel(status)}
          </span>
          <span className="text-[13px] text-red-100/80">{ORDER_STATUS_INFO[status].description}</span>
        </div>
      ) : (
        <ol className="grid grid-cols-6 border-b border-white/10" aria-label="Етапи замовлення">
          {ORDER_FLOW.map((flowStatus, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            return (
              <li
                key={flowStatus}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1 border-r border-white/[0.06] px-2 py-2.5 last:border-r-0 @2xl:px-3",
                  current && "bg-blue-500/[0.12]",
                  done && "bg-white/[0.02]"
                )}
              >
                {current ? <span className="absolute inset-x-0 top-0 h-[3px] bg-blue-400" /> : null}
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center text-[11px] font-semibold",
                    done
                      ? "bg-emerald-500/20 text-emerald-300"
                      : current
                        ? "bg-blue-500 text-white"
                        : "border border-white/15 text-zinc-500"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[11px] leading-[14px] break-words @xl:line-clamp-2 @4xl:text-[12px]",
                    current ? "font-semibold text-white" : done ? "text-zinc-400" : "text-zinc-600"
                  )}
                >
                  {ORDER_STATUS_INFO[flowStatus].label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-col gap-4 px-5 py-4 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="min-w-0">
          {!closed ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[17px] font-semibold text-white">{orderStatusLabel(status)}</span>
              {waitingDays !== null ? (
                <span
                  className={cn(
                    "text-[12px]",
                    waitingDays >= 7 && status !== "DELIVERED" ? "text-amber-300" : "text-zinc-500"
                  )}
                >
                  {waitingDays === 0 ? "з сьогодні" : `уже ${waitingDays} дн.`}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="mt-1 max-w-[60ch] text-[13px] leading-5 text-zinc-400">{step.hint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 @3xl:justify-end">
          {step.primary ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onMove(step.primary!.to)}
              className="bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {step.primary.label}
            </button>
          ) : null}
          {step.secondary ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onMove(step.secondary!.to)}
              className="border border-white/20 px-4 py-2.5 text-[14px] text-zinc-100 transition hover:bg-white/5 disabled:opacity-50"
            >
              {step.secondary.label}
            </button>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            {step.back ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove(step.back!.to)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {step.back.label}
              </button>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={onChoose}
              className="px-2.5 py-2 text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Інший статус…
            </button>
            {step.canCancel ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onMove("CANCELLED")}
                className="px-2.5 py-2 text-[13px] text-red-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
              >
                Скасувати замовлення
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
