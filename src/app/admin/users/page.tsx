'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Plus } from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Array<{ role: { name: string; key: string } }>;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to load access list');
        setUsers(await response.json());
      } catch (err: any) {
        setError(err.message || 'Error loading data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors">
          <Plus className="w-4 h-4" />
          Створити доступ
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-red-900/20 text-red-300 rounded border border-red-500/20 mb-6">
          {error}
        </div>
      ) : null}

      <div className="border border-white/10 bg-black/40 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-white/50 text-center">Завантаження бази...</div>
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
                        <span key={i} className="inline-flex items-center px-2 py-0.5 border border-white/10 bg-white/5 rounded-full text-[10px] uppercase text-white/70">
                          {r.role.name}
                        </span>
                      )) : (
                        <span className="text-white/30 text-xs">Немає</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.isActive ? (
                      <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500"></span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-white/50 text-xs">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Ніколи'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[11px] uppercase tracking-wider text-white hover:text-indigo-400 transition-colors">
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
    </div>
  );
}
