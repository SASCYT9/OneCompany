"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ShopAccountSetupPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params?.locale === "ua" ? "ua" : "en";
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isUa = locale === "ua";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError(
        isUa
          ? "Посилання для встановлення пароля відсутнє або пошкоджене."
          : "The password setup link is missing or invalid."
      );
      return;
    }

    if (password.length < 8) {
      setError(
        isUa
          ? "Пароль має містити щонайменше 8 символів."
          : "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(isUa ? "Паролі не співпадають." : "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/shop/account/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!response.ok) {
        setError(
          response.status === 400 && /invalid or expired/i.test(data.error ?? "")
            ? isUa
              ? "Посилання недійсне або вже використане (діє 3 дні й лише один раз). Попросіть менеджера надіслати нове або скористайтеся «Забули пароль?»."
              : "This link is invalid or already used (valid for 3 days, once). Ask your manager for a new one or use “Forgot password?”."
            : isUa
              ? "Не вдалося зберегти пароль. Спробуйте ще раз."
              : "Could not save the password. Please try again."
        );
        return;
      }

      // Tell the customer which address is their login before sending them to sign in.
      setSuccess(
        isUa
          ? `Пароль встановлено. Ваш логін для входу — ${data.email ?? "ваш email"}.`
          : `Password set. Sign in with ${data.email ?? "your email"}.`
      );
      setTimeout(() => {
        router.push(`/${locale}/shop/account`);
      }, 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-black dark:bg-[radial-gradient(circle_at_top,rgba(194,157,89,0.14),transparent_55%)] px-6 py-24 text-foreground">
      <div className="mx-auto max-w-md rounded-none border border-foreground/10 bg-foreground/5 p-8 backdrop-blur-2xl">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.25em] text-foreground/60 dark:text-foreground/40">
            {isUa ? "Акаунт клієнта" : "Customer account"}
          </div>
          <h1 className="mt-3 text-3xl font-light tracking-tight">
            {isUa ? "Встановіть пароль" : "Set your password"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/75 dark:text-foreground/60">
            {isUa
              ? "Завершіть активацію акаунта, щоб увійти до кабінету й переглядати замовлення."
              : "Complete your account activation to sign in and view your orders."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-foreground/65 dark:text-foreground/45">
              {isUa ? "Новий пароль" : "New password"}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-none border border-foreground/10 bg-card dark:bg-zinc-950 px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-hidden"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-foreground/65 dark:text-foreground/45">
              {isUa ? "Підтвердіть пароль" : "Confirm password"}
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-none border border-foreground/10 bg-card dark:bg-zinc-950 px-4 py-3 text-sm text-foreground focus:border-foreground/30 focus:outline-hidden"
              autoComplete="new-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-none border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-none border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-none bg-primary px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading
              ? isUa
                ? "Зберігаємо..."
                : "Saving..."
              : isUa
                ? "Зберегти пароль"
                : "Save password"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-foreground/65 dark:text-foreground/45">
          <Link href={`/${locale}/shop/account`} className="hover:text-foreground">
            {isUa ? "Повернутися до входу" : "Back to sign in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
