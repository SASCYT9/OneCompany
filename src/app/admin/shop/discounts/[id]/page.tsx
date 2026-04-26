'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Archive, ArrowLeft, Save } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
  AdminCheckboxField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { AdminActivityTimeline } from '@/components/admin/AdminActivityTimeline';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
type DiscountScope = 'CART' | 'PRODUCT' | 'COLLECTION' | 'SHIPPING';
type DiscountStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

type DiscountDetail = {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  scope: DiscountScope;
  status: DiscountStatus;
  value: number;
  currency: string | null;
  minOrderValue: number | null;
  customerGroups: string[] | null;
  productIds: string[] | null;
  collectionIds: string[] | null;
  excludeOnSale: boolean;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountPct: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usageCount: number;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  redemptions: Array<{
    id: string;
    orderId: string | null;
    customerId: string | null;
    email: string | null;
    amount: number;
    currency: string;
    redeemedAt: string;
  }>;
};

export default function AdminDiscountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const id = params?.id;

  const [discount, setDiscount] = useState<DiscountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Editable fields (mirror new page)
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DiscountStatus>('DRAFT');
  const [value, setValue] = useState('0');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [excludeOnSale, setExcludeOnSale] = useState(false);
  const [b2cAllowed, setB2cAllowed] = useState(true);
  const [b2bPendingAllowed, setB2bPendingAllowed] = useState(true);
  const [b2bApprovedAllowed, setB2bApprovedAllowed] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/discounts/${id}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as DiscountDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load');
        if (cancelled) return;
        setDiscount(data);
        setDescription(data.description ?? '');
        setStatus(data.status);
        setValue(String(data.value));
        setMinOrderValue(data.minOrderValue != null ? String(data.minOrderValue) : '');
        setUsageLimit(data.usageLimit != null ? String(data.usageLimit) : '');
        setUsageLimitPerUser(data.usageLimitPerUser != null ? String(data.usageLimitPerUser) : '');
        setValidFrom(data.validFrom ? data.validFrom.slice(0, 16) : '');
        setValidUntil(data.validUntil ? data.validUntil.slice(0, 16) : '');
        setExcludeOnSale(data.excludeOnSale);
        const groups = data.customerGroups ?? ['B2C', 'B2B_PENDING', 'B2B_APPROVED'];
        setB2cAllowed(groups.includes('B2C'));
        setB2bPendingAllowed(groups.includes('B2B_PENDING'));
        setB2bApprovedAllowed(groups.includes('B2B_APPROVED'));
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
  }, [id]);

  async function handleSave() {
    if (!discount) return;
    setSaving(true);
    setError('');
    try {
      const groups: string[] = [];
      if (b2cAllowed) groups.push('B2C');
      if (b2bPendingAllowed) groups.push('B2B_PENDING');
      if (b2bApprovedAllowed) groups.push('B2B_APPROVED');

      const payload = {
        description: description.trim() || null,
        status,
        value: discount.type === 'FREE_SHIPPING' ? 0 : parseFloat(value) || 0,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
        customerGroups: groups.length === 3 ? null : groups,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        usageLimitPerUser: usageLimitPerUser ? parseInt(usageLimitPerUser, 10) : null,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        excludeOnSale,
      };

      const response = await fetch(`/api/admin/shop/discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || 'Failed to save';
        setError(msg);
        toast.error('Could not save', msg);
        return;
      }
      toast.success('Discount saved');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!discount) return;
    const ok = await confirm({
      tone: 'danger',
      title: `Archive code ${discount.code}?`,
      description: 'The code becomes unredeemable. Past redemptions are preserved.',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/discounts/${discount.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Could not archive');
      return;
    }
    toast.success('Discount archived');
    router.push('/admin/shop/discounts');
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="space-y-3">
          <div className="h-3 w-20 motion-safe:animate-pulse rounded bg-white/[0.06]" />
          <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
          <div className="h-3.5 w-96 motion-safe:animate-pulse rounded bg-white/[0.04]" />
        </div>
      </AdminPage>
    );
  }

  if (!discount) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || 'Discount not found'}</AdminInlineAlert>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/admin/shop/discounts" className="inline-flex items-center gap-1 transition hover:text-zinc-300">
          <ArrowLeft className="h-3 w-3" />
          Back to discounts
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Marketing"
        title={discount.code}
        description={discount.description || 'Discount code editor — change conditions, status, and validity.'}
        actions={
          <>
            <AdminStatusBadge tone={status === 'ACTIVE' ? 'success' : status === 'ARCHIVED' || status === 'EXPIRED' ? 'danger' : 'warning'}>
              {status}
            </AdminStatusBadge>
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={discount.status === 'ARCHIVED'}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-950/20 px-4 py-2 text-sm text-red-300 transition hover:bg-red-950/40 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          </>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <AdminInspectorCard title="Settings" description="Status, description, and core value.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelectField
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as DiscountStatus)}
                options={[
                  { value: 'DRAFT', label: 'Draft' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'PAUSED', label: 'Paused' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
              />
              <AdminInputField
                label={discount.type === 'PERCENTAGE' ? 'Percent off' : discount.type === 'FIXED_AMOUNT' ? `Amount off (${discount.currency ?? 'EUR'})` : 'Value'}
                value={value}
                onChange={setValue}
                type="number"
                step="0.01"
                disabled={discount.type === 'FREE_SHIPPING' || discount.type === 'BUY_X_GET_Y'}
              />
            </div>
            <div className="mt-4">
              <AdminTextareaField label="Description" value={description} onChange={setDescription} rows={2} />
            </div>
          </AdminInspectorCard>

          <AdminInspectorCard title="Conditions" description="Limits on who and when this code can be used.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField label="Min order value" value={minOrderValue} onChange={setMinOrderValue} type="number" step="0.01" />
              <AdminInputField label="Total usage limit" value={usageLimit} onChange={setUsageLimit} type="number" min={1} />
              <AdminInputField label="Per-customer limit" value={usageLimitPerUser} onChange={setUsageLimitPerUser} type="number" min={1} />
              <AdminCheckboxField label="Exclude items on sale" checked={excludeOnSale} onChange={setExcludeOnSale} />
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer groups</div>
              <div className="flex flex-wrap gap-3">
                <AdminCheckboxField label="B2C" checked={b2cAllowed} onChange={setB2cAllowed} />
                <AdminCheckboxField label="B2B pending" checked={b2bPendingAllowed} onChange={setB2bPendingAllowed} />
                <AdminCheckboxField label="B2B approved" checked={b2bApprovedAllowed} onChange={setB2bApprovedAllowed} />
              </div>
            </div>
          </AdminInspectorCard>

          <AdminInspectorCard title="Validity window">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField label="Valid from" value={validFrom} onChange={setValidFrom} type="datetime-local" />
              <AdminInputField label="Valid until" value={validUntil} onChange={setValidUntil} type="datetime-local" />
            </div>
          </AdminInspectorCard>

          {discount.redemptions.length > 0 ? (
            <AdminInspectorCard title={`Redemptions · ${discount.redemptionCount}`} description="Recent uses of this code.">
              <div className="space-y-1.5">
                {discount.redemptions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-black/25 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate text-zinc-200">
                        {r.email || r.customerId || 'Guest'}
                      </div>
                      <div className="truncate text-zinc-600">
                        {r.orderId ? `Order ${r.orderId.slice(-8)}` : '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-medium text-emerald-300 tabular-nums">−{r.amount.toFixed(2)} {r.currency}</span>
                      <span className="text-zinc-600 tabular-nums">{new Date(r.redeemedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AdminInspectorCard>
          ) : null}
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Save" description="Apply changes immediately.">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </AdminInspectorCard>

          <AdminInspectorCard title="Stats">
            <AdminKeyValueGrid
              rows={[
                { label: 'Type', value: discount.type.replace(/_/g, ' ') },
                { label: 'Scope', value: discount.scope },
                { label: 'Usage', value: `${discount.usageCount}${discount.usageLimit ? ` / ${discount.usageLimit}` : ''}` },
                { label: 'Created', value: new Date(discount.createdAt).toLocaleDateString() },
                { label: 'Updated', value: new Date(discount.updatedAt).toLocaleDateString() },
              ]}
            />
          </AdminInspectorCard>

          <AdminInspectorCard title="Activity" description="Recent admin actions on this code.">
            <AdminActivityTimeline
              entityType="shop.discount"
              entityId={discount.id}
              emptyTitle="No activity yet"
              emptyDescription="Edits and status changes appear here."
            />
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}
