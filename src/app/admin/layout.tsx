'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

import AdminShell from '@/components/admin/AdminShell';
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
        if (!isMounted) {
          return;
        }
        setIsAuthenticated(Boolean(data.authenticated));
      } catch {
        if (!isMounted) {
          return;
        }
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
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
      // Keep local logout resilient to transient network failures.
    }

    setIsAuthenticated(false);
    setPassword('');
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm uppercase tracking-[0.2em] text-stone-500">
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,240,232,0.08),_transparent_26%),linear-gradient(180deg,#050505_0%,#000000_100%)] px-6">
        <div className="flex min-h-screen items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#0b0b0b]/95 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.45)]"
          >
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03]">
                <Lock className="h-8 w-8 text-stone-100" />
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-amber-100/55">OneCompany</div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-50">Admin Access</h1>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Luxury operations shell for catalog, orders, pricing, and internal tools.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@onecompany.local"
                  className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-100/20 focus:outline-none"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter admin password"
                  className="w-full rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-100/20 focus:outline-none"
                  required
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Enter admin'}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <AdminCurrencyProvider>
      <AdminShell onLogout={handleLogout}>{children}</AdminShell>
    </AdminCurrencyProvider>
  );
}
