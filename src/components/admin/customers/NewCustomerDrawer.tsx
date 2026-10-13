"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { useToast } from "@/components/admin/AdminToast";
import { crmButton, crmInput, crmPrimaryButton } from "@/components/admin/crm/CrmUi";
import { isUsableShopCustomerEmail, normalizeShopCustomerEmail } from "@/lib/shopCustomerEmail";
import { cn } from "@/lib/utils";

type CustomerKind = "B2B_APPROVED" | "B2C";

export type DuplicateCandidate = {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
};

const EMPTY = {
  kind: "B2B_APPROVED" as CustomerKind,
  firstName: "",
  lastName: "",
  companyName: "",
  phone: "",
  email: "",
  vatNumber: "",
  preferredLocale: "ua" as "ua" | "en",
  notes: "",
};

const digits = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(-9);

/** A side panel over the customer list: create without leaving the list. */
export function NewCustomerDrawer({
  open,
  onClose,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  customers: DuplicateCandidate[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError("");
    const timer = window.setTimeout(() => firstInput.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const email = normalizeShopCustomerEmail(form.email);
  const emailInvalid = email !== "" && !isUsableShopCustomerEmail(email);
  const canSubmit = Boolean(form.firstName.trim()) && isUsableShopCustomerEmail(email) && !saving;

  // Same phone, email or company already on file: offer it instead of a duplicate.
  const duplicate = useMemo(() => {
    const phone = digits(form.phone);
    const company = form.companyName.trim().toLowerCase();
    return (
      customers.find(
        (customer) =>
          (email && customer.email.toLowerCase() === email) ||
          (phone.length >= 9 && digits(customer.phone) === phone) ||
          (company.length >= 3 && (customer.companyName ?? "").trim().toLowerCase() === company)
      ) ?? null
    );
  }, [customers, email, form.phone, form.companyName]);

  function update<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, group: form.kind, email }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        customerId?: string;
        existingCustomerId?: string;
        error?: string;
      };
      if (!response.ok || !data.customerId) {
        setError(data.error || "Не вдалося створити клієнта");
        return;
      }
      toast.success("Клієнта створено");
      router.push(`/admin/shop/customers/${data.customerId}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Закрити"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-customer-title"
        className="crm-surface relative flex h-full w-full max-w-[500px] flex-col border-l border-[#2A2C31] bg-[#0E0F11] shadow-[-24px_0_48px_rgba(0,0,0,0.55)]"
      >
        <div className="flex h-[52px] items-center gap-2 border-b border-[#1F2125] px-5">
          <h2 id="new-customer-title" className="text-[15px] font-semibold text-white">
            Новий клієнт
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center border border-[#24262B] text-zinc-400 hover:bg-[#1C1D21] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <fieldset>
              <legend className="mb-2 text-zinc-400">Тип клієнта</legend>
              <div className="grid grid-cols-2 border border-[#24262B]">
                {(
                  [
                    ["B2B_APPROVED", "B2B-партнер", "СТО, тюнінг, дилер"],
                    ["B2C", "Роздріб", "Звичайні ціни сайту"],
                  ] as const
                ).map(([value, title, text]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2.5",
                      form.kind === value
                        ? "bg-[#121A2B] shadow-[inset_0_0_0_1px_#3B82F6]"
                        : "hover:bg-white/[0.02]"
                    )}
                  >
                    <input
                      type="radio"
                      name="kind"
                      checked={form.kind === value}
                      onChange={() => update("kind", value)}
                      className="accent-[#3B82F6]"
                    />
                    <span>
                      <span className="block font-medium text-white">{title}</span>
                      <span className="block text-[12px] text-zinc-500">{text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="block text-zinc-400">Ім’я *</span>
                <input
                  ref={firstInput}
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  autoComplete="off"
                  className={crmInput}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="block text-zinc-400">Прізвище</span>
                <input
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  autoComplete="off"
                  className={crmInput}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="block text-zinc-400">Компанія</span>
              <input
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                autoComplete="off"
                className={crmInput}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="block text-zinc-400">Телефон</span>
                <input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  inputMode="tel"
                  placeholder="+380…"
                  autoComplete="off"
                  className={cn(crmInput, "crm-mono text-[12px]")}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="block text-zinc-400">Email (логін) *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  autoComplete="off"
                  className={cn(crmInput, emailInvalid && "border-amber-400/60")}
                />
                {emailInvalid ? (
                  <span className="block text-[12px] text-amber-300">Потрібна справжня адреса</span>
                ) : null}
              </label>
            </div>

            {duplicate ? (
              <div className="border border-[#3A2E14] bg-[#17130A] px-3 py-2.5 leading-5 text-[#F5C46B]">
                Схожий клієнт уже є:{" "}
                <Link
                  href={`/admin/shop/customers/${duplicate.id}`}
                  className="text-[#FFD58A] underline underline-offset-2"
                >
                  {duplicate.companyName || duplicate.fullName}
                  {duplicate.phone ? ` · ${duplicate.phone}` : ""}
                </Link>
                . Відкрити його замість нового?
              </div>
            ) : null}

            <details className="border-t border-[#1F2125] pt-3">
              <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
                Ще поля: ЄДРПОУ, мова, примітка
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block space-y-1.5">
                  <span className="block text-zinc-400">ЄДРПОУ / VAT</span>
                  <input
                    value={form.vatNumber}
                    onChange={(e) => update("vatNumber", e.target.value)}
                    autoComplete="off"
                    className={crmInput}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-zinc-400">Мова листів і кабінету</span>
                  <select
                    value={form.preferredLocale}
                    onChange={(e) =>
                      update("preferredLocale", e.target.value === "en" ? "en" : "ua")
                    }
                    className={crmInput}
                  >
                    <option value="ua">Українська</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-zinc-400">Примітка</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={3}
                    placeholder="Видно лише команді"
                    className={cn(crmInput, "h-auto resize-y py-2")}
                  />
                </label>
              </div>
            </details>

            {error ? (
              <div
                role="alert"
                className="border-l-2 border-red-400 bg-red-500/[0.08] px-3 py-2 text-red-100"
              >
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-[#1F2125] px-5 py-4">
            <p className="leading-5 text-zinc-500">
              Пароль клієнт задасть сам — посилання для входу створюється на картці. Знижки на
              бренди теж задаються там.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className={crmButton}>
                Скасувати
              </button>
              <button type="submit" disabled={!canSubmit} className={crmPrimaryButton}>
                {saving ? "Створюємо…" : "Створити й відкрити картку"}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}
