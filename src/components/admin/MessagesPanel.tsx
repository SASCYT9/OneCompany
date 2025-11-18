'use client';

import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  Inbox,
  MessageSquare,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

export type Message = {
  id: string;
  userName: string;
  userEmail: string;
  messageText: string;
  createdAt: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  replies: { replyText: string; repliedAt: string }[];
};

export type MessageStats = {
  total: number;
  new: number;
  read: number;
  replied: number;
};

const statusCopy: Record<string, { label: string; badge: string }> = {
  new: { label: 'Нове', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  read: { label: 'Прочитано', badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200' },
  replied: { label: 'Відповідь', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  archived: { label: 'Архів', badge: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-100' },
};

export default function MessagesPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<MessageStats>({ total: 0, new: 0, read: 0, replied: 0 });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState<'all' | Message['status']>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as Message[];
        setMessages(data);
        setSelectedMessage((prev) => {
          if (!prev) return null;
          const next = data.find((msg) => msg.id === prev.id);
          return next ?? null;
        });
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?stats=true', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as MessageStats;
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadMessages(), loadStats()]);
  }, [loadMessages, loadStats]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStatus = async (messageId: string, nextStatus: Message['status']) => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', messageId, status: nextStatus }),
      });
      if (res.ok) {
        await refresh();
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addReply',
          messageId: selectedMessage.id,
          replyText,
          recipientEmail: selectedMessage.userEmail,
          originalMessage: selectedMessage.messageText,
          userName: selectedMessage.userName,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Message;
        setReplyText('');
        await refresh();
        setSelectedMessage(updated);
      }
    } catch (error) {
      console.error('Failed to send reply', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Видалити це повідомлення без можливості відновлення?')) return;
    try {
      const res = await fetch(`/api/messages?id=${messageId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedMessage(null);
        await refresh();
      }
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (filter !== 'all' && msg.status !== filter) return false;
      if (search.trim()) {
        const needle = search.toLowerCase();
        return (
          msg.userName.toLowerCase().includes(needle) ||
          msg.userEmail.toLowerCase().includes(needle) ||
          msg.messageText.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [messages, filter, search]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Всього" value={stats.total} icon={<Inbox className="w-5 h-5" />} accent="border-white/20" />
        <StatCard label="Нові" value={stats.new} icon={<MessageSquare className="w-5 h-5" />} accent="border-blue-500/40" />
        <StatCard label="Прочитані" value={stats.read} icon={<CheckCircle className="w-5 h-5" />} accent="border-purple-500/40" />
        <StatCard label="З відповіддю" value={stats.replied} icon={<Send className="w-5 h-5" />} accent="border-green-500/40" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук по імені, e-mail або тексту"
              className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 pb-4 text-xs uppercase tracking-[0.3em] text-white/40">
            {['all', 'new', 'read', 'replied', 'archived'].map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value as typeof filter)}
                className={`flex-1 rounded-full border px-3 py-1 ${
                  filter === value ? 'border-white text-white' : 'border-transparent text-white/50'
                }`}
              >
                {value === 'all' ? 'Всі' : statusCopy[value]?.label ?? value}
              </button>
            ))}
          </div>
          <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            {filteredMessages.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                Немає повідомлень
              </div>
            )}
            {filteredMessages.map((msg) => (
              <motion.button
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (msg.status === 'new') {
                    updateStatus(msg.id, 'read');
                  }
                }}
                whileHover={{ x: 6 }}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  selectedMessage?.id === msg.id
                    ? 'border-white/60 bg-white/10'
                    : 'border-white/5 bg-white/5 hover:border-white/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{msg.userName}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em] ${statusCopy[msg.status]?.badge}`}>
                    {statusCopy[msg.status]?.label}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-white/60">{msg.messageText}</p>
                <p className="mt-2 text-[11px] text-white/40">{new Date(msg.createdAt).toLocaleString()}</p>
              </motion.button>
            ))}
          </div>
        </div>

        <div className={`fixed inset-0 z-50 bg-black lg:static lg:bg-transparent ${selectedMessage ? 'block' : 'hidden lg:block'}`}>
          <div className="h-full rounded-none border-0 bg-black p-6 lg:rounded-3xl lg:border lg:border-white/10 lg:bg-black/30 lg:backdrop-blur">
          <AnimatePresence mode="wait">
            {selectedMessage ? (
              <motion.div
                key={selectedMessage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex h-full flex-col"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedMessage(null)}
                      className="lg:hidden rounded-full border border-white/20 p-2 text-white/60 hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div>
                      <p className="text-lg font-light text-white">{selectedMessage.userName}</p>
                      <p className="text-sm text-white/50">{selectedMessage.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusButton
                      label="Read"
                      active={selectedMessage.status === 'read'}
                      onClick={() => updateStatus(selectedMessage.id, 'read')}
                    />
                    <StatusButton
                      label="Replied"
                      active={selectedMessage.status === 'replied'}
                      onClick={() => updateStatus(selectedMessage.id, 'replied')}
                    />
                    <StatusButton
                      label="Archive"
                      active={selectedMessage.status === 'archived'}
                      onClick={() => updateStatus(selectedMessage.id, 'archived')}
                    />
                    <button
                      onClick={() => deleteMessage(selectedMessage.id)}
                      className="rounded-full border border-red-500/40 p-2 text-red-400 hover:bg-red-500/10"
                      title="Видалити"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="hidden lg:block rounded-full border border-white/20 p-2 text-white/60 hover:bg-white/10"
                      title="Закрити"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-2">
                  <p className="whitespace-pre-wrap text-sm text-white/80">{selectedMessage.messageText}</p>

                  {selectedMessage.replies?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.4em] text-white/40">Історія відповідей</p>
                      {selectedMessage.replies.map((reply, index) => (
                        <div key={`${reply.repliedAt}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <p className="text-sm text-white/80">{reply.replyText}</p>
                          <p className="mt-2 text-[11px] text-white/40">{new Date(reply.repliedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={4}
                    placeholder={`Відповісти ${selectedMessage.userName}...`}
                    className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                  />
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      onClick={sendReply}
                      disabled={loading || !replyText.trim()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-2 text-xs uppercase tracking-[0.4em] text-white transition hover:border-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:border-white/20 disabled:text-white/40"
                    >
                      {loading ? 'Відправка...' : (<><Send className="h-4 w-4" /> Надіслати</>)}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-white/50"
              >
                <Inbox className="mb-4 h-10 w-10" />
                <p className="text-lg font-light">Оберіть повідомлення ліворуч</p>
                <p className="text-sm text-white/40">Щоб переглянути діалог та відповісти</p>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <div className={`rounded-2xl border ${accent ?? 'border-white/10'} bg-white/5 p-4 text-white backdrop-blur`}>
      <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-white/60">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-3xl font-light">{value}</p>
    </div>
  );
}

function StatusButton({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.3em] ${
        active ? 'border-white bg-white/10 text-white' : 'border-white/20 text-white/60 hover:border-white/40'
      }`}
    >
      {label}
    </button>
  );
}
