'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, AlertCircle, ArrowLeft, Plus, Trash2 } from 'lucide-react';

export default function AdminNewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    customerEmail: '',
    currency: 'EUR',
    deliveryMethod: 'SPECIAL_DELIVERY',
    shippingCost: '0.00',
  });

  const [items, setItems] = useState([
    { id: 1, title: '', price: '', quantity: 1 }
  ]);

  const subtotal = items.reduce((acc, current) => {
    return acc + (parseFloat(current.price || '0') * current.quantity);
  }, 0);

  const total = subtotal + parseFloat(formData.shippingCost || '0');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.title || !i.price)) {
      setError('Всі товари повинні мати назву та ціну');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/shop/orders/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create draft order');
      }

      router.push(`/admin/shop/orders/${data.orderId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin/shop/orders"
          className="mb-8 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до замовлень
        </Link>
        
        <h1 className="mb-2 text-3xl font-light tracking-tight text-white drop-border border-white/5">Нове ручне замовлення (Draft)</h1>
        <p className="mb-10 text-sm text-white/40 leading-relaxed max-w-2xl">
          Створіть замовлення вручну для клієнта. Введіть існуючий Email клієнта та додайте товари.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-none bg-blue-950/30 border border-red-900/50 text-blue-500/10 p-4 text-sm text-blue-500 border border-blue-500/20">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-8 transition-all hover:border-blue-500/20 group">
            <h2 className="text-lg font-medium tracking-wide text-white mb-6">Деталі клієнта та замовлення</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50 group-hover:text-zinc-500 transition-colors">Email клієнта *</span>
                <input
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={e => setFormData(p => ({ ...p, customerEmail: e.target.value }))}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                  placeholder="Обов'язково має бути зареєстрований"
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Валюта замовлення</span>
                <select
                  value={formData.currency}
                  onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="UAH">UAH (₴)</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Спосіб доставки</span>
                <select
                  value={formData.deliveryMethod}
                  onChange={e => setFormData(p => ({ ...p, deliveryMethod: e.target.value }))}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                >
                  <option value="SPECIAL_DELIVERY">Спецдоставка (Special)</option>
                  <option value="NOVA_POSHTA">Нова Пошта</option>
                  <option value="PICKUP">Самовивіз</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Вартість доставки ({formData.currency})</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shippingCost}
                  onChange={e => setFormData(p => ({ ...p, shippingCost: e.target.value }))}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>
            </div>
          </div>

          <div className="rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-8 hover:border-blue-500/20 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium tracking-wide text-white">Товари (Draft Items)</h2>
              <button
                type="button"
                onClick={() => setItems(p => [...p, { id: Date.now(), title: '', price: '', quantity: 1 }])}
                className="flex items-center gap-1.5 text-[13px] tracking-wide font-medium text-zinc-400 hover:text-zinc-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-all duration-300"
              >
                <Plus className="w-4 h-4" /> Додати рядок
              </button>
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Назва товару (або артикул)"
                      required
                      value={item.title}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].title = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-full rounded-none border border-white/[0.06] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      placeholder="Ціна"
                      required
                      step="0.01"
                      min="0"
                      value={item.price}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].price = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-full rounded-none border border-white/[0.06] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="К-ть"
                      required
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[index].quantity = parseInt(e.target.value) || 1;
                        setItems(newItems);
                      }}
                      className="w-full rounded-none border border-white/[0.06] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner text-center"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems(p => p.filter((_, i) => i !== index))}
                      className="mt-3 text-blue-500/50 hover:text-blue-400 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 border-t border-white/[0.06] pt-6 flex flex-col items-end">
              <div className="text-[13px] text-white/40 mb-2 tracking-wide">Підсумок товарів: <span className="text-white/80">{subtotal.toFixed(2)} {formData.currency}</span></div>
              <div className="text-2xl font-light text-white tracking-tight drop-border border-white/5">До сплати: {total.toFixed(2)} {formData.currency}</div>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_18px_rgba(59,130,246,0.5)] hover:from-blue-400 hover:to-blue-600 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                'Обробка...'
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Створити Замовлення
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
