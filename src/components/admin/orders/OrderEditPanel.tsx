"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Search, Trash2, Undo2 } from "lucide-react";

import { AdminSlideOver } from "@/components/admin/AdminSlideOver";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { cn } from "@/lib/utils";
import { ORDER_ADDRESS_FIELDS, type OrderAddressKey } from "@/lib/admin/orderEditing";
import { formatOrderMoney } from "./orderFormat";

export type EditableOrder = {
  id: string;
  orderNumber: string;
  updatedAt: string;
  currency: string;
  total: number;
  customerName: string;
  email: string;
  phone: string | null;
  customerGroupSnapshot?: string;
  shippingAddress: Record<string, unknown>;
  amountLock?: { code: string; text: string } | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: number;
    total: number;
    image: string | null;
    sku?: string | null;
    variantTitle?: string | null;
  }>;
};

type Row = {
  key: string;
  id: string | null;
  title: string;
  sku: string | null;
  image: string | null;
  productId: string | null;
  variantId: string | null;
  quantity: string;
  price: string;
  removed: boolean;
  original: { quantity: number; price: number; total: number } | null;
};

type CatalogHit = {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  brand: string | null;
  sku: string | null;
  image: string | null;
  published: boolean;
  price: number | null;
  b2bPrice: number | null;
};

function addressValue(address: Record<string, unknown>, key: OrderAddressKey) {
  const value = address?.[key];
  return typeof value === "string" ? value : "";
}

function num(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const inputClass =
  "w-full border border-white/15 bg-black/40 px-3 py-2 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/60 focus:outline-none disabled:opacity-60";

/**
 * «Редагувати замовлення»: contacts, address and items in one form with a before/after
 * total. Items lock as soon as money or a payment link exists — the panel says why.
 */
export function OrderEditPanel({
  order,
  open,
  onClose,
  onSaved,
}: {
  order: EditableOrder;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(order.customerName);
  const [email, setEmail] = useState(order.email);
  const [phone, setPhone] = useState(order.phone ?? "");
  const [address, setAddress] = useState<Record<OrderAddressKey, string>>(
    () =>
      Object.fromEntries(
        ORDER_ADDRESS_FIELDS.map(({ key }) => [key, addressValue(order.shippingAddress, key)])
      ) as Record<OrderAddressKey, string>
  );
  const [rows, setRows] = useState<Row[]>(() =>
    order.items.map((item) => ({
      key: item.id,
      id: item.id,
      title: item.variantTitle ? `${item.title} — ${item.variantTitle}` : item.title,
      sku: item.sku ?? null,
      image: item.image,
      productId: null,
      variantId: null,
      quantity: String(item.quantity),
      price: String(item.price),
      removed: false,
      original: { quantity: item.quantity, price: item.price, total: item.total },
    }))
  );
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const confirm = useConfirm();
  const locked = order.amountLock ?? null;
  const isB2b = String(order.customerGroupSnapshot ?? "").startsWith("B2B");

  useEffect(() => {
    if (locked) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/admin/shop/orders/catalog-search?q=${encodeURIComponent(q)}&currency=${encodeURIComponent(order.currency)}`,
          { signal: controller.signal }
        );
        const data = await response.json().catch(() => ({}));
        setHits(Array.isArray(data.items) ? data.items : []);
      } catch {
        // aborted or offline — keep the previous hits
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, order.currency, locked]);

  const rowErrors = useMemo(
    () =>
      rows
        .filter((row) => !row.removed)
        .some((row) => {
          const quantity = num(row.quantity);
          const price = num(row.price);
          return (
            !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || !(price >= 0)
          );
        }),
    [rows]
  );

  const itemsBefore = round2(order.items.reduce((sum, item) => sum + item.total, 0));
  const itemsAfter = round2(
    rows
      .filter((row) => !row.removed)
      .reduce((sum, row) => {
        const quantity = num(row.quantity);
        const price = num(row.price);
        if (!Number.isFinite(quantity) || !Number.isFinite(price)) return sum;
        const unchanged =
          row.original && row.original.quantity === quantity && round2(row.original.price) === round2(price);
        return sum + (unchanged ? row.original!.total : price * quantity);
      }, 0)
  );
  const delta = round2(itemsAfter - itemsBefore);
  const nextTotal = round2(order.total + delta);

  const itemChanges = {
    update: rows
      .filter((row) => row.id && !row.removed && row.original)
      .filter(
        (row) =>
          num(row.quantity) !== row.original!.quantity ||
          round2(num(row.price)) !== round2(row.original!.price)
      )
      .map((row) => ({ id: row.id!, quantity: num(row.quantity), price: round2(num(row.price)) })),
    remove: rows.filter((row) => row.id && row.removed).map((row) => row.id!),
    add: rows
      .filter((row) => !row.id && !row.removed)
      .map((row) => ({
        productId: row.productId,
        variantId: row.variantId,
        sku: row.sku,
        image: row.image,
        title: row.title,
        quantity: num(row.quantity),
        price: round2(num(row.price)),
      })),
  };
  const itemsChanged =
    itemChanges.update.length + itemChanges.remove.length + itemChanges.add.length > 0;
  const contactChanged =
    name.trim() !== order.customerName ||
    email.trim().toLowerCase() !== order.email ||
    phone.trim() !== (order.phone ?? "");
  const addressChanged = ORDER_ADDRESS_FIELDS.some(
    ({ key }) => address[key].trim() !== addressValue(order.shippingAddress, key).trim()
  );
  const dirty = itemsChanged || contactChanged || addressChanged;
  const activeRows = rows.filter((row) => !row.removed).length;

  async function requestClose() {
    if (saving) return;
    if (
      dirty &&
      !(await confirm({
        title: "Закрити без збереження?",
        description: "Внесені зміни буде втрачено.",
        confirmLabel: "Закрити без збереження",
        tone: "warning",
      }))
    )
      return;
    onClose();
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addHit(hit: CatalogHit) {
    const price = isB2b && hit.b2bPrice ? hit.b2bPrice : hit.price;
    setRows((current) => [
      ...current,
      {
        key: `new-${hit.variantId}-${current.length}`,
        id: null,
        title: hit.title,
        sku: hit.sku,
        image: hit.image,
        productId: hit.productId,
        variantId: hit.variantId,
        quantity: "1",
        price: price != null ? String(price) : "",
        removed: false,
        original: null,
      },
    ]);
    setQuery("");
    setHits([]);
  }

  function addCustom() {
    const title = customTitle.trim();
    if (!title) return;
    setRows((current) => [
      ...current,
      {
        key: `custom-${current.length}-${title}`,
        id: null,
        title,
        sku: null,
        image: null,
        productId: null,
        variantId: null,
        quantity: "1",
        price: customPrice,
        removed: false,
        original: null,
      },
    ]);
    setCustomTitle("");
    setCustomPrice("");
  }

  async function save() {
    if (!dirty || saving || (itemsChanged && rowErrors)) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${order.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: order.updatedAt,
          note,
          ...(contactChanged
            ? { contact: { customerName: name, email, phone } }
            : {}),
          ...(addressChanged ? { shippingAddress: address } : {}),
          ...(itemsChanged ? { items: itemChanges } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Не вдалося зберегти зміни. Спробуйте ще раз."
        );
        return;
      }
      onSaved("Зміни збережено й записано в історію замовлення.");
    } catch {
      setError("Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminSlideOver
      open={open}
      onClose={() => void requestClose()}
      title={`Редагувати ${order.orderNumber}`}
      subtitle="Усі зміни потраплять в історію замовлення"
      width="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-zinc-400">
            {itemsChanged ? (
              <>
                До сплати:{" "}
                <span className="text-zinc-500 line-through">
                  {formatOrderMoney(order.total, order.currency)}
                </span>{" "}
                <strong className="text-white">{formatOrderMoney(nextTotal, order.currency)}</strong>
              </>
            ) : dirty ? (
              "Є незбережені зміни"
            ) : (
              "Змін поки немає"
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void requestClose()}
              disabled={saving}
              className="border border-white/15 px-4 py-2 text-[13px] text-zinc-200 hover:bg-white/5"
            >
              Закрити
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || (itemsChanged && rowErrors) || activeRows < 1}
              className="bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Зберігаємо…" : "Зберегти зміни"}
            </button>
          </div>
        </div>
      }
    >
      <div className="@container space-y-7 px-5 py-5">
        {error ? (
          <div role="alert" className="border-l-2 border-red-400 bg-red-500/[0.08] px-3 py-2 text-[13px] leading-5 text-red-100">
            {error}
          </div>
        ) : null}

        <Section title="Покупець">
          <div className="grid gap-3 @xl:grid-cols-3">
            <Field label="Ім’я та прізвище">
              <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Телефон">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                inputMode="email"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Адреса доставки" hint="Вартість доставки при зміні адреси не перераховується.">
          <div className="grid gap-3 @xl:grid-cols-3">
            {ORDER_ADDRESS_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label} wide={key === "line1"}>
                <input
                  value={address[key]}
                  onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </Section>

        <Section title="Товари">
          {locked ? (
            <p className="mb-3 flex items-start gap-2 border-l-2 border-amber-400 bg-amber-400/[0.07] px-3 py-2 text-[13px] leading-5 text-amber-100">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {locked.text}
            </p>
          ) : null}
          <div className="divide-y divide-white/[0.06] border border-white/10">
            {rows.map((row) => {
              const quantity = num(row.quantity);
              const price = num(row.price);
              const lineTotal = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0;
              return (
                <div
                  key={row.key}
                  className={cn(
                    "grid grid-cols-[48px_minmax(0,1fr)] gap-3 px-3 py-3 @xl:grid-cols-[48px_minmax(0,1fr)_88px_130px_110px_36px] @xl:items-center",
                    row.removed && "opacity-45",
                    !row.id && "bg-blue-500/[0.05]"
                  )}
                >
                  <div className="h-12 w-12 overflow-hidden bg-white/5">
                    {row.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("text-[14px] leading-5 text-zinc-100", row.removed && "line-through")}>
                      {row.title}
                    </div>
                    <div className="mt-0.5 text-[12px] text-zinc-500">
                      {row.sku ? `SKU ${row.sku}` : row.id ? "" : "Довільна позиція"}
                      {!row.id ? <span className="ml-2 text-blue-300">нова</span> : null}
                    </div>
                  </div>
                  <label className="col-start-2 @xl:col-start-auto">
                    <span className="mb-1 block text-[11px] text-zinc-500 @xl:sr-only">Кількість</span>
                    <input
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      disabled={Boolean(locked) || row.removed}
                      inputMode="numeric"
                      aria-label="Кількість"
                      className={cn(inputClass, "text-right")}
                    />
                  </label>
                  <label className="col-start-2 @xl:col-start-auto">
                    <span className="mb-1 block text-[11px] text-zinc-500 @xl:sr-only">Ціна за шт., {order.currency}</span>
                    <input
                      value={row.price}
                      onChange={(event) => updateRow(row.key, { price: event.target.value })}
                      disabled={Boolean(locked) || row.removed}
                      inputMode="decimal"
                      aria-label="Ціна за штуку"
                      className={cn(inputClass, "text-right")}
                    />
                  </label>
                  <div className="col-start-2 text-right text-[14px] font-medium text-zinc-100 @xl:col-start-auto">
                    {formatOrderMoney(lineTotal, order.currency)}
                  </div>
                  <div className="col-start-2 flex justify-end @xl:col-start-auto">
                    {!locked ? (
                      row.removed ? (
                        <button
                          type="button"
                          onClick={() => updateRow(row.key, { removed: false })}
                          className="p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                          aria-label="Повернути позицію"
                          title="Повернути позицію"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            row.id
                              ? updateRow(row.key, { removed: true })
                              : setRows((current) => current.filter((entry) => entry.key !== row.key))
                          }
                          className="p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                          aria-label="Прибрати позицію"
                          title="Прибрати позицію"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {itemsChanged ? (
            <dl className="mt-3 grid gap-1 border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Товари</dt>
                <dd className="text-zinc-200">
                  {formatOrderMoney(itemsBefore, order.currency)} → {formatOrderMoney(itemsAfter, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 font-semibold">
                <dt className="text-zinc-300">Разом до сплати</dt>
                <dd className="text-white">
                  {formatOrderMoney(order.total, order.currency)} → {formatOrderMoney(nextTotal, order.currency)}
                </dd>
              </div>
            </dl>
          ) : null}

          {!locked ? (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <label className="flex items-center gap-2 border border-white/15 bg-black/40 px-3 py-2 focus-within:border-blue-400/60">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Додати товар з каталогу: назва, бренд або SKU"
                    className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                  {searching ? <span className="text-[12px] text-zinc-500">шукаємо…</span> : null}
                </label>
                {hits.length ? (
                  <ul className="mt-1 max-h-72 divide-y divide-white/[0.06] overflow-y-auto border border-white/15 bg-[#101010]">
                    {hits.map((hit) => {
                      const price = isB2b && hit.b2bPrice ? hit.b2bPrice : hit.price;
                      return (
                        <li key={hit.variantId}>
                          <button
                            type="button"
                            onClick={() => addHit(hit)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05]"
                          >
                            <span className="h-9 w-9 shrink-0 overflow-hidden bg-white/5">
                              {hit.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={hit.image} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] text-zinc-100">{hit.title}</span>
                              <span className="block text-[11px] text-zinc-500">
                                {[hit.brand, hit.sku ? `SKU ${hit.sku}` : null, hit.published ? null : "не опубліковано"]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-[13px] text-zinc-200">
                              {price != null ? formatOrderMoney(price, order.currency) : "ціну вкажете"}
                              <span className="flex items-center justify-end gap-1 text-[11px] text-blue-300">
                                <Plus className="h-3 w-3" /> додати
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : query.trim().length >= 2 && !searching ? (
                  <p className="mt-1 text-[12px] text-zinc-500">Нічого не знайдено. Додайте як довільну позицію нижче.</p>
                ) : null}
              </div>
              <div className="grid gap-2 @xl:grid-cols-[minmax(0,1fr)_150px_auto]">
                <input
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder="Довільна позиція (напр. «Монтаж», «Доставка з ЄС»)"
                  className={inputClass}
                />
                <input
                  value={customPrice}
                  onChange={(event) => setCustomPrice(event.target.value)}
                  placeholder={`Ціна, ${order.currency}`}
                  inputMode="decimal"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={!customTitle.trim() || !(num(customPrice) >= 0)}
                  className="inline-flex items-center justify-center gap-1.5 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 hover:bg-white/5 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" /> Додати
                </button>
              </div>
              {isB2b ? (
                <p className="text-[12px] text-zinc-500">
                  Клієнт B2B: для товарів з оптовою ціною підставляється вона, інакше — роздрібна. Ціну можна змінити.
                </p>
              ) : null}
            </div>
          ) : null}
          {itemsChanged && rowErrors ? (
            <p className="mt-2 text-[12px] text-red-300">Перевірте кількість (ціле число від 1) і ціну (число від 0).</p>
          ) : null}
        </Section>

        <Section title="Коментар до змін">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Наприклад: клієнт попросив замінити колір"
            className={cn(inputClass, "resize-y")}
          />
        </Section>
      </div>
    </AdminSlideOver>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{title}</h3>
        {hint ? <span className="text-[12px] text-zinc-500">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block", wide && "@xl:col-span-2")}>
      <span className="mb-1.5 block text-[12px] text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
