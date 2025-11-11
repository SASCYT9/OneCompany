'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

interface MediaItem {
  id: string;
  kind: string;
  filename: string;
  url: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

export default function AdminMediaPage() {
  const { locale } = useLanguage();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fileInput = e.currentTarget.file as unknown as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setUploading(true); setError(null); setSuccess(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload error');
      setSuccess(locale==='ua' ? 'Завантажено' : 'Uploaded');
      (e.target as HTMLFormElement).reset();
      await refresh();
    } catch (err:any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(locale==='ua' ? 'Видалити файл?' : 'Delete file?')) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: 'DELETE', headers: { 'x-admin-secret': secret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e:any) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-wide mb-6">{locale==='ua' ? 'Медіа Адмін' : 'Media Admin'}</h1>
      <p className="text-sm text-white/60 mb-8 max-w-prose">
        {locale==='ua' ? 'Завантажуй відео та зображення. Використовується простий файловий маніфест. Не для масового CDN.' : 'Upload videos and images. Simple filesystem manifest (not for massive CDN scale).'}
      </p>

      <div className="mb-10 p-6 rounded-xl border border-white/10 bg-white/5">
        <form onSubmit={handleUpload} className="space-y-4" autoComplete="off">
          <input
            type="password"
            name="secret"
            placeholder={locale==='ua' ? 'Адмін секрет' : 'Admin secret'}
            value={secret}
            onChange={e => setSecret(e.target.value)}
            className="w-full bg-white/5 text-white px-4 py-3 rounded-md border border-white/10 focus:border-white/30 outline-none text-sm"
            required
          />
          <input
            type="file"
            name="file"
            accept="video/*,image/*"
            className="w-full text-sm text-white/80"
            required
          />
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-3 rounded-full bg-white text-black text-sm tracking-wide font-medium disabled:opacity-50"
          >{uploading ? (locale==='ua' ? 'Завантаження…' : 'Uploading…') : (locale==='ua' ? 'Завантажити' : 'Upload')}</button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-emerald-400 text-xs">{success}</p>}
        </form>
      </div>

      <div>
        <h2 className="text-xl font-medium mb-4">{locale==='ua' ? 'Файли' : 'Files'}</h2>
        {loading && <p className="text-white/50 text-sm">{locale==='ua' ? 'Завантаження…' : 'Loading…'}</p>}
        {!loading && items.length === 0 && <p className="text-white/40 text-sm">{locale==='ua' ? 'Немає файлів' : 'No files yet'}</p>}
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-4 p-4 rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.originalName}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.kind} • {(item.size/1024).toFixed(1)} KB • {new Date(item.uploadedAt).toLocaleString(locale==='ua'?'uk-UA':'en-US')}</p>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white underline mt-1 inline-block">{locale==='ua'?'Переглянути':'Open'}</a>
              </div>
              <button onClick={() => remove(item.id)} className="text-xs px-3 py-1.5 rounded-md bg-red-600/70 hover:bg-red-600 text-white">{locale==='ua'?'Видалити':'Delete'}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
