'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Save, Trash2, Plus, Users, Percent, DollarSign, Loader2, Calculator } from 'lucide-react';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

type CustomerMarkup = {
  id: string;
  customerId: string;
  customerName: string;
  markupPct: number;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
};

type AirtableCustomer = {
  id: string;
  name: string;
};

export default function CustomerPricingPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [markups, setMarkups] = useState<CustomerMarkup[]>([]);
  const [airtableCustomers, setAirtableCustomers] = useState<AirtableCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editedMarkups, setEditedMarkups] = useState<Record<string, { markupPct: number; notes: string }>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customerId: '', customerName: '', markupPct: 25, notes: '' });
  const [saveMsg, setSaveMsg] = useState('');

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/pricing/customer-markups');
      const data = await res.json();
      setMarkups(data.markups || []);
      setAirtableCustomers(data.airtableCustomers || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return markups;
    const q = search.toLowerCase();
    return markups.filter(m => m.customerName.toLowerCase().includes(q) || m.notes?.toLowerCase().includes(q));
  }, [markups, search]);

  // Available customers (not yet assigned a markup)
  const availableCustomers = useMemo(() => {
    const assigned = new Set(markups.map(m => m.customerId));
    return airtableCustomers.filter(c => !assigned.has(c.id));
  }, [markups, airtableCustomers]);

  function handleEdit(customerId: string, field: 'markupPct' | 'notes', value: string | number) {
    setEditedMarkups(prev => ({
      ...prev,
      [customerId]: {
        markupPct: field === 'markupPct' ? Number(value) : (prev[customerId]?.markupPct ?? markups.find(m => m.customerId === customerId)?.markupPct ?? 25),
        notes: field === 'notes' ? String(value) : (prev[customerId]?.notes ?? markups.find(m => m.customerId === customerId)?.notes ?? ''),
      },
    }));
  }

  const hasChanges = Object.keys(editedMarkups).length > 0;

  async function handleSaveAll() {
    setSaving(true);
    setSaveMsg('');
    try {
      for (const [customerId, edits] of Object.entries(editedMarkups)) {
        const existing = markups.find(m => m.customerId === customerId);
        await fetch('/api/admin/shop/pricing/customer-markups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            customerName: existing?.customerName || '',
            markupPct: edits.markupPct,
            notes: edits.notes,
          }),
        });
      }
      setEditedMarkups({});
      setSaveMsg(`Збережено ${Object.keys(editedMarkups).length} змін`);
      await fetchData();
    } catch (err: any) {
      setSaveMsg('Помилка: ' + err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(customerId: string) {
    const ok = await confirm({
      tone: 'warning',
      title: 'Видалити персональну націнку?',
      description: 'Для цього клієнта буде використовуватись націнка бренду за замовчуванням.',
      confirmLabel: 'Видалити',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/pricing/customer-markups?customerId=${customerId}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Не вдалося видалити націнку');
      return;
    }
    setEditedMarkups(prev => { const n = { ...prev }; delete n[customerId]; return n; });
    await fetchData();
    toast.success('Персональну націнку видалено');
  }

  async function handleAddNew() {
    if (!newCustomer.customerId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/shop/pricing/customer-markups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error('Не вдалося додати націнку', data.error);
        return;
      }
      const customerLabel = newCustomer.customerName || newCustomer.customerId;
      setShowAddModal(false);
      setNewCustomer({ customerId: '', customerName: '', markupPct: 25, notes: '' });
      // Force fresh fetch with no-store so dropdown reflects new state immediately
      await fetchData();
      toast.success('Персональну націнку додано', `Клієнт ${customerLabel}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Завантаження customer pricing…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Customer pricing"
        description="Персональна націнка для кожного CRM клієнта. Якщо її не задано, storefront fallback бере брендове правило."
        actions={
          <>
            <Link
              href="/admin/shop/pricing/simulator"
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              <Calculator className="h-4 w-4" />
              Price simulator
            </Link>
            <Link
              href="/admin/shop/turn14/markups"
              className="inline-flex items-center gap-2 rounded-none border border-amber-300/20 bg-amber-500/10 px-4 py-2.5 text-sm text-blue-300 transition hover:bg-amber-500/15"
            >
              <Percent className="h-4 w-4" />
              Brand markups
            </Link>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Add customer
            </button>
          </>
        }
      />

      <AdminMetricGrid className="xl:grid-cols-3">
        <AdminMetricCard label="Customers with markup" value={markups.length} meta="CRM accounts with custom rule" tone="accent" />
        <AdminMetricCard
          label="Average markup"
          value={`${markups.length ? (markups.reduce((s, m) => s + m.markupPct, 0) / markups.length).toFixed(1) : 0}%`}
          meta="Mean custom markup across active records"
        />
        <AdminMetricCard label="CRM customers" value={airtableCustomers.length} meta="Total CRM customers available for assignment" />
      </AdminMetricGrid>

      {saveMsg ? (
        <AdminInlineAlert tone={saveMsg.startsWith('Помилка') ? 'error' : 'success'}>
          {saveMsg}
        </AdminInlineAlert>
      ) : null}

      <AdminActionBar className="bg-[#171717]">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Change set</div>
          <div className="text-sm text-zinc-300">
            {hasChanges ? `${Object.keys(editedMarkups).length} pending customer pricing changes` : 'All pricing rules are in sync'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
            <DollarSign className="h-3.5 w-3.5" />
            Pricing overrides
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 md:min-w-[280px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Пошук клієнта..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
        <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
          {filtered.length} / {markups.length} visible
        </div>
      </AdminFilterBar>

      {filtered.length === 0 ? (
        <AdminEmptyState
          title={markups.length === 0 ? 'Ще немає персональних націнок' : 'Нічого не знайдено'}
          description={
            markups.length === 0
              ? 'Створи перший customer-specific pricing rule, щоб перевизначити брендове ціноутворення для окремого CRM клієнта.'
              : 'Спробуй змінити пошуковий запит або очистити фільтр.'
          }
          action={
            markups.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add customer
              </button>
            ) : undefined
          }
        />
      ) : (
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-5 py-4 font-medium text-[11px] uppercase tracking-[0.18em] text-zinc-500">Клієнт</th>
                <th className="px-5 py-4 font-medium text-[11px] uppercase tracking-[0.18em] text-zinc-500 w-40">Націнка %</th>
                <th className="px-5 py-4 font-medium text-[11px] uppercase tracking-[0.18em] text-zinc-500">Множник</th>
                <th className="px-5 py-4 font-medium text-[11px] uppercase tracking-[0.18em] text-zinc-500">Нотатки</th>
                <th className="px-5 py-4 font-medium text-[11px] uppercase tracking-[0.18em] text-zinc-500 w-24">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(m => {
                const edited = editedMarkups[m.customerId];
                const pct = edited?.markupPct ?? m.markupPct;
                const notes = edited?.notes ?? m.notes ?? '';
                const isEdited = !!edited;

                return (
                  <tr key={m.id} className={`transition-colors hover:bg-white/[0.02] ${isEdited ? 'bg-emerald-500/[0.03]' : ''}`}>
                    <td className="px-5 py-4">
                      <div className="font-medium text-zinc-100 text-sm">{m.customerName}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{m.customerId}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={pct}
                          onChange={e => handleEdit(m.customerId, 'markupPct', e.target.value)}
                          className="flex-1 h-1.5 appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={pct}
                          onChange={e => handleEdit(m.customerId, 'markupPct', e.target.value)}
                          className="w-16 rounded-none border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm text-zinc-100 focus:border-amber-200/30 focus:outline-none"
                        />
                        <span className="text-xs text-zinc-500">%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-emerald-300">
                      ×{(1 + pct / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <input
                        value={notes}
                        onChange={e => handleEdit(m.customerId, 'notes', e.target.value)}
                        placeholder="VIP, оптовик..."
                        className="w-full border-b border-white/5 bg-transparent px-0 py-1 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(m.customerId)}
                        className="rounded-none border border-blue-500/20 p-2 text-zinc-400 transition hover:bg-blue-950/30 hover:text-blue-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md rounded-none border border-white/10 bg-[#111] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-5 text-sm font-medium text-zinc-100">Додати персональну націнку</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">CRM Клієнт *</label>
                <select value={newCustomer.customerId}
                  onChange={e => {
                    const cust = availableCustomers.find(c => c.id === e.target.value);
                    setNewCustomer(prev => ({ ...prev, customerId: e.target.value, customerName: cust?.name || '' }));
                  }}
                  className="w-full rounded-none border border-white/10 bg-[#171717] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-200/30 focus:outline-none">
                  <option value="">Оберіть клієнта</option>
                  {availableCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Націнка %</label>
                <input type="number" min="0" max="200" value={newCustomer.markupPct}
                  onChange={e => setNewCustomer(prev => ({ ...prev, markupPct: Number(e.target.value) }))}
                  className="w-full rounded-none border border-white/10 bg-[#171717] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-200/30 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Нотатки</label>
                <input value={newCustomer.notes} onChange={e => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="VIP, оптовик..."
                  className="w-full rounded-none border border-white/10 bg-[#171717] px-3.5 py-2.5 text-sm text-zinc-100 focus:border-amber-200/30 focus:outline-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-none border border-white/10 py-2.5 text-center text-xs uppercase tracking-[0.18em] text-zinc-400 transition hover:bg-white/5">
                Скасувати
              </button>
              <button onClick={handleAddNew} disabled={!newCustomer.customerId || saving}
                className="flex-1 rounded-none bg-zinc-100 py-2.5 text-center text-xs font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white disabled:opacity-50">
                {saving ? 'Зберігаю...' : 'Додати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
