"use client";

import { useEffect, useState } from "react";

import { Coins, Loader2, Plus, Trash2 } from "lucide-react";

import { AdminInspectorCard, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from "@/components/admin/AdminFormFields";
import { useToast } from "@/components/admin/AdminToast";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";

type CreditStatus = "ACTIVE" | "PARTIALLY_USED" | "FULLY_USED" | "EXPIRED" | "VOIDED";
type CreditType = "RETURN_REFUND" | "GOODWILL" | "PROMOTIONAL" | "ADJUSTMENT";

type Credit = {
  id: string;
  type: CreditType;
  status: CreditStatus;
  amount: number;
  amountUsed: number;
  remainingAmount: number;
  currency: string;
  reason: string | null;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  redemptions: Array<{
    id: string;
    amount: number;
    currency: string;
    redeemedAt: string;
    orderId: string | null;
    note: string | null;
  }>;
};

type CreditsData = {
  credits: Credit[];
  balanceByCurrency: Record<string, number>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusTone(s: CreditStatus): "default" | "success" | "warning" | "danger" {
  if (s === "ACTIVE") return "success";
  if (s === "PARTIALLY_USED") return "warning";
  if (s === "FULLY_USED") return "default";
  return "danger";
}

export function CustomerCreditPanel({
  customerId,
  preferredCurrency,
}: {
  customerId: string;
  preferredCurrency: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [showIssueForm, setShowIssueForm] = useState(false);

  // Issue form state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(preferredCurrency);
  const [type, setType] = useState<CreditType>("GOODWILL");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/customers/${customerId}/credits`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const d = await response.json();
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [customerId, reloadKey]);

  async function handleIssue() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.warning("Введіть додатну суму");
      return;
    }
    setIssuing(true);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          currency,
          type,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
          expiresAt: expiresAt || null,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error("Не вдалося нарахувати кредит", errData.error || "Спробуйте ще раз");
        return;
      }
      toast.success("Кредит нараховано", `${formatMoney(amt, currency)} для клієнта`);
      setAmount("");
      setReason("");
      setNotes("");
      setExpiresAt("");
      setShowIssueForm(false);
      setReloadKey((k) => k + 1);
    } finally {
      setIssuing(false);
    }
  }

  async function handleVoid(c: Credit) {
    const ok = await confirm({
      tone: "danger",
      title: "Анулювати цей кредит?",
      description: `${formatMoney(c.remainingAmount, c.currency)} невикористаного кредиту стане недоступним. Скасувати неможливо.`,
      confirmLabel: "Анулювати",
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/customers/${customerId}/credits/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOIDED" }),
    });
    if (!response.ok) {
      toast.error("Не вдалося анулювати");
      return;
    }
    toast.success("Кредит анульовано");
    setReloadKey((k) => k + 1);
  }

  return (
    <AdminInspectorCard
      title="Баланс кредиту"
      description="Реєстр магазинного кредиту, зручний для B2B. Нараховані кредити можна застосовувати до наступних замовлень."
    >
      {/* Balance summary */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
          Завантаження кредитів…
        </div>
      ) : data && Object.keys(data.balanceByCurrency).length > 0 ? (
        <div className="space-y-1.5">
          {Object.entries(data.balanceByCurrency).map(([cur, bal]) => (
            <div
              key={cur}
              className="flex items-center justify-between rounded-none border border-emerald-500/20 bg-emerald-500/4 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                  {cur}
                </span>
              </div>
              <span className="text-base font-bold text-emerald-200 tabular-nums">
                {formatMoney(bal, cur)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-none border border-dashed border-white/8 bg-black/20 p-3 text-center text-xs text-zinc-500">
          Немає активних кредитів.
        </div>
      )}

      {/* Issue button */}
      <div className="mt-3">
        {!showIssueForm ? (
          <button
            type="button"
            onClick={() => setShowIssueForm(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/6 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/12"
          >
            <Plus className="h-3 w-3" />
            Нарахувати кредит
          </button>
        ) : (
          <div className="space-y-3 rounded-none border border-blue-500/20 bg-blue-500/3 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <AdminInputField
                label="Сума"
                value={amount}
                onChange={setAmount}
                type="number"
                step="0.01"
                min={0}
              />
              <AdminSelectField
                label="Валюта"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "EUR", label: "EUR" },
                  { value: "USD", label: "USD" },
                  { value: "UAH", label: "UAH" },
                ]}
              />
            </div>
            <AdminSelectField
              label="Тип"
              value={type}
              onChange={(v) => setType(v as CreditType)}
              options={[
                { value: "GOODWILL", label: "Goodwill (рішення менеджера)" },
                { value: "RETURN_REFUND", label: "Повернення (B2B альтернатива Stripe)" },
                { value: "PROMOTIONAL", label: "Промо / маркетинг" },
                { value: "ADJUSTMENT", label: "Ручне коригування" },
              ]}
            />
            <AdminInputField
              label="Причина (коротко)"
              value={reason}
              onChange={setReason}
              placeholder="напр. компенсація за пошкоджене відправлення"
            />
            <AdminInputField
              label="Спливає (опціонально)"
              value={expiresAt}
              onChange={setExpiresAt}
              type="date"
            />
            <AdminTextareaField
              label="Внутрішні нотатки"
              value={notes}
              onChange={setNotes}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleIssue()}
                disabled={issuing || !amount}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none bg-blue-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {issuing ? (
                  <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Нарахувати
              </button>
              <button
                type="button"
                onClick={() => setShowIssueForm(false)}
                className="rounded-none border border-white/10 bg-white/3 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/6"
              >
                Скасувати
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent credits list */}
      {data && data.credits.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Останні кредити
          </div>
          {data.credits.slice(0, 6).map((c) => (
            <div key={c.id} className="rounded-none border border-white/5 bg-[#171717] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium tabular-nums text-zinc-100">
                      {formatMoney(c.amount, c.currency)}
                    </span>
                    <AdminStatusBadge tone={statusTone(c.status)}>
                      {c.status.replace("_", " ")}
                    </AdminStatusBadge>
                  </div>
                  {c.reason ? (
                    <div className="mt-0.5 truncate text-[11px] text-zinc-400">{c.reason}</div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-zinc-600">
                    {c.type.replace("_", " ").toLowerCase()} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString()}
                    {c.expiresAt ? ` · спливає ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                  </div>
                  {c.amountUsed > 0 ? (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      Використано:{" "}
                      <span className="text-zinc-300 tabular-nums">
                        {formatMoney(c.amountUsed, c.currency)}
                      </span>{" "}
                      · Залишок:{" "}
                      <span className="text-emerald-300 tabular-nums">
                        {formatMoney(c.remainingAmount, c.currency)}
                      </span>
                    </div>
                  ) : null}
                </div>
                {c.status === "ACTIVE" || c.status === "PARTIALLY_USED" ? (
                  <button
                    type="button"
                    onClick={() => void handleVoid(c)}
                    aria-label="Анулювати кредит"
                    title="Анулювати кредит"
                    className="rounded-none p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </AdminInspectorCard>
  );
}
