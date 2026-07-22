"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "Неверный email или пароль");
        return;
      }

      router.refresh();
    } catch {
      setError("Не удалось войти. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0A0A0A] px-4 py-8 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[140px]" />

      <section className="relative w-full max-w-[440px]" aria-labelledby="admin-login-title">
        <div className="mb-7 flex justify-center">
          <Image
            src="/branding/logo-light.svg"
            alt="OneCompany"
            width={200}
            height={48}
            className="h-11 w-auto"
            priority
          />
        </div>

        <div className="border border-white/[0.07] bg-[#121212] p-6 shadow-[0_50px_120px_rgba(0,0,0,0.6)] sm:p-9">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center bg-blue-600/15">
              <Lock className="h-6 w-6 text-blue-400" aria-hidden="true" />
            </div>
            <h1 id="admin-login-title" className="text-2xl font-semibold tracking-tight">
              Вход в админку
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Доступ определяется актуальными ролями сотрудника.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-xs font-medium text-zinc-400">
              <span className="mb-1.5 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full border border-white/8 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 outline-hidden transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                required
              />
            </label>

            <label className="block text-xs font-medium text-zinc-400">
              <span className="mb-1.5 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                Пароль
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full border border-white/8 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 outline-hidden transition focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                required
              />
            </label>

            {error ? (
              <div
                role="alert"
                className="border border-red-500/25 bg-red-950/25 px-4 py-3 text-sm text-red-100"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
            >
              <span>{loading ? "Проверяем…" : "Войти"}</span>
              {!loading ? (
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </form>

          <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Signed session · current DB roles
          </div>
        </div>
      </section>
    </main>
  );
}
