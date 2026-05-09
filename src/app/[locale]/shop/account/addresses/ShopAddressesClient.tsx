'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { SupportedLocale } from '@/lib/seo';
import { SHOP_COUNTRIES } from '@/lib/shopCountries';

type AddressDto = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string | null;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

type FormState = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

const EMPTY_FORM: FormState = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postcode: '',
  country: 'Ukraine',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

function toForm(address: AddressDto): FormState {
  return {
    label: address.label || '',
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region ?? '',
    postcode: address.postcode ?? '',
    country: address.country,
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  };
}

export default function ShopAddressesClient({
  locale,
  initialAddresses,
}: {
  locale: SupportedLocale;
  initialAddresses: AddressDto[];
}) {
  const isUa = locale === 'ua';
  const [addresses, setAddresses] = useState<AddressDto[]>(initialAddresses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setCreating(true);
  }

  function startEdit(address: AddressDto) {
    setCreating(false);
    setForm(toForm(address));
    setEditingId(address.id);
    setError('');
  }

  function cancel() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const body = {
        label: form.label.trim() || (isUa ? 'Доставка' : 'Shipping'),
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        region: form.region.trim() || null,
        postcode: form.postcode.trim() || null,
        country: form.country,
        isDefaultShipping: form.isDefaultShipping,
        isDefaultBilling: form.isDefaultBilling,
      };
      const url = editingId
        ? `/api/shop/account/addresses/${editingId}`
        : '/api/shop/account/addresses';
      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || (isUa ? 'Не вдалося зберегти адресу' : 'Failed to save address'));
        return;
      }
      await reload();
      cancel();
    } finally {
      setSubmitting(false);
    }
  }

  async function reload() {
    try {
      const response = await fetch('/api/shop/account/addresses');
      if (!response.ok) return;
      const data = (await response.json()) as { addresses: AddressDto[] };
      setAddresses(data.addresses);
    } catch {
      // ignore — keep last known state
    }
  }

  async function remove(addressId: string) {
    if (!window.confirm(isUa ? 'Видалити цю адресу?' : 'Delete this address?')) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/shop/account/addresses/${addressId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || (isUa ? 'Не вдалося видалити' : 'Failed to delete'));
        return;
      }
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6">
        <Link
          href={`/${locale}/shop/account`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {isUa ? 'Назад до акаунта' : 'Back to account'}
        </Link>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
              {isUa ? 'Акаунт клієнта' : 'Customer account'}
            </p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">
              {isUa ? 'Мої адреси' : 'My addresses'}
            </h1>
            <p className="mt-2 text-sm text-white/55">
              {isUa
                ? 'Зберігайте адреси доставки та білінгу. Дефолтна адреса підтягнеться у checkout автоматично.'
                : 'Save shipping and billing addresses. The default one is auto-applied at checkout.'}
            </p>
          </div>
          {!showForm ? (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
            >
              <Plus className="h-4 w-4" />
              {isUa ? 'Додати адресу' : 'Add address'}
            </button>
          ) : null}
        </header>

        {showForm ? (
          <section className="mb-10 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-medium text-white">
              {editingId ? (isUa ? 'Редагувати адресу' : 'Edit address') : isUa ? 'Нова адреса' : 'New address'}
            </h2>

            <div className="mt-4 space-y-4">
              <Field
                label={isUa ? 'Назва (наприклад «Дім», «Офіс»)' : 'Label (e.g. "Home", "Office")'}
                value={form.label}
                onChange={(v) => setForm((f) => ({ ...f, label: v }))}
              />
              <Field
                label={isUa ? 'Адреса (вулиця, будинок)' : 'Address (street, number)'}
                value={form.line1}
                onChange={(v) => setForm((f) => ({ ...f, line1: v }))}
                required
              />
              <Field
                label={isUa ? 'Квартира, офіс (необовʼязково)' : 'Apt, office (optional)'}
                value={form.line2}
                onChange={(v) => setForm((f) => ({ ...f, line2: v }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={isUa ? 'Місто' : 'City'}
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  required
                />
                <Field
                  label={isUa ? 'Область' : 'Region'}
                  value={form.region}
                  onChange={(v) => setForm((f) => ({ ...f, region: v }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={isUa ? 'Індекс' : 'Postcode'}
                  value={form.postcode}
                  onChange={(v) => setForm((f) => ({ ...f, postcode: v }))}
                />
                <label className="block">
                  <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {isUa ? 'Країна' : 'Country'}
                  </span>
                  <select
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white backdrop-blur-md transition-all focus:border-[#c29d59]/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[#c29d59]/50"
                  >
                    {SHOP_COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isUa ? c.ua : c.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-6 pt-2">
                <Toggle
                  label={isUa ? 'Дефолт для доставки' : 'Default shipping'}
                  checked={form.isDefaultShipping}
                  onChange={(v) => setForm((f) => ({ ...f, isDefaultShipping: v }))}
                />
                <Toggle
                  label={isUa ? 'Дефолт для білінгу' : 'Default billing'}
                  checked={form.isDefaultBilling}
                  onChange={(v) => setForm((f) => ({ ...f, isDefaultBilling: v }))}
                />
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="rounded-full border border-white bg-white px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {submitting
                    ? isUa
                      ? 'Збереження…'
                      : 'Saving…'
                    : editingId
                      ? isUa
                        ? 'Зберегти зміни'
                        : 'Save changes'
                      : isUa
                        ? 'Додати'
                        : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={submitting}
                  className="rounded-full border border-white/15 bg-transparent px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {isUa ? 'Скасувати' : 'Cancel'}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          {addresses.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/2 p-10 text-center text-white/55">
              <MapPin className="mx-auto mb-4 h-8 w-8 text-white/25" />
              <p>
                {isUa
                  ? 'Ще немає збережених адрес. Додайте першу — і вона зʼявиться у checkout.'
                  : 'No saved addresses yet. Add one and it will be available at checkout.'}
              </p>
            </div>
          ) : (
            addresses.map((address) => (
              <article
                key={address.id}
                className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/4 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-medium text-white">{address.label}</h3>
                    {address.isDefaultShipping ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                        <Star className="h-3 w-3" />
                        {isUa ? 'Доставка' : 'Shipping'}
                      </span>
                    ) : null}
                    {address.isDefaultBilling ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                        <Star className="h-3 w-3" />
                        {isUa ? 'Білінг' : 'Billing'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-white/75">{address.line1}</p>
                  {address.line2 ? <p className="text-sm text-white/55">{address.line2}</p> : null}
                  <p className="text-sm text-white/55">
                    {[address.city, address.region, address.postcode].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-sm text-white/55">{address.country}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(address)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isUa ? 'Редагувати' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(address.id)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isUa ? 'Видалити' : 'Delete'}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/45">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white placeholder:text-white/30 backdrop-blur-md transition-all focus:border-[#c29d59]/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[#c29d59]/50"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/30 bg-black accent-[#c29d59]"
      />
      {label}
    </label>
  );
}
