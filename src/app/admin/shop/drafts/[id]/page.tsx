'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Copy, Send, Trash2, X } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { AdminActivityTimeline } from '@/components/admin/AdminActivityTimeline';

type DraftDetail = {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  customerId: string | null;
  customerGroupSnapshot: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  isDraft: boolean;
  draftQuoteToken: string | null;
  draftValidUntil: string | null;
  quoteSentAt: string | null;
  quoteAcceptedAt: string | null;
  quoteDeclinedAt: string | null;
  internalNote: string | null;
  customer: { id: string; firstName: string; lastName: string; email: string; group: string; companyName: string | null } | null;
  items: Array<{
    id: string;
    title: string;
    productSlug: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export default function AdminDraftDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [shippingCost, setShippingCost] = useState('0');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/drafts/${id}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as DraftDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load');
        if (cancelled) return;
        setDraft(data);
        setInternalNote(data.internalNote ?? '');
        setValidUntil(data.draftValidUntil ? data.draftValidUntil.slice(0, 16) : '');
        setShippingCost(String(data.shippingCost));
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
  }, [id, reloadKey]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/shop/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalNote: internalNote.trim() || null,
          validUntil: validUntil || null,
          shippingCost: parseFloat(shippingCost) || 0,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error('Could not save', data.error || 'Try again');
        return;
      }
      toast.success('Draft updated');
      setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendQuote() {
    if (!draft) return;
    const ok = await confirm({
      tone: 'warning',
      title: 'Mark quote as sent?',
      description: 'This records the send time. Use the share link to actually deliver the quote to the customer.',
      confirmLabel: 'Mark as sent',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/shop/drafts/${draft.id}?action=send-quote`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      toast.error('Could not mark sent');
      return;
    }
    toast.success('Quote marked as sent');
    setReloadKey((k) => k + 1);
  }

  async function handleConvert() {
    if (!draft) return;
    const ok = await confirm({
      tone: 'warning',
      title: `Convert ${draft.orderNumber} to active order?`,
      description: 'The draft becomes a real order in PENDING_PAYMENT. The customer will need to pay to fulfill.',
      confirmLabel: 'Convert to order',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/shop/drafts/${draft.id}?action=convert`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error('Could not convert', data.error || 'Try again');
      return;
    }
    toast.success(`${draft.orderNumber} converted to active order`);
    router.push(`/admin/shop/orders/${data.orderId}`);
  }

  async function handleDecline() {
    if (!draft) return;
    const ok = await confirm({
      tone: 'danger',
      title: `Decline quote ${draft.orderNumber}?`,
      description: 'The quote will be marked as declined. The draft stays in the system for reference.',
      confirmLabel: 'Decline',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/shop/drafts/${draft.id}?action=decline`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) {
      toast.error('Could not decline');
      return;
    }
    toast.success('Quote declined');
    setReloadKey((k) => k + 1);
  }

  async function handleDiscard() {
    if (!draft) return;
    const ok = await confirm({
      tone: 'danger',
      title: 'Discard this draft?',
      description: 'The draft will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Discard',
    });
    if (!ok) return;

    const response = await fetch(`/api/admin/shop/drafts/${draft.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Could not discard');
      return;
    }
    toast.success('Draft discarded');
    router.push('/admin/shop/drafts');
  }

  async function copyShareLink() {
    if (!draft || !draft.draftQuoteToken) return;
    const link = `${window.location.origin}/quote/${draft.draftQuoteToken}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Quote link copied', link);
    } catch {
      toast.error('Could not copy');
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

  if (!draft) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || 'Draft not found'}</AdminInlineAlert>
      </AdminPage>
    );
  }

  const stage = draft.quoteAcceptedAt
    ? { label: 'Accepted', tone: 'success' as const }
    : draft.quoteDeclinedAt
      ? { label: 'Declined', tone: 'danger' as const }
      : draft.quoteSentAt
        ? { label: 'Sent · awaiting', tone: 'warning' as const }
        : { label: 'Draft', tone: 'default' as const };

  const closed = Boolean(draft.quoteAcceptedAt || draft.quoteDeclinedAt);

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/shop/drafts" className="inline-flex items-center gap-1 transition hover:text-zinc-300">
          <ArrowLeft className="h-3 w-3" />
          Back to drafts
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Draft order"
        title={draft.orderNumber}
        description={`${draft.customerName} · ${draft.email}`}
        actions={
          <>
            <AdminStatusBadge tone={stage.tone}>{stage.label}</AdminStatusBadge>
            {draft.customerGroupSnapshot.startsWith('B2B') ? (
              <span className="rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                {draft.customerGroupSnapshot.replace('B2B_', 'B2B ')}
              </span>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Items */}
          <AdminTableShell>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-medium text-zinc-100">Line items</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Quote items with custom prices set when creating the draft.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit price</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {draft.items.map((it) => (
                    <tr key={it.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-100">{it.title}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{it.productSlug}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{it.quantity}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{formatMoney(it.price, draft.currency)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-100 tabular-nums">{formatMoney(it.total, draft.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={3} className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Subtotal
                    </td>
                    <td className="px-4 py-2 text-zinc-300 tabular-nums">{formatMoney(draft.subtotal, draft.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Shipping
                    </td>
                    <td className="px-4 py-2 text-zinc-300 tabular-nums">{formatMoney(draft.shippingCost, draft.currency)}</td>
                  </tr>
                  {draft.taxAmount > 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Tax
                      </td>
                      <td className="px-4 py-2 text-zinc-300 tabular-nums">{formatMoney(draft.taxAmount, draft.currency)}</td>
                    </tr>
                  ) : null}
                  <tr className="border-t border-white/10 bg-white/[0.03]">
                    <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Total
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-50 tabular-nums">{formatMoney(draft.total, draft.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </AdminTableShell>

          {/* Quote settings */}
          <AdminInspectorCard title="Quote settings" description="Validity, internal notes, shipping override.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField label="Valid until" value={validUntil} onChange={setValidUntil} type="datetime-local" />
              <AdminInputField label={`Shipping (${draft.currency})`} value={shippingCost} onChange={setShippingCost} type="number" step="0.01" />
            </div>
            <div className="mt-4">
              <AdminTextareaField label="Internal note (admin only)" value={internalNote} onChange={setInternalNote} rows={3} />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || closed}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </AdminInspectorCard>
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Workflow" description="Send the quote, convert to order, or decline.">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void copyShareLink()}
                disabled={!draft.draftQuoteToken}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy quote link
              </button>
              <button
                type="button"
                onClick={() => void handleSendQuote()}
                disabled={Boolean(draft.quoteSentAt) || closed}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500/[0.12] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {draft.quoteSentAt ? 'Sent' : 'Mark as sent'}
              </button>
              <button
                type="button"
                onClick={() => void handleConvert()}
                disabled={closed}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/[0.15] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Convert to order
              </button>
              <button
                type="button"
                onClick={() => void handleDecline()}
                disabled={closed}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/[0.12] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Mark declined
              </button>
              <button
                type="button"
                onClick={() => void handleDiscard()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Discard draft
              </button>
            </div>
          </AdminInspectorCard>

          <AdminInspectorCard title="Customer">
            <AdminKeyValueGrid
              rows={[
                { label: 'Name', value: draft.customerName },
                { label: 'Email', value: draft.email },
                { label: 'Group', value: draft.customerGroupSnapshot },
                { label: 'Company', value: draft.customer?.companyName || '—' },
              ]}
            />
            {draft.customerId ? (
              <Link
                href={`/admin/shop/customers/${draft.customerId}`}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/[0.06]"
              >
                Open customer profile
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </AdminInspectorCard>

          <AdminInspectorCard title="Timeline">
            <AdminKeyValueGrid
              rows={[
                { label: 'Created', value: new Date(draft.createdAt).toLocaleString() },
                { label: 'Updated', value: new Date(draft.updatedAt).toLocaleString() },
                { label: 'Quote sent', value: draft.quoteSentAt ? new Date(draft.quoteSentAt).toLocaleString() : '—' },
                { label: 'Accepted', value: draft.quoteAcceptedAt ? new Date(draft.quoteAcceptedAt).toLocaleString() : '—' },
                { label: 'Declined', value: draft.quoteDeclinedAt ? new Date(draft.quoteDeclinedAt).toLocaleString() : '—' },
              ]}
            />
          </AdminInspectorCard>

          <AdminInspectorCard title="Activity">
            <AdminActivityTimeline
              entityType="shop.order"
              entityId={draft.id}
              emptyTitle="No activity yet"
              emptyDescription="Edits and quote actions will appear here."
            />
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}
