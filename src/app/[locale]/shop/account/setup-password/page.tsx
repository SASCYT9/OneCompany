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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Failed to set password");
        return;
      }

      setSuccess(
        isUa
          ? "Пароль успішно встановлено. Тепер увійдіть у свій акаунт."
          : "Password set successfully. You can now sign in to your account."
      );
      setTimeout(() => {
        router.push(`/${locale}/shop/account`);
      }, 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(circle_at_top,rgba(194,157,89,0.14),transparent_55%)] px-6 py-24 text-white">
      <div className="mx-auto max-w-md rounded-none border border-white/10 bg-white/3 p-8 backdrop-blur-2xl">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">
            {isUa ? "Акаунт клієнта" : "Customer account"}
          </div>
          <h1 className="mt-3 text-3xl font-light tracking-tight">
            {isUa ? "Встановіть пароль" : "Set your password"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            {isUa
              ? "Завершіть активацію акаунта, щоб увійти до кабінету й переглядати замовлення."
              : "Complete your account activation to sign in and view your orders."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">
              {isUa ? "Новий пароль" : "New password"}
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-none border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-hidden"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">
              {isUa ? "Підтвердіть пароль" : "Confirm password"}
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-none border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-hidden"
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
            className="w-full rounded-none bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-black transition hover:bg-white/90 disabled:opacity-50"
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

        <div className="mt-6 text-center text-xs text-white/45">
          <Link href={`/${locale}/shop/account`} className="hover:text-white">
            {isUa ? "Повернутися до входу" : "Back to sign in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
