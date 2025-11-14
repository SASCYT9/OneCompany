'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Search, CheckCircle, Send, Archive, Trash2, X, LogOut, Inbox, BarChart2, Mail, User } from 'lucide-react';

interface Message {
  id: string;
  userName: string;
  userEmail: string;
  messageText: string;
  createdAt: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  replies: { replyText: string; repliedAt: string }[];
}

interface Stats {
  total: number;
  new: number;
  read: number;
  replied: number;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, read: 0, replied: 0 });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      loadMessages();
      loadStats();
    }
  }, [status]);

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/messages?stats=true');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const updateStatus = async (messageId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', messageId, status: newStatus }),
      });
      if (response.ok) {
        loadMessages();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const sendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/messages', {
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
      if (response.ok) {
        setReplyText('');
        loadMessages();
        // Optimistically update the selected message to show the new reply
        const updatedMessage = await response.json();
        setSelectedMessage(updatedMessage);
        updateStatus(selectedMessage.id, 'replied');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
        setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити це повідомлення? Цю дію неможливо скасувати.')) return;

    try {
      const response = await fetch(`/api/messages?id=${messageId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSelectedMessage(null);
        loadMessages();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter !== 'all' && msg.status !== filter) return false;
    if (searchQuery && !msg.messageText.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !msg.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (status === "loading") {
    return <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center"><p>Loading Session...</p></div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <MessageSquare className="w-16 h-16 mx-auto mb-6 text-zinc-900 dark:text-white" />
            <h1 className="text-4xl font-light text-zinc-900 dark:text-white mb-4">
              Messages Dashboard
            </h1>
            <p className="text-zinc-600 dark:text-white/60">
              Вхід для адміністратора
            </p>
          </div>

          <button
            onClick={() => signIn('credentials')}
            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-light uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-white/90 transition-all"
          >
            Увійти
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="bg-white dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-white/10 p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <MessageSquare className="w-8 h-8 text-zinc-900 dark:text-white" />
            <div>
              <h1 className="text-xl font-light text-zinc-900 dark:text-white">
                Messages
              </h1>
              <p className="text-sm text-zinc-500 dark:text-white/50">
                {session?.user?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
                onClick={() => { loadMessages(); loadStats(); }}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors"
                title="Оновити"
            >
                <motion.div whileHover={{ rotate: 90 }}>
                    <Inbox className="w-5 h-5 text-zinc-500 dark:text-white/50" />
                </motion.div>
            </button>
            <button
                onClick={() => signOut()}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded transition-colors"
                title="Вийти"
            >
                <LogOut className="w-5 h-5 text-zinc-500 dark:text-white/50" />
            </button>
          </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Всього" value={stats.total} icon={BarChart2} color="blue" />
            <StatCard label="Нові" value={stats.new} icon={Mail} color="green" />
            <StatCard label="Прочитані" value={stats.read} icon={CheckCircle} color="purple" />
            <StatCard label="З відповіддю" value={stats.replied} icon={Send} color="orange" />
        </div>

        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Пошук..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all"
            />
          </div>
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-white/50">
              Повідомлень не знайдено
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <motion.div
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (msg.status === 'new') {
                    updateStatus(msg.id, 'read');
                  }
                }}
                className={`p-4 bg-white dark:bg-zinc-950 border cursor-pointer transition-all ${
                  selectedMessage?.id === msg.id
                    ? 'border-zinc-900 dark:border-white shadow-lg'
                    : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/30'
                }`}
                whileHover={{ x: 4 }}
              >
                <div className="flex justify-between items-start">
                  <p className="font-light text-zinc-800 dark:text-white">{msg.userName}</p>
                  <StatusBadge status={msg.status} />
                </div>
                <p className="text-sm text-zinc-500 dark:text-white/50 truncate mt-1">{msg.messageText}</p>
                <p className="text-xs text-zinc-400 dark:text-white/30 mt-2">{new Date(msg.createdAt).toLocaleString()}</p>
              </motion.div>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence>
            {selectedMessage ? (
              <motion.div
                key={selectedMessage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-sm"
              >
                <div className="p-4 border-b border-zinc-200 dark:border-white/10 flex justify-between items-center">
                  <div>
                    <h2 className="font-light text-lg text-zinc-900 dark:text-white">{selectedMessage.userName}</h2>
                    <p className="text-sm text-zinc-500 dark:text-white/50">{selectedMessage.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusButton status="read" onClick={() => updateStatus(selectedMessage.id, 'read')} active={selectedMessage.status === 'read'} />
                    <StatusButton status="replied" onClick={() => updateStatus(selectedMessage.id, 'replied')} active={selectedMessage.status === 'replied'} />
                    <StatusButton status="archived" onClick={() => updateStatus(selectedMessage.id, 'archived')} active={selectedMessage.status === 'archived'} />
                    <button onClick={() => deleteMessage(selectedMessage.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => setSelectedMessage(null)} className="p-2 text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="p-6 max-h-[calc(100vh-500px)] overflow-y-auto">
                  <p className="whitespace-pre-wrap text-zinc-700 dark:text-white/80">{selectedMessage.messageText}</p>
                  
                  {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                    <div className="mt-6 space-y-4">
                      <h3 className="text-sm font-bold text-zinc-500 dark:text-white/50 uppercase tracking-wider">Історія відповідей</h3>
                      {selectedMessage.replies.map((reply, index) => (
                        <div key={index} className="p-3 bg-zinc-50 dark:bg-zinc-900 border-l-2 border-zinc-300 dark:border-zinc-700">
                          <p className="text-sm text-zinc-600 dark:text-white/70 whitespace-pre-wrap">{reply.replyText}</p>
                          <p className="text-xs text-zinc-400 dark:text-white/40 mt-2">{new Date(reply.repliedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-white/10">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Відповісти ${selectedMessage.userName}...`}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all"
                    rows={4}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={sendReply}
                      disabled={loading || !replyText.trim()}
                      className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black font-light uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 hover:bg-zinc-800 dark:hover:bg-white/90 transition-all"
                    >
                      {loading ? 'Відправка...' : <> <Send className="w-4 h-4" /> Надіслати </>}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-white/50 text-center p-12">
                <Inbox className="w-16 h-16 mb-4" />
                <h2 className="text-xl font-light">Оберіть повідомлення</h2>
                <p>Оберіть повідомлення зі списку, щоб переглянути його тут.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color?: string }) {
  const colorClass = color === 'blue' ? 'text-blue-600' :
                     color === 'green' ? 'text-green-600' :
                     color === 'purple' ? 'text-purple-600' :
                     color === 'orange' ? 'text-orange-600' :
                     'text-zinc-900 dark:text-white';

  return (
    <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 flex items-center gap-4">
        <div className={`p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full`}>
            <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
        <div>
            <div className={`text-2xl font-light ${colorClass} mb-1`}>{value}</div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 dark:text-white/50">
                {label}
            </div>
        </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    new: { label: 'Нове', color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' },
    read: { label: 'Прочитано', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600' },
    replied: { label: 'Відповідь', color: 'bg-green-100 dark:bg-green-900/20 text-green-600' },
    archived: { label: 'Архів', color: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500' },
  };

  const { label, color } = config[status as keyof typeof config] || config.new;

  return (
    <span className={`px-2 py-1 text-xs uppercase tracking-wider font-semibold rounded-full ${color}`}>
      {label}
    </span>
  );
}

function StatusButton({ status, onClick, active }: { status: string; onClick: () => void; active: boolean }) {
  const config = {
    read: { label: 'Прочитано', icon: CheckCircle },
    replied: { label: 'Відповідь', icon: Send },
    archived: { label: 'Архів', icon: Archive },
  };

  const { label, icon: Icon } = config[status as keyof typeof config];

  return (
    <button
      onClick={onClick}
      className={`p-2 transition-colors rounded-full ${
        active
          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white'
          : 'text-zinc-500 dark:text-white/60 hover:bg-zinc-100 dark:hover:bg-zinc-900'
      }`}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
