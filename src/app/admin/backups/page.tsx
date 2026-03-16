'use client';

import { useEffect, useState } from 'react';

type BackupItem = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

export default function AdminBackupsPage() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/backups');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити список бекапів');
        return;
      }
      setItems(Array.isArray(data.items) ? (data.items as BackupItem[]) : []);
    } finally {
      setLoading(false);
    }
  }

  async function createBackup() {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/backups', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося створити бекап');
        return;
      }
      setSuccess('Бекап успішно створено.');
      await load();
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-4 md:px-8 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Бекапи бази даних</h2>
            <p className="mt-2 text-sm text-white/45">
              Ручні дампи PostgreSQL для магазину. Перед масовими змінами в каталозі, цінах або імпортом CSV варто зробити свіжий бекап.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
            >
              Оновити список
            </button>
            <button
              type="button"
              onClick={() => void createBackup()}
              disabled={creating}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              {creating ? 'Створюємо…' : 'Зробити бекап зараз'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {loading ? (
            <div className="py-8 text-sm text-white/60">Завантаження списку бекапів…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-sm text-white/50">
              Поки що немає жодного бекапу. Натисніть «Зробити бекап зараз», щоб створити перший дамп бази даних.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-white/60 font-medium">Файл</th>
                    <th className="px-4 py-3 text-white/60 font-medium">Розмір</th>
                    <th className="px-4 py-3 text-white/60 font-medium">Створено</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.filename} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-xs text-white/80">{item.filename}</td>
                      <td className="px-4 py-3 text-white/70">
                        {(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60 space-y-1">
          <p className="font-medium text-white/80">Як відновити з бекапу (інструкція для DevOps):</p>
          <p>• Бекапи зберігаються в папці `backups/` у корені проєкту на сервері.</p>
          <p>• Для відновлення використовуйте `psql` або `pg_restore` (залежно від формату дампу).</p>
          <p>• Перед відновленням бажано зупинити застосунок і зробити додатковий дамп поточного стану.</p>
        </div>
      </div>
    </div>
  );
}

