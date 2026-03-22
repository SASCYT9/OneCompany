'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut, MessageSquare, Settings, ImagePlus, ShoppingBag, Package, Shield, LayoutDashboard, Database, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const isAuth = sessionStorage.getItem('adminAuth') === 'true';
    setIsAuthenticated(isAuth);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem('adminAuth', 'true');
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md rounded-3xl border border-white/5 bg-white/[0.01] p-8 backdrop-blur-xl shadow-2xl"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-900/50 mb-6">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-white mb-4">
              Admin Access
            </h1>
            <p className="text-sm font-normal text-white/50">
              Enter your password to continue
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs uppercase tracking-widest text-white/40 mb-3 font-medium">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors font-normal mb-8"
                placeholder="admin@onecompany.local"
                required
              />
              <label htmlFor="password" className="block text-xs uppercase tracking-widest text-white/40 mb-3 font-medium">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-0 py-3 bg-transparent border-b border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors font-normal"
                placeholder="Enter admin password"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-900/20 text-red-300 text-sm font-light"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-4 mt-4 bg-white text-black text-sm uppercase tracking-widest font-semibold hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 rounded-lg"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-950 via-black to-black font-sans text-sm tracking-normal overflow-hidden">
      <div className="flex-none border-b border-white/[0.06] z-20 bg-black/80 backdrop-blur-2xl">
        <div className="w-full px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] font-medium text-white/90 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                Admin · One Company
              </span>
              <span className="hidden text-xs text-white/40 md:inline">
                Catalogs, Orders, Integrations & VIPs
              </span>
            </div>
            <motion.button
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/60 text-white/70 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium rounded-lg border border-white/10 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Вийти
            </motion.button>
          </div>
        </div>
        <div className="w-full px-4 md:px-8">
          <div className="flex items-center gap-4 overflow-x-auto pb-1 text-[13px]">
            <TabLink href="/admin" currentPath={pathname} exactMatch>
              <LayoutDashboard className="w-4 h-4" />
              <span>Огляд</span>
            </TabLink>
            <TabLink href="/admin/messages" currentPath={pathname}>
              <MessageSquare className="w-4 h-4" />
              <span>Запити</span>
            </TabLink>
            <TabLink href="/admin/users" currentPath={pathname}>
              <Shield className="w-4 h-4" />
              <span>Доступи</span>
            </TabLink>
            <TabLink href="/admin/blog" currentPath={pathname}>
              <ImagePlus className="w-4 h-4" />
              <span>Блог</span>
            </TabLink>
            <TabLink href="/admin/shop" currentPath={pathname}>
              <ShoppingBag className="w-4 h-4" />
              <span>Магазин</span>
            </TabLink>
            <TabLink href="/admin/shop/orders" currentPath={pathname}>
              <Package className="w-4 h-4" />
              <span>Замовлення</span>
            </TabLink>
            <TabLink href="/admin/backups" currentPath={pathname}>
              <Package className="w-4 h-4" />
              <span>Бекапи</span>
            </TabLink>
            <TabLink href="/admin/settings" currentPath={pathname}>
              <Settings className="w-4 h-4" />
              <span>Системні налаштування</span>
            </TabLink>
            <TabLink href="/admin/crm" currentPath={pathname}>
              <Database className="w-4 h-4" />
              <span>CRM</span>
            </TabLink>
            <TabLink href="/admin/shop/turn14" currentPath={pathname}>
              <Layers className="w-4 h-4" />
              <span>Turn14</span>
            </TabLink>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

type TabLinkProps = {
  href: string;
  children: ReactNode;
  currentPath: string;
  exactMatch?: boolean;
};

const TabLink = ({ href, children, currentPath, exactMatch }: TabLinkProps) => {
  const isActive = exactMatch ? currentPath === href : currentPath.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 py-4 border-b-2 transition-all duration-300 px-1 ${
        isActive
          ? 'border-indigo-500 text-white font-medium drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]'
          : 'border-transparent text-white/40 hover:text-white/80 hover:border-white/10'
      }`}
    >
      {children}
    </Link>
  );
};
