"use client";

import { useState } from "react";
import Link from "next/link";

import { useToast } from "@/components/admin/AdminToast";
import { CrmChip, crmButton, crmInput, crmPrimaryButton } from "@/components/admin/crm/CrmUi";
import { formatPct, groupAccent, GroupMark } from "@/components/admin/b2b/B2bPricingUi";
import { assignPartnerTariffGroup } from "@/components/admin/b2b/TariffGroupsTab";
import type { B2bTariffGroup } from "@/components/admin/b2b/useB2bTariffGroups";
import { cn } from "@/lib/utils";

type Props = {
  customerId: string;
  value: { id: string; name: string } | null;
  groups: B2bTariffGroup[];
  loading: boolean;
  onChanged: (next: { id: string; name: string } | null) => void;
};

/** Tariff group picker on the customer card: the partner's base set of brand discounts. */
export function CustomerTariffGroupPanel({ customerId, value, groups, loading, onChanged }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedId = draft ?? value?.id ?? "";
  const dirty = draft != null && draft !== (value?.id ?? "");
  const currentIndex = groups.findIndex((group) => group.id === value?.id);
  const current = currentIndex >= 0 ? groups[currentIndex]! : null;
  const accent = current ? groupAccent(current.name, currentIndex) : null;
  const manageHref = value
    ? `/admin/shop/customers/b2b-pricing?group=${value.id}`
    : "/admin/shop/customers/b2b-pricing";

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const result = await assignPartnerTariffGroup(customerId, draft || null);
      onChanged(result.tariffGroup);
      setDraft(null);
      toast.success(
        result.tariffGroup ? `Група «${result.tariffGroup.name}»` : "Партнера прибрано з групи",
        "Ціни на сайті вже оновлені"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося змінити групу");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-[#24262B] bg-[#0E0F11]">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <h3 className="text-[13px] font-semibold text-zinc-100">Тарифна група</h3>
        <Link href={manageHref} className="text-[12px] text-[#9CC0FF] hover:text-white">
          {groups.length ? "Налаштувати групи →" : "Створити групу →"}
        </Link>
      </header>

      {!loading && !groups.length && !value ? (
        <p className="px-4 pb-4 text-zinc-500">
          Груп ще немає. Група — це набір знижок на бренди (наприклад «Gold»), який можна дати
          кільком партнерам одразу.
        </p>
      ) : (
        <div className="px-4 pb-4">
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {current && accent && !dirty ? (
              <GroupMark name={current.name} accent={accent} size={32} />
            ) : null}
            <select
              value={selectedId}
              disabled={loading || saving}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Тарифна група партнера"
              className={cn(crmInput, "w-auto min-w-[220px] max-w-full")}
            >
              <option value="">Без групи</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · знижок на бренди: {group.brandDiscounts.length}
                </option>
              ))}
            </select>
            {dirty ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className={crmPrimaryButton}
                >
                  {saving ? "Зберігаємо…" : "Зберегти"}
                </button>
                <button type="button" onClick={() => setDraft(null)} className={crmButton}>
                  Скасувати
                </button>
              </>
            ) : null}
          </div>

          {current ? (
            current.brandDiscounts.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {current.brandDiscounts.map((rule) => (
                  <CrmChip key={rule.brand} tone="blue">
                    {rule.brand} −{formatPct(rule.discountPct)}
                  </CrmChip>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-zinc-500">
                У групі «{current.name}» ще немає знижок —{" "}
                <Link href={manageHref} className="text-[#9CC0FF] hover:text-white">
                  додайте бренди
                </Link>
                .
              </p>
            )
          ) : !loading ? (
            <p className="mt-2 text-zinc-500">
              Без групи — діють знижки брендів для всіх партнерів і винятки нижче.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
