'use client';

import { useEffect, useState, type ReactNode } from 'react';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';

import AdminShell from '@/components/admin/AdminShell';
import { AdminConfirmProvider } from '@/components/admin/AdminConfirmDialog';
import { AdminToastProvider } from '@/components/admin/AdminToast';
import { AdminCurrencyProvider } from '@/lib/admin/currencyContext';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthState() {
      try {
        const response = await fetch('/api/admin/auth', { cache: 'no-store' });
        const data = await response.json().catch(() => ({ authenticated: false }));
        if (!isMounted) return;
        setIsAuthenticated(Boolean(data.authenticated));
      } catch {
        if (!isMounted) return;
        setIsAuthenticated(false);
      } finally {
        if (isMounted) setAuthReady(true);
      }
    }

    void loadAuthState();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as { error?: string }).error || 'Invalid password');
        return;
      }

      setIsAuthenticated(true);
    } catch {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch {
      // resilient logout
    }
    setIsAuthenticated(false);
    setPassword('');
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 motion-safe:animate-ping rounded-full border border-blue-500/40" />
            <div className="relative h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.9)]" />
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Authenticating</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#0A0A0A]">
        {/* Subtle blue ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/[0.10] blur-[140px]" />
          <div className="absolute -right-32 bottom-1/4 h-[450px] w-[450px] rounded-full bg-blue-500/[0.06] blur-[120px]" />
        </div>

        {/* Hairline grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[440px]"
          >
            {/* Brand logo above card */}
            <div className="mb-8 flex justify-center">
              <Image
                src="/branding/logo-light.svg"
                alt="OneCompany"
                width={200}
                height={48}
                className="h-12 w-auto"
                priority
              />
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121212] shadow-[0_50px_120px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">
              {/* Top blue accent line */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

              <div className="p-9">
                <div className="mb-8 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 shadow-[inset_0_1px_0_rgba(96,165,250,0.2),0_8px_24px_rgba(59,130,246,0.2)]"
                  >
                    <Lock className="h-6 w-6 text-blue-400" strokeWidth={2} aria-hidden="true" />
                  </motion.div>

                  <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-50">
                    Welcome back
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Sign in to access your operations console.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                      <Mail className="h-3 w-3 text-blue-400" aria-hidden="true" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@onecompany.local"
                      autoComplete="email"
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-150 focus:border-blue-500/50 focus:bg-[#171717] focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
                      <Lock className="h-3 w-3 text-blue-400" aria-hidden="true" />
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-white/[0.08] bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-150 focus:border-blue-500/50 focus:bg-[#171717] focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                      required
                    />
                  </div>

                  {error ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      role="alert"
                      aria-live="assertive"
                      className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-sm text-red-100"
                    >
                      {error}
                    </motion.div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_18px_rgba(59,130,246,0.4)] transition-all duration-150 hover:bg-blue-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                        <span>Authenticating</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in</span>
                        <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  <span>Encrypted · Rate-limited · Audit logged</span>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center text-[11px] text-zinc-600">
              OneCompany · Premium Automotive Distribution
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <AdminToastProvider>
      <AdminConfirmProvider>
        <AdminCurrencyProvider>
          <AdminShell onLogout={handleLogout}>{children}</AdminShell>
        </AdminCurrencyProvider>
      </AdminConfirmProvider>
    </AdminToastProvider>
  );
}
