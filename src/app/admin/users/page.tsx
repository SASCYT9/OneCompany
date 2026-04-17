'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, X, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AdminRole = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Array<{ role: { id: string; name: string; key: string } }>;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    name: '',
    password: '',
    roleIds: [] as string[],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ]);
      if (!usersRes.ok) throw new Error('Failed to load access list');
      setUsers(await usersRes.json());
      if (rolesRes.ok) {
        setRoles(await rolesRes.json());
      }
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleRole = (roleId: string) => {
    setForm(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      setShowModal(false);
      setForm({ email: '', name: '', password: '', roleIds: [] });
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full px-4 md:px-12 py-8 pb-32 h-full overflow-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl tracking-tight text-white flex items-center gap-3">
            <Shield className="w-6 h-6 text-white/70" />
            Доступи та Адміністратори
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Керування індивідуальними обліковими записами менеджерів та їх ролями.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-none hover:bg-white/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Створити доступ
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-red-900/20 text-red-300 rounded-none border border-red-500/20 mb-6">
          {error}
        </div>
      ) : null}

      <div className="border border-white/10 bg-black/40 rounded-none overflow-hidden">
        {loading ? (
          <div className="p-6 text-white/50 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Завантаження бази...
          </div>
        ) : (
          <table className="w-full text-left text-sm text-white/80">
            <thead className="bg-white/5 border-b border-white/10 uppercase text-[10px] tracking-wider text-white/50">
              <tr>
                <th className="px-6 py-4 font-medium">Користувач</th>
                <th className="px-6 py-4 font-medium">Ролі</th>
                <th className="px-6 py-4 font-medium text-center">Статус</th>
                <th className="px-6 py-4 font-medium">Останній вхід</th>
                <th className="px-6 py-4 font-medium text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{user.name || 'Без імені'}</div>
                    <div className="text-white/50 text-[11px] mt-0.5">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length ? user.roles.map((r, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 border border-white/10 bg-white/5 rounded-none-full text-[10px] uppercase text-white/70">
                          {r.role.name}
                        </span>
                      )) : (
                        <span className="text-white/30 text-xs">Немає</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.isActive ? (
                      <span className="inline-flex items-center justify-center w-2 h-2 rounded-none-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-2 h-2 rounded-none-full bg-red-950/30 border border-red-900/50 text-red-500"></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-white/50 text-xs">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Ніколи'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[11px] uppercase tracking-wider text-white hover:text-zinc-400 transition-colors">
                      Редагувати
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/40">
                    Жодних адміністраторів не знайдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ Create Admin Modal ═══ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 bg-zinc-900 border border-white/10 rounded-none shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-lg font-medium text-white">Новий адміністратор</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="manager@onecompany.com.ua"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-none text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Ім&apos;я
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Олександр"
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-none text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">
                    Пароль *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Мінімум 6 символів"
                      className="w-full px-4 py-3 pr-12 bg-black/50 border border-white/10 rounded-none text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Roles */}
                {roles.length > 0 && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-white/40 mb-2 font-medium">
                      Ролі
                    </label>
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-none border cursor-pointer transition-colors ${
                            form.roleIds.includes(role.id)
                              ? 'border-indigo-500/40 bg-zinc-100 text-black/10'
                              : 'border-white/10 bg-black/30 hover:bg-white/5'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.roleIds.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-none border flex items-center justify-center transition-colors ${
                            form.roleIds.includes(role.id)
                              ? 'bg-zinc-100 text-black border-indigo-500'
                              : 'border-white/30'
                          }`}>
                            {form.roleIds.includes(role.id) && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="text-sm text-white font-medium">{role.name}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-wider">{role.key}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {createError && (
                  <div className="p-3 bg-red-900/20 text-red-300 rounded-none border border-red-500/20 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 text-sm text-white/60 hover:text-white border border-white/10 rounded-none hover:bg-white/5 transition-colors"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 text-sm font-medium bg-white text-black rounded-none hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Створення...
                      </>
                    ) : (
                      'Створити'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
