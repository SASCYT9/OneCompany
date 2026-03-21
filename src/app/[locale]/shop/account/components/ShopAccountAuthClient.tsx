'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import type { SupportedLocale } from '@/lib/seo';
import { sanitizeNextPath } from '@/lib/safeRedirect';

type Mode = 'login' | 'register';

type Props = {
  locale: SupportedLocale;
  mode: Mode;
};

function baseCopy(locale: SupportedLocale, mode: Mode) {
  const isUa = locale === 'ua';
  if (mode === 'login') {
    return {
      eyebrow: isUa ? 'Акаунт клієнта' : 'Customer account',
      title: isUa ? 'Вхід у shop account' : 'Shop account login',
      subtitle: isUa
        ? 'Увійдіть, щоб бачити свій кошик, замовлення та B2B статус.'
        : 'Sign in to access your cart, orders, and B2B status.',
      submit: isUa ? 'Увійти' : 'Sign in',
      altHref: `/${locale}/shop/account/register`,
      altLabel: isUa ? 'Створити акаунт' : 'Create account',
    };
  }

  return {
    eyebrow: isUa ? 'Новий акаунт' : 'New account',
    title: isUa ? 'Створити shop account' : 'Create shop account',
    subtitle: isUa
      ? 'Після реєстрації ви зможете подати B2B заявку з кабінету.'
      : 'After registration you can apply for B2B access from your account.',
    submit: isUa ? 'Зареєструватися' : 'Create account',
    altHref: `/${locale}/shop/account/login`,
    altLabel: isUa ? 'У мене вже є акаунт' : 'I already have an account',
  };
}

export default function ShopAccountAuthClient({ locale, mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = baseCopy(locale, mode);
  const isUa = locale === 'ua';
  const nextHref = sanitizeNextPath(searchParams.get('next'), `/${locale}/shop/account`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  async function handleLogin() {
    const result = await signIn('credentials', {
      redirect: false,
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });

    if (!result?.ok) {
      throw new Error(isUa ? 'Невірний email або пароль' : 'Invalid email or password');
    }

    await fetch('/api/shop/cart');
    router.push(nextHref);
    router.refresh();
  }

  async function handleRegister() {
    if (form.password !== form.confirmPassword) {
      throw new Error(isUa ? 'Паролі не співпадають' : 'Passwords do not match');
    }

    const registerResponse = await fetch('/api/shop/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        password: form.password,
        preferredLocale: locale,
      }),
    });
    const registerData = await registerResponse.json().catch(() => ({}));
    if (!registerResponse.ok) {
      throw new Error(registerData.error || (isUa ? 'Не вдалося створити акаунт' : 'Failed to create account'));
    }

    await handleLogin();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'login') {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (submitError) {
      setError((submitError as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-28 sm:px-6">
        <div className="w-full rounded-[30px] border border-white/10 bg-white/[0.05] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">{copy.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-light tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm text-white/55">{copy.subtitle}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === 'register' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label={isUa ? 'Ім’я' : 'First name'}
                  value={form.firstName}
                  onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
                />
                <InputField
                  label={isUa ? 'Прізвище' : 'Last name'}
                  value={form.lastName}
                  onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
                />
              </div>
            ) : null}

            <InputField
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />

            {mode === 'register' ? (
              <InputField
                label={isUa ? 'Телефон' : 'Phone'}
                value={form.phone}
                onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              />
            ) : null}

            <InputField
              label={isUa ? 'Пароль' : 'Password'}
              type="password"
              value={form.password}
              onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            />

            {mode === 'register' ? (
              <InputField
                label={isUa ? 'Підтвердіть пароль' : 'Confirm password'}
                type="password"
                value={form.confirmPassword}
                onChange={(value) => setForm((current) => ({ ...current, confirmPassword: value }))}
              />
            ) : null}

            {error ? <div className="rounded-xl bg-red-900/20 px-4 py-3 text-sm text-red-200">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-white px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {submitting ? (isUa ? 'Зачекайте…' : 'Please wait…') : copy.submit}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4 text-sm text-white/50">
            <Link href={`/${locale}/shop/urban/collections`} className="hover:text-white">
              {isUa ? '← До колекцій Urban' : '← Back to Urban collections'}
            </Link>
            <Link href={copy.altHref} className="hover:text-white">
              {copy.altLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function InputField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-white/45">{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 focus:border-white/35 focus:outline-none"
        required
      />
    </label>
  );
}
