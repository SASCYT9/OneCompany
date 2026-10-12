"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ORDER_CANCEL_REASONS,
  ORDER_STATUS_INFO,
  ORDER_STATUS_TRANSITIONS,
  orderHasMoney,
  orderStatusChangeProblem,
  orderStatusLabel,
  orderStatusMove,
  orderStatusMoveNeedsReason,
  ORDER_STATUS_PROBLEM_TEXT,
  type OrderStatusCode,
} from "@/lib/admin/orderWorkflow";
import { formatOrderDate, formatOrderMoney } from "./orderFormat";

export type StatusDialogOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  amountPaid: number;
  total: number;
  currency: string;
  isDraft?: boolean;
  ttnNumber?: string | null;
  monobankLink?: { url: string; expiresAt: string | null } | null;
};

const MANUAL_PAYMENT_METHODS = ["FOP", "MANAGER_QUOTE"];

function targetsFor(orders: StatusDialogOrder[]) {
  if (!orders.length) return [] as OrderStatusCode[];
  return (Object.keys(ORDER_STATUS_INFO) as OrderStatusCode[]).filter((candidate) =>
    orders.every(
      (order) =>
        order.status !== candidate &&
        ORDER_STATUS_TRANSITIONS[order.status as OrderStatusCode]?.includes(candidate)
    )
  );
}

/**
 * One dialog for every status change — single order or a bulk selection. It asks only
 * for what the move needs: a reason when cancelling or correcting, the TTN when shipping.
 */
export function OrderStatusDialog({
  open,
  orders,
  target: initialTarget,
  customerEmailsEnabled,
  onClose,
  onDone,
}: {
  open: boolean;
  orders: StatusDialogOrder[];
  /** null opens the «choose a status» step. */
  target: OrderStatusCode | null;
  customerEmailsEnabled: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Parents mount the dialog per opening (see `key`), so props seed the state once.
  const single = orders.length === 1 ? orders[0] : null;
  const from = single?.status ?? "";
  const [target, setTarget] = useState<OrderStatusCode | null>(initialTarget);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [ttn, setTtn] = useState(single?.ttnNumber ?? "");
  // Only the natural next step mails the customer by default; closing an old order by
  // jumping to «Доставлено» months later must not.
  const [notify, setNotify] = useState(
    () =>
      (initialTarget === "SHIPPED" && ["CONFIRMED", "PROCESSING"].includes(from)) ||
      (initialTarget === "DELIVERED" && from === "SHIPPED")
  );
  // Waiting for a bank transfer and confirming it is the same act for ФОП orders.
  const [markPaid, setMarkPaid] = useState(() =>
    Boolean(
      single &&
        initialTarget === "CONFIRMED" &&
        single.status === "PENDING_PAYMENT" &&
        !orderHasMoney(single) &&
        MANUAL_PAYMENT_METHODS.includes(single.paymentMethod)
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, saving]);

  const choices = useMemo(() => targetsFor(orders), [orders]);
  const problems = useMemo(() => {
    if (!target) return [];
    return orders
      .map((order) => ({ order, problem: orderStatusChangeProblem(order, target) }))
      .filter((entry) => entry.problem && entry.order.status !== target);
  }, [orders, target]);

  if (!open || !orders.length) return null;

  const move = target ? orderStatusMove(single ? from : orders[0].status, target) : "same";
  const isCancel = target === "CANCELLED";
  const needsNote =
    target !== null &&
    orders.some((order) => orderStatusMoveNeedsReason(order.status, target)) &&
    !isCancel;
  const paidOrders = orders.filter((order) => orderHasMoney(order));
  const openLinks = orders.filter(
    (order) => order.monobankLink || (order.paymentStatus === "PENDING" && !orderHasMoney(order))
  );
  // Confirming an unpaid card/crypto order means shipping before the money arrives.
  const unpaidProviderConfirm = Boolean(
    single &&
      target === "CONFIRMED" &&
      !orderHasMoney(single) &&
      !MANUAL_PAYMENT_METHODS.includes(single.paymentMethod)
  );
  const showTtn = Boolean(single && target === "SHIPPED");
  const showNotify =
    Boolean(single) &&
    customerEmailsEnabled &&
    move === "forward" &&
    (target === "SHIPPED" || target === "DELIVERED");
  const canMarkPaid = Boolean(
    single &&
      target === "CONFIRMED" &&
      ["PENDING_REVIEW", "PENDING_PAYMENT"].includes(single.status) &&
      !orderHasMoney(single) &&
      MANUAL_PAYMENT_METHODS.includes(single.paymentMethod)
  );

  const reasonMissing = isCancel
    ? !reason || (reason === "other" && !note.trim())
    : needsNote && !note.trim();
  const blocked = problems.length > 0;

  async function submit() {
    if (!target || reasonMissing || blocked || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = single
        ? await fetch(`/api/admin/shop/orders/${single.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: target,
              note,
              reason: isCancel ? reason : undefined,
              notifyCustomer: showNotify ? notify : false,
              ...(showTtn && ttn.trim() !== (single.ttnNumber ?? "")
                ? { ttnNumber: ttn.trim() }
                : {}),
              ...(canMarkPaid && markPaid
                ? { paymentStatus: "PAID", amountPaid: single.total }
                : {}),
            }),
          })
        : await fetch("/api/admin/shop/orders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderIds: orders.map((order) => order.id),
              status: target,
              note,
              reason: isCancel ? reason : undefined,
            }),
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.error === "string" && data.error
            ? data.error
            : "Не вдалося змінити статус. Спробуйте ще раз."
        );
        return;
      }
      onDone(
        single
          ? `${single.orderNumber}: статус «${orderStatusLabel(target)}».`
          : `Оновлено замовлень: ${data.updatedCount ?? orders.length}. Статус «${orderStatusLabel(target)}».`
      );
    } catch {
      setError("Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      setSaving(false);
    }
  }

  const title = single
    ? target
      ? `${single.orderNumber}: ${orderStatusLabel(single.status)} → ${orderStatusLabel(target)}`
      : `${single.orderNumber}: змінити статус`
    : target
      ? `${orders.length} замовл. → ${orderStatusLabel(target)}`
      : `Змінити статус ${orders.length} замовлень`;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Закрити"
        className="absolute inset-0 bg-black/70"
        onClick={() => (!saving ? onClose() : undefined)}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-[560px] flex-col border border-white/15 bg-[#141414] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {isCancel ? "Скасування" : move === "back" || move === "restore" ? "Виправлення статусу" : "Зміна статусу"}
            </div>
            <h2 className="mt-1 text-[16px] font-semibold leading-6 text-zinc-50">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Закрити"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!target ? (
            <div className="grid gap-1.5" role="radiogroup" aria-label="Новий статус">
              {choices.length ? (
                choices.map((candidate) => {
                  const candidateMove = orderStatusMove(orders[0].status, candidate);
                  const problem = orders
                    .map((order) => orderStatusChangeProblem(order, candidate))
                    .find(Boolean);
                  return (
                    <button
                      key={candidate}
                      type="button"
                      disabled={Boolean(problem)}
                      onClick={() => {
                        setTarget(candidate);
                        setMarkPaid(false);
                      }}
                      className={cn(
                        "flex items-start gap-3 border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-45",
                        candidate === "CANCELLED" && "border-red-500/25"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[14px] font-medium text-zinc-100">
                          {orderStatusLabel(candidate)}
                          {candidateMove === "back" || candidateMove === "restore" ? (
                            <span className="text-[11px] font-normal text-amber-300">повернення назад</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-zinc-500">
                          {problem
                            ? ORDER_STATUS_PROBLEM_TEXT[problem]
                            : ORDER_STATUS_INFO[candidate].description}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
                    </button>
                  );
                })
              ) : (
                <p className="text-[13px] text-zinc-400">
                  Для обраних замовлень немає спільного наступного статусу. Оберіть замовлення з
                  однаковим статусом.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="border-l-2 border-white/20 pl-3 text-[13px] leading-5 text-zinc-300">
                {ORDER_STATUS_INFO[target].description}
              </p>

              {blocked ? (
                <div className="border-l-2 border-red-400 bg-red-500/[0.08] px-3 py-2 text-[13px] leading-5 text-red-100">
                  {problems.map((entry) => (
                    <div key={entry.order.id}>
                      {orders.length > 1 ? `${entry.order.orderNumber}: ` : ""}
                      {ORDER_STATUS_PROBLEM_TEXT[entry.problem!]}
                    </div>
                  ))}
                </div>
              ) : null}

              {isCancel ? (
                <fieldset>
                  <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    Причина скасування
                  </legend>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {ORDER_CANCEL_REASONS.map((option) => (
                      <label
                        key={option.code}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 border px-3 py-2 text-[13px] transition",
                          reason === option.code
                            ? "border-red-400/60 bg-red-500/10 text-white"
                            : "border-white/10 text-zinc-300 hover:border-white/25"
                        )}
                      >
                        <input
                          type="radio"
                          name="cancel-reason"
                          value={option.code}
                          checked={reason === option.code}
                          onChange={() => setReason(option.code)}
                          className="accent-red-500"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {isCancel && paidOrders.length ? (
                <Warning>
                  {single
                    ? `Клієнт уже заплатив ${formatOrderMoney(single.amountPaid, single.currency)}.`
                    : `Серед обраних є оплачені замовлення (${paidOrders.map((order) => order.orderNumber).join(", ")}).`}{" "}
                  Після скасування поверніть гроші й позначте замовлення «Повернено».
                </Warning>
              ) : null}
              {isCancel && openLinks.length ? (
                <Warning>
                  {single?.monobankLink?.expiresAt
                    ? `Посилання mono на оплату ще дійсне до ${formatOrderDate(single.monobankLink.expiresAt)}.`
                    : "Клієнту вже видано посилання на оплату."}{" "}
                  Не надсилайте його клієнту: якщо він оплатить скасоване замовлення, гроші доведеться
                  повертати.
                </Warning>
              ) : null}
              {unpaidProviderConfirm ? (
                <Warning>
                  Оплата ще не надійшла (статус оплати «Не оплачено»). Оплата карткою чи криптою
                  підтвердить замовлення сама — підтверджуйте вручну, лише якщо домовилися з клієнтом
                  про оплату пізніше.
                </Warning>
              ) : null}

              {showTtn ? (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    Номер ТТН
                  </span>
                  <input
                    value={ttn}
                    onChange={(event) => setTtn(event.target.value)}
                    placeholder="20450000000000"
                    inputMode="numeric"
                    className="w-full border border-white/15 bg-black/40 px-3 py-2 font-mono text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/60 focus:outline-none"
                  />
                  <span className="mt-1 block text-[12px] text-zinc-500">
                    Можна додати пізніше в блоці «Відправлення».
                  </span>
                </label>
              ) : null}

              {canMarkPaid ? (
                <Checkbox checked={markPaid} onChange={setMarkPaid}>
                  Гроші надійшли — позначити замовлення оплаченим на{" "}
                  <strong className="text-white">{formatOrderMoney(single!.total, single!.currency)}</strong>
                </Checkbox>
              ) : null}

              {showNotify ? (
                <Checkbox checked={notify} onChange={setNotify}>
                  Надіслати клієнту лист «Замовлення {target === "SHIPPED" ? "відправлено" : "доставлено"}»
                </Checkbox>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                  {isCancel
                    ? reason === "other"
                      ? "Опишіть причину"
                      : "Коментар (необов’язково)"
                    : needsNote
                      ? "Чому змінюєте статус?"
                      : "Коментар (необов’язково)"}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder={
                    needsNote ? "Наприклад: помилково натиснули «Відправлено»" : "Буде видно в історії замовлення"
                  }
                  className="w-full resize-y border border-white/15 bg-black/40 px-3 py-2 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/60 focus:outline-none"
                />
              </label>

              {error ? (
                <div role="alert" className="border-l-2 border-red-400 bg-red-500/[0.08] px-3 py-2 text-[13px] leading-5 text-red-100">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          {target && !initialTarget ? (
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={saving}
              className="px-2 py-2 text-[13px] text-zinc-400 transition hover:text-white"
            >
              ← Інший статус
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border border-white/15 px-4 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5"
            >
              Не змінювати
            </button>
            {target ? (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={reasonMissing || blocked || saving}
                className={cn(
                  "px-4 py-2 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40",
                  isCancel ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                )}
              >
                {saving
                  ? "Зберігаємо…"
                  : isCancel
                    ? orders.length > 1
                      ? `Скасувати ${orders.length} замовл.`
                      : "Скасувати замовлення"
                    : `Змінити на «${orderStatusLabel(target)}»`}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 border-l-2 border-amber-400 bg-amber-400/[0.07] px-3 py-2 text-[13px] leading-5 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[13px] leading-5 text-zinc-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
      />
      <span>{children}</span>
    </label>
  );
}
