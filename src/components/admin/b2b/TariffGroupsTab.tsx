"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Layers, Pencil, Plus, Trash2, X } from "lucide-react";

import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { findB2bBrandOption, type B2bBrandOption } from "@/components/admin/b2b/B2bBrandSelect";
import {
  AddRow,
  CrmPicker,
  formatPct,
  groupAccent,
  GroupMark,
  PctCell,
  pluralBrands,
  pluralPartners,
  sendB2bJson,
} from "@/components/admin/b2b/B2bPricingUi";
import type { B2bTariffGroup } from "@/components/admin/b2b/useB2bTariffGroups";
import {
  CrmAvatar,
  CrmChip,
  crmButton,
  crmIconButton,
  crmInput,
  crmPrimaryButton,
} from "@/components/admin/crm/CrmUi";
import { normalizeShopBrandKey } from "@/lib/shopB2bBrandDiscounts";
import { cn } from "@/lib/utils";

export type TariffGroupPartner = {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  placeholderEmail?: boolean;
  canSignIn: boolean;
  tariffGroup: { id: string; name: string } | null;
  brandDiscounts: Array<{ brand: string; discountPct: number }>;
};

const SUGGESTED_GROUPS = ["Silver", "Gold", "Dealer"];

export function partnerLabel(partner: Pick<TariffGroupPartner, "name" | "companyName">) {
  return partner.companyName && partner.companyName !== partner.name
    ? `${partner.companyName} · ${partner.name}`
    : partner.companyName || partner.name;
}

/** Puts a partner into a group (or none); shared by every screen that assigns groups. */
export async function assignPartnerTariffGroup(customerId: string, groupId: string | null) {
  return sendB2bJson<{ tariffGroup: { id: string; name: string } | null }>(
    `/api/admin/shop/customers/${customerId}/tariff-group`,
    "PUT",
    { tariffGroupId: groupId }
  );
}

export function TariffGroupsTab({
  groups,
  groupsLoading,
  partners,
  brands,
  brandsLoading,
  systemDiscounts,
  selectedId,
  onSelect,
  onChanged,
}: {
  groups: B2bTariffGroup[];
  groupsLoading: boolean;
  partners: TariffGroupPartner[];
  brands: B2bBrandOption[];
  brandsLoading: boolean;
  systemDiscounts: ReadonlyArray<{ brand: string; discountPct: number }>;
  selectedId: string;
  onSelect: (groupId: string) => void;
  /** Reloads groups (and partners when membership changed). */
  onChanged: (options?: { partners?: boolean }) => Promise<void>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedIndex = Math.max(
    0,
    groups.findIndex((group) => group.id === selectedId)
  );
  const selected = groups[selectedIndex] ?? null;
  const membersByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const partner of partners) {
      if (partner.tariffGroup) {
        map.set(partner.tariffGroup.id, (map.get(partner.tariffGroup.id) ?? 0) + 1);
      }
    }
    return map;
  }, [partners]);

  async function createGroup(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const result = await sendB2bJson<{ group: { id: string; name: string } }>(
        "/api/admin/shop/b2b/tariff-groups",
        "POST",
        { name: clean }
      );
      setNewName("");
      setCreating(false);
      await onChanged();
      onSelect(result.group.id);
      toast.success(`Групу «${result.group.name}» створено`, "Додайте знижки на бренди");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося створити групу");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(group: B2bTariffGroup) {
    const members = membersByGroup.get(group.id) ?? 0;
    const ok = await confirm({
      title: `Видалити групу «${group.name}»?`,
      description: members
        ? `Партнерів у групі: ${members}. Вони залишаться партнерами, але втратять знижки цієї групи. Їхні винятки й знижки брендів для всіх діятимуть далі.`
        : "У групі немає партнерів — ціни на сайті не зміняться.",
      confirmLabel: "Видалити групу",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await sendB2bJson(`/api/admin/shop/b2b/tariff-groups/${group.id}`, "DELETE");
      onSelect("");
      await onChanged({ partners: true });
      toast.success(`Групу «${group.name}» видалено`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося видалити групу");
    }
  }

  if (groupsLoading) {
    return <div className="px-6 py-10 text-zinc-500">Завантажуємо групи…</div>;
  }

  if (!groups.length) {
    return (
      <div className="flex justify-center px-4 py-14">
        <div className="w-full max-w-[560px] border border-[#1F2125] bg-[#0E0F11] px-7 py-8">
          <span className="inline-flex h-10 w-10 items-center justify-center bg-[#0F1A2E] text-[#9CC0FF] shadow-[inset_0_0_0_1px_#203A66]">
            <Layers className="h-5 w-5" />
          </span>
          <h2 className="crm-title mt-4 text-[20px] font-semibold text-white">
            Тарифні групи партнерів
          </h2>
          <p className="mt-2 leading-6 text-zinc-400">
            Група — це набір знижок на бренди, наприклад «Gold»: Akrapovic −15%, Remus −10%.
            Партнеру достатньо призначити групу, а для окремих брендів на його картці можна задати
            свій виняток.
          </p>
          <div className="mt-6 text-[12px] text-zinc-500">Почати з типових рівнів</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_GROUPS.map((name, index) => (
              <button
                key={name}
                type="button"
                disabled={busy}
                onClick={() => void createGroup(name)}
                className={cn(crmButton, "h-9 gap-2 pl-1.5 pr-3")}
              >
                <GroupMark name={name} accent={groupAccent(name, index)} size={24} />
                {name}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void createGroup(newName);
            }}
          >
            <input
              value={newName}
              maxLength={60}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Або своя назва групи"
              aria-label="Назва нової групи"
              className={crmInput}
            />
            <button type="submit" disabled={busy || !newName.trim()} className={crmPrimaryButton}>
              Створити
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[560px] flex-1 flex-col lg:flex-row">
      <nav
        aria-label="Тарифні групи"
        className="shrink-0 border-b border-[#1F2125] lg:w-[264px] lg:border-b-0 lg:border-r"
      >
        <div className="flex items-center justify-between px-4 pb-1.5 pt-4">
          <span className="text-[12px] text-zinc-500">Групи</span>
          <span className="crm-mono text-[11px] text-zinc-600">{groups.length}</span>
        </div>
        <ul className="pb-2">
          {groups.map((group, index) => {
            const active = group.id === selected?.id;
            const accent = groupAccent(group.name, index);
            const members = membersByGroup.get(group.id) ?? 0;
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => onSelect(group.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                    active ? "bg-[#141518]" : "hover:bg-[#111113]"
                  )}
                  style={active ? { boxShadow: `inset 2px 0 0 ${accent.solid}` } : undefined}
                >
                  <GroupMark name={group.name} accent={accent} size={30} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium",
                        active ? "text-white" : "text-zinc-200"
                      )}
                    >
                      {group.name}
                    </span>
                    <span className="block text-[12px] text-zinc-500">
                      {members} {pluralPartners(members)} · {group.brandDiscounts.length}{" "}
                      {pluralBrands(group.brandDiscounts.length)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-[#1F2125] p-3">
          {creating ? (
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void createGroup(newName);
              }}
            >
              <input
                autoFocus
                value={newName}
                maxLength={60}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCreating(false);
                }}
                placeholder="Назва групи"
                aria-label="Назва нової групи"
                className={crmInput}
              />
              <button
                type="submit"
                disabled={busy || !newName.trim()}
                className={cn(crmPrimaryButton, "shrink-0")}
              >
                OK
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-1.5 text-[13px] text-zinc-400 transition hover:text-[#9CC0FF]"
            >
              <Plus className="h-3.5 w-3.5" /> Нова група
            </button>
          )}
        </div>
      </nav>

      {selected ? (
        <GroupDetail
          key={selected.id}
          group={selected}
          accent={groupAccent(selected.name, selectedIndex)}
          partners={partners}
          brands={brands}
          brandsLoading={brandsLoading}
          systemDiscounts={systemDiscounts}
          onChanged={onChanged}
          onDelete={() => void deleteGroup(selected)}
        />
      ) : null}
    </div>
  );
}

function GroupDetail({
  group,
  accent,
  partners,
  brands,
  brandsLoading,
  systemDiscounts,
  onChanged,
  onDelete,
}: {
  group: B2bTariffGroup;
  accent: ReturnType<typeof groupAccent>;
  partners: TariffGroupPartner[];
  brands: B2bBrandOption[];
  brandsLoading: boolean;
  systemDiscounts: ReadonlyArray<{ brand: string; discountPct: number }>;
  onChanged: (options?: { partners?: boolean }) => Promise<void>;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<"name" | "description" | null>(null);
  const [draft, setDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrand, setNewBrand] = useState<string | null>(null);
  const [newPct, setNewPct] = useState("");
  const [addingPartner, setAddingPartner] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const systemByKey = useMemo(
    () => new Map(systemDiscounts.map((row) => [normalizeShopBrandKey(row.brand), row])),
    [systemDiscounts]
  );
  const members = partners.filter((partner) => partner.tariffGroup?.id === group.id);
  const candidates = partners.filter((partner) => partner.tariffGroup?.id !== group.id);
  const hiddenMembers = Math.max(0, group.partnerCount - members.length);
  const rules = group.brandDiscounts;
  const positive = rules.filter((rule) => rule.discountPct > 0);
  const average = positive.length
    ? positive.reduce((sum, rule) => sum + rule.discountPct, 0) / positive.length
    : null;
  const top = positive.reduce<(typeof rules)[number] | null>(
    (best, rule) => (!best || rule.discountPct > best.discountPct ? rule : best),
    null
  );
  const taken = new Set(rules.map((rule) => normalizeShopBrandKey(rule.brand)));

  async function saveMeta(field: "name" | "description") {
    setSavingMeta(true);
    try {
      await sendB2bJson(`/api/admin/shop/b2b/tariff-groups/${group.id}`, "PATCH", {
        name: field === "name" ? draft : group.name,
        description: field === "description" ? draft : (group.description ?? ""),
      });
      setEditing(null);
      await onChanged({ partners: field === "name" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося зберегти");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveRule(brand: string, pct: number | null) {
    try {
      if (pct == null) {
        await sendB2bJson(
          `/api/admin/shop/b2b/tariff-groups/${group.id}/brand-discounts?brand=${encodeURIComponent(brand)}`,
          "DELETE"
        );
        toast.success(`${brand}: знижку групи прибрано`);
      } else {
        await sendB2bJson(`/api/admin/shop/b2b/tariff-groups/${group.id}/brand-discounts`, "PUT", {
          brand,
          discountPct: pct,
        });
        toast.success(`«${group.name}»: ${brand} −${formatPct(pct)}`);
      }
      await onChanged();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося зберегти");
      return false;
    }
  }

  async function addRule(event?: React.FormEvent) {
    event?.preventDefault();
    if (!newBrand) return;
    const value = Number(newPct.trim().replace(",", "."));
    if (newPct.trim() === "" || !Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Знижка має бути від 0 до 100%");
      return;
    }
    setBusyKey("add-brand");
    const ok = await saveRule(newBrand, value);
    setBusyKey(null);
    if (ok) {
      setNewBrand(null);
      setNewPct("");
    }
  }

  async function setMembership(partner: TariffGroupPartner, groupId: string | null) {
    setBusyKey(`member:${partner.id}`);
    try {
      await assignPartnerTariffGroup(partner.id, groupId);
      await onChanged({ partners: true });
      toast.success(
        groupId
          ? `${partnerLabel(partner)} — у групі «${group.name}»`
          : `${partnerLabel(partner)} — без групи`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не вдалося змінити групу");
    } finally {
      setBusyKey(null);
    }
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: "Партнерів у групі", value: String(members.length) },
    { label: "Брендів зі знижкою", value: String(rules.length) },
    { label: "Середня знижка", value: average != null ? `−${formatPct(average)}` : "—" },
    {
      label: "Найбільша",
      value: top ? `${top.brand} −${formatPct(top.discountPct)}` : "—",
    },
  ];

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-start gap-4 border-b border-[#1F2125] px-5 py-5 sm:px-6">
        <GroupMark name={group.name} accent={accent} size={46} />
        <div className="min-w-[220px] flex-1">
          {editing === "name" ? (
            <form
              className="flex max-w-md gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void saveMeta("name");
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={60}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditing(null);
                }}
                aria-label="Назва групи"
                className={crmInput}
              />
              <button type="submit" disabled={savingMeta} className={crmPrimaryButton}>
                Зберегти
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Скасувати"
                className={crmIconButton}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(group.name);
                setEditing("name");
              }}
              className="group inline-flex items-center gap-2 text-left"
            >
              <h2 className="crm-title text-[22px] font-semibold text-white">{group.name}</h2>
              <Pencil className="h-3.5 w-3.5 text-zinc-600 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}
          {editing === "description" ? (
            <form
              className="mt-2 flex max-w-xl gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void saveMeta("description");
              }}
            >
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditing(null);
                }}
                placeholder="Кому даємо цю групу"
                aria-label="Опис групи"
                className={crmInput}
              />
              <button type="submit" disabled={savingMeta} className={crmPrimaryButton}>
                Зберегти
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(group.description ?? "");
                setEditing("description");
              }}
              className={cn(
                "mt-1 block text-left",
                group.description
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {group.description || "Додати опис — кому даємо цю групу"}
            </button>
          )}
        </div>
        <button type="button" onClick={onDelete} className={crmButton}>
          <Trash2 className="h-3.5 w-3.5" /> Видалити групу
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-[#1F2125] bg-[#1F2125] sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 bg-[#0A0A0B] px-5 py-3 sm:px-6">
            <dt className="text-[12px] text-zinc-500">{stat.label}</dt>
            <dd className="crm-mono mt-0.5 truncate text-[15px] text-white">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-1 flex-col xl:flex-row">
        <div className="min-w-0 flex-[3_1_0%]">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4 sm:px-6">
            <h3 className="font-medium text-zinc-100">Знижки на бренди</h3>
            <span className="text-[12px] text-zinc-600">Клікніть на відсоток, щоб змінити</span>
          </div>
          <div className="mx-5 border border-[#1F2125] sm:mx-6">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="h-8 border-b border-[#1F2125] text-[12px] text-zinc-500">
                  <th className="px-3 font-normal">Бренд</th>
                  <th className="w-[120px] px-3 text-right font-normal">Для всіх</th>
                  <th className="w-[130px] px-1 text-right font-normal">Знижка групи</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const option = findB2bBrandOption(brands, rule.brand);
                  const system = systemByKey.get(normalizeShopBrandKey(rule.brand));
                  return (
                    <tr
                      key={rule.brand}
                      className="group h-10 border-b border-[#17181B] last:border-b-0 hover:bg-[#111113]"
                    >
                      <td className="truncate px-3">
                        <span className="text-zinc-100">{rule.brand}</span>
                        {option ? (
                          <span className="crm-mono ml-2 text-[11px] text-zinc-600">
                            {option.productCount} тов.
                          </span>
                        ) : !brandsLoading ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-[#F5C46B]">
                            <AlertTriangle className="h-3 w-3" /> немає товарів — не діє
                          </span>
                        ) : null}
                      </td>
                      <td className="crm-mono px-3 text-right text-[12px] text-zinc-500">
                        {system ? `−${formatPct(system.discountPct)}` : "—"}
                      </td>
                      <td className="px-1">
                        <PctCell
                          value={rule.discountPct}
                          label={`Знижка групи «${group.name}» на ${rule.brand}`}
                          onSave={(next) => saveRule(rule.brand, next)}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          aria-label={`Прибрати ${rule.brand} з групи`}
                          title="Прибрати з групи"
                          onClick={() => void saveRule(rule.brand, null)}
                          className="p-1 text-zinc-600 opacity-0 transition hover:text-[#F19B9B] group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rules.length && !newBrand ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      Ще немає знижок. Додайте бренд — наприклад Akrapovic −15%.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {newBrand ? (
              <form
                onSubmit={addRule}
                className="flex flex-wrap items-center gap-2 border-t border-[#1F2125] px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-zinc-100">{newBrand}</span>
                {systemByKey.get(normalizeShopBrandKey(newBrand)) ? (
                  <span className="text-[12px] text-zinc-500">
                    для всіх −
                    {formatPct(systemByKey.get(normalizeShopBrandKey(newBrand))!.discountPct)}
                  </span>
                ) : null}
                <div className="relative w-24">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={newPct}
                    onChange={(event) => setNewPct(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setNewBrand(null);
                    }}
                    placeholder="15"
                    aria-label={`Знижка групи на ${newBrand}, %`}
                    className={cn(crmInput, "crm-mono pr-6 text-right")}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">
                    %
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={busyKey === "add-brand" || !newPct.trim()}
                  className={crmPrimaryButton}
                >
                  Додати
                </button>
                <button
                  type="button"
                  onClick={() => setNewBrand(null)}
                  aria-label="Скасувати"
                  className={crmIconButton}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <AddRow label="Додати бренд" open={addingBrand} onOpen={() => setAddingBrand(true)}>
                <CrmPicker
                  autoFocus
                  label="Бренд для знижки групи"
                  placeholder="Почніть вводити бренд…"
                  loading={brandsLoading}
                  options={brands.map((option) => {
                    const system = systemByKey.get(normalizeShopBrandKey(option.brand));
                    const has = taken.has(normalizeShopBrandKey(option.brand));
                    return {
                      value: option.brand,
                      label: option.brand,
                      disabled: has,
                      meta: has
                        ? "вже в групі"
                        : `${option.productCount} тов.${system ? ` · для всіх −${formatPct(system.discountPct)}` : ""}`,
                    };
                  })}
                  onSelect={(value) => {
                    setNewBrand(value);
                    setNewPct("");
                    setAddingBrand(false);
                  }}
                />
              </AddRow>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_0%] pb-6 xl:border-l xl:border-[#1F2125]">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-4 sm:px-6">
            <h3 className="font-medium text-zinc-100">
              Партнери <span className="crm-mono text-[12px] text-zinc-500">{members.length}</span>
            </h3>
          </div>
          <div className="mx-5 border border-[#1F2125] sm:mx-6">
            {members.length ? (
              <ul>
                {members.map((partner) => (
                  <li
                    key={partner.id}
                    className="group flex items-center gap-3 border-b border-[#17181B] px-3 py-2 last:border-b-0 hover:bg-[#111113]"
                  >
                    <CrmAvatar name={partner.companyName || partner.name} partner size={28} />
                    <Link
                      href={`/admin/shop/customers/${partner.id}?tab=discounts`}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate text-zinc-100 group-hover:text-white">
                        {partner.companyName || partner.name}
                      </span>
                      <span className="block truncate text-[12px] text-zinc-500">
                        {partner.companyName && partner.companyName !== partner.name
                          ? `${partner.name} · `
                          : ""}
                        {partner.canSignIn ? (
                          "може увійти"
                        ) : (
                          <span className="text-[#C9A869]">немає пароля</span>
                        )}
                      </span>
                    </Link>
                    {partner.brandDiscounts.length ? (
                      <CrmChip tone="green">винятки: {partner.brandDiscounts.length}</CrmChip>
                    ) : null}
                    <Link
                      href={`/admin/shop/customers/${partner.id}?tab=discounts`}
                      aria-label={`Картка ${partnerLabel(partner)}`}
                      className="p-1 text-zinc-600 hover:text-white"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      disabled={busyKey === `member:${partner.id}`}
                      aria-label={`Прибрати ${partnerLabel(partner)} з групи`}
                      title="Прибрати з групи"
                      onClick={() => void setMembership(partner, null)}
                      className="p-1 text-zinc-600 opacity-0 transition hover:text-[#F19B9B] group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-center text-zinc-500">У групі ще немає партнерів.</p>
            )}
            <AddRow
              label="Додати партнера"
              open={addingPartner}
              onOpen={() => setAddingPartner(true)}
            >
              <CrmPicker
                autoFocus
                label="Партнер, якого додати в групу"
                placeholder="Компанія, ім’я або email…"
                emptyText="Партнера не знайдено"
                options={candidates.map((partner) => ({
                  value: partner.id,
                  label: partnerLabel(partner),
                  keywords: partner.email,
                  meta: partner.tariffGroup ? `зараз у «${partner.tariffGroup.name}»` : undefined,
                }))}
                onSelect={(value) => {
                  const partner = candidates.find((entry) => entry.id === value);
                  setAddingPartner(false);
                  if (partner) void setMembership(partner, group.id);
                }}
              />
            </AddRow>
          </div>
          {hiddenMembers ? (
            <p className="mx-5 mt-3 border-l-2 border-[#F5C46B] bg-[#22190A] px-3 py-2 text-[12px] text-[#F5DDA6] sm:mx-6">
              Ще клієнтів у групі без статусу B2B-партнера: {hiddenMembers}. Для них знижки групи не
              діють, доки їх не затвердять.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
