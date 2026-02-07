'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Lock, LogOut, MessageSquare, Settings, ImagePlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
        body: JSON.stringify({ password }),
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
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
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
              className="w-full py-4 bg-white text-black text-sm uppercase tracking-widest font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-black font-sans text-sm tracking-normal overflow-hidden">
      <div className="flex-none border-b border-white/10 z-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Admin Panel
            </h1>
            <motion.button
              onClick={handleLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 text-white hover:bg-zinc-900 transition-colors text-xs font-medium rounded-lg border border-white/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </motion.button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-6">
            <TabLink href="/admin/messages" currentPath={pathname}>
              <MessageSquare className="w-4 h-4" />
              <span>Messages</span>
            </TabLink>
            <TabLink href="/admin/blog" currentPath={pathname}>
              <ImagePlus className="w-4 h-4" />
              <span>Blog</span>
            </TabLink>
            <TabLink href="/admin/settings" currentPath={pathname}>
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </TabLink>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {children}
      </div>
    </div>
  );
}

type TabLinkProps = {
  href: string;
  children: ReactNode;
  currentPath: string;
};

const TabLink = ({ href, children, currentPath }: TabLinkProps) => {
  const isActive = currentPath.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
        isActive
          ? 'border-white text-white'
          : 'border-transparent text-white/40 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
};
