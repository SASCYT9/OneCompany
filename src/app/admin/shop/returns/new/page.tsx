'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, PackageX, Save } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
  AdminCheckboxField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';

type OrderItem = {
  id: string;
  productSlug: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  customerGroupSnapshot: string;
  currency: string;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  items: OrderItem[];
};

type ReturnReason =
  | 'WRONG_ITEM'
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'NOT_AS_DESCRIBED'
  | 'CHANGED_MIND'
  | 'ORDERING_ERROR'
  | 'OTHER';

type ItemDraft = {
  selected: boolean;
  quantity: string;
  refundAmount: string;
  conditionNote: string;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function NewReturnPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const toast = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [reason, setReason] = useState<ReturnReason>('OTHER');
  const [reasonNote, setReasonNote] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [refundMethod, setRefundMethod] = useState<'NONE' | 'STRIPE_REFUND' | 'STORE_CREDIT' | 'BANK_TRANSFER' | 'REPLACEMENT'>('NONE');
  const [restockOnReceive, setRestockOnReceive] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('Missing orderId');
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/orders/${orderId}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as OrderDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load order');
        if (cancelled) return;
        setOrder(data);

        // Default refund method based on customer group
        if (data.customerGroupSnapshot.startsWith('B2B')) {
          setRefundMethod('STORE_CREDIT');
        } else if (data.paymentStatus === 'PAID') {
          setRefundMethod('STRIPE_REFUND');
        }

        const initial: Record<string, ItemDraft> = {};
        for (const it of data.items) {
          initial[it.id] = {
            selected: false,
            quantity: String(it.quantity),
            refundAmount: '0',
            conditionNote: '',
          };
        }
        setDrafts(initial);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  function updateDraft(itemId: string, patch: Partial<ItemDraft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  // Auto-suggest refund amount when item is checked
  function toggleSelected(item: OrderItem) {
    const cur = drafts[item.id];
    if (!cur) return;
    const nextSelected = !cur.selected;
    const qty = parseInt(cur.quantity, 10) || item.quantity;
    const suggestedRefund = nextSelected ? (item.price * qty).toFixed(2) : '0';
    updateDraft(item.id, { selected: nextSelected, refundAmount: suggestedRefund });
  }

  const totalRefund = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, it) => {
      const draft = drafts[it.id];
      if (!draft || !draft.selected) return sum;
      return sum + (parseFloat(draft.refundAmount) || 0);
    }, 0);
  }, [drafts, order]);

  const selectedCount = useMemo(() => {
    return Object.values(drafts).filter((d) => d.selected).length;
  }, [drafts]);

  async function handleSubmit() {
    if (!order) return;
    if (selectedCount === 0) {
      toast.warning('Select at least one item to return');
      return;
    }

    setSaving(true);
    try {
      const items = order.items
        .filter((it) => drafts[it.id]?.selected)
        .map((it) => {
          const draft = drafts[it.id];
          return {
            orderItemId: it.id,
            quantity: parseInt(draft.quantity, 10) || it.quantity,
            refundAmount: parseFloat(draft.refundAmount) || 0,
            reason,
            conditionNote: draft.conditionNote.trim() || null,
          };
        });

      const response = await fetch('/api/admin/shop/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          reason,
          reasonNote: reasonNote.trim() || null,
          customerNote: customerNote.trim() || null,
          refundMethod,
          restockOnReceive,
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error('Could not create RMA', data.error || 'Try again');
        return;
      }
      toast.success(`RMA created · ${data.rmaNumber}`);
      router.push(`/admin/shop/returns/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="space-y-3">
          <div className="h-3 w-20 motion-safe:animate-pulse rounded bg-white/[0.06]" />
          <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
        </div>
      </AdminPage>
    );
  }

  if (!order) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || 'Order not found'}</AdminInlineAlert>
        <Link
          href="/admin/shop/orders"
          className="mt-4 inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to orders
        </Link>
      </AdminPage>
    );
  }

  const isB2B = order.customerGroupSnapshot.startsWith('B2B');

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href={`/admin/shop/orders/${order.id}`}
          className="inline-flex items-center gap-1 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to order {order.orderNumber}
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Operations"
        title="New return / RMA"
        description={`Create a return request for order ${order.orderNumber} · ${order.customerName} · ${formatMoney(order.total, order.currency)}`}
        actions={
          isB2B ? (
            <span className="rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
              B2B → store credit / bank transfer
            </span>
          ) : (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              B2C → Stripe refund
            </span>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Item picker */}
          <AdminTableShell>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <PackageX className="h-4 w-4 text-amber-300" />
                Pick items being returned
              </h2>
              <p className="mt-1 text-xs text-zinc-500">Check items, set quantity, and adjust refund amount per line.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Original</th>
                    <th className="px-4 py-3 font-medium">Return qty</th>
                    <th className="px-4 py-3 font-medium">Refund amount</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {order.items.map((it) => {
                    const draft = drafts[it.id];
                    if (!draft) return null;
                    return (
                      <tr key={it.id} className={`align-top transition hover:bg-white/[0.03] ${draft.selected ? 'bg-blue-500/[0.04]' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={() => toggleSelected(it)}
                            className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-100">{it.title}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{it.productSlug}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          <div>{it.quantity} × {formatMoney(it.price, order.currency)}</div>
                          <div className="text-zinc-600">= {formatMoney(it.total, order.currency)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            max={it.quantity}
                            value={draft.quantity}
                            onChange={(e) => updateDraft(it.id, { quantity: e.target.value })}
                            disabled={!draft.selected}
                            className="w-20 rounded-[6px] border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={draft.refundAmount}
                            onChange={(e) => updateDraft(it.id, { refundAmount: e.target.value })}
                            disabled={!draft.selected}
                            className="w-24 rounded-[6px] border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={draft.conditionNote}
                            onChange={(e) => updateDraft(it.id, { conditionNote: e.target.value })}
                            disabled={!draft.selected}
                            placeholder="e.g. box damaged"
                            className="w-full rounded-[6px] border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/[0.03]">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Total refund
                    </td>
                    <td colSpan={2} className="px-4 py-3 font-bold text-emerald-300 tabular-nums">
                      {formatMoney(totalRefund, order.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </AdminTableShell>

          {/* Reason */}
          <AdminInspectorCard title="Reason for return" description="Choose the primary reason. Detailed notes go below.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelectField
                label="Reason"
                value={reason}
                onChange={(v) => setReason(v as ReturnReason)}
                options={[
                  { value: 'WRONG_ITEM', label: 'Wrong item shipped' },
                  { value: 'DAMAGED', label: 'Damaged in transit' },
                  { value: 'DEFECTIVE', label: 'Defective on arrival' },
                  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
                  { value: 'CHANGED_MIND', label: 'Customer changed mind' },
                  { value: 'ORDERING_ERROR', label: 'Customer ordering error' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
              <AdminSelectField
                label="Refund method"
                value={refundMethod}
                onChange={(v) => setRefundMethod(v as typeof refundMethod)}
                options={[
                  { value: 'NONE', label: 'None / replacement' },
                  { value: 'STRIPE_REFUND', label: 'Stripe refund (B2C)' },
                  { value: 'STORE_CREDIT', label: 'Store credit (B2B)' },
                  { value: 'BANK_TRANSFER', label: 'Bank transfer (B2B)' },
                  { value: 'REPLACEMENT', label: 'Replacement shipment' },
                ]}
              />
            </div>
            <div className="mt-4">
              <AdminTextareaField label="Reason note (internal)" value={reasonNote} onChange={setReasonNote} rows={2} />
            </div>
            <div className="mt-4">
              <AdminTextareaField label="Customer note" value={customerNote} onChange={setCustomerNote} rows={2} />
            </div>
            <div className="mt-4">
              <AdminCheckboxField label="Restock items on RECEIVED" checked={restockOnReceive} onChange={setRestockOnReceive} />
            </div>
          </AdminInspectorCard>
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Submit RMA" description="Creates the return in REQUESTED state. You can move it through the workflow next.">
            <div className="space-y-3">
              <div className="rounded-lg border border-white/[0.05] bg-[#171717] p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Items selected</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-50">{selectedCount}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Refund total</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{formatMoney(totalRefund, order.currency)}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || selectedCount === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Creating…' : 'Create RMA'}
              </button>
            </div>
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}

export default function AdminNewReturnPage() {
  return (
    <Suspense fallback={<AdminPage><div className="text-sm text-zinc-400">Loading…</div></AdminPage>}>
      <NewReturnPageContent />
    </Suspense>
  );
}
