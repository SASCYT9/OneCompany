"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/seo";

export default function ShopForgotPasswordClient({ locale }: { locale: SupportedLocale }) {
  const isUa = locale === "ua";
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/shop/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        setError(
          isUa
            ? "Забагато спроб скидання — спробуйте пізніше."
            : "Too many attempts — try again later."
        );
        return;
      }
      if (!response.ok) {
        setError(
          (data as { error?: string }).error ||
            (isUa ? "Помилка. Спробуйте ще раз." : "Something went wrong.")
        );
        return;
      }
      setSubmitted(true);
      setMessage(
        (data as { message?: string }).message ||
          (isUa
            ? "Якщо акаунт існує — лист надіслано."
            : "If the account exists, an email is on its way.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)]">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-24">
        <div className="w-full rounded-[28px] border border-foreground/10 bg-foreground/5 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/45">
            {isUa ? "Акаунт клієнта" : "Customer account"}
          </p>
          <h1 className="mt-3 text-3xl font-light tracking-tight">
            {isUa ? "Забули пароль?" : "Forgot password?"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground/75 dark:text-foreground/60">
            {isUa
              ? "Введіть email акаунта — надішлемо посилання для встановлення нового пароля."
              : "Enter your account email and we’ll send a link to set a new password."}
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-5 py-4 text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="you@example.com"
                />
              </label>

              {error ? (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full border border-primary bg-primary py-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground transition hover:bg-primary hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                {submitting
                  ? isUa
                    ? "Надсилаємо…"
                    : "Sending…"
                  : isUa
                    ? "Надіслати посилання"
                    : "Send reset link"}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </p>
              <p className="text-xs leading-5 text-foreground/65 dark:text-foreground/45">
                {isUa
                  ? "Перевірте папку «Спам», якщо лист не прийшов протягом кількох хвилин."
                  : "Check the spam folder if the email does not arrive within a few minutes."}
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between text-xs text-foreground/70 dark:text-foreground/55">
            <Link
              href={`/${locale}/shop/account/login`}
              className="hover:text-foreground transition"
            >
              ← {isUa ? "Назад до входу" : "Back to login"}
            </Link>
            <Link
              href={`/${locale}/shop/account/register`}
              className="hover:text-foreground transition"
            >
              {isUa ? "Створити акаунт" : "Create account"}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
