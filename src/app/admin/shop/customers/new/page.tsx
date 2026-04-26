'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, AlertCircle, ArrowLeft } from 'lucide-react';

export default function AdminNewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    group: 'B2C',
    isActive: true,
    preferredLocale: 'uk',
    preferredCurrency: 'EUR',
    b2bDiscountPercent: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/shop/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      router.push(`/admin/shop/customers/${data.customerId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin/shop/customers"
          className="mb-8 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до списку
        </Link>
        
        <h1 className="mb-2 text-3xl font-light tracking-tight text-white drop-border border-white/5">Реєстрація клієнта (B2B/VIP)</h1>
        <p className="mb-10 text-sm text-white/40 leading-relaxed max-w-2xl">
          Створіть профіль клієнта вручну, щоб оформлювати замовлення від його імені або надати знижки.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-none bg-blue-950/30 border border-red-900/50 text-blue-500/10 p-4 text-sm text-blue-500 border border-blue-500/20">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-8 transition-all hover:border-blue-500/20 group">
            <h2 className="text-lg font-medium tracking-wide text-white mb-6">Основні дані</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50 group-hover:text-zinc-500 transition-colors">Email *</span>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Телефон</span>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Ім&apos;я *</span>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Прізвище *</span>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>
              
              <label className="block md:col-span-2">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Назва компанії (Для B2B)</span>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>
            </div>
          </div>

          <div className="rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-8 transition-all hover:border-blue-500/20 group">
            <h2 className="text-lg font-medium tracking-wide text-white mb-6">Налаштування акаунту</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50 group-hover:text-zinc-500 transition-colors">Група доступу</span>
                <select
                  name="group"
                  value={formData.group}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                >
                  <option value="B2C">B2C (Звичайний)</option>
                  <option value="B2B_PENDING">B2B (На перевірці)</option>
                  <option value="B2B_APPROVED">B2B (VIP/Партнер)</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Відсоток знижки B2B (%)</span>
                <input
                  type="number"
                  name="b2bDiscountPercent"
                  min="0"
                  max="100"
                  value={formData.b2bDiscountPercent}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                />
              </label>
              
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Бажана Валюта</span>
                <select
                  name="preferredCurrency"
                  value={formData.preferredCurrency}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="UAH">UAH (₴)</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider font-medium text-white/50">Бажана Мова</span>
                <select
                  name="preferredLocale"
                  value={formData.preferredLocale}
                  onChange={handleChange}
                  className="w-full rounded-none border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all shadow-inner"
                >
                  <option value="uk">Українська</option>
                  <option value="en">English</option>
                </select>
              </label>

              <label className="flex items-center gap-3 pt-4 md:col-span-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-5 w-5 rounded-none border-white/10 bg-zinc-950 text-zinc-200 focus:ring-0"
                />
                <span className="text-sm text-white">Акаунт Активний</span>
              </label>
            </div>
          </div>

            <div className="flex justify-end pt-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_18px_rgba(59,130,246,0.5)] hover:from-blue-400 hover:to-blue-600 transition-all duration-300 disabled:opacity-50"
              >
                {loading ? (
                  'Створення...'
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Зареєструвати клієнта
                  </>
                )}
              </button>
            </div>
        </form>
      </div>
    </div>
  );
}
