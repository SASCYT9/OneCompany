'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Save, Trash2, Plus, Users, Percent, DollarSign, Loader2 } from 'lucide-react';

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
    if (!confirm('Видалити персональну націнку? Буде використовуватись націнка бренду.')) return;
    await fetch(`/api/admin/shop/pricing/customer-markups?customerId=${customerId}`, { method: 'DELETE' });
    setEditedMarkups(prev => { const n = { ...prev }; delete n[customerId]; return n; });
    await fetchData();
  }

  async function handleAddNew() {
    if (!newCustomer.customerId) return;
    setSaving(true);
    try {
      await fetch('/api/admin/shop/pricing/customer-markups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      setShowAddModal(false);
      setNewCustomer({ customerId: '', customerName: '', markupPct: 25, notes: '' });
      await fetchData();
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Завантаження...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/8 blur-[120px]" />

      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        <Link href="/admin/shop" className="group mb-8 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all duration-300">
          <ArrowLeft className="h-4 w-4 transform transition-transform group-hover:-translate-x-1" /> Назад
        </Link>

        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-500/80 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              Ціноутворення Клієнтів
            </h1>
            <p className="mt-2 text-sm text-white/40 max-w-lg">
              Персональна націнка для кожного CRM клієнта. Якщо не задана — використовується націнка бренду.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/shop/pricing/simulator"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs uppercase tracking-widest font-bold hover:bg-indigo-500/20 transition-all">
              <Calculator className="w-3.5 h-3.5" /> Симулятор ціни
            </Link>
            <Link href="/admin/shop/turn14/markups"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs uppercase tracking-widest font-medium hover:bg-amber-500/10 transition-all">
              <Percent className="w-3 h-3" /> Бренд Націнки
            </Link>
            <button onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-xs uppercase tracking-widest font-bold hover:bg-emerald-400 transition-all">
              <Plus className="w-3.5 h-3.5" /> Додати клієнта
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl border border-white/[0.08] bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Клієнтів з націнкою</div>
            <div className="text-2xl font-light text-white">{markups.length}</div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Середня націнка</div>
            <div className="text-2xl font-light text-emerald-400">
              {markups.length ? (markups.reduce((s, m) => s + m.markupPct, 0) / markups.length).toFixed(1) : 0}%
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/60 p-5">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">CRM Клієнтів</div>
            <div className="text-2xl font-light text-white">{airtableCustomers.length}</div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3">
          <Search className="w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук клієнта..."
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none" />
          <span className="text-[10px] text-white/20">{filtered.length} / {markups.length}</span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-white/20 text-sm">
            <Users className="w-12 h-12 mx-auto mb-4 text-white/10" />
            {markups.length === 0 ? 'Ще немає персональних націнок. Натисніть "Додати клієнта".' : 'Нічого не знайдено.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/60 backdrop-blur-2xl shadow-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Клієнт</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40 w-40">Націнка %</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Множник</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Нотатки</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40 w-24">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(m => {
                  const edited = editedMarkups[m.customerId];
                  const pct = edited?.markupPct ?? m.markupPct;
                  const notes = edited?.notes ?? m.notes ?? '';
                  const isEdited = !!edited;

                  return (
                    <tr key={m.id} className={`hover:bg-white/[0.02] transition-colors ${isEdited ? 'bg-emerald-500/[0.03]' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="font-medium text-white text-sm">{m.customerName}</div>
                        <div className="text-[10px] text-white/20 font-mono mt-0.5">{m.customerId}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max="100" step="1" value={pct}
                            onChange={e => handleEdit(m.customerId, 'markupPct', e.target.value)}
                            className="flex-1 h-1.5 appearance-none bg-white/10 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer" />
                          <input type="number" min="0" max="200" value={pct}
                            onChange={e => handleEdit(m.customerId, 'markupPct', e.target.value)}
                            className="w-16 bg-white/[0.03] border border-white/10 text-center text-sm text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500/30" />
                          <span className="text-white/30 text-xs">%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-emerald-400 text-sm font-mono">
                        ×{(1 + pct / 100).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <input value={notes} onChange={e => handleEdit(m.customerId, 'notes', e.target.value)}
                          placeholder="VIP, оптовик..."
                          className="w-full bg-transparent border-b border-white/5 text-sm text-white/60 placeholder-white/15 px-0 py-1 focus:outline-none focus:border-white/20" />
                      </td>
                      <td className="px-5 py-4">
                        <button onClick={() => handleDelete(m.customerId)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sticky save bar */}
        {hasChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl border border-emerald-500/20 bg-black/90 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <span className="text-xs text-white/50">
              {Object.keys(editedMarkups).length} змін
            </span>
            <button onClick={handleSaveAll} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-black text-xs uppercase tracking-widest font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Зберігаю...' : 'Зберегти все'}
            </button>
          </div>
        )}
        {saveMsg && (
          <div className="mt-4 text-center text-sm text-emerald-400">{saveMsg}</div>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#111] border border-white/10 w-full max-w-md p-6 rounded-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-white mb-5">Додати персональну націнку</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">CRM Клієнт *</label>
                <select value={newCustomer.customerId}
                  onChange={e => {
                    const cust = availableCustomers.find(c => c.id === e.target.value);
                    setNewCustomer(prev => ({ ...prev, customerId: e.target.value, customerName: cust?.name || '' }));
                  }}
                  className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/30">
                  <option value="">Оберіть клієнта</option>
                  {availableCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Націнка %</label>
                <input type="number" min="0" max="200" value={newCustomer.markupPct}
                  onChange={e => setNewCustomer(prev => ({ ...prev, markupPct: Number(e.target.value) }))}
                  className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/30" />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Нотатки</label>
                <input value={newCustomer.notes} onChange={e => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="VIP, оптовик..."
                  className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-emerald-500/30" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest text-white/40 border border-white/10 rounded-xl hover:bg-white/5">
                Скасувати
              </button>
              <button onClick={handleAddNew} disabled={!newCustomer.customerId || saving}
                className="flex-1 text-center py-2.5 text-xs uppercase tracking-widest font-bold bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 disabled:opacity-50">
                {saving ? 'Зберігаю...' : 'Додати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
