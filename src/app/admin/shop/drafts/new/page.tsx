"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Plus, Save, Search, Trash2 } from "lucide-react";

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from "@/components/admin/AdminFormFields";
import { useToast } from "@/components/admin/AdminToast";

type CustomerOption = {
  id: string;
  email: string;
  fullName: string;
  group: string;
  companyName: string | null;
};

type ProductOption = {
  id: string;
  slug: string;
  titleEn: string;
  titleUa: string;
  brand: string | null;
  sku: string | null;
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceEurB2b: number | null;
  priceUsdB2b: number | null;
  priceUahB2b: number | null;
};

type LineItem = {
  productSlug: string;
  productId: string | null;
  title: string;
  quantity: number;
  price: number;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminNewDraftPage() {
  const router = useRouter();
  const toast = useToast();

  // Customer
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  // Manual customer (when no DB match)
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Order setup
  const [currency, setCurrency] = useState<"EUR" | "USD" | "UAH">("EUR");
  const [shippingCost, setShippingCost] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Items
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer search (debounced)
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setCustomerOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/shop/customers`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as CustomerOption[];
        const needle = customerSearch.toLowerCase();
        setCustomerOptions(
          data
            .filter((c) =>
              [c.email, c.fullName, c.companyName]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(needle))
            )
            .slice(0, 8)
        );
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Product search (debounced)
  useEffect(() => {
    if (!productSearch.trim() || productSearch.length < 2) {
      setProductOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/shop/products?search=${encodeURIComponent(productSearch)}&limit=12`,
          {
            cache: "no-store",
          }
        );
        if (!response.ok) return;
        const data = await response.json();
        setProductOptions((data.products || []).slice(0, 12));
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [productSearch]);

  function pickCustomer(c: CustomerOption) {
    setSelectedCustomer(c);
    setManualEmail(c.email);
    setManualName(c.fullName);
    setCustomerSearch("");
    setCustomerOptions([]);
  }

  function pickProduct(p: ProductOption) {
    const isB2B = selectedCustomer?.group?.startsWith("B2B");
    let unitPrice = 0;
    if (currency === "EUR") unitPrice = (isB2B ? p.priceEurB2b : null) ?? p.priceEur ?? 0;
    if (currency === "USD") unitPrice = (isB2B ? p.priceUsdB2b : null) ?? p.priceUsd ?? 0;
    if (currency === "UAH") unitPrice = (isB2B ? p.priceUahB2b : null) ?? p.priceUah ?? 0;

    setItems((current) => [
      ...current,
      {
        productSlug: p.slug,
        productId: p.id,
        title: p.titleEn || p.titleUa,
        quantity: 1,
        price: unitPrice,
      },
    ]);
    setProductSearch("");
    setProductOptions([]);
  }

  function updateLineItem(idx: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeLineItem(idx: number) {
    setItems((current) => current.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.quantity, 0),
    [items]
  );
  const total = useMemo(() => subtotal + (parseFloat(shippingCost) || 0), [subtotal, shippingCost]);

  async function handleSubmit() {
    if (!manualEmail.trim() || !manualName.trim()) {
      setError("Customer email and name are required");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id ?? null,
          email: manualEmail.trim(),
          customerName: manualName.trim(),
          phone: manualPhone.trim() || null,
          currency,
          shippingAddress: {},
          shippingCost: parseFloat(shippingCost) || 0,
          internalNote: internalNote.trim() || null,
          validUntil: validUntil || null,
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || "Failed to create draft";
        setError(msg);
        toast.error("Could not create draft", msg);
        return;
      }
      toast.success(`Draft created · ${data.orderNumber}`);
      router.push(`/admin/shop/drafts/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href="/admin/shop/drafts"
          className="inline-flex items-center gap-1 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to drafts
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Drafts"
        title="New draft order"
        description="Build a custom quote: pick a customer, add line items with negotiated prices, set shipping, send a shareable link."
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Customer */}
          <AdminInspectorCard
            title="Customer"
            description="Select an existing customer or fill in details for a guest quote."
          >
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                Search customers
              </span>
              <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Name, email or company"
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
                />
              </div>
            </label>
            {customerOptions.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-none border border-white/5 bg-[#0F0F0F]">
                {customerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickCustomer(c)}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/4 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-white/4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-100">
                        {c.fullName || c.email}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                        {c.email}
                        {c.companyName ? ` · ${c.companyName}` : ""}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/8 bg-white/4 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                      {c.group.replace("B2B_", "B2B ")}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedCustomer ? (
              <div className="mt-3 rounded-none border border-blue-500/25 bg-blue-500/6 px-3 py-2 text-sm">
                <div className="font-medium text-zinc-100">{selectedCustomer.fullName}</div>
                <div className="mt-0.5 text-[11px] text-zinc-400">{selectedCustomer.email}</div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setManualEmail("");
                    setManualName("");
                  }}
                  className="mt-2 text-[11px] text-blue-300 hover:text-blue-200"
                >
                  Clear and use guest customer
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AdminInputField
                label="Email"
                value={manualEmail}
                onChange={setManualEmail}
                type="email"
              />
              <AdminInputField label="Customer name" value={manualName} onChange={setManualName} />
              <AdminInputField
                label="Phone (optional)"
                value={manualPhone}
                onChange={setManualPhone}
              />
              <AdminSelectField
                label="Currency"
                value={currency}
                onChange={(v) => setCurrency(v as typeof currency)}
                options={[
                  { value: "EUR", label: "EUR" },
                  { value: "USD", label: "USD" },
                  { value: "UAH", label: "UAH" },
                ]}
              />
            </div>
          </AdminInspectorCard>

          {/* Items */}
          <AdminInspectorCard
            title="Line items"
            description="Add products from the catalog. Override prices freely (negotiated B2B prices are typical here)."
          >
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">
                Search catalog
              </span>
              <div className="flex items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Product title, SKU, slug or brand"
                  className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
                />
              </div>
            </label>
            {productOptions.length > 0 ? (
              <div className="mt-2 max-h-72 overflow-auto rounded-none border border-white/5 bg-[#0F0F0F]">
                {productOptions.map((p) => {
                  const price =
                    currency === "EUR" ? p.priceEur : currency === "USD" ? p.priceUsd : p.priceUah;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="flex w-full items-center justify-between gap-3 border-b border-white/4 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-white/4"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-100">
                          {p.titleEn || p.titleUa}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {[p.brand, p.sku, p.slug].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-300 tabular-nums">
                        {price != null ? formatMoney(price, currency) : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="mt-4">
                <AdminTableShell>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Unit</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="w-12 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {items.map((it, idx) => (
                        <tr key={`${it.productSlug}-${idx}`} className="hover:bg-white/3">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={it.title}
                              onChange={(e) => updateLineItem(idx, { title: e.target.value })}
                              className="w-full bg-transparent text-sm text-zinc-100 focus:outline-hidden"
                            />
                            <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
                              {it.productSlug}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) =>
                                updateLineItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })
                              }
                              className="w-16 rounded-none border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 focus:outline-hidden"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={it.price}
                              onChange={(e) =>
                                updateLineItem(idx, { price: parseFloat(e.target.value) || 0 })
                              }
                              className="w-24 rounded-none border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 focus:outline-hidden"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-zinc-100 tabular-nums">
                            {formatMoney(it.price * it.quantity, currency)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeLineItem(idx)}
                              className="rounded-none p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AdminTableShell>
              </div>
            ) : (
              <div className="mt-3 rounded-none border border-dashed border-white/8 px-4 py-6 text-center text-xs text-zinc-500">
                No items yet. Search catalog and add products above.
              </div>
            )}
          </AdminInspectorCard>

          <AdminInspectorCard
            title="Quote settings"
            description="Validity, shipping, internal note."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField
                label={`Shipping (${currency})`}
                value={shippingCost}
                onChange={setShippingCost}
                type="number"
                step="0.01"
              />
              <AdminInputField
                label="Valid until"
                value={validUntil}
                onChange={setValidUntil}
                type="datetime-local"
              />
            </div>
            <div className="mt-4">
              <AdminTextareaField
                label="Internal note"
                value={internalNote}
                onChange={setInternalNote}
                rows={3}
              />
            </div>
          </AdminInspectorCard>
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Summary" description="Quote totals.">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-none border border-white/4 bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Items</span>
                <span className="font-medium text-zinc-200 tabular-nums">{items.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-none border border-white/4 bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium text-zinc-200 tabular-nums">
                  {formatMoney(subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-none border border-white/4 bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Shipping</span>
                <span className="font-medium text-zinc-200 tabular-nums">
                  {formatMoney(parseFloat(shippingCost) || 0, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-none border border-blue-500/30 bg-blue-500/6 px-3 py-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Total
                </span>
                <span className="text-base font-bold text-blue-200 tabular-nums">
                  {formatMoney(total, currency)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || items.length === 0 || !manualEmail || !manualName}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Creating…" : "Create draft"}
            </button>
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}
