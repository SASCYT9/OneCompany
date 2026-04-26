'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminPage,
  AdminPageHeader,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
  AdminCheckboxField,
} from '@/components/admin/AdminFormFields';
import { useToast } from '@/components/admin/AdminToast';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
type DiscountScope = 'CART' | 'PRODUCT' | 'COLLECTION' | 'SHIPPING';
type DiscountStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

function generateCode(): string {
  const adjectives = ['SUMMER', 'FLASH', 'VIP', 'EARLY', 'LOYAL', 'WINTER', 'B2B', 'AUTUMN', 'SPRING'];
  const numbers = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${numbers}`;
}

export default function AdminNewDiscountPage() {
  const router = useRouter();
  const toast = useToast();

  const [code, setCode] = useState(generateCode());
  const [description, setDescription] = useState('');
  const [type, setType] = useState<DiscountType>('PERCENTAGE');
  const [scope, setScope] = useState<DiscountScope>('CART');
  const [status, setStatus] = useState<DiscountStatus>('DRAFT');
  const [value, setValue] = useState('10');
  const [currency, setCurrency] = useState<string>('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [excludeOnSale, setExcludeOnSale] = useState(false);
  const [b2cAllowed, setB2cAllowed] = useState(true);
  const [b2bPendingAllowed, setB2bPendingAllowed] = useState(false);
  const [b2bApprovedAllowed, setB2bApprovedAllowed] = useState(true);
  const [buyQty, setBuyQty] = useState('1');
  const [getQty, setGetQty] = useState('1');
  const [getDiscountPct, setGetDiscountPct] = useState('100');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    setError('');
    try {
      const groups: string[] = [];
      if (b2cAllowed) groups.push('B2C');
      if (b2bPendingAllowed) groups.push('B2B_PENDING');
      if (b2bApprovedAllowed) groups.push('B2B_APPROVED');

      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        type,
        scope,
        status,
        value: type === 'FREE_SHIPPING' ? 0 : parseFloat(value) || 0,
        currency: type === 'FIXED_AMOUNT' && currency ? currency : null,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
        customerGroups: groups.length === 3 ? null : groups, // null = all
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        usageLimitPerUser: usageLimitPerUser ? parseInt(usageLimitPerUser, 10) : null,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        excludeOnSale,
        buyQuantity: type === 'BUY_X_GET_Y' ? parseInt(buyQty, 10) : null,
        getQuantity: type === 'BUY_X_GET_Y' ? parseInt(getQty, 10) : null,
        getDiscountPct: type === 'BUY_X_GET_Y' ? parseFloat(getDiscountPct) : null,
      };

      const response = await fetch('/api/admin/shop/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || 'Failed to create discount';
        setError(msg);
        toast.error('Could not create discount', msg);
        return;
      }
      toast.success('Discount created', `Code ${payload.code} is ready`);
      router.push(`/admin/shop/discounts/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  const valueLabel =
    type === 'PERCENTAGE'
      ? 'Percent off (0–100)'
      : type === 'FIXED_AMOUNT'
        ? `Fixed amount (${currency || 'EUR'})`
        : type === 'FREE_SHIPPING'
          ? 'Value (ignored — free shipping)'
          : 'Value (ignored — see BOGO settings below)';

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
        title="New discount code"
        description="Define a promo code with type, conditions, eligibility and validity window. Save as draft first; activate when ready."
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Identity */}
          <AdminInspectorCard title="Code & description" description="Customer-facing code and internal description.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-end gap-2">
                <AdminInputField label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
                <button
                  type="button"
                  onClick={() => setCode(generateCode())}
                  className="rounded-none border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-blue-300"
                  title="Generate a random code"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>
              <AdminSelectField
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as DiscountStatus)}
                options={[
                  { value: 'DRAFT', label: 'Draft (not redeemable)' },
                  { value: 'ACTIVE', label: 'Active (live)' },
                ]}
              />
            </div>
            <div className="mt-4">
              <AdminTextareaField
                label="Description (internal note)"
                value={description}
                onChange={setDescription}
                rows={2}
              />
            </div>
          </AdminInspectorCard>

          {/* Type and scope */}
          <AdminInspectorCard title="Discount type" description="Choose how the discount works. Conditions adapt to the selection.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelectField
                label="Type"
                value={type}
                onChange={(v) => setType(v as DiscountType)}
                options={[
                  { value: 'PERCENTAGE', label: 'Percentage off' },
                  { value: 'FIXED_AMOUNT', label: 'Fixed amount off' },
                  { value: 'FREE_SHIPPING', label: 'Free shipping' },
                  { value: 'BUY_X_GET_Y', label: 'Buy X, Get Y (BOGO)' },
                ]}
              />
              <AdminSelectField
                label="Applies to"
                value={scope}
                onChange={(v) => setScope(v as DiscountScope)}
                options={[
                  { value: 'CART', label: 'Whole cart' },
                  { value: 'PRODUCT', label: 'Specific products' },
                  { value: 'COLLECTION', label: 'Specific collections' },
                  { value: 'SHIPPING', label: 'Shipping cost' },
                ]}
              />
            </div>

            {type !== 'BUY_X_GET_Y' && type !== 'FREE_SHIPPING' ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <AdminInputField label={valueLabel} value={value} onChange={setValue} type="number" step="0.01" />
                {type === 'FIXED_AMOUNT' ? (
                  <AdminSelectField
                    label="Currency"
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      { value: '', label: 'Any currency (will convert)' },
                      { value: 'EUR', label: 'EUR' },
                      { value: 'USD', label: 'USD' },
                      { value: 'UAH', label: 'UAH' },
                    ]}
                  />
                ) : null}
              </div>
            ) : null}

            {type === 'BUY_X_GET_Y' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-none border border-blue-500/20 bg-blue-500/[0.05] p-3 text-xs text-blue-200">
                  Customer must buy <b>{buyQty || 'X'}</b> items, then gets <b>{getQty || 'Y'}</b> items at{' '}
                  <b>{getDiscountPct || '100'}% off</b>. The cheapest items will receive the discount.
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <AdminInputField label="Buy quantity" value={buyQty} onChange={setBuyQty} type="number" min={1} />
                  <AdminInputField label="Get quantity" value={getQty} onChange={setGetQty} type="number" min={1} />
                  <AdminInputField label="Discount on Get %" value={getDiscountPct} onChange={setGetDiscountPct} type="number" min={0} max={100} />
                </div>
              </div>
            ) : null}
          </AdminInspectorCard>

          {/* Conditions */}
          <AdminInspectorCard title="Conditions & eligibility" description="Restrict who, when and how often the code can be used.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField label="Min order value" value={minOrderValue} onChange={setMinOrderValue} type="number" step="0.01" />
              <AdminInputField label="Total usage limit" value={usageLimit} onChange={setUsageLimit} type="number" min={1} />
              <AdminInputField label="Per-customer limit" value={usageLimitPerUser} onChange={setUsageLimitPerUser} type="number" min={1} />
              <AdminCheckboxField
                label="Exclude items already on sale"
                checked={excludeOnSale}
                onChange={setExcludeOnSale}
              />
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

          {/* Validity */}
          <AdminInspectorCard title="Validity window" description="Optional start and end dates. Leave blank for always-on.">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInputField label="Valid from" value={validFrom} onChange={setValidFrom} type="datetime-local" />
              <AdminInputField label="Valid until" value={validUntil} onChange={setValidUntil} type="datetime-local" />
            </div>
          </AdminInspectorCard>
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Save" description="Drafts are not redeemable. Activate when ready.">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !code.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Create discount'}
            </button>
          </AdminInspectorCard>

          <AdminInspectorCard title="Preview" description="How customers see this code.">
            <div className="rounded-none border border-blue-500/25 bg-blue-500/[0.06] p-4">
              <div className="font-mono text-lg font-bold tracking-wider text-blue-200">{code}</div>
              <div className="mt-1 text-sm text-blue-300/80">
                {type === 'PERCENTAGE' && `${value}% off`}
                {type === 'FIXED_AMOUNT' && `${currency || 'EUR'}${value} off`}
                {type === 'FREE_SHIPPING' && 'Free shipping'}
                {type === 'BUY_X_GET_Y' && `Buy ${buyQty}, get ${getQty} at ${getDiscountPct}% off`}
              </div>
              {minOrderValue ? (
                <div className="mt-2 text-xs text-zinc-400">Min. order {minOrderValue}</div>
              ) : null}
            </div>
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}
